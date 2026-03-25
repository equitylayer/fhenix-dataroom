import { Link } from "react-router-dom";
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
			<Link
				to="/"
				onClick={(e) => {
					e.preventDefault();
					onNavigateToRooms();
				}}
				className="transition-colors text-muted-foreground hover:text-foreground"
			>
				Data Rooms
			</Link>
			<span className="text-muted-foreground/50">/</span>
			<Link
				to={`/room/${selectedRoomId.toString()}`}
				onClick={(e) => {
					e.preventDefault();
					onNavigateToRoom();
				}}
				className={`truncate max-w-48 transition-colors ${
					selectedFolderId !== null
						? "text-muted-foreground hover:text-foreground"
						: "font-semibold text-foreground"
				}`}
			>
				{roomData?.name ?? "..."}
			</Link>
			{selectedFolderId !== null && folderData && (
				<>
					<span className="text-muted-foreground/50">/</span>
					<span className="font-semibold text-foreground truncate max-w-48">{folderData.name}</span>
				</>
			)}
		</nav>
	);
}
