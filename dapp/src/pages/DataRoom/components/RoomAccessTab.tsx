import { useState } from "react";
import { AlertTriangle, FolderOpen, Loader2, RefreshCw, Shield } from "lucide-react";
import { useReEncryptRoom, useRoomAccessSummary } from "@/hooks/dataroom";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ModalActions } from "@/components/ui/ModalActions";
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
	const { reEncryptRoom, progress } = useReEncryptRoom(dataRoomAddress);
	const [showReEncrypt, setShowReEncrypt] = useState(false);

	const folderIds = summary?.folderIds ?? [];
	const inheritedSet = summary?.roomWideSet ?? new Set<string>();
	const isBusy = progress.phase !== "idle" && progress.phase !== "done" && progress.phase !== "error";

	const handleReEncrypt = async () => {
		setShowReEncrypt(false);
		await reEncryptRoom(roomId);
	};

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

				{!isBusy && progress.phase !== "error" && folderIds.length > 0 && (
					<div className="flex justify-end pt-1">
						<Button
							variant="textLink"
							size="xs"
							onClick={() => setShowReEncrypt(true)}
							className="!text-[0.65rem] !text-muted-foreground"
						>
							Re-encrypt room
						</Button>
					</div>
				)}

				{isBusy && (
					<div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-1">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						{progress.phase === "rekeying" &&
							`Re-keying folder ${progress.folderCurrent}/${progress.folderTotal}…`}
						{progress.phase === "rewrapping" &&
							`Re-wrapping folder ${progress.folderCurrent}/${progress.folderTotal} — doc ${progress.docCurrent}/${progress.docTotal}…`}
						{progress.phase === "updating" &&
							`Saving folder ${progress.folderCurrent}/${progress.folderTotal}…`}
					</div>
				)}

				{progress.phase === "error" && (
					<div className="rounded px-3 py-2 text-xs bg-destructive/10 text-destructive flex items-center justify-between gap-2">
						<span className="flex items-center gap-1 min-w-0">
							<AlertTriangle className="h-3 w-3 shrink-0" />
							<span className="truncate">{progress.error}</span>
						</span>
						<Button variant="textLink" size="xs" onClick={handleReEncrypt}>
							<RefreshCw className="h-3 w-3" />
							Retry
						</Button>
					</div>
				)}
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

			<Modal
				open={showReEncrypt}
				onOpenChange={setShowReEncrypt}
				title="Re-encrypt room"
				description="Generate fresh encryption keys for every folder and re-wrap all documents."
			>
				<div className="rounded px-3 py-2 text-xs bg-muted mb-4">
					<p className="font-semibold mb-1">What this does:</p>
					<ul className="ml-4 list-disc space-y-0.5">
						<li>Re-key each of the {folderIds.length} folder{folderIds.length === 1 ? "" : "s"}</li>
						<li>Re-wrap every document's encryption key with the new folder key</li>
						<li>Save updated keys on-chain</li>
						<li>Previously revoked users can no longer decrypt, even cached values</li>
					</ul>
					<p className="mt-2 font-semibold">
						Requires signing {folderIds.length} rekey transaction{folderIds.length === 1 ? "" : "s"} + {folderIds.length} update{folderIds.length === 1 ? "" : "s"}.
					</p>
				</div>
				<ModalActions
					onCancel={() => setShowReEncrypt(false)}
					onSubmit={handleReEncrypt}
					submitText="Re-encrypt"
					loadingText="Processing…"
					isLoading={false}
				/>
			</Modal>
		</div>
	);
}
