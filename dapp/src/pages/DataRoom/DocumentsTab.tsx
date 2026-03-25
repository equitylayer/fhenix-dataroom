import { useState } from "react";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { useCreateRoom, useVisibleParentRooms } from "@/hooks/dataroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoomCard } from "./RoomCard";
import { FolderPanel } from "./FolderPanel";
import { RoomFolderView } from "./components/RoomFolderView";
import { DataRoomBreadcrumb } from "./components/DataRoomBreadcrumb";
import type { HexAddress } from "@/lib/contracts";

export function DocumentsTab({ dataRoomAddress }: { dataRoomAddress: HexAddress }) {
	const {
		createRoom,
		isPending: isCreatingRoom,
		isConfirming: isConfirmingRoom,
		error: createRoomError,
	} = useCreateRoom(dataRoomAddress);
	const { data: visibleRooms, isLoading: isLoadingVisibleRooms } = useVisibleParentRooms(dataRoomAddress);

	const [showCreateRoom, setShowCreateRoom] = useState(false);
	const [roomName, setRoomName] = useState("");
	const [selectedRoomId, setSelectedRoomId] = useState<bigint | null>(null);
	const [selectedFolderId, setSelectedFolderId] = useState<bigint | null>(null);

	const handleCreateRoom = async () => {
		if (!roomName.trim()) return;
		const createdRoomId = await createRoom(roomName.trim());
		if (createdRoomId === null || createdRoomId === undefined) return;
		setRoomName("");
		setShowCreateRoom(false);
		setSelectedFolderId(null);
		setSelectedRoomId(createdRoomId);
	};

	if (selectedRoomId !== null && selectedFolderId !== null) {
		return (
			<div>
				<DataRoomBreadcrumb
					dataRoomAddress={dataRoomAddress}
					selectedRoomId={selectedRoomId}
					selectedFolderId={selectedFolderId}
					onNavigateToRooms={() => {
						setSelectedRoomId(null);
						setSelectedFolderId(null);
					}}
					onNavigateToRoom={() => setSelectedFolderId(null)}
				/>
				<FolderPanel
					dataRoomAddress={dataRoomAddress}
					folderId={selectedFolderId}
				/>
			</div>
		);
	}

	if (selectedRoomId !== null) {
		return (
			<div>
				<DataRoomBreadcrumb
					dataRoomAddress={dataRoomAddress}
					selectedRoomId={selectedRoomId}
					selectedFolderId={null}
					onNavigateToRooms={() => {
						setSelectedRoomId(null);
						setSelectedFolderId(null);
					}}
					onNavigateToRoom={() => setSelectedFolderId(null)}
				/>
				<RoomFolderView
					dataRoomAddress={dataRoomAddress}
					roomId={selectedRoomId}
					onSelectFolder={(folderId) => setSelectedFolderId(folderId)}
				/>
			</div>
		);
	}

	const ownedRooms = visibleRooms?.owned ?? [];
	const sharedRooms = visibleRooms?.shared ?? [];

	return (
		<div>
			<div id="my-data-rooms" className="scroll-mt-24">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-semibold">My Data Rooms</h2>
					<Button variant="textLink" onClick={() => setShowCreateRoom(true)} size="sm">
						<Plus className="h-4 w-4" />
						New Data Room
					</Button>
				</div>

				{showCreateRoom && (
					<div className="border border-border rounded-lg bg-card p-4 mb-4 shadow-sm">
						<h3 className="font-semibold text-sm mb-3">New Data Room</h3>
						<div className="flex gap-3 items-center">
							<Input
								type="text"
								value={roomName}
								onChange={(e) => setRoomName(e.target.value)}
								placeholder="Data room name (e.g. Series A, Due Diligence)"
								className="flex-1"
								onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
							/>
							<Button onClick={handleCreateRoom} disabled={isCreatingRoom || isConfirmingRoom}>
								{isCreatingRoom && "Signing..."}
								{!isCreatingRoom && isConfirmingRoom && "Confirming..."}
								{!isCreatingRoom && !isConfirmingRoom && "Create"}
							</Button>
							<Button variant="ghost" size="sm" onClick={() => setShowCreateRoom(false)}>
								Cancel
							</Button>
						</div>
					</div>
				)}

				{(isCreatingRoom || isConfirmingRoom) && (
					<div className="border border-border rounded-lg bg-card p-4 mb-4 flex items-center gap-3 text-sm text-muted-foreground shadow-sm">
						<Loader2 className="h-4 w-4 animate-spin" />
						{isCreatingRoom ? "Waiting for signature..." : "Confirming transaction..."}
					</div>
				)}

				{createRoomError && (
					<div className="mb-4 rounded-lg px-3 py-2 text-xs bg-destructive/10 text-destructive">
						<AlertTriangle className="h-3 w-3 inline mr-1" />
						{createRoomError.message}
					</div>
				)}

				{isLoadingVisibleRooms ? (
					<div className="border border-border rounded-lg bg-card p-4 mb-4 flex items-center gap-3 text-sm text-muted-foreground shadow-sm">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading data rooms...
					</div>
				) : ownedRooms.length === 0 && !isCreatingRoom && !isConfirmingRoom ? (
					<div className="border border-dashed border-border rounded-lg bg-card py-16 text-center text-muted-foreground text-sm shadow-sm">
						No data rooms yet. Create one to get started.
					</div>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{ownedRooms.map((roomId) => (
							<RoomCard
								key={roomId.toString()}
								dataRoomAddress={dataRoomAddress}
								roomId={roomId}
								onSelect={() => setSelectedRoomId(roomId)}
							/>
						))}
					</div>
				)}
			</div>

			<div id="shared-with-me" className="scroll-mt-24 mt-14">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-semibold">Shared With Me</h2>
				</div>

				{isLoadingVisibleRooms ? (
					<div className="border border-border rounded-lg bg-card p-4 mb-4 flex items-center gap-3 text-sm text-muted-foreground shadow-sm">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading shared rooms...
					</div>
				) : sharedRooms.length === 0 ? (
					<div className="border border-dashed border-border rounded-lg bg-card py-16 text-center text-muted-foreground text-sm shadow-sm">
						No data rooms shared with you yet.
					</div>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{sharedRooms.map((roomId) => (
							<RoomCard
								key={roomId.toString()}
								dataRoomAddress={dataRoomAddress}
								roomId={roomId}
								onSelect={() => setSelectedRoomId(roomId)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
