import { useQuery } from "@tanstack/react-query";
import { getDataRoomSignerContract, useSignerAndAccount, CHAIN_ID, type HexAddress } from "./shared";

/**
 * Members whose grant has passed `expiresAt`. Only callable by room owner / operator.
 * Feed the result into `revokeAndRekey` (via `useCommitAccessChanges`) to hard-revoke.
 */
export function useExpiredMembers(
	dataRoomAddress: HexAddress | undefined,
	roomId: bigint | undefined,
	isOwner: boolean,
) {
	const { signerPromise, account } = useSignerAndAccount({ chainId: CHAIN_ID });
	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "expiredMembers", roomId?.toString(), account],
		queryFn: async () => {
			const contract = await getDataRoomSignerContract(dataRoomAddress!, signerPromise!);
			const result = (await contract.getExpiredMembers(roomId!)) as string[];
			return [...result];
		},
		enabled: !!signerPromise && !!dataRoomAddress && roomId !== undefined && isOwner,
		structuralSharing: false,
	});
}
