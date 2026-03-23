import { useQuery } from "@tanstack/react-query";
import { useDataRoomContract, type HexAddress } from "./shared";

export function useRoom(dataRoomAddress: HexAddress | undefined, roomId: bigint | undefined) {
	const contract = useDataRoomContract(dataRoomAddress);
	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "room", roomId?.toString()],
		queryFn: async () => {
			const [room, owner] = await Promise.all([contract!.getRoom(roomId!), contract!.ownerOf(roomId!)]);
			return {
				owner,
				name: room.name,
				documentCount: room.documentCount,
				memberCount: room.memberCount,
				isParent: room.isParent,
				parentId: room.parentId,
				childCount: room.childCount,
			};
		},
		enabled: !!contract && roomId !== undefined,
		structuralSharing: false,
	});
}
