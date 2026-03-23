import { useAccount } from "wagmi";
import { useRoom, useRoomMembers, useDecryptFolder } from "@/hooks/dataroom";
import { DecryptPrompt, DecryptingState, RejectedState } from "./components/DecryptGate";
import { DocumentList } from "./components/DocumentList";
import { AccessGroup } from "./components/AccessGroup";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HexAddress } from "@/lib/contracts";

interface IFolderPanelProps {
	dataRoomAddress: HexAddress;
	folderId: bigint;
}

export function FolderPanel({ dataRoomAddress, folderId }: IFolderPanelProps) {
	const { address } = useAccount();

	const { data: folderData } = useRoom(dataRoomAddress, folderId);
	const isOwner = !!address && !!folderData && folderData.owner.toLowerCase() === address.toLowerCase();
	const { data: membersData } = useRoomMembers(dataRoomAddress, folderId, isOwner);
	const {
		roomKeyHex,
		status: decryptStatus,
		noAccess,
		decryptFailed,
		showPrompt,
		resetRoomKey,
		requestDecrypt,
	} = useDecryptFolder(dataRoomAddress, folderId);

	const members = (membersData as string[] | undefined) ?? [];
	const documentCount = folderData ? Number(folderData.documentCount) : 0;

	const status = !folderData ? "loading" : decryptStatus;

	return (
		<>
			{status === "loading" && <p className="text-muted-foreground">Loading folder...</p>}

			{status === "rejected" && <RejectedState onRetry={resetRoomKey} />}

			{status === "decrypting" && <DecryptingState />}

			{status === "ready" && (
				<>
					{showPrompt && <DecryptPrompt onDecrypt={requestDecrypt} />}

					{noAccess && (
						<div className="flex items-center gap-2 mb-4 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
							<Lock className="h-4 w-4 shrink-0" />
							<span className="flex-1">
								You don't have access to this folder. Only public files are shown.
							</span>
						</div>
					)}

					{decryptFailed && (
						<div className="flex items-center gap-2 mb-4 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
							<Lock className="h-4 w-4 shrink-0" />
							<span className="flex-1">
								Could not decrypt this folder. You can still access public files.
							</span>
							<Button variant="ghost" size="sm" onClick={resetRoomKey} className="shrink-0 text-xs">
								Retry
							</Button>
						</div>
					)}

					<div className="grid gap-6 lg:grid-cols-3">
						<DocumentList
							dataRoomAddress={dataRoomAddress}
							folderId={folderId}
							documentCount={documentCount}
							isOwner={isOwner}
							roomKeyHex={roomKeyHex}
						/>
						<AccessGroup
							dataRoomAddress={dataRoomAddress}
							folderId={folderId}
							members={members}
							documentCount={documentCount}
							isOwner={isOwner}
							ownerAddress={folderData?.owner ?? ""}
							roomKeyHex={roomKeyHex}
						/>
					</div>
				</>
			)}
		</>
	);
}
