import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
	getDataRoomSignerContract,
	useEthersSigner,
	CHAIN_ID,
	isUserRejection,
	friendlyError,
	type HexAddress,
} from "./shared";

export function useAddDocuments(dataRoomAddress: HexAddress | undefined) {
	const signerPromise = useEthersSigner({ chainId: CHAIN_ID });
	const queryClient = useQueryClient();
	const [isPending, setIsPending] = useState<boolean>(false);
	const [isConfirming, setIsConfirming] = useState<boolean>(false);
	const [error, setError] = useState<Error | null>(null);

	const addDocuments = useCallback(
		async (roomId: bigint, cids: string[], names: string[], wrappedKeys: string[], metadata?: string[]) => {
			if (!signerPromise || !dataRoomAddress) return;
			setIsPending(true);
			setError(null);
			try {
				const contract = await getDataRoomSignerContract(dataRoomAddress, signerPromise);
				const meta = metadata || cids.map(() => "0x");
				const tx = await contract.addDocuments(roomId, cids, names, wrappedKeys, meta);
				setIsPending(false);
				setIsConfirming(true);
				await tx.wait();
				setIsConfirming(false);
				queryClient.invalidateQueries({ refetchType: "all" });
			} catch (e) {
				console.error("addDocuments failed:", e);
				setIsPending(false);
				setIsConfirming(false);
				if (!isUserRejection(e)) setError(new Error(friendlyError(e)));
			}
		},
		[signerPromise, dataRoomAddress, queryClient],
	);

	return { addDocuments, isPending, isConfirming, error };
}
