import { FheTypes } from "@cofhe/sdk";
import { CHAIN_ID } from "@/lib/contracts";
import { createPublicClient, createWalletClient, custom, http, type WalletClient } from "viem";
import { anvil, baseSepolia } from "viem/chains";

// --- Session storage cache ---
const CACHE_PREFIX = "fhe:";

function getCached(handle: string): string | null {
	try {
		return sessionStorage.getItem(CACHE_PREFIX + handle.toLowerCase());
	} catch {
		return null;
	}
}

export function getCachedKey(handle: string): string | null {
	return getCached(handle);
}

function setCached(handle: string, hex: string): void {
	try {
		sessionStorage.setItem(CACHE_PREFIX + handle.toLowerCase(), hex);
	} catch {
		/* do nothing */
	}
}

// --- CoFHE client singleton ---
const viemChain = CHAIN_ID === baseSepolia.id ? baseSepolia : anvil;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clientPromise: Promise<any> | null = null;
let connectedAccount: string | null = null;

async function getCofheClient(walletClient: WalletClient) {
	const account = walletClient.account?.address?.toLowerCase() ?? null;

	if (clientPromise && connectedAccount === account) {
		return clientPromise;
	}

	connectedAccount = account;
	clientPromise = (async () => {
		const { createCofheConfig, createCofheClient } = await import("@cofhe/sdk/web");
		const { getChainById } = await import("@cofhe/sdk/chains");

		const chain = getChainById(CHAIN_ID);
		if (!chain) {
			throw new Error(`No CoFHE chain config for chain ${CHAIN_ID}.`);
		}

		// CoFHE SDK needs raw viem clients (wagmi/rainbowkit ones lack standard methods)
		const sdkPublicClient = createPublicClient({ chain: viemChain, transport: http() });
		const sdkWalletClient = createWalletClient({
			account: walletClient.account!,
			chain: viemChain,
			transport: custom(walletClient.transport),
		});

		const config = createCofheConfig({ supportedChains: [chain] });
		const client = createCofheClient(config);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await client.connect(sdkPublicClient as any, sdkWalletClient as any);
		return client;
	})();

	try {
		return await clientPromise;
	} catch (e) {
		clientPromise = null;
		connectedAccount = null;
		throw e;
	}
}

export async function decryptRoomKey(handle: string, walletClient: WalletClient): Promise<string> {
	const cached = getCached(handle);
	if (cached) return cached;

	const client = await getCofheClient(walletClient);
	await client.permits.getOrCreateSelfPermit();

	const plaintext = await client.decryptForView(BigInt(handle), FheTypes.Uint128).execute();

	const hex = `0x${(plaintext as bigint).toString(16).padStart(32, "0")}`;
	setCached(handle, hex);
	return hex;
}
