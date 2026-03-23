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
		<button
			type="button"
			onClick={onSelect}
			className="group w-full text-left border border-border rounded-lg bg-card p-4 shadow-sm hover:border-foreground/20 transition-all duration-200 cursor-pointer"
		>
			<div className="flex items-center gap-3">
				<div className="shrink-0 w-8 h-8 rounded-md bg-primary/8 flex items-center justify-center">
					<FolderOpen className="h-4 w-4 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="font-semibold text-sm truncate">{data.name}</h3>
					<div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
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
				<ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
			</div>
		</button>
	);
}
