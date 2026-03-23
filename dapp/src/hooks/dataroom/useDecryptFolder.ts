import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoomKeyHandle, useRoomKey } from "./useRoomKey";
import { ZERO_BYTES32 } from "./shared";
import { getCachedKey } from "@/lib/fhe";
import type { HexAddress } from "./shared";

export type DecryptStatus = "loading" | "rejected" | "decrypting" | "ready";

export function useDecryptFolder(dataRoomAddress: HexAddress, folderId: bigint) {
	const queryClient = useQueryClient();
	const [decryptRequested, setDecryptRequested] = useState(false);

	const { data: handle, error: handleError } = useRoomKeyHandle(dataRoomAddress, folderId);

	const hasCached = !!handle && !!getCachedKey(handle);
	const decryptEnabled = decryptRequested || hasCached;

	const {
		data: roomKeyData,
		error: roomKeyError,
		isLoading: isKeyLoading,
	} = useRoomKey(dataRoomAddress, folderId, handle ?? undefined, decryptEnabled);

	const roomKeyHex = roomKeyData && roomKeyData !== ZERO_BYTES32 ? roomKeyData : null;

	const noAccess = !!handleError;
	const isRejection =
		roomKeyError?.message?.includes("user rejected") || roomKeyError?.message?.includes("ACTION_REJECTED");
	const decryptFailed = !roomKeyHex && decryptEnabled && !!roomKeyError && !isRejection;
	const showPrompt = !roomKeyHex && !decryptEnabled && !noAccess;

	const resetRoomKey = () => {
		queryClient.resetQueries({
			queryKey: ["dataroom", dataRoomAddress, "roomKey", folderId.toString()],
		});
		setDecryptRequested(true);
	};

	const requestDecrypt = () => setDecryptRequested(true);

	let status: DecryptStatus;
	if (isRejection) status = "rejected";
	else if (decryptEnabled && isKeyLoading) status = "decrypting";
	else status = "ready";

	return { roomKeyHex, status, noAccess, decryptFailed, showPrompt, resetRoomKey, requestDecrypt };
}
