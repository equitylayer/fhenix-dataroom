import { useQuery } from "@tanstack/react-query";
import { getDataRoomSignerContract, useSignerAndAccount, CHAIN_ID, type HexAddress } from "./shared";

export function useVisibleParentRooms(dataRoomAddress: HexAddress | undefined) {
	const { signerPromise, account } = useSignerAndAccount({ chainId: CHAIN_ID });

	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "visibleParentRooms", account],
		queryFn: async () => {
			const contract = await getDataRoomSignerContract(dataRoomAddress!, signerPromise!);
			const total = Number(await contract.roomCount());
			const owned: bigint[] = [];
			const shared: bigint[] = [];

			for (let i = 0; i < total; i++) {
				const roomId = BigInt(i);
				const [room, owner] = await Promise.all([contract.getRoom(roomId), contract.ownerOf(roomId)]);

				if (!room.isParent) continue;

				if (owner.toLowerCase() === account!.toLowerCase()) {
					owned.push(roomId);
					continue;
				}

				const folderIds = await contract.getFolders(roomId);
				if (folderIds.length === 0) continue;

				const accessFlags = await Promise.all(folderIds.map((folderId) => contract.hasAccess(folderId)));
				if (accessFlags.some(Boolean)) {
					shared.push(roomId);
				}
			}

			return { owned, shared };
		},
		enabled: !!signerPromise && !!account && !!dataRoomAddress,
		structuralSharing: false,
	});
}
