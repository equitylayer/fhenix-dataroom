import { useQuery } from "@tanstack/react-query";
import { getDataRoomSignerContract, useSignerAndAccount, CHAIN_ID, type HexAddress } from "./shared";

export function useDocument(
	dataRoomAddress: HexAddress | undefined,
	roomId: bigint | undefined,
	docIndex: bigint | undefined,
) {
	const { signerPromise, account } = useSignerAndAccount({ chainId: CHAIN_ID });
	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "document", roomId?.toString(), docIndex?.toString(), account],
		queryFn: async () => {
			const contract = await getDataRoomSignerContract(dataRoomAddress!, signerPromise!);
			return contract.getDocument(roomId!, docIndex!);
		},
		enabled: !!signerPromise && !!dataRoomAddress && roomId !== undefined && docIndex !== undefined,
		retry: false,
		structuralSharing: false,
	});
}
