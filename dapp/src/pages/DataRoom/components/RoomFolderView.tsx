import { useState } from "react";
import { useAccount } from "wagmi";
import { FolderOpen, Plus, Shield, Loader2, AlertTriangle } from "lucide-react";
import { useRoom, useAccessibleFolders, useCreateFolder } from "@/hooks/dataroom";
import type { HexAddress } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FolderCard } from "../FolderCard";
import { RoomAccessTab } from "./RoomAccessTab";

interface IRoomFolderViewProps {
	dataRoomAddress: HexAddress;
	roomId: bigint;
	onSelectFolder: (folderId: bigint) => void;
}

type Tab = "folders" | "access";

export function RoomFolderView({ dataRoomAddress, roomId, onSelectFolder }: IRoomFolderViewProps) {
	const { address } = useAccount();
	const { data: roomData } = useRoom(dataRoomAddress, roomId);
	const {
		createFolder,
		isPending: isCreatingFolder,
		isConfirming: isConfirmingFolder,
		error: createFolderError,
	} = useCreateFolder(dataRoomAddress);

	const [showCreateFolder, setShowCreateFolder] = useState(false);
	const [folderName, setFolderName] = useState("");
	const [activeTab, setActiveTab] = useState<Tab>("folders");

	const isOwner = !!address && !!roomData && roomData.owner.toLowerCase() === address.toLowerCase();
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

	const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
		{ key: "folders", label: "Folders", icon: <FolderOpen className="h-3.5 w-3.5" /> },
		...(isOwner ? [{ key: "access" as Tab, label: "Access", icon: <Shield className="h-3.5 w-3.5" /> }] : []),
	];

	return (
		<div className="space-y-6">
			{tabs.length > 1 && (
				<div className="flex justify-end">
					<div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
						{tabs.map((tab) => (
							<button
								key={tab.key}
								type="button"
								onClick={() => setActiveTab(tab.key)}
								className={cn(
									"inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs orbitron uppercase tracking-wider transition-colors cursor-pointer",
									"!border-none !shadow-none",
									activeTab === tab.key
										? "!bg-primary/10 !text-primary"
										: "!bg-transparent !text-muted-foreground hover:!text-foreground hover:!bg-accent/50",
								)}
							>
								{tab.icon}
								{tab.label}
							</button>
						))}
					</div>
				</div>
			)}

			{activeTab === "folders" && (
				<div id="folders" className="scroll-mt-24">
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
						<div className="border border-dashed border-border rounded-lg bg-card py-12 text-center text-muted-foreground text-sm shadow-sm">
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
			)}

			{activeTab === "access" && isOwner && (
				<RoomAccessTab dataRoomAddress={dataRoomAddress} roomId={roomId} isOwner={isOwner} />
			)}
		</div>
	);
}
