import { CHAIN_ID, RPC_URL, SECRETS_VAULT_ADDRESS } from "@/lib/contracts";
import { decryptNsKey } from "@/lib/fhe";
import { SecretsVaultClient } from "@obolos/secretsvault-sdk";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { anvil, baseSepolia, arbitrumSepolia } from "viem/chains";
import { useWalletClient } from "wagmi";

const SecretsVaultContext = createContext<SecretsVaultClient | null>(null);

const viemChains = {
	[anvil.id]: anvil,
	[baseSepolia.id]: baseSepolia,
	[arbitrumSepolia.id]: arbitrumSepolia,
} as const;

const chain = viemChains[CHAIN_ID as keyof typeof viemChains] ?? anvil;

export function SecretsVaultProvider({ children }: { children: ReactNode }) {
	const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
	const [client, setClient] = useState<SecretsVaultClient | null>(null);

	useEffect(() => {
		if (!walletClient?.account) {
			setClient(null);
			return;
		}
		if (!SECRETS_VAULT_ADDRESS) {
			setClient(null);
			return;
		}

		const sdkPublicClient = createPublicClient({
			chain,
			transport: http(RPC_URL),
		});

		const sdkWalletClient = createWalletClient({
			account: walletClient.account,
			chain,
			transport: custom(walletClient.transport),
		});

		const decryptFheKey = (handle: string) => decryptNsKey(handle, walletClient);

		setClient(
			SecretsVaultClient.fromClients({
				publicClient: sdkPublicClient,
				walletClient: sdkWalletClient,
				vaultAddress: SECRETS_VAULT_ADDRESS,
				chainId: CHAIN_ID,
				decryptFheKey,
			}),
		);
	}, [walletClient]);

	return <SecretsVaultContext.Provider value={client}>{children}</SecretsVaultContext.Provider>;
}

export function useSecretsVaultClient(): SecretsVaultClient | null {
	return useContext(SecretsVaultContext);
}
