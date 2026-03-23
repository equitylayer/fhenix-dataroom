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

export function useRevokeAccess(dataRoomAddress: HexAddress | undefined) {
	const signerPromise = useEthersSigner({ chainId: CHAIN_ID });
	const queryClient = useQueryClient();
	const [isPending, setIsPending] = useState(false);
	const [isConfirming, setIsConfirming] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const revokeAccess = useCallback(
		async (roomId: bigint, user: string) => {
			if (!signerPromise || !dataRoomAddress) return;
			setIsPending(true);
			setError(null);
			try {
				const contract = await getDataRoomSignerContract(dataRoomAddress, signerPromise);
				const tx = await contract.revokeAccess(roomId, [user]);
				setIsPending(false);
				setIsConfirming(true);
				await tx.wait();
				setIsConfirming(false);
				queryClient.invalidateQueries({ refetchType: "all" });
			} catch (e) {
				console.error("revokeAccess failed:", e);
				setIsPending(false);
				setIsConfirming(false);
				if (!isUserRejection(e)) setError(new Error(friendlyError(e)));
			}
		},
		[signerPromise, dataRoomAddress, queryClient],
	);

	return { revokeAccess, isPending, isConfirming, error };
}
