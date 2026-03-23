import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import {
	getDataRoomSignerContract,
	useEthersSigner,
	CHAIN_ID,
	isUserRejection,
	friendlyError,
	type HexAddress,
} from "./shared";
import { deriveAesKey, hexToBytes, unwrapKey, wrapKey, bytesToHex } from "@/lib/crypto";
import { decryptRoomKey } from "@/lib/fhe";

export const CommitPhase = {
	Idle: "idle",
	Revoking: "revoking",
	Rewrapping: "rewrapping",
	UpdatingKeys: "updatingKeys",
	Granting: "granting",
	Done: "done",
	Error: "error",
} as const;

export type CommitPhase = (typeof CommitPhase)[keyof typeof CommitPhase];

export type CommitProgress = {
	phase: CommitPhase;
	current: number;
	total: number;
	error?: string;
};

export function useCommitAccessChanges(dataRoomAddress: HexAddress | undefined) {
	const signerPromise = useEthersSigner({ chainId: CHAIN_ID });
	const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
	const queryClient = useQueryClient();
	const [progress, setProgress] = useState<CommitProgress>({
		phase: CommitPhase.Idle,
		current: 0,
		total: 0,
	});

	const commit = useCallback(
		async (
			folderId: bigint,
			usersToRevoke: string[],
			usersToAdd: string[],
			documentCount: number,
			oldRoomKeyHex: string,
		) => {
			if (!signerPromise || !dataRoomAddress || !walletClient) return;
			try {
				const contract = await getDataRoomSignerContract(dataRoomAddress, signerPromise);

				if (usersToRevoke.length > 0) {
					setProgress({ phase: CommitPhase.Revoking, current: 0, total: 0 });
					const tx = await contract.revokeAndRekey(folderId, usersToRevoke);
					await tx.wait();

					if (documentCount > 0) {
						const newKeyHandle = await contract.getRoomKey(folderId);
						const newKeyHex = await decryptRoomKey(newKeyHandle, walletClient);

						setProgress({ phase: CommitPhase.Rewrapping, current: 0, total: documentCount });
						const oldWrappingKey = await deriveAesKey(hexToBytes(oldRoomKeyHex));
						const newWrappingKey = await deriveAesKey(hexToBytes(newKeyHex));
						const newWrappedKeys: string[] = [];

						for (let i = 0; i < documentCount; i++) {
							setProgress({ phase: CommitPhase.Rewrapping, current: i + 1, total: documentCount });
							const doc = await contract.getDocument(folderId, BigInt(i));

							if (!doc.wrappedKey || doc.wrappedKey === "0x") {
								newWrappedKeys.push("0x");
								continue;
							}

							const wrappedCek = hexToBytes(doc.wrappedKey);
							const cek = await unwrapKey(wrappedCek, oldWrappingKey);
							const newWrapped = await wrapKey(cek, newWrappingKey);
							newWrappedKeys.push(bytesToHex(newWrapped));
						}

						setProgress({ phase: CommitPhase.UpdatingKeys, current: 0, total: documentCount });
						const docIndices = Array.from({ length: documentCount }, (_, i) => BigInt(i));
						const updateTx = await contract.updateDocumentKeys(folderId, docIndices, newWrappedKeys);
						await updateTx.wait();
					}
				}

				if (usersToAdd.length > 0) {
					setProgress({ phase: CommitPhase.Granting, current: 0, total: 0 });
					const grantTx = await contract.grantAccess(folderId, usersToAdd);
					await grantTx.wait();
				}

				setProgress({ phase: CommitPhase.Done, current: 0, total: 0 });
				queryClient.invalidateQueries({ refetchType: "all" });
			} catch (e) {
				console.error("commitAccessChanges failed:", e);
				if (isUserRejection(e)) {
					setProgress({ phase: CommitPhase.Idle, current: 0, total: 0 });
				} else {
					setProgress((prev) => ({ ...prev, phase: CommitPhase.Error, error: friendlyError(e) }));
				}
			}
		},
		[signerPromise, dataRoomAddress, walletClient, queryClient],
	);

	const reset = useCallback(() => {
		setProgress({ phase: CommitPhase.Idle, current: 0, total: 0 });
	}, []);

	return { commit, progress, reset };
}
