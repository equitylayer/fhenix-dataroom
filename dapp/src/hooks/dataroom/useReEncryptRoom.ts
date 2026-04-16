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

export interface ReEncryptRoomProgress {
	phase: "idle" | "rekeying" | "rewrapping" | "updating" | "done" | "error";
	folderCurrent: number;
	folderTotal: number;
	docCurrent: number;
	docTotal: number;
	error?: string;
}

/**
 * Re-encrypt every folder in a room: rekey + rewrap documents for each folder.
 * Same as per-folder rekeyAndRewrap but looped across all folders in one flow.
 */
export function useReEncryptRoom(dataRoomAddress: HexAddress | undefined) {
	const signerPromise = useEthersSigner({ chainId: CHAIN_ID });
	const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
	const queryClient = useQueryClient();
	const [progress, setProgress] = useState<ReEncryptRoomProgress>({
		phase: "idle",
		folderCurrent: 0,
		folderTotal: 0,
		docCurrent: 0,
		docTotal: 0,
	});

	const reEncryptRoom = useCallback(
		async (roomId: bigint) => {
			if (!signerPromise || !dataRoomAddress || !walletClient) return;
			try {
				const contract = await getDataRoomSignerContract(dataRoomAddress, signerPromise);
				const folderIdsRaw: bigint[] = await contract.getFolders(roomId);
				const folderIds = folderIdsRaw.map((id) => BigInt(id));
				const folderTotal = folderIds.length;

				// 1. Decrypt all OLD folder keys before rekey invalidates them
				const folderMeta: { folderId: bigint; documentCount: number; oldKeyHex: string }[] = [];
				for (let f = 0; f < folderTotal; f++) {
					const folderId = folderIds[f];
					const roomData = await contract.getRoom(folderId);
					const documentCount = Number(roomData.documentCount);
					const oldKeyHandle = await contract.getRoomKey(folderId);
					const oldKeyHex = await decryptRoomKey(oldKeyHandle, walletClient);
					folderMeta.push({ folderId, documentCount, oldKeyHex });
				}

				// 2. Single TX: rekey all folders at once
				setProgress({ phase: "rekeying", folderCurrent: 0, folderTotal, docCurrent: 0, docTotal: 0 });
				const rekeyTx = await contract.rekeyAllFolders(roomId);
				await rekeyTx.wait();

				// 3. Re-wrap documents per folder (requires new key → 1 update TX each)
				for (let f = 0; f < folderTotal; f++) {
					const { folderId, documentCount, oldKeyHex } = folderMeta[f];
					if (documentCount === 0) continue;

					// Decrypt new key
					const newKeyHandle = await contract.getRoomKey(folderId);
					const newKeyHex = await decryptRoomKey(newKeyHandle, walletClient);

					const oldWrappingKey = await deriveAesKey(hexToBytes(oldKeyHex));
					const newWrappingKey = await deriveAesKey(hexToBytes(newKeyHex));
					const newWrappedKeys: string[] = [];

					for (let i = 0; i < documentCount; i++) {
						setProgress({ phase: "rewrapping", folderCurrent: f + 1, folderTotal, docCurrent: i + 1, docTotal: documentCount });
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

					setProgress({ phase: "updating", folderCurrent: f + 1, folderTotal, docCurrent: 0, docTotal: documentCount });
					const docIndices = Array.from({ length: documentCount }, (_, i) => BigInt(i));
					const updateTx = await contract.updateDocumentKeys(folderId, docIndices, newWrappedKeys);
					await updateTx.wait();
				}

				setProgress({ phase: "done", folderCurrent: folderTotal, folderTotal, docCurrent: 0, docTotal: 0 });
				queryClient.invalidateQueries({ refetchType: "all" });
			} catch (e) {
				console.error("reEncryptRoom failed:", e);
				if (isUserRejection(e)) {
					setProgress({ phase: "idle", folderCurrent: 0, folderTotal: 0, docCurrent: 0, docTotal: 0 });
				} else {
					setProgress((prev) => ({ ...prev, phase: "error", error: friendlyError(e) }));
				}
			}
		},
		[signerPromise, dataRoomAddress, queryClient, walletClient],
	);

	return { reEncryptRoom, progress };
}
