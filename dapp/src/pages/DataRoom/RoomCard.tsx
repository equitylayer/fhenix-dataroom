import { ChevronRight, FolderOpen, Database } from "lucide-react";
import { useRoom } from "@/hooks/dataroom";
import type { HexAddress } from "@/lib/contracts";

interface IRoomCardProps {
	dataRoomAddress: HexAddress;
	roomId: bigint;
	onSelect: () => void;
}

export function RoomCard({ dataRoomAddress, roomId, onSelect }: IRoomCardProps) {
	const { data } = useRoom(dataRoomAddress, roomId);
	if (!data) return null;
	if (!data.isParent) return null;

	return (
		<button
			type="button"
			onClick={onSelect}
			className="group w-full text-left border border-border rounded-lg bg-card p-5 shadow-sm hover:border-foreground/20 transition-all duration-200 cursor-pointer"
		>
			<div className="flex items-center gap-3">
				<div className="shrink-0 w-9 h-9 rounded-md bg-primary/8 flex items-center justify-center">
					<Database className="h-4 w-4 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="font-semibold text-sm truncate">{data.name}</h3>
					<p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
						<FolderOpen className="h-3 w-3" />
						{data.childCount.toString()} {Number(data.childCount) === 1 ? "folder" : "folders"}
					</p>
				</div>
				<ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
			</div>
		</button>
	);
}
