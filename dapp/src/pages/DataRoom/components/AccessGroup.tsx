import { useState } from "react";
import { isAddress } from "viem";
import { UserPlus, UserMinus, Users, RefreshCw, Loader2, AlertTriangle, X, Undo2 } from "lucide-react";
import { useCommitAccessChanges, CommitPhase, useRekeyAndRewrap, RekeyPhase } from "@/hooks/dataroom";
import { CopyableAddress } from "@/components/Button/CopyableAddress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ModalActions } from "@/components/ui/ModalActions";
import type { HexAddress } from "@/lib/contracts";

export function AccessGroup({
	dataRoomAddress,
	folderId,
	members,
	documentCount,
	isOwner,
	ownerAddress,
	roomKeyHex,
}: {
	dataRoomAddress: HexAddress;
	folderId: bigint;
	members: string[];
	documentCount: number;
	isOwner: boolean;
	ownerAddress: string;
	roomKeyHex: string | null;
}) {
	const { commit, progress: commitProgress, reset: resetCommit } = useCommitAccessChanges(dataRoomAddress);
	const { rekeyAndRewrap, progress: rekeyProgress } = useRekeyAndRewrap(dataRoomAddress);

	const [pendingAdds, setPendingAdds] = useState<string[]>([]);
	const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());
	const [inputValue, setInputValue] = useState("");
	const [showRekeyWarning, setShowRekeyWarning] = useState(false);

	const hasPendingChanges = pendingAdds.length > 0 || pendingRemoves.size > 0;
	const isBusy =
		commitProgress.phase !== CommitPhase.Idle &&
		commitProgress.phase !== CommitPhase.Done &&
		commitProgress.phase !== CommitPhase.Error;

	const handleAddChip = () => {
		const addr = inputValue.trim();
		if (!addr) return;
		if (!isAddress(addr)) return;
		const normalized = addr.toLowerCase();
		if (pendingAdds.some((a) => a.toLowerCase() === normalized)) return;
		if (members.some((m) => m.toLowerCase() === normalized)) return;
		setPendingAdds((prev) => [...prev, addr]);
		setInputValue("");
	};

	const handleRemoveChip = (addr: string) => {
		setPendingAdds((prev) => prev.filter((a) => a !== addr));
	};

	const handleToggleRemove = (member: string) => {
		setPendingRemoves((prev) => {
			const next = new Set(prev);
			if (next.has(member)) {
				next.delete(member);
			} else {
				next.add(member);
			}
			return next;
		});
	};

	const handleCommit = async () => {
		if (!roomKeyHex) return;
		resetCommit();
		await commit(folderId, Array.from(pendingRemoves), pendingAdds, documentCount, roomKeyHex);
		setPendingAdds([]);
		setPendingRemoves(new Set());
	};

	const handleRekeyRoom = async () => {
		if (!roomKeyHex) return;
		setShowRekeyWarning(false);
		await rekeyAndRewrap(folderId, documentCount, roomKeyHex);
	};

	const isRoomOwner = (member: string) => ownerAddress && member.toLowerCase() === ownerAddress.toLowerCase();

	return (
		<>
			<div className="border border-border rounded-lg bg-card p-5 shadow-sm">
				<h2 className="font-semibold text-sm flex items-center gap-2 mb-4">
					<Users className="h-4 w-4 text-muted-foreground" />
					Access Group
					{isOwner && <span className="text-muted-foreground font-normal">({members.length})</span>}
				</h2>

				{isOwner && (
					<>
						<div className="mb-4">
							<div className="flex flex-wrap gap-1.5 mb-2">
								{pendingAdds.map((addr) => (
									<span
										key={addr}
										className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-mono"
									>
										{addr.slice(0, 6)}...{addr.slice(-4)}
										<button
											type="button"
											onClick={() => handleRemoveChip(addr)}
											className="hover:text-destructive"
										>
											<X className="h-3 w-3" />
										</button>
									</span>
								))}
							</div>
							<div className="flex gap-2">
								<Input
									type="text"
									value={inputValue}
									onChange={(e) => setInputValue(e.target.value)}
									placeholder="0x..."
									className="flex-1 text-xs font-mono"
									onKeyDown={(e) => e.key === "Enter" && handleAddChip()}
									disabled={isBusy}
								/>
								<Button size="icon" variant="textLink" onClick={handleAddChip} disabled={isBusy}>
									<UserPlus className="h-4 w-4" />
								</Button>
							</div>
						</div>

						<div className="space-y-0">
							{members.map((member: string) => {
								const markedForRemoval = pendingRemoves.has(member);
								return (
									<div
										key={member}
										className="group/member flex items-center justify-between py-2 border-b last:border-0"
									>
										<span
											className={`flex items-center gap-1.5 ${
												markedForRemoval ? "line-through opacity-50" : ""
											}`}
										>
											<CopyableAddress value={member} />
											{isRoomOwner(member) && (
												<span className="text-primary text-[0.65rem] uppercase tracking-wider">
													owner
												</span>
											)}
											{markedForRemoval && (
												<span className="text-destructive text-[0.65rem] uppercase tracking-wider">
													removing
												</span>
											)}
										</span>
										{!isRoomOwner(member) && (
											<>
												{markedForRemoval ? (
													<Button
														size="icon"
														variant="textLink"
														onClick={() => handleToggleRemove(member)}
														disabled={isBusy}
														className="opacity-0 group-hover/member:opacity-100 transition-opacity"
													>
														<Undo2 className="h-3.5 w-3.5" />
													</Button>
												) : (
													<Button
														size="icon"
														variant="dangerLink"
														onClick={() => handleToggleRemove(member)}
														disabled={isBusy}
														className="opacity-0 group-hover/member:opacity-100 transition-opacity"
													>
														<UserMinus className="h-3.5 w-3.5" />
													</Button>
												)}
											</>
										)}
									</div>
								);
							})}
						</div>

						{hasPendingChanges && !isBusy && (
							<Button
								variant="default"
								onClick={handleCommit}
								disabled={!roomKeyHex || isBusy}
								className="w-full mt-4"
							>
								Commit Changes
								{pendingRemoves.size > 0 && ` (${pendingRemoves.size} revoke`}
								{pendingRemoves.size > 0 && pendingAdds.length > 0 && ", "}
								{pendingRemoves.size > 0 && pendingAdds.length === 0 && ")"}
								{pendingAdds.length > 0 && pendingRemoves.size === 0 && ` (${pendingAdds.length} grant`}
								{pendingAdds.length > 0 && pendingRemoves.size > 0 && `${pendingAdds.length} grant`}
								{pendingAdds.length > 0 && ")"}
							</Button>
						)}

						{isBusy && (
							<div className="w-full mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								{commitProgress.phase === CommitPhase.Revoking && "Revoking access & rekeying..."}
								{commitProgress.phase === CommitPhase.Rewrapping &&
									`Re-wrapping keys ${commitProgress.current}/${commitProgress.total}...`}
								{commitProgress.phase === CommitPhase.UpdatingKeys && `Updating on-chain keys...`}
								{commitProgress.phase === CommitPhase.Granting && "Granting access..."}
							</div>
						)}

						{commitProgress.phase === CommitPhase.Error && (
							<div className="mt-4 rounded px-3 py-2 text-xs bg-destructive/10 text-destructive">
								<AlertTriangle className="h-3 w-3 inline mr-1" />
								{commitProgress.error}
								<Button variant="textLink" onClick={handleCommit} className="ml-2 text-xs">
									<RefreshCw className="h-3 w-3" />
									Retry
								</Button>
							</div>
						)}

						{!isBusy &&
							commitProgress.phase !== CommitPhase.Error &&
							(rekeyProgress.phase === RekeyPhase.Idle || rekeyProgress.phase === RekeyPhase.Done) && (
								<Button
									variant="textLink"
									size="xs"
									onClick={() => setShowRekeyWarning(true)}
									disabled={!roomKeyHex}
									className="mt-4 !text-[0.65rem] !text-muted-foreground"
								>
									Rotate folder key
								</Button>
							)}

						{rekeyProgress.phase === RekeyPhase.Error && (
							<>
								<div className="mt-4 rounded px-3 py-2 text-xs bg-destructive/10 text-destructive">
									<AlertTriangle className="h-3 w-3 inline mr-1" />
									{rekeyProgress.error}
								</div>
								<Button variant="textLink" onClick={handleRekeyRoom} className="w-full mt-2">
									<RefreshCw className="h-4 w-4" />
									Retry Key Rotation
								</Button>
							</>
						)}

						{(rekeyProgress.phase === RekeyPhase.Rekeying ||
							rekeyProgress.phase === RekeyPhase.Rewrapping ||
							rekeyProgress.phase === RekeyPhase.Updating) && (
							<div className="w-full mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								{rekeyProgress.phase === RekeyPhase.Rekeying && "Rekeying on-chain..."}
								{rekeyProgress.phase === RekeyPhase.Rewrapping &&
									`Re-wrapping keys ${rekeyProgress.current}/${rekeyProgress.total}...`}
								{rekeyProgress.phase === RekeyPhase.Updating &&
									`Updating on-chain ${rekeyProgress.current}/${rekeyProgress.total}...`}
							</div>
						)}
					</>
				)}

				{!isOwner && (
					<p className="text-sm text-muted-foreground">Member list is only visible to the room owner.</p>
				)}
			</div>

			<Modal
				open={showRekeyWarning}
				onOpenChange={setShowRekeyWarning}
				title="Rotate Folder Key"
				description="This will generate a new encryption key and re-wrap all document keys in this folder."
			>
				<div className="rounded px-3 py-2 text-xs bg-muted mb-4">
					<p className="font-semibold mb-1">This will:</p>
					<ul className="ml-4 list-disc space-y-0.5">
						<li>Generate a new folder encryption key</li>
						<li>
							Re-wrap encryption keys for {documentCount} document
							{documentCount !== 1 ? "s" : ""}
						</li>
						<li>Save wrapped keys</li>
						<li>Revoked users will lose access to all documents in this folder</li>
					</ul>
					<p className="mt-2 font-semibold">This may take a while for folders with many documents.</p>
				</div>
				<ModalActions
					onCancel={() => setShowRekeyWarning(false)}
					onSubmit={handleRekeyRoom}
					submitText="Rotate & Re-wrap"
					loadingText="Processing..."
					isLoading={false}
				/>
			</Modal>
		</>
	);
}
