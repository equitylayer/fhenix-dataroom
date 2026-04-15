import { useState, useCallback } from "react";
import {
	encryptFile,
	decryptFile,
	deriveAesKey,
	hexToBytes,
	generateCek,
	wrapKey,
	unwrapKey,
	bytesToHex,
} from "@/lib/crypto";
import { uploadFileToIPFS, fetchFromIPFS, isIPFSConfigured } from "@/lib/ipfs";

export function useStorage() {
	const [isUploading, setIsUploading] = useState(false);

	const isReady = isIPFSConfigured();
	const isInitializing = false;

	const initialize = useCallback(async () => {
		// No-op: Pinata is ready the moment VITE_PINATA_JWT is set.
	}, []);

	const uploadEncrypted = useCallback(
		async (
			file: File,
			roomKeyHex: string,
		): Promise<{ cid: string; encodedName: string; wrappedKeyHex: string }> => {
			if (!isIPFSConfigured()) throw new Error("VITE_PINATA_JWT must be configured.");
			setIsUploading(true);
			try {
				const cek = generateCek();
				const cekKey = await deriveAesKey(cek);
				const { encrypted, filename } = await encryptFile(file, cekKey);
				const roomKey = await deriveAesKey(hexToBytes(roomKeyHex));
				const wrappedCek = await wrapKey(cek, roomKey);
				const wrappedKeyHex = bytesToHex(wrappedCek);
				const encryptedFile = new File([encrypted], "encrypted.bin", {
					type: "application/octet-stream",
				});
				const cid = await uploadFileToIPFS(encryptedFile);
				return { cid, encodedName: filename, wrappedKeyHex };
			} finally {
				setIsUploading(false);
			}
		},
		[],
	);

	const uploadPlain = useCallback(async (file: File): Promise<{ cid: string; encodedName: string }> => {
		if (!isIPFSConfigured()) throw new Error("VITE_PINATA_JWT must be configured.");
		setIsUploading(true);
		try {
			const cid = await uploadFileToIPFS(file);
			const encodedName = btoa(file.name);
			return { cid, encodedName };
		} finally {
			setIsUploading(false);
		}
	}, []);

	const downloadDecrypted = useCallback(
		async (cid: string, roomKeyHex: string, wrappedKeyHex: string): Promise<Blob> => {
			const roomKey = await deriveAesKey(hexToBytes(roomKeyHex));
			const wrappedCek = hexToBytes(wrappedKeyHex);
			const cek = await unwrapKey(wrappedCek, roomKey);
			const cekKey = await deriveAesKey(cek);
			const encryptedData = await fetchFromIPFS(cid);
			const decrypted = await decryptFile(encryptedData, cekKey);
			return new Blob([decrypted]);
		},
		[],
	);

	const downloadPlain = useCallback(async (cid: string): Promise<Blob> => {
		const data = await fetchFromIPFS(cid);
		return new Blob([data]);
	}, []);

	const downloadEncryptedBlob = useCallback(async (cid: string): Promise<Blob> => {
		const data = await fetchFromIPFS(cid);
		return new Blob([data], { type: "application/octet-stream" });
	}, []);

	return {
		initialize,
		uploadEncrypted,
		uploadPlain,
		downloadDecrypted,
		downloadPlain,
		downloadEncryptedBlob,
		isReady,
		isInitializing,
		isUploading,
	};
}
