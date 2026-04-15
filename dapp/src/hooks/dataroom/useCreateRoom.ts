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

export function useCreateRoom(dataRoomAddress: HexAddress | undefined) {
	const signerPromise = useEthersSigner({ chainId: CHAIN_ID });
	const queryClient = useQueryClient();
	const [isPending, setIsPending] = useState(false);
	const [isConfirming, setIsConfirming] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const createRoom = useCallback(
		async (name: string) => {
			if (!signerPromise || !dataRoomAddress) return;
			setIsPending(true);
			setError(null);
			try {
				const contract = await getDataRoomSignerContract(dataRoomAddress, signerPromise);
				const tx = await contract.createRoom(name);
				setIsPending(false);
				setIsConfirming(true);
				const receipt = await tx.wait();
				setIsConfirming(false);
				await queryClient.invalidateQueries({ refetchType: "all" });
				setTimeout(() => queryClient.invalidateQueries({ refetchType: "all" }), 2500);

				const createdRoomLog = receipt?.logs
					.map((log) => {
						try {
							return contract.interface.parseLog(log);
						} catch {
							return null;
						}
					})
					.find((parsedLog) => parsedLog?.name === "RoomCreated");

				return createdRoomLog ? (createdRoomLog.args[0] as bigint) : null;
			} catch (e) {
				console.error("createRoom failed:", e);
				setIsPending(false);
				setIsConfirming(false);
				if (!isUserRejection(e)) setError(new Error(friendlyError(e)));
				return null;
			}
		},
		[signerPromise, dataRoomAddress, queryClient],
	);

	return { createRoom, isPending, isConfirming, error };
}
