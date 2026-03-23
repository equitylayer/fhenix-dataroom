import { useQuery } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import { DataRoom__factory, useSignerAndAccount, CHAIN_ID, type HexAddress } from "./shared";
import { decryptRoomKey, getCachedKey } from "@/lib/fhe";

export function useRoomKeyHandle(dataRoomAddress: HexAddress | undefined, roomId: bigint | undefined) {
	const { signerPromise, account } = useSignerAndAccount({ chainId: CHAIN_ID });
	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "roomKeyHandle", roomId?.toString(), account],
		queryFn: async () => {
			const signer = await signerPromise!;
			const contract = DataRoom__factory.connect(dataRoomAddress!, signer);
			return contract.getRoomKey(roomId!);
		},
		enabled: !!signerPromise && !!dataRoomAddress && roomId !== undefined,
		retry: false,
		structuralSharing: false,
	});
}

export function useRoomKey(
	dataRoomAddress: HexAddress | undefined,
	roomId: bigint | undefined,
	handle: string | undefined,
	decryptEnabled: boolean,
) {
	const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });

	return useQuery({
		queryKey: ["dataroom", dataRoomAddress, "roomKey", roomId?.toString(), handle],
		queryFn: async () => {
			const cached = getCachedKey(handle!);
			if (cached) return cached;

			if (!walletClient) {
				throw new Error("Waiting for wallet");
			}
			return decryptRoomKey(handle!, walletClient);
		},
		enabled: decryptEnabled && !!handle,
		staleTime: Infinity,
		retry: (count, error) => {
			if (error instanceof Error && error.message === "Waiting for wallet") return count < 20;
			return false;
		},
		retryDelay: 500,
		structuralSharing: false,
	});
}
