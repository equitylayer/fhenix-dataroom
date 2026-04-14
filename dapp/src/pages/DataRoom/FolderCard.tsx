import { FolderOpen, FileText, Users, ChevronRight } from "lucide-react";
import { useRoom, useRoomMembers } from "@/hooks/dataroom";
import type { HexAddress } from "@/lib/contracts";

interface IFolderCardProps {
	dataRoomAddress: HexAddress;
	folderId: bigint;
	isOwner: boolean;
	onSelect: () => void;
}

export function FolderCard({ dataRoomAddress, folderId, isOwner, onSelect }: IFolderCardProps) {
	const { data } = useRoom(dataRoomAddress, folderId);
	const { data: members } = useRoomMembers(dataRoomAddress, folderId, isOwner);
	if (!data) return null;

	const activeMemberCount = members ? members.length : Number(data.memberCount);

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
					<FolderOpen className="h-4 w-4" />
				</div>
				<div className="min-w-0">
					<p className="font-semibold text-sm truncate">{data.name}</p>
					<div className="flex gap-3 text-xs text-muted-foreground">
						<span className="flex items-center gap-1">
							<FileText className="h-3 w-3" />
							{data.documentCount.toString()}
						</span>
						<span className="flex items-center gap-1">
							<Users className="h-3 w-3" />
							{activeMemberCount}
						</span>
					</div>
				</div>
			</div>
			<ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary shrink-0" />
		</div>
	);
}
