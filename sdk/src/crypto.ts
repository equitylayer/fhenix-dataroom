const ALGO = "AES-GCM";
export const IV_BYTES = 12;

function hexToBytes(hex: string): Uint8Array {
	const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
	const bytes = new Uint8Array(clean.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

async function deriveAesKey(keyBytes: Uint8Array): Promise<CryptoKey> {
	const buf = new ArrayBuffer(keyBytes.byteLength);
	new Uint8Array(buf).set(keyBytes);
	return crypto.subtle.importKey("raw", buf, { name: ALGO }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string, keyHex: string): Promise<Uint8Array> {
	const keyBytes = hexToBytes(keyHex);
	const aesKey = await deriveAesKey(keyBytes.slice(0, 16));
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const encoded = new TextEncoder().encode(value);
	const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, aesKey, encoded);

	const result = new Uint8Array(iv.length + ciphertext.byteLength);
	result.set(iv, 0);
	result.set(new Uint8Array(ciphertext), iv.length);
	return result;
}

export async function decryptSecret(encrypted: Uint8Array, keyHex: string): Promise<string> {
	const keyBytes = hexToBytes(keyHex);
	const aesKey = await deriveAesKey(keyBytes.slice(0, 16));

	if (encrypted.length < IV_BYTES + 16) {
		throw new Error("Encrypted data too short");
	}

	const iv = encrypted.slice(0, IV_BYTES);
	const ciphertext = encrypted.slice(IV_BYTES);
	const plaintext = await crypto.subtle.decrypt({ name: ALGO, iv }, aesKey, ciphertext);
	return new TextDecoder().decode(plaintext);
}
