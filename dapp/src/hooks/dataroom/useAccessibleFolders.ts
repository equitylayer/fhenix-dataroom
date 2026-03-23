import { useQuery } from "@tanstack/react-query";
import { getDataRoomSignerContract, useSignerAndAccount, CHAIN_ID, type HexAddress } from "./shared";

export function useAccessibleFolders(
	dataRoomAddress: HexAddress | undefined,
	parentId: bigint | undefined,
	isOwner: boolean,
) {
	const { signerPromise, account } = useSignerAndAccount({ chainId: CHAIN_ID });
	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "accessibleFolders", parentId?.toString(), isOwner, account],
		queryFn: async () => {
			const contract = await getDataRoomSignerContract(dataRoomAddress!, signerPromise!);
			const folderIds = await contract.getFolders(parentId!);
			if (isOwner || folderIds.length === 0) return folderIds;
			const flags = await Promise.all(folderIds.map((fId) => contract.hasAccess(fId)));
			return folderIds.filter((_, i) => flags[i]);
		},
		enabled: !!signerPromise && !!dataRoomAddress && parentId !== undefined,
		structuralSharing: false,
	});
}
