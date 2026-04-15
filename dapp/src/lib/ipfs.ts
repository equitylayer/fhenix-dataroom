const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || "";
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

export function isIPFSConfigured(): boolean {
	return !!PINATA_JWT;
}

export async function uploadFileToIPFS(file: File): Promise<string> {
	if (!PINATA_JWT) throw new Error("File storage not configured (VITE_PINATA_JWT missing).");

	const formData = new FormData();
	formData.append("file", file);

	const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
		method: "POST",
		headers: { Authorization: `Bearer ${PINATA_JWT}` },
		body: formData,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`IPFS upload failed: ${response.status} ${response.statusText} — ${errorText}`);
	}

	const data = (await response.json()) as { IpfsHash: string };
	if (!data.IpfsHash) throw new Error("IPFS upload: missing IpfsHash in response");
	return data.IpfsHash;
}

export async function fetchFromIPFS(cid: string): Promise<ArrayBuffer> {
	const url = `${IPFS_GATEWAY}/${cid}`;
	const response = await fetch(url);
	if (!response.ok) throw new Error(`IPFS fetch failed: ${response.status}`);
	return response.arrayBuffer();
}
