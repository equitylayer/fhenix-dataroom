import { useState } from "react";
import { useAccount } from "wagmi";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { useRoomCount, useCreateRoom } from "@/hooks/dataroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoomCard } from "./RoomCard";
import { FolderPanel } from "./FolderPanel";
import { RoomFolderView } from "./components/RoomFolderView";
import { DataRoomBreadcrumb } from "./components/DataRoomBreadcrumb";
import type { HexAddress } from "@/lib/contracts";

export function DocumentsTab({
	dataRoomAddress,
	adminAddress,
}: {
	dataRoomAddress: HexAddress;
	adminAddress: string;
}) {
	const { address } = useAccount();

	const isAdmin = !!address && adminAddress.toLowerCase() === address.toLowerCase();

	const { data: roomCount } = useRoomCount(dataRoomAddress);
	const {
		createRoom,
		isPending: isCreatingRoom,
		isConfirming: isConfirmingRoom,
		error: createRoomError,
	} = useCreateRoom(dataRoomAddress);

	const [showCreateRoom, setShowCreateRoom] = useState(false);
	const [roomName, setRoomName] = useState("");
	const [selectedRoomId, setSelectedRoomId] = useState<bigint | null>(null);
	const [selectedFolderId, setSelectedFolderId] = useState<bigint | null>(null);

	const count = roomCount ? Number(roomCount) : 0;

	const handleCreateRoom = () => {
		if (!roomName.trim()) return;
		createRoom(roomName.trim());
		setRoomName("");
		setShowCreateRoom(false);
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
					boardAddress={adminAddress}
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
					isAdmin={isAdmin}
					onSelectFolder={(folderId) => setSelectedFolderId(folderId)}
				/>
			</div>
		);
	}

	return (
		<div>
			<div id="data-rooms" className="scroll-mt-24">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-semibold">Data Rooms</h2>
					{isAdmin && (
						<Button variant="textLink" onClick={() => setShowCreateRoom(true)} size="sm">
							<Plus className="h-4 w-4" />
							New Data Room
						</Button>
					)}
				</div>

				{showCreateRoom && (
					<div className="border border-border rounded-lg p-4 mb-4">
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
					<div className="border border-border rounded-lg p-4 mb-4 flex items-center gap-3 text-sm text-muted-foreground">
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

				{count === 0 && !isCreatingRoom && !isConfirmingRoom ? (
					<div className="border border-dashed border-border rounded-lg py-16 text-center text-muted-foreground text-sm">
						No data rooms yet.{isAdmin ? " Create one to get started." : ""}
					</div>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: count }, (_, i) => (
							<RoomCard
								key={i}
								dataRoomAddress={dataRoomAddress}
								roomId={BigInt(i)}
								onSelect={() => setSelectedRoomId(BigInt(i))}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
