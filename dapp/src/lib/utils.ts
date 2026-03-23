import type { HexAddress } from "@/lib/contracts.ts";
import { type ClassValue, clsx } from "clsx";
import { ethers } from "ethers";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const ZERO_ADDRESS = ethers.ZeroAddress as HexAddress;

export { formatAddress } from "./formatters";

export function saveBlob(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	Object.assign(document.createElement("a"), { href: url, download: name }).click();
	URL.revokeObjectURL(url);
}
