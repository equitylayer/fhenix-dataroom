import { useQuery } from "@tanstack/react-query";
import { getDataRoomSignerContract, useSignerAndAccount, CHAIN_ID, type HexAddress } from "./shared";

/**
 * Access summary for a parent room:
 *   - roomWide: addresses granted via `grantAccessToAllFolders` (tracked on-chain)
 *   - folderIds: all folder IDs under the parent
 *
 * Room-wide intent is read straight from `getRoomWideGrantees` — no inference from
 * per-folder membership, which previously produced false positives (e.g. a single-folder
 * room marked every direct member as "room-wide").
 */
export function useRoomAccessSummary(
	dataRoomAddress: HexAddress | undefined,
	roomId: bigint | undefined,
	isOwner: boolean,
) {
	const { signerPromise, account } = useSignerAndAccount({ chainId: CHAIN_ID });
	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "accessSummary", roomId?.toString(), account],
		queryFn: async () => {
			const contract = await getDataRoomSignerContract(dataRoomAddress!, signerPromise!);
			const [folderIdsRaw, roomWideRaw] = await Promise.all([
				contract.getFolders(roomId!) as Promise<bigint[]>,
				contract.getRoomWideGrantees(roomId!) as Promise<string[]>,
			]);

			const folderIds = folderIdsRaw.map((id) => BigInt(id));
			const roomWide = [...roomWideRaw];
			const roomWideSet = new Set(roomWide.map((a) => a.toLowerCase()));

			// Fetch per-user expiry in parallel. 0 = not a grantee; PERMANENT = no expiry.
			const expiryEntries = await Promise.all(
				roomWide.map(async (addr) => {
					const exp = (await contract.getRoomWideExpiry(roomId!, addr)) as bigint;
					return [addr.toLowerCase(), exp] as const;
				}),
			);
			const roomWideExpiry = new Map<string, bigint>(expiryEntries);

			return { folderIds, roomWide, roomWideSet, roomWideExpiry };
		},
		enabled: !!signerPromise && !!dataRoomAddress && roomId !== undefined && isOwner,
		structuralSharing: false,
	});
}
