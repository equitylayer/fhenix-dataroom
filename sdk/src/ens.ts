import { createPublicClient, http, isAddress, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import type { HexAddress } from "./types";

let mainnetClient: PublicClient | null = null;

function getMainnetClient(): PublicClient {
	if (!mainnetClient) {
		mainnetClient = createPublicClient({
			chain: mainnet,
			transport: http("https://eth.drpc.org"),
		});
	}
	return mainnetClient;
}

const forwardCache = new Map<string, HexAddress>();
const reverseCache = new Map<string, string | null>();
const pendingReverse = new Map<string, Promise<string | null>>();

export async function resolveAddress(addressOrName: string): Promise<HexAddress> {
	if (isAddress(addressOrName)) {
		return addressOrName as HexAddress;
	}

	const key = addressOrName.toLowerCase();
	const cached = forwardCache.get(key);
	if (cached) return cached;

	const resolved = await getMainnetClient().getEnsAddress({
		name: normalize(addressOrName),
	});

	if (!resolved) {
		throw new Error(`Could not resolve ENS name: ${addressOrName}`);
	}

	forwardCache.set(key, resolved as HexAddress);
	reverseCache.set(resolved.toLowerCase(), addressOrName);
	return resolved as HexAddress;
}

const ENS_SUBGRAPH = "https://api.thegraph.com/subgraphs/name/ensdomains/ens";

async function subgraphReverseLookup(addressLower: string): Promise<string | null> {
	const query = `{ domains(where: { resolvedAddress: "${addressLower}" }, first: 1, orderBy: createdAt, orderDirection: desc) { name } }`;
	const res = await fetch(ENS_SUBGRAPH, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query }),
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const json: any = await res.json();
	const name = json?.data?.domains?.[0]?.name;
	return name ?? null;
}

export async function resolveEnsName(address: HexAddress): Promise<string | null> {
	const key = address.toLowerCase();

	const cached = reverseCache.get(key);
	if (cached !== undefined) return cached;

	const pending = pendingReverse.get(key);
	if (pending) return pending;

	const promise = (async () => {
		try {
			const name = await getMainnetClient().getEnsName({
				address,
				universalResolverAddress: "0xce01f8eee7E479C928F8919abD53E553a36CeF67",
			});
			if (name) {
				reverseCache.set(key, name);
				return name;
			}
		} catch {
			// No primary ENS name set for this address
		}

		try {
			const name = await subgraphReverseLookup(key);
			reverseCache.set(key, name);
			return name;
		} catch {
			reverseCache.set(key, null);
			return null;
		} finally {
			pendingReverse.delete(key);
		}
	})();

	pendingReverse.set(key, promise);
	return promise;
}
