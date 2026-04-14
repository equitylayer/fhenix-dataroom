import {
	getContract,
	toHex,
	hexToBytes,
	parseEventLogs,
	type Hash,
	type PublicClient,
	type WalletClient,
} from "viem";
import { SECRETS_VAULT_ABI } from "./abi";
import { getVaultAddress } from "./chains";
import { encryptSecret, decryptSecret, IV_BYTES } from "./crypto";
import type { ClientConfig, DecryptFheKeyFn, HexAddress, Namespace, SecretValue, Grantee } from "./types";
import { PERMANENT } from "./types";

export class SecretsVaultClient {
	private publicClient: PublicClient;
	private walletClient: WalletClient;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private contract: any;
	private decryptFheKey: DecryptFheKeyFn;
	private address: HexAddress;

	private constructor(
		publicClient: PublicClient,
		walletClient: WalletClient,
		vaultAddress: HexAddress,
		decryptFheKey: DecryptFheKeyFn,
	) {
		this.publicClient = publicClient;
		this.walletClient = walletClient;
		this.decryptFheKey = decryptFheKey;
		this.address = walletClient.account!.address as HexAddress;

		this.contract = getContract({
			address: vaultAddress,
			abi: SECRETS_VAULT_ABI,
			client: { public: publicClient, wallet: walletClient },
		});
	}

	static fromClients<P, W>(config: ClientConfig<P, W>): SecretsVaultClient {
		const vaultAddress = config.vaultAddress ?? getVaultAddress(config.chainId);
		return new SecretsVaultClient(
			config.publicClient as unknown as PublicClient,
			config.walletClient as unknown as WalletClient,
			vaultAddress,
			config.decryptFheKey,
		);
	}

	get account(): HexAddress {
		return this.address;
	}

	private get readOpts() {
		return { account: this.address };
	}

	private async waitAndCheck(hash: Hash, label: string) {
		const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status === "success") return receipt;

