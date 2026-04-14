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
		<div
			role="button"
			tabIndex={0}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === "Enter") onSelect();
			}}
			className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md cursor-pointer"
		>
			<div className="flex items-center gap-3 min-w-0">
				<div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
					<Database className="h-4 w-4" />
				</div>
				<div className="min-w-0">
					<p className="font-semibold text-sm truncate">{data.name}</p>
					<p className="text-xs text-muted-foreground flex items-center gap-1">
						<FolderOpen className="h-3 w-3" />
						{data.childCount.toString()} {Number(data.childCount) === 1 ? "folder" : "folders"}
					</p>
				</div>
			</div>
			<ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary shrink-0" />
		</div>
	);
}
