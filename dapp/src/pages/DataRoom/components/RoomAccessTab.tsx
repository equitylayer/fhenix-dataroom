import { FolderOpen, Shield } from "lucide-react";
import { useRoomAccessSummary } from "@/hooks/dataroom";
import { PerFolderAccessRow } from "./PerFolderAccessRow";
import { RoomWideAccessPanel } from "./RoomWideAccessPanel";
import type { HexAddress } from "@/lib/contracts";

interface Props {
	dataRoomAddress: HexAddress;
	roomId: bigint;
	isOwner: boolean;
}

export function RoomAccessTab({ dataRoomAddress, roomId, isOwner }: Props) {
	const { data: summary } = useRoomAccessSummary(dataRoomAddress, roomId, isOwner);
	const folderIds = summary?.folderIds ?? [];
	const inheritedSet = summary?.roomWideSet ?? new Set<string>();

	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
				<div className="flex items-center gap-2">
					<Shield className="h-4 w-4 text-primary" />
					<h3 className="text-sm font-semibold">Room-wide Access</h3>
				</div>
				<p className="text-xs text-muted-foreground">
					Grant or revoke a wallet across every folder in this room in a single transaction.
				</p>
				<RoomWideAccessPanel dataRoomAddress={dataRoomAddress} roomId={roomId} />
			</div>

			<div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
				<div className="flex items-center gap-2">
					<FolderOpen className="h-4 w-4 text-primary" />
					<h3 className="text-sm font-semibold">Per-Folder Access</h3>
				</div>
				<p className="text-xs text-muted-foreground">
					Grant access to individual folders only.
				</p>

				{folderIds.length === 0 ? (
					<p className="py-6 text-sm text-muted-foreground text-center">No folders yet.</p>
				) : (
					<div className="rounded-md border border-border overflow-hidden divide-y divide-border">
						{folderIds.map((folderId) => (
							<PerFolderAccessRow
								key={folderId.toString()}
								dataRoomAddress={dataRoomAddress}
								folderId={folderId}
								isOwner={isOwner}
								inheritedSet={inheritedSet}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
