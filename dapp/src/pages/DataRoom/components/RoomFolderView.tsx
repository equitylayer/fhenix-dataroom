import { useState } from "react";
import { useAccount } from "wagmi";
import { Plus, Users, UserPlus, UserMinus, Loader2, AlertTriangle } from "lucide-react";
import {
	useRoom,
	useAccessibleFolders,
	useCreateFolder,
	useGrantAccessToAllFolders,
	useRevokeAccessFromAllFolders,
} from "@/hooks/dataroom";
import type { HexAddress } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderCard } from "../FolderCard";

interface IRoomFolderViewProps {
	dataRoomAddress: HexAddress;
	roomId: bigint;
	onSelectFolder: (folderId: bigint) => void;
}

export function RoomFolderView({ dataRoomAddress, roomId, onSelectFolder }: IRoomFolderViewProps) {
	const { address } = useAccount();
	const { data: roomData } = useRoom(dataRoomAddress, roomId);
	const {
		createFolder,
		isPending: isCreatingFolder,
		isConfirming: isConfirmingFolder,
		error: createFolderError,
	} = useCreateFolder(dataRoomAddress);
	const {
		grantAccessToAllFolders,
		isPending: isGrantingAll,
		isConfirming: isConfirmingGrantAll,
		error: grantAllError,
	} = useGrantAccessToAllFolders(dataRoomAddress);
	const {
		revokeAccessFromAllFolders,
		isPending: isRevokingAll,
		isConfirming: isConfirmingRevokeAll,
		error: revokeAllError,
	} = useRevokeAccessFromAllFolders(dataRoomAddress);

	const [showCreateFolder, setShowCreateFolder] = useState(false);
	const [folderName, setFolderName] = useState("");
	const [bulkMember, setBulkMember] = useState("");
	const isOwner = !!address && !!roomData && roomData.owner.toLowerCase() === address.toLowerCase();
	const isShareBusy = isGrantingAll || isConfirmingGrantAll || isRevokingAll || isConfirmingRevokeAll;
	const { data: folderIds } = useAccessibleFolders(dataRoomAddress, roomId, isOwner);

	if (!roomData) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading data room...
			</div>
		);
	}

	const folders = (folderIds as bigint[] | undefined) ?? [];
	const isFolderBusy = isCreatingFolder || isConfirmingFolder;

	const handleCreateFolder = async () => {
		if (!folderName.trim()) return;
		const createdFolderId = await createFolder(roomId, folderName.trim());
		if (createdFolderId === null || createdFolderId === undefined) return;
		setFolderName("");
		setShowCreateFolder(false);
		onSelectFolder(createdFolderId);
	};

	const handleGrantAll = () => {
		if (!bulkMember.trim()) return;
		grantAccessToAllFolders(roomId, bulkMember.trim());
		setBulkMember("");
	};

	const handleRevokeAll = () => {
		if (!bulkMember.trim()) return;
		revokeAccessFromAllFolders(roomId, bulkMember.trim());
		setBulkMember("");
	};

	return (
		<div id="folders" className="scroll-mt-24">
			<div className="flex gap-6 items-start">
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between mb-4">
						<h3 className="font-semibold text-sm">Folders</h3>
						{isOwner && (
							<Button variant="textLink" onClick={() => setShowCreateFolder(true)} size="sm">
								<Plus className="h-4 w-4" />
								New Folder
							</Button>
						)}
					</div>

					{isOwner && showCreateFolder && (
						<div className="border border-border rounded-lg bg-card p-4 mb-4 shadow-sm">
							<h3 className="font-semibold text-sm mb-3">New Folder</h3>
							<div className="flex gap-3 items-center">
								<Input
									type="text"
									value={folderName}
									onChange={(e) => setFolderName(e.target.value)}
									placeholder="Folder name (e.g. Legal, Financials)"
									className="flex-1"
									onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
								/>
								<Button onClick={handleCreateFolder} disabled={isFolderBusy}>
									{isCreatingFolder && "Signing..."}
									{!isCreatingFolder && isConfirmingFolder && "Confirming..."}
									{!isCreatingFolder && !isConfirmingFolder && "Create"}
								</Button>
								<Button variant="ghost" size="sm" onClick={() => setShowCreateFolder(false)}>
									Cancel
								</Button>
							</div>
						</div>
					)}

					{createFolderError && (
						<div className="mb-4 rounded-lg px-3 py-2 text-xs bg-destructive/10 text-destructive">
							<AlertTriangle className="h-3 w-3 inline mr-1" />
							{createFolderError.message}
						</div>
					)}

					{isFolderBusy && (
						<div className="border border-border rounded-lg bg-card p-4 mb-4 flex items-center gap-3 text-sm text-muted-foreground shadow-sm">
							<Loader2 className="h-4 w-4 animate-spin" />
							{isCreatingFolder ? "Waiting for signature..." : "Confirming transaction..."}
						</div>
					)}

					{folders.length === 0 && !isFolderBusy ? (
						<div className="border border-dashed border-border rounded-lg bg-card py-16 text-center text-muted-foreground text-sm shadow-sm">
							No folders yet.{isOwner ? " Create one to start adding documents." : ""}
						</div>
					) : (
						<div className="grid gap-3 sm:grid-cols-2">
							{folders.map((fId) => (
								<FolderCard
									key={fId.toString()}
									dataRoomAddress={dataRoomAddress}
									folderId={fId}
									isOwner={isOwner}
									onSelect={() => onSelectFolder(fId)}
								/>
							))}
						</div>
					)}
				</div>

				{isOwner && folders.length > 0 && (
					<div className="hidden lg:block w-64 shrink-0">
						<div className="border border-border rounded-lg bg-card p-4 shadow-sm">
							<h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
								<Users className="h-4 w-4" />
								Share access
							</h3>
							<p className="text-xs text-muted-foreground mb-3">Grant or revoke across all folders.</p>
							<Input
								type="text"
								value={bulkMember}
								onChange={(e) => setBulkMember(e.target.value)}
								placeholder="0x..."
								className="w-full text-xs font-mono mb-2"
							/>
							{isShareBusy ? (
								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									{(isGrantingAll || isRevokingAll) && "Waiting for signature..."}
									{(isConfirmingGrantAll || isConfirmingRevokeAll) && "Confirming transaction..."}
								</div>
							) : (
								<div className="flex gap-2">
									<Button
										variant="textLink"
										size="icon"
										onClick={handleGrantAll}
										disabled={!bulkMember.trim()}
										title="Grant access to all folders"
										className="flex-1"
									>
										<UserPlus className="h-3.5 w-3.5" />
									</Button>
									<Button
										variant="dangerLink"
										size="icon"
										onClick={handleRevokeAll}
										disabled={!bulkMember.trim()}
										title="Revoke access from all folders"
										className="flex-1"
									>
										<UserMinus className="h-3.5 w-3.5" />
									</Button>
								</div>
							)}
							{grantAllError && (
								<div className="mt-2 rounded px-2 py-1.5 text-xs bg-destructive/10 text-destructive">
									<AlertTriangle className="h-3 w-3 inline mr-1" />
									{grantAllError.message}
								</div>
							)}
							{revokeAllError && (
								<div className="mt-2 rounded px-2 py-1.5 text-xs bg-destructive/10 text-destructive">
									<AlertTriangle className="h-3 w-3 inline mr-1" />
									{revokeAllError.message}
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
