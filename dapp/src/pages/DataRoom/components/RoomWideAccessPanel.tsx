import { useState } from "react";
import { AlertTriangle, Loader2, UserMinus } from "lucide-react";
import { GrantAccessForm } from "@/components/access/GrantAccessForm";
import {
	useGrantAccessToAllFolders,
	useRevokeAccessFromAllFolders,
	useRoomAccessSummary,
} from "@/hooks/dataroom";
import { Button } from "@/components/ui/button";
import { CopyableAddress } from "@/components/Button/CopyableAddress";
import { formatExpiry } from "@/lib/format";
import type { HexAddress } from "@/lib/contracts";

const PERMANENT = (1n << 256n) - 1n;

interface Props {
	dataRoomAddress: HexAddress;
	roomId: bigint;
}

export function RoomWideAccessPanel({ dataRoomAddress, roomId }: Props) {
	const { data: summary, isLoading } = useRoomAccessSummary(dataRoomAddress, roomId, true);
	const {
		grantAccessToAllFolders,
		isPending: isGranting,
		isConfirming: isConfirmingGrant,
		error: grantError,
	} = useGrantAccessToAllFolders(dataRoomAddress);
	const {
		revokeAccessFromAllFolders,
		isPending: isRevoking,
		isConfirming: isConfirmingRevoke,
		error: revokeError,
	} = useRevokeAccessFromAllFolders(dataRoomAddress);

	const [revokingAddr, setRevokingAddr] = useState<string | null>(null);

	const isBusy = isGranting || isConfirmingGrant || isRevoking || isConfirmingRevoke;
	const err = grantError?.message || revokeError?.message;

	const handleGrant = async (address: string, expiresAt: bigint) => {
		await grantAccessToAllFolders(roomId, address, expiresAt);
	};

	const handleRevoke = async (addr: string) => {
		setRevokingAddr(addr);
		try {
			await revokeAccessFromAllFolders(roomId, addr);
		} finally {
			setRevokingAddr(null);
		}
	};

	const roomWide = summary?.roomWide ?? [];
	const roomWideExpiry = summary?.roomWideExpiry ?? new Map<string, bigint>();
	const nowSec = BigInt(Math.floor(Date.now() / 1000));

	return (
		<div className="space-y-3">
			<GrantAccessForm onGrant={handleGrant} isPending={isBusy} />

			{isBusy && (
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<Loader2 className="h-3 w-3 animate-spin" />
					{isGranting || isRevoking ? "Waiting for signature…" : "Confirming transaction…"}
				</div>
			)}

			{err && (
				<p className="text-destructive text-xs flex items-center gap-1">
					<AlertTriangle className="h-3 w-3" />
					{err}
				</p>
			)}

			{isLoading && <p className="text-xs text-muted-foreground">Loading grantees…</p>}

			{!isLoading && roomWide.length === 0 && (
				<p className="text-xs text-muted-foreground">No room-wide grants yet.</p>
			)}

			{!isLoading && roomWide.length > 0 && (
				<div className="space-y-1">
					{roomWide.map((addr) => {
						const exp = roomWideExpiry.get(addr.toLowerCase()) ?? 0n;
						const expired = exp !== PERMANENT && exp !== 0n && nowSec >= exp;
						return (
							<div
								key={addr}
								className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-card"
							>
								<div className="min-w-0">
									<CopyableAddress value={addr} />
									<p className={`text-xs ${expired ? "text-destructive" : "text-muted-foreground"}`}>
										{formatExpiry({
											address: addr as HexAddress,
											expiresAt: exp,
											permanent: exp === PERMANENT,
											expired,
										})}
									</p>
								</div>
								<Button
									size="sm"
									variant="dangerLink"
									onClick={() => handleRevoke(addr)}
									disabled={isBusy}
								>
									<UserMinus className="h-3.5 w-3.5" />
									{revokingAddr === addr && (isRevoking || isConfirmingRevoke) ? "…" : "Revoke"}
								</Button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
