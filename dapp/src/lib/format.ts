import type { Grantee } from "@obolos/secretsvault-sdk";

export function formatExpiry(grantee: Grantee): string {
	if (grantee.permanent) return "Permanent";
	if (grantee.expired) return "Expired";
	return new Date(Number(grantee.expiresAt) * 1000).toLocaleString();
}

export function shortenAddress(addr: string): string {
	return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