		let reason = "";
		try {
			const tx = await this.publicClient.getTransaction({ hash });
			await this.publicClient.call({
				to: tx.to!,
				data: tx.input,
				account: tx.from,
				blockNumber: receipt.blockNumber - 1n,
				value: tx.value,
				gas: tx.gas,
			});
		} catch (e) {
			reason = e instanceof Error ? e.message : String(e);
		}
		throw new Error(`${label} reverted on-chain (tx ${hash})${reason ? ": " + reason : ""}`);
	}

	async createNamespace(name: string): Promise<bigint> {
		const hash = await this.contract.write.createNamespace([name]);
		const receipt = await this.waitAndCheck(hash, "createNamespace");
		const events = parseEventLogs({
			abi: SECRETS_VAULT_ABI,
			logs: receipt.logs,
			eventName: "NamespaceCreated",
		});
		if (events.length > 0) {
			return events[0].args.namespaceId;
		}
		const count = await this.contract.read.namespaceCount();
		return count - 1n;
	}

	async getNamespace(namespaceId: bigint): Promise<Namespace> {
		const [owner, name, secretCount] = await this.contract.read.getNamespace([namespaceId], this.readOpts);
		return {
			id: namespaceId,
			owner: owner as HexAddress,
			name,
			secretCount,
		};
	}

	async listNamespaces(owner?: HexAddress): Promise<Namespace[]> {
		const target = owner ?? this.address;
		const ids = await this.contract.read.getNamespacesByOwner([target]);
		return Promise.all(ids.map((id: bigint) => this.getNamespace(id)));
	}

	async listSharedNamespaces(account?: HexAddress): Promise<Namespace[]> {
		const target = account ?? this.address;
		const ids = await this.contract.read.getNamespacesByGrantee([target]);
		return Promise.all(ids.map((id: bigint) => this.getNamespace(id)));
	}

	async setSecret(namespaceId: bigint, key: string, value: string): Promise<void> {
		// 1. Get namespace key
		const nsHandle = await this.contract.read.getNsKeyHandle([namespaceId], this.readOpts);
		const nsKeyHex = await this.decryptFheKey(nsHandle);

		// 2. Encrypt value with namespace key
		const encryptedNsValue = await encryptSecret(value, nsKeyHex);

		// 3. Try to encrypt with per-secret key (exists only for existing secrets)
		let encryptedValue: Uint8Array | null = null;
		try {
			const secretHandle = await this.contract.read.getSecretKeyHandle([namespaceId, key], this.readOpts);
			const secretKeyHex = await this.decryptFheKey(secretHandle);
			encryptedValue = await encryptSecret(value, secretKeyHex);
		} catch (e) {
			// Only SecretNotFound means "new secret, fall through to create flow".
			// Anything else (FHE decrypt failure, read revert, etc.) is a real bug we'd
			// otherwise silently turn into an unnecessary TX2.
			const msg = e instanceof Error ? e.message : String(e);
			const isNotFound = msg.includes("SecretNotFound");
			if (!isNotFound) {
				console.warn("[setSecret] per-secret encrypt step failed unexpectedly:", e);
			}
		}

		// 4. First TX: create or update the secret
		const hash = await this.contract.write.setSecret([
			namespaceId,
			key,
			encryptedValue ? toHex(encryptedValue) : "0x",
			toHex(encryptedNsValue),
		]);
		await this.waitAndCheck(hash, "setSecret");

		// 5. For new secrets: best-effort second TX to backfill the per-secret encrypted value.
		//    Known bug: this TX sometimes reverts silently on-chain (see TODO.md).
		//    The secret is fully functional for owner + namespace-level grantees via the
		//    nsValue fallback; only per-secret grantees are affected. Warn and move on
		//    instead of throwing a red error at the user.
		if (!encryptedValue) {
			try {
				let secretHandle: Awaited<ReturnType<typeof this.contract.read.getSecretKeyHandle>> | undefined;
				for (let attempt = 0; attempt < 3; attempt++) {
					try {
						secretHandle = await this.contract.read.getSecretKeyHandle([namespaceId, key], this.readOpts);
						break;
					} catch {
						await new Promise((r) => setTimeout(r, 500));
					}
				}
				if (!secretHandle) throw new Error("per-secret handle unavailable after create");
				const secretKeyHex = await this.decryptFheKey(secretHandle);
				const encrypted = await encryptSecret(value, secretKeyHex);

				const hash2 = await this.contract.write.setSecret([
					namespaceId,
					key,
					toHex(encrypted),
					toHex(encryptedNsValue),
				]);
				await this.waitAndCheck(hash2, "setSecret (backfill)");
			} catch (e) {
				console.warn(
					"[setSecret] per-secret backfill failed — namespace-level reads still work; per-secret grants will not be decryptable for this secret until a future `updateSecret`.",
					e,
				);
			}
		}
	}

	async getSecret(namespaceId: bigint, key: string): Promise<SecretValue> {
		const [value, nsValue, createdAt, updatedAt] = await this.contract.read.getSecret(
			[namespaceId, key],
			this.readOpts,
		);

		const valueBytes = hexToBytes(value as `0x${string}`);
		const nsValueBytes = hexToBytes(nsValue as `0x${string}`);

		let plaintext: string;
		if (valueBytes.length > IV_BYTES) {
			const secretHandle = await this.contract.read.getSecretKeyHandle([namespaceId, key], this.readOpts);
			const secretKeyHex = await this.decryptFheKey(secretHandle);
			plaintext = await decryptSecret(valueBytes, secretKeyHex);
		} else {
			const nsHandle = await this.contract.read.getNsKeyHandle([namespaceId], this.readOpts);
			const nsKeyHex = await this.decryptFheKey(nsHandle);
			plaintext = await decryptSecret(nsValueBytes, nsKeyHex);
		}

		return {
			value: plaintext,
			createdAt: Number(createdAt),
			updatedAt: Number(updatedAt),
		};
	}

	async deleteSecret(namespaceId: bigint, key: string): Promise<void> {
		const hash = await this.contract.write.deleteSecret([namespaceId, key]);
		await this.waitAndCheck(hash, "deleteSecret");
	}

	async listSecrets(namespaceId: bigint): Promise<string[]> {
		const keys = await this.contract.read.getSecretKeys([namespaceId], this.readOpts);
		return [...keys];
	}

	async grantNamespaceAccess(namespaceId: bigint, account: HexAddress, expiresAt?: bigint): Promise<void> {
		const expiry = expiresAt ?? PERMANENT;
		const hash = await this.contract.write.grantNamespaceAccess([namespaceId, account, expiry]);
		await this.waitAndCheck(hash, "grantNamespaceAccess");
	}

	async revokeNamespaceAccess(namespaceId: bigint, account: HexAddress): Promise<void> {
		const hash = await this.contract.write.revokeNamespaceAccess([namespaceId, account]);
		await this.waitAndCheck(hash, "revokeNamespaceAccess");
	}

	async listNamespaceGrantees(namespaceId: bigint): Promise<Grantee[]> {
		const addresses = await this.contract.read.getNamespaceGrantees([namespaceId], this.readOpts);
		const now = BigInt(Math.floor(Date.now() / 1000));

		return Promise.all(
			addresses.map(async (addr: HexAddress) => {
				const expiresAt = await this.contract.read.getNamespaceAccessExpiry([namespaceId, addr]);
				return {
					address: addr as HexAddress,
					expiresAt,
					permanent: expiresAt === PERMANENT,
					expired: expiresAt < now,
				};
			}),
		);
	}

	async grantSecretAccess(
		namespaceId: bigint,
		key: string,
		account: HexAddress,
		expiresAt?: bigint,
	): Promise<void> {
		const expiry = expiresAt ?? PERMANENT;
		const hash = await this.contract.write.grantSecretAccess([namespaceId, key, account, expiry]);
		await this.waitAndCheck(hash, "grantSecretAccess");
	}

	async revokeSecretAccess(namespaceId: bigint, key: string, account: HexAddress): Promise<void> {
		const hash = await this.contract.write.revokeSecretAccess([namespaceId, key, account]);
		await this.waitAndCheck(hash, "revokeSecretAccess");
	}

	async listSecretGrantees(namespaceId: bigint, key: string): Promise<Grantee[]> {
		const addresses = await this.contract.read.getSecretGrantees([namespaceId, key], this.readOpts);
		const now = BigInt(Math.floor(Date.now() / 1000));

		return Promise.all(
			addresses.map(async (addr: HexAddress) => {
				const expiresAt = await this.contract.read.getSecretAccessExpiry([namespaceId, key, addr]);
				return {
					address: addr as HexAddress,
					expiresAt,
					permanent: expiresAt === PERMANENT,
					expired: expiresAt < now,
				};
			}),
		);
	}
}
