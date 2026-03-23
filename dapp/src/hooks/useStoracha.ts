import { useState, useRef, useCallback } from "react";
import * as Client from "@storacha/client";
import { StoreMemory } from "@storacha/client/stores/memory";
import * as Proof from "@storacha/client/proof";
import { Signer } from "@storacha/client/principal/ed25519";
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

const GATEWAY = "https://storacha.link/ipfs";

export function useStoracha() {
	const clientRef = useRef<Awaited<ReturnType<typeof Client.create>> | null>(null);
	const [isReady, setIsReady] = useState<boolean>(false);
	const [isInitializing, setIsInitializing] = useState<boolean>(false);
	const [isUploading, setIsUploading] = useState<boolean>(false);

	const initialize = useCallback(async () => {
		if (clientRef.current && isReady) return;
		setIsInitializing(true);
		try {
			const key = import.meta.env.VITE_STORACHA_KEY;
			const proofStr = import.meta.env.VITE_STORACHA_PROOF;
			if (!key || !proofStr) {
				throw new Error("VITE_STORACHA_KEY and VITE_STORACHA_PROOF must be configured.");
			}
			const principal = Signer.parse(key);
			const client = await Client.create({ principal, store: new StoreMemory() });
			clientRef.current = client;
			const proof = await Proof.parse(proofStr);
			const space = await client.addSpace(proof);
			await client.setCurrentSpace(space.did());
			setIsReady(true);
		} finally {
			setIsInitializing(false);
		}
	}, [isReady]);

	const uploadEncrypted = useCallback(
		async (
			file: File,
			roomKeyHex: string,
		): Promise<{ cid: string; encodedName: string; wrappedKeyHex: string }> => {
			if (!clientRef.current) {
				throw new Error("Storacha client not initialized. Call initialize() first.");
			}
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
				const cid = await clientRef.current.uploadFile(encryptedFile);
				return { cid: cid.toString(), encodedName: filename, wrappedKeyHex };
			} finally {
				setIsUploading(false);
			}
		},
		[],
	);

	const downloadDecrypted = useCallback(
		async (cid: string, roomKeyHex: string, wrappedKeyHex: string): Promise<Blob> => {
			const roomKey = await deriveAesKey(hexToBytes(roomKeyHex));
			const wrappedCek = hexToBytes(wrappedKeyHex);
			const cek = await unwrapKey(wrappedCek, roomKey);
			const cekKey = await deriveAesKey(cek);
			const url = `${GATEWAY}/${cid}`;
			const response = await fetch(url);
			if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
			const encryptedData = await response.arrayBuffer();
			const decrypted = await decryptFile(encryptedData, cekKey);
			return new Blob([decrypted]);
		},
		[],
	);

	const uploadPlain = useCallback(async (file: File): Promise<{ cid: string; encodedName: string }> => {
		if (!clientRef.current) {
			throw new Error("Storacha client not initialized. Call initialize() first.");
		}
		setIsUploading(true);
		try {
			const cid = await clientRef.current.uploadFile(file);
			const encodedName = btoa(file.name);
			return { cid: cid.toString(), encodedName };
		} finally {
			setIsUploading(false);
		}
	}, []);

	const downloadPlain = useCallback(async (cid: string): Promise<Blob> => {
		const url = `${GATEWAY}/${cid}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
		return new Blob([await response.arrayBuffer()]);
	}, []);

	const downloadEncryptedBlob = useCallback(async (cid: string): Promise<Blob> => {
		const url = `${GATEWAY}/${cid}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
		return new Blob([await response.arrayBuffer()], { type: "application/octet-stream" });
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
