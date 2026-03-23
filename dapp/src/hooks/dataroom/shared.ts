import { useMemo } from "react";
import type { JsonRpcSigner } from "ethers";
import { CHAIN_ID, type HexAddress } from "@/lib/contracts";
import { DataRoom__factory } from "@/types/factories/DataRoom__factory";
import type { DataRoom } from "@/types/DataRoom";
import { useEthersProvider, useEthersSigner, useSignerAndAccount } from "@/lib/ethers-adapter";

export { CHAIN_ID };
export { DataRoom__factory };
export type { DataRoom };
export { useEthersSigner, useSignerAndAccount };
export type { HexAddress };

export const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export function useDataRoomContract(address: HexAddress | undefined): DataRoom | null {
	const provider = useEthersProvider({ chainId: CHAIN_ID });
	return useMemo(() => {
		if (!provider || !address) return null;
		return DataRoom__factory.connect(address, provider);
	}, [provider, address]);
}

export async function getDataRoomSignerContract(address: HexAddress, signerPromise: Promise<JsonRpcSigner>) {
	const signer = await signerPromise;
	return DataRoom__factory.connect(address, signer);
}

export function isUserRejection(e: unknown): boolean {
	const msg = (e as Error)?.message ?? String(e);
	return (
		msg.includes("user rejected") ||
		msg.includes("ACTION_REJECTED") ||
		msg.includes("ethers-user-denied") ||
		msg.includes("User denied") ||
		msg.includes("User rejected")
	);
}

export function friendlyError(e: unknown): string {
	const msg = (e as Error)?.message ?? String(e);
	if (isUserRejection(e)) return "Transaction was rejected.";
	if (msg.includes("missing revert data"))
		return "Transaction reverted (no revert reason). The contract call may not be supported on this chain.";
	if (msg.includes("insufficient funds")) return "Insufficient funds for transaction.";
	if (msg.includes("nonce")) return "Nonce error. Try resetting your wallet activity.";
	// Try to extract a short reason from "reverted with reason string '...'"
	const reasonMatch = msg.match(/reverted with reason string '([^']+)'/);
	if (reasonMatch) return reasonMatch[1];
	// Fallback: first line, capped
	const firstLine = msg.split("\n")[0];
	return firstLine.length > 120 ? `${firstLine.slice(0, 120)}...` : firstLine;
}
