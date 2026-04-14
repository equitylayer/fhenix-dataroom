import { useState } from "react";
import { AlertTriangle, Loader2, UserMinus } from "lucide-react";
import { isAddress } from "viem";
import {
	useGrantAccessToAllFolders,
	useRevokeAccessFromAllFolders,
	useRoomAccessSummary,
} from "@/hooks/dataroom";
import { Button } from "@/components/ui/button";
import { CopyableAddress } from "@/components/Button/CopyableAddress";
import { Input } from "@/components/ui/input";
import type { HexAddress } from "@/lib/contracts";

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

	const [address, setAddress] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);
	const [revokingAddr, setRevokingAddr] = useState<string | null>(null);

	const isBusy = isGranting || isConfirmingGrant || isRevoking || isConfirmingRevoke;
	const err = validationError || grantError?.message || revokeError?.message;

	const handleGrant = async () => {
		const v = address.trim();
		if (!v) return setValidationError("Enter an address");
		if (!isAddress(v)) return setValidationError("Not a valid address");
		if (summary?.roomWideSet.has(v.toLowerCase()))
			return setValidationError("Already has room-wide access");
		setValidationError(null);
		await grantAccessToAllFolders(roomId, v);
		setAddress("");
	};

	const handleRevoke = async (addr: string) => {
		setValidationError(null);
		setRevokingAddr(addr);
		try {
			await revokeAccessFromAllFolders(roomId, addr);
		} finally {
			setRevokingAddr(null);
		}
	};

	const roomWide = summary?.roomWide ?? [];

	return (
		<div className="space-y-3">
			<div className="flex gap-2">
				<Input
					type="text"
					value={address}
					onChange={(e) => setAddress(e.target.value)}
					placeholder="0x..."
					className="flex-1"
					style={{ fontFamily: "monospace" }}
					onKeyDown={(e) => e.key === "Enter" && handleGrant()}
					disabled={isBusy}
				/>
				<Button size="sm" onClick={handleGrant} disabled={isBusy}>
					{isGranting || isConfirmingGrant ? "..." : "Grant"}
				</Button>
			</div>

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

			{isLoading ? (
				<p className="text-xs text-muted-foreground">Loading grantees…</p>
			) : roomWide.length === 0 ? (
				<p className="text-xs text-muted-foreground">No room-wide grants yet.</p>
			) : (
				<div className="space-y-1">
					{roomWide.map((addr) => (
						<div
							key={addr}
							className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-card"
						>
							<CopyableAddress value={addr} />
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
					))}
				</div>
			)}
		</div>
	);
}
