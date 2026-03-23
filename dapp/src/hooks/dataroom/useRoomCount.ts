import { useQuery } from "@tanstack/react-query";
import { useDataRoomContract, type HexAddress } from "./shared";

export function useRoomCount(dataRoomAddress: HexAddress | undefined) {
	const contract = useDataRoomContract(dataRoomAddress);
	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "roomCount"],
		queryFn: () => contract!.roomCount(),
		enabled: !!contract,
		structuralSharing: false,
	});
}
