import { useQuery } from "@tanstack/react-query";
import { useDataRoomContract, type HexAddress } from "./shared";

export function useRoom(dataRoomAddress: HexAddress | undefined, roomId: bigint | undefined) {
	const contract = useDataRoomContract(dataRoomAddress);
	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "room", roomId?.toString()],
		queryFn: () => contract!.getRoom(roomId!),
		enabled: !!contract && roomId !== undefined,
		structuralSharing: false,
	});
}
