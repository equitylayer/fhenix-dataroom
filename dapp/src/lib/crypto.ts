const ALGO = "AES-GCM";
const IV_BYTES = 12;

export async function deriveAesKey(roomKeyBytes: Uint8Array): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", roomKeyBytes.buffer as ArrayBuffer, { name: ALGO }, false, [
		"encrypt",
		"decrypt",
	]);
}

export async function encryptFile(file: File, aesKey: CryptoKey): Promise<{ encrypted: Blob; filename: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const plaintext = await file.arrayBuffer();
	const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, aesKey, plaintext);
	const blob = new Blob([iv, ciphertext], { type: "application/octet-stream" });
	const encodedName = btoa(file.name);
	return { encrypted: blob, filename: encodedName };
}

export async function decryptFile(encryptedData: ArrayBuffer, aesKey: CryptoKey): Promise<ArrayBuffer> {
	const data = new Uint8Array(encryptedData);
	const iv = data.slice(0, IV_BYTES);
	const ciphertext = data.slice(IV_BYTES);
	return crypto.subtle.decrypt({ name: ALGO, iv }, aesKey, ciphertext);
}

export async function encryptBuffer(plaintext: ArrayBuffer, aesKey: CryptoKey): Promise<Blob> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, aesKey, plaintext);
	return new Blob([iv, ciphertext], { type: "application/octet-stream" });
}

export function hexToBytes(hex: string): Uint8Array {
	const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
	const bytes = new Uint8Array(clean.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
	return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateCek(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(32));
}

export async function wrapKey(cek: Uint8Array, wrappingKey: CryptoKey): Promise<Uint8Array> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, wrappingKey, cek.buffer as ArrayBuffer);
	const result = new Uint8Array(iv.length + ciphertext.byteLength);
	result.set(iv, 0);
	result.set(new Uint8Array(ciphertext), iv.length);
	return result;
}

export async function unwrapKey(wrapped: Uint8Array, wrappingKey: CryptoKey): Promise<Uint8Array> {
	if (wrapped.length < IV_BYTES + 16) throw new Error("Wrapped key too short");
	const iv = wrapped.slice(0, IV_BYTES);
	const ciphertext = wrapped.slice(IV_BYTES);
	const plaintext = await crypto.subtle.decrypt({ name: ALGO, iv }, wrappingKey, ciphertext);
	return new Uint8Array(plaintext);
}
