import { BrowserProvider, FallbackProvider, JsonRpcProvider } from "ethers";
import { useMemo } from "react";
import type { Account, Chain, Client, Transport } from "viem";
import { type Config, useClient, useConnectorClient } from "wagmi";

export function clientToProvider(client: Client<Transport, Chain>) {
	const { chain, transport } = client;
	const network = {
		chainId: chain.id,
		name: chain.name,
		ensAddress: chain.contracts?.ensRegistry?.address,
	};
	if (transport.type === "fallback") {
		const providers = (transport.transports as ReturnType<Transport>[]).map(
			({ value }) => new JsonRpcProvider(value?.url, network),
		);
		if (providers.length === 1) return providers[0];
		return new FallbackProvider(providers);
	}
	return new JsonRpcProvider(transport.url, network);
}

export function useEthersProvider({ chainId }: { chainId?: number } = {}) {
	const client = useClient<Config>({ chainId });
	return useMemo(() => (client ? clientToProvider(client) : undefined), [client]);
}

export function clientToSigner(client: Client<Transport, Chain, Account>) {
	const { account, chain, transport } = client;
	const network = {
		chainId: chain.id,
		name: chain.name,
		ensAddress: chain.contracts?.ensRegistry?.address,
	};
	const provider = new BrowserProvider(transport, network);
	const signer = provider.getSigner(account.address);
	return signer;
}

export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
	const { data: client } = useConnectorClient<Config>({ chainId });
	return useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
}

/** Returns signer + account derived from the same connector client (no desync on account switch). */
export function useSignerAndAccount({ chainId }: { chainId?: number } = {}) {
	const { data: client } = useConnectorClient<Config>({ chainId });
	const signerPromise = useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
	const account = client?.account?.address as `0x${string}` | undefined;
	return { signerPromise, account };
}
