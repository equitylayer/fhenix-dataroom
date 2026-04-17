import {
	encodeFunctionData,
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

	private async decryptFheKeyWithRetry(handle: unknown, attempts = 8, delayMs = 1000): Promise<string> {
		let lastErr: unknown;
		for (let i = 0; i < attempts; i++) {
			try {
				return await this.decryptFheKey(handle as Parameters<DecryptFheKeyFn>[0]);
			} catch (e) {
				lastErr = e;
				if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
			}
		}
		throw lastErr;
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

		// 4. First TX: create or update the secret.
		const hash = await this.contract.write.setSecret(
			[
				namespaceId,
				key,
				encryptedValue ? toHex(encryptedValue) : "0x",
				toHex(encryptedNsValue),
			],
			{ gas: 600_000n },
		);
		await this.waitAndCheck(hash, "setSecret");

		// 5. For new secrets: second TX to backfill the per-secret encrypted value.
		//    The CoFHE coprocessor takes a few seconds to materialize the fresh key
		//    ciphertext after TX1 confirms — retry decrypt with backoff. Without this
		//    the backfill silently fails and per-secret grantees can't decrypt.
		if (!encryptedValue) {
			try {
				const secretHandle = await this.contract.read.getSecretKeyHandle([namespaceId, key], this.readOpts);
				const secretKeyHex = await this.decryptFheKeyWithRetry(secretHandle);
				const encrypted = await encryptSecret(value, secretKeyHex);

				const hash2 = await this.contract.write.setSecret(
					[
						namespaceId,
						key,
						toHex(encrypted),
						toHex(encryptedNsValue),
					],
					{ gas: 400_000n },
				);
				await this.waitAndCheck(hash2, "setSecret (backfill)");
			} catch (e) {
				console.warn(
					"[setSecret] per-secret backfill failed — namespace-level reads still work; per-secret grants will not be decryptable for this secret until a future `updateSecret`.",
					e,
				);
			}
		}
	}

	/**
	 * Set multiple secrets in 2 TXs (instead of 2 per secret):
	 *   TX1: multicall of setSecret (creates FHE keys, stores nsValues)
	 *   TX2: multicall of setSecret (backfills per-secret encrypted values)
	 */
	async batchSetSecrets(
		namespaceId: bigint,
		entries: { key: string; value: string }[],
		onProgress?: (current: number, total: number) => void,
	): Promise<void> {
		if (entries.length === 0) return;

		// 1. Get namespace key and encrypt all values with it
		const nsHandle = await this.contract.read.getNsKeyHandle([namespaceId], this.readOpts);
		const nsKeyHex = await this.decryptFheKey(nsHandle);

		const createCalls: `0x${string}`[] = [];
		const nsEncrypted: Uint8Array[] = [];

		for (let i = 0; i < entries.length; i++) {
			onProgress?.(i, entries.length * 2);
			const enc = await encryptSecret(entries[i].value, nsKeyHex);
			nsEncrypted.push(enc);
			createCalls.push(
				encodeFunctionData({
					abi: SECRETS_VAULT_ABI,
					functionName: "setSecret",
					args: [namespaceId, entries[i].key, "0x", toHex(enc)],
				}),
			);
		}

		// TX1: create all secrets (generates per-secret FHE keys)
		const hash1 = await this.contract.write.multicall([createCalls], { gas: BigInt(600_000 * entries.length) });
		await this.waitAndCheck(hash1, "batchSetSecrets (create)");

		// 2. Backfill: decrypt each per-secret key, re-encrypt, batch update
		const backfillCalls: `0x${string}`[] = [];
		for (let i = 0; i < entries.length; i++) {
			onProgress?.(entries.length + i, entries.length * 2);
			try {
				const secretHandle = await this.contract.read.getSecretKeyHandle(
					[namespaceId, entries[i].key],
					this.readOpts,
				);
				const secretKeyHex = await this.decryptFheKeyWithRetry(secretHandle);
				const encrypted = await encryptSecret(entries[i].value, secretKeyHex);
				backfillCalls.push(
					encodeFunctionData({
						abi: SECRETS_VAULT_ABI,
						functionName: "setSecret",
						args: [namespaceId, entries[i].key, toHex(encrypted), toHex(nsEncrypted[i])],
					}),
				);
			} catch (e) {
				console.warn(`[batchSetSecrets] backfill skipped for ${entries[i].key}:`, e);
			}
		}

		if (backfillCalls.length > 0) {
			const hash2 = await this.contract.write.multicall([backfillCalls], {
				gas: BigInt(400_000 * backfillCalls.length),
			});
			await this.waitAndCheck(hash2, "batchSetSecrets (backfill)");
		}
		onProgress?.(entries.length * 2, entries.length * 2);
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

	async reEncryptNamespace(
		namespaceId: bigint,
		onProgress?: (current: number, total: number) => void,
	): Promise<void> {
		const keys = await this.listSecrets(namespaceId);
		const total = keys.length;

		// 1. Decrypt all secrets with current keys (before rotation invalidates them)
		const plaintexts: { key: string; plain: string; secretEncrypted: Uint8Array | null }[] = [];
		for (let i = 0; i < keys.length; i++) {
			onProgress?.(i, total);
			const secret = await this.getSecret(namespaceId, keys[i]);
			// Also grab per-secret encrypted value if present
			const [value] = await this.contract.read.getSecret([namespaceId, keys[i]], this.readOpts);
			const valueBytes = hexToBytes(value as `0x${string}`);
			let secretEnc: Uint8Array | null = null;
			if (valueBytes.length > IV_BYTES) {
				const secretHandle = await this.contract.read.getSecretKeyHandle(
					[namespaceId, keys[i]],
					this.readOpts,
				);
				const secretKeyHex = await this.decryptFheKey(secretHandle);
				secretEnc = await encryptSecret(secret.value, secretKeyHex);
			}
			plaintexts.push({ key: keys[i], plain: secret.value, secretEncrypted: secretEnc });
		}

		// 2. Rotate on-chain (generates new FHE key, re-allows grantees)
		const hash = await this.contract.write.rotateNamespaceKey([namespaceId]);
		await this.waitAndCheck(hash, "rotateNamespaceKey");

		// 3. Re-encrypt with NEW namespace key, batch all updates via multicall (1 TX)
		const newNsHandle = await this.contract.read.getNsKeyHandle([namespaceId], this.readOpts);
		const newNsKeyHex = await this.decryptFheKey(newNsHandle);

		const multicallData: `0x${string}`[] = [];
		for (let i = 0; i < plaintexts.length; i++) {
			onProgress?.(total + i, total * 2);
			const { key, plain, secretEncrypted } = plaintexts[i];
			const newNsValue = await encryptSecret(plain, newNsKeyHex);
			multicallData.push(
				encodeFunctionData({
					abi: SECRETS_VAULT_ABI,
					functionName: "setSecret",
					args: [namespaceId, key, secretEncrypted ? toHex(secretEncrypted) : "0x", toHex(newNsValue)],
				}),
			);
		}

		if (multicallData.length > 0) {
			const hash2 = await this.contract.write.multicall([multicallData]);
			await this.waitAndCheck(hash2, "re-encrypt (batch update)");
		}
		onProgress?.(total * 2, total * 2);
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
