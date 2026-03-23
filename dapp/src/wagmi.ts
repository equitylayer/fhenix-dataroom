import { http } from "wagmi";
import { anvil, baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const chainId = Number(import.meta.env.VITE_CHAIN_ID || "31337");

const chains = {
	[anvil.id]: anvil,
	[baseSepolia.id]: baseSepolia,
} as const;

const chain = chains[chainId as keyof typeof chains];

if (!chain) {
	throw new Error(`Unsupported chain ID: ${chainId}. Supported: ${Object.keys(chains).join(", ")}`);
}

const rpcUrl = chainId === anvil.id ? "http://127.0.0.1:8545" : import.meta.env.VITE_RPC_URL || undefined;

export const config = getDefaultConfig({
	appName: "Obolos DataRoom",
	projectId: "5706257c1983b2588ef21d961c632d66",
	chains: [chain],
	transports: {
		[chain.id]: http(rpcUrl, {
			batch: {
				wait: 50,
				batchSize: 1024,
			},
		}),
	},
});
