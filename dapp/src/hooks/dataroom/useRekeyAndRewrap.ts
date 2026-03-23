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

export const RekeyPhase = {
	Idle: "idle",
	Rekeying: "rekeying",
	Rewrapping: "rewrapping",
	Updating: "updating",
	Done: "done",
	Error: "error",
} as const;

export type RekeyPhase = (typeof RekeyPhase)[keyof typeof RekeyPhase];

export type RekeyProgress = {
	phase: RekeyPhase;
	current: number;
	total: number;
	error?: string;
};

export function useRekeyAndRewrap(dataRoomAddress: HexAddress | undefined) {
	const signerPromise = useEthersSigner({ chainId: CHAIN_ID });
	const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
	const queryClient = useQueryClient();
	const [progress, setProgress] = useState<RekeyProgress>({
		phase: RekeyPhase.Idle,
		current: 0,
		total: 0,
	});

	const rekeyAndRewrap = useCallback(
		async (folderId: bigint, documentCount: number, oldRoomKeyHex: string) => {
			if (!signerPromise || !dataRoomAddress || !walletClient) return;
			try {
				const contract = await getDataRoomSignerContract(dataRoomAddress, signerPromise);

				setProgress({ phase: RekeyPhase.Rekeying, current: 0, total: 0 });
				const tx = await contract.rekeyRoom(folderId);
				await tx.wait();

				if (documentCount === 0) {
					setProgress({ phase: RekeyPhase.Done, current: 0, total: 0 });
					queryClient.invalidateQueries({ refetchType: "all" });
					return;
				}

				const _ = await signerPromise;
				const newKeyHandle = await contract.getRoomKey(folderId);
				const newKeyHex = await decryptRoomKey(newKeyHandle, walletClient);

				setProgress({ phase: RekeyPhase.Rewrapping, current: 0, total: documentCount });
				const oldWrappingKey = await deriveAesKey(hexToBytes(oldRoomKeyHex));
				const newWrappingKey = await deriveAesKey(hexToBytes(newKeyHex));
				const newWrappedKeys: string[] = [];

				for (let i = 0; i < documentCount; i++) {
					setProgress({ phase: RekeyPhase.Rewrapping, current: i + 1, total: documentCount });
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

				setProgress({ phase: RekeyPhase.Updating, current: 0, total: documentCount });
				const docIndices = Array.from({ length: documentCount }, (_, i) => BigInt(i));
				const updateTx = await contract.updateDocumentKeys(folderId, docIndices, newWrappedKeys);
				await updateTx.wait();

				setProgress({ phase: RekeyPhase.Done, current: documentCount, total: documentCount });
				queryClient.invalidateQueries({ refetchType: "all" });
			} catch (e) {
				console.error("rekeyAndRewrap failed:", e);
				if (isUserRejection(e)) {
					setProgress({ phase: RekeyPhase.Idle, current: 0, total: 0 });
				} else {
					setProgress((prev) => ({ ...prev, phase: RekeyPhase.Error, error: friendlyError(e) }));
				}
			}
		},
		[signerPromise, dataRoomAddress, queryClient, walletClient],
	);

	const reset = useCallback(() => {
		setProgress({ phase: RekeyPhase.Idle, current: 0, total: 0 });
	}, []);

	return { rekeyAndRewrap, progress, reset };
}
