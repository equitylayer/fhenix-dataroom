import { useQuery } from "@tanstack/react-query";
import { getDataRoomSignerContract, useSignerAndAccount, CHAIN_ID, type HexAddress } from "./shared";

export function useRoomMembers(dataRoomAddress: HexAddress | undefined, roomId: bigint | undefined, enabled = true) {
	const { signerPromise, account } = useSignerAndAccount({ chainId: CHAIN_ID });
	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "members", roomId?.toString(), account],
		queryFn: async () => {
			const contract = await getDataRoomSignerContract(dataRoomAddress!, signerPromise!);
			return contract.getMembers(roomId!);
		},
		enabled: !!signerPromise && !!dataRoomAddress && roomId !== undefined && enabled,
		structuralSharing: false,
	});
}
