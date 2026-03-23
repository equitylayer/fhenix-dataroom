/**
 * Formats an Ethereum address to a shortened format
 * @param address - The Ethereum address to format
 * @param prefixLength - Number of characters to show at start (default: 6)
 * @param suffixLength - Number of characters to show at end (default: 4)
 * @returns Formatted address like "0x1234...5678" or null if invalid
 */
export function formatAddress(address?: string | null, prefixLength = 6, suffixLength = 4): string | null {
	if (!address) return null;
	if (address.length <= prefixLength + suffixLength) return address;
	return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}
