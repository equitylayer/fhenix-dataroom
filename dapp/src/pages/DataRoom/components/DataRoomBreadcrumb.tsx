import { useRoom } from "@/hooks/dataroom";
import type { HexAddress } from "@/lib/contracts";

interface IDataRoomBreadcrumbProps {
	dataRoomAddress: HexAddress;
	selectedRoomId: bigint;
	selectedFolderId: bigint | null;
	onNavigateToRooms: () => void;
	onNavigateToRoom: () => void;
}

export function DataRoomBreadcrumb({
	dataRoomAddress,
	selectedRoomId,
	selectedFolderId,
	onNavigateToRooms,
	onNavigateToRoom,
}: IDataRoomBreadcrumbProps) {
	const { data: roomData } = useRoom(dataRoomAddress, selectedRoomId);
	const { data: folderData } = useRoom(dataRoomAddress, selectedFolderId ?? undefined);

	return (
		<nav className="flex items-center gap-1.5 text-sm mb-6">
			<span
				role="link"
				tabIndex={0}
				onClick={onNavigateToRooms}
				onKeyDown={(e) => {
					if (e.key === "Enter") onNavigateToRooms();
				}}
				className="cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
			>
				Data Rooms
			</span>
			<span className="text-muted-foreground/50">/</span>
			<span
				role="link"
				tabIndex={0}
				onClick={onNavigateToRoom}
				onKeyDown={(e) => {
					if (e.key === "Enter") onNavigateToRoom();
				}}
				className={`cursor-pointer truncate max-w-48 transition-colors ${
					selectedFolderId !== null
						? "text-muted-foreground hover:text-foreground"
						: "font-semibold text-foreground"
				}`}
			>
				{roomData?.name ?? "..."}
			</span>
			{selectedFolderId !== null && folderData && (
				<>
					<span className="text-muted-foreground/50">/</span>
					<span className="font-semibold text-foreground truncate max-w-48">{folderData.name}</span>
				</>
			)}
		</nav>
	);
}
