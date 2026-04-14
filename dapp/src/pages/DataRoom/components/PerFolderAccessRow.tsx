import { useState } from "react";
import {
	AlertTriangle,
	ChevronDown,
	ChevronRight,
	Loader2,
	RefreshCw,
	Undo2,
	UserMinus,
	UserPlus,
	X,
} from "lucide-react";
import { isAddress } from "viem";
import { CopyableAddress } from "@/components/Button/CopyableAddress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ModalActions } from "@/components/ui/ModalActions";
import {
	CommitPhase,
	RekeyPhase,
	useCommitAccessChanges,
	useDecryptFolder,
	useRekeyAndRewrap,
	useRoom,
	useRoomMembers,
} from "@/hooks/dataroom";
import type { HexAddress } from "@/lib/contracts";

interface Props {
	dataRoomAddress: HexAddress;
	folderId: bigint;
	isOwner: boolean;
	/** Lowercased set of addresses that have room-wide access (members of every folder). */
	inheritedSet: Set<string>;
}

export function PerFolderAccessRow({ dataRoomAddress, folderId, isOwner, inheritedSet }: Props) {
	const [expanded, setExpanded] = useState(false);
	const [inheritedOpen, setInheritedOpen] = useState(false);

	const { data: folder } = useRoom(dataRoomAddress, folderId);
	const { data: members } = useRoomMembers(dataRoomAddress, folderId, isOwner);
	const { roomKeyHex, showPrompt, requestDecrypt } = useDecryptFolder(dataRoomAddress, folderId);
	const { commit, progress: commitProgress, reset: resetCommit } = useCommitAccessChanges(dataRoomAddress);
	const { rekeyAndRewrap, progress: rekeyProgress } = useRekeyAndRewrap(dataRoomAddress);

	const [pendingAdds, setPendingAdds] = useState<string[]>([]);
	const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());
	const [inputValue, setInputValue] = useState("");
	const [inputError, setInputError] = useState<string | null>(null);
	const [showRekeyWarning, setShowRekeyWarning] = useState(false);

	const memberList = (members as string[] | undefined) ?? [];
	const ownerAddr = folder?.owner?.toLowerCase();
	const documentCount = folder ? Number(folder.documentCount) : 0;

	// Split members into "direct" (granted to this folder specifically, including owner)
	// vs "inherited" (has room-wide access — member of every folder).
	const directMembers: string[] = [];
	const inheritedMembers: string[] = [];
	for (const m of memberList) {
		const lower = m.toLowerCase();
		if (lower === ownerAddr) directMembers.push(m);
		else if (inheritedSet.has(lower)) inheritedMembers.push(m);
		else directMembers.push(m);
	}

	const hasPendingChanges = pendingAdds.length > 0 || pendingRemoves.size > 0;
	const isCommitBusy =
		commitProgress.phase !== CommitPhase.Idle &&
		commitProgress.phase !== CommitPhase.Done &&
		commitProgress.phase !== CommitPhase.Error;
	const isRekeyBusy =
		rekeyProgress.phase === RekeyPhase.Rekeying ||
		rekeyProgress.phase === RekeyPhase.Rewrapping ||
		rekeyProgress.phase === RekeyPhase.Updating;

	const handleAddChip = () => {
		const addr = inputValue.trim();
		if (!addr) return;
		if (!isAddress(addr)) return setInputError("Not a valid address");
		const lower = addr.toLowerCase();
		if (pendingAdds.some((a) => a.toLowerCase() === lower)) return setInputError("Already pending");
		if (memberList.some((m) => m.toLowerCase() === lower)) return setInputError("Already a member");
		setInputError(null);
		setPendingAdds((prev) => [...prev, addr]);
		setInputValue("");
	};

	const handleRemoveChip = (addr: string) => setPendingAdds((prev) => prev.filter((a) => a !== addr));

	const handleToggleRemove = (member: string) =>
		setPendingRemoves((prev) => {
			const next = new Set(prev);
			if (next.has(member)) next.delete(member);
			else next.add(member);
			return next;
		});

	const handleCommit = async () => {
		if (!roomKeyHex) {
			requestDecrypt();
			return;
		}
		resetCommit();
		await commit(folderId, Array.from(pendingRemoves), pendingAdds, documentCount, roomKeyHex);
		setPendingAdds([]);
		setPendingRemoves(new Set());
	};

	const handleRotateKey = async () => {
		if (!roomKeyHex) {
			requestDecrypt();
			return;
		}
		setShowRekeyWarning(false);
		await rekeyAndRewrap(folderId, documentCount, roomKeyHex);
	};

	const isFolderOwner = (m: string) => !!ownerAddr && m.toLowerCase() === ownerAddr;

	return (
		<div>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="w-full flex items-center justify-between gap-2 px-4 py-3 transition-colors cursor-pointer !border-none !shadow-none !bg-transparent hover:!bg-accent/40"
			>
				<span className="flex items-center gap-2 min-w-0">
					<span className="text-sm font-medium truncate">{folder?.name ?? `#${folderId.toString()}`}</span>
					<span className="text-xs text-muted-foreground shrink-0">
						{directMembers.length} direct
						{inheritedMembers.length > 0 && ` · +${inheritedMembers.length} inherited`}
					</span>
				</span>
				{expanded ? (
					<ChevronDown className="h-4 w-4 text-muted-foreground" />
				) : (
					<ChevronRight className="h-4 w-4 text-muted-foreground" />
				)}
			</button>

			{expanded && (
				<div className="px-4 py-4 border-t border-border bg-accent/10 space-y-3">
					{showPrompt && (
						<p className="text-xs text-muted-foreground">
							Sign the folder to enable commits and key rotation.
						</p>
					)}

					{pendingAdds.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{pendingAdds.map((addr) => (
								<span
									key={addr}
									className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-mono"
								>
									{addr.slice(0, 6)}…{addr.slice(-4)}
									<button
										type="button"
										onClick={() => handleRemoveChip(addr)}
										className="btn-reset hover:text-destructive"
									>
										<X className="h-3 w-3" />
									</button>
								</span>
							))}
						</div>
					)}

					<div className="flex gap-2">
						<Input
							type="text"
							value={inputValue}
							onChange={(e) => {
								setInputValue(e.target.value);
								if (inputError) setInputError(null);
							}}
							placeholder="0x..."
							className="flex-1"
							style={{ fontFamily: "monospace" }}
							onKeyDown={(e) => e.key === "Enter" && handleAddChip()}
							disabled={isCommitBusy || isRekeyBusy}
						/>
						<Button size="sm" onClick={handleAddChip} disabled={isCommitBusy || isRekeyBusy}>
							<UserPlus className="h-3.5 w-3.5" />
							Add
						</Button>
					</div>

					{inputError && <p className="text-destructive text-xs">{inputError}</p>}

					{directMembers.length === 0 && inheritedMembers.length === 0 ? (
						<p className="text-xs text-muted-foreground">No members yet.</p>
					) : (
						directMembers.length > 0 && (
							<div className="space-y-0">
								{directMembers.map((m) => {
									const markedForRemoval = pendingRemoves.has(m);
									const ownerTag = isFolderOwner(m);
									return (
										<div
											key={m}
											className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0"
										>
											<span
												className={`flex items-center gap-2 ${
													markedForRemoval ? "line-through opacity-50" : ""
												}`}
											>
												<CopyableAddress value={m} />
												{ownerTag && (
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
											{!ownerTag && (
												<Button
													size="sm"
													variant={markedForRemoval ? "textLink" : "dangerLink"}
													onClick={() => handleToggleRemove(m)}
													disabled={isCommitBusy || isRekeyBusy}
												>
													{markedForRemoval ? (
														<>
															<Undo2 className="h-3.5 w-3.5" /> Undo
														</>
													) : (
														<>
															<UserMinus className="h-3.5 w-3.5" /> Revoke
														</>
													)}
												</Button>
											)}
										</div>
									);
								})}
							</div>
						)
					)}

					{inheritedMembers.length > 0 && (
						<div className="rounded-md border border-dashed border-border bg-card/60">
							<button
								type="button"
								onClick={() => setInheritedOpen(!inheritedOpen)}
								className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs !border-none !shadow-none !bg-transparent hover:!bg-accent/30 cursor-pointer"
							>
								<span className="text-muted-foreground">
									+{inheritedMembers.length} inherited from room-level access
								</span>
								{inheritedOpen ? (
									<ChevronDown className="h-3 w-3 text-muted-foreground" />
								) : (
									<ChevronRight className="h-3 w-3 text-muted-foreground" />
								)}
							</button>
							{inheritedOpen && (
								<div className="px-3 pb-2 space-y-1">
									{inheritedMembers.map((m) => (
										<div
											key={m}
											className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
										>
											<CopyableAddress value={m} />
											<span className="text-[0.65rem] uppercase tracking-wider">room-wide</span>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{hasPendingChanges && !isCommitBusy && (
						<Button onClick={handleCommit} disabled={isRekeyBusy} className="w-full">
							{!roomKeyHex ? "Decrypt & Apply" : "Apply Changes"}
							{pendingRemoves.size > 0 &&
								` (${pendingRemoves.size} revoke${pendingAdds.length > 0 ? `, ${pendingAdds.length} grant` : ""})`}
							{pendingRemoves.size === 0 && pendingAdds.length > 0 && ` (${pendingAdds.length} grant)`}
						</Button>
					)}

					{isCommitBusy && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-1">
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							{commitProgress.phase === CommitPhase.Revoking && "Revoking & rekeying…"}
							{commitProgress.phase === CommitPhase.Rewrapping &&
								`Re-wrapping keys ${commitProgress.current}/${commitProgress.total}…`}
							{commitProgress.phase === CommitPhase.UpdatingKeys && "Updating on-chain keys…"}
							{commitProgress.phase === CommitPhase.Granting && "Granting access…"}
						</div>
					)}

					{commitProgress.phase === CommitPhase.Error && (
						<div className="rounded px-3 py-2 text-xs bg-destructive/10 text-destructive flex items-center justify-between gap-2">
							<span className="flex items-center gap-1 min-w-0">
								<AlertTriangle className="h-3 w-3 shrink-0" />
								<span className="truncate">{commitProgress.error}</span>
							</span>
							<Button variant="textLink" size="xs" onClick={handleCommit}>
								<RefreshCw className="h-3 w-3" />
								Retry
							</Button>
						</div>
					)}

					{!isCommitBusy && !isRekeyBusy && (
						<div className="flex justify-end">
							<Button
								variant="textLink"
								size="xs"
								onClick={() => setShowRekeyWarning(true)}
								className="!text-[0.65rem] !text-muted-foreground"
							>
								Rotate folder key
							</Button>
						</div>
					)}

					{isRekeyBusy && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-1">
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							{rekeyProgress.phase === RekeyPhase.Rekeying && "Rekeying on-chain…"}
							{rekeyProgress.phase === RekeyPhase.Rewrapping &&
								`Re-wrapping keys ${rekeyProgress.current}/${rekeyProgress.total}…`}
							{rekeyProgress.phase === RekeyPhase.Updating &&
								`Updating on-chain ${rekeyProgress.current}/${rekeyProgress.total}…`}
						</div>
					)}

					{rekeyProgress.phase === RekeyPhase.Error && (
						<div className="rounded px-3 py-2 text-xs bg-destructive/10 text-destructive flex items-center justify-between gap-2">
							<span className="flex items-center gap-1 min-w-0">
								<AlertTriangle className="h-3 w-3 shrink-0" />
								<span className="truncate">{rekeyProgress.error}</span>
							</span>
							<Button variant="textLink" size="xs" onClick={handleRotateKey}>
								<RefreshCw className="h-3 w-3" />
								Retry
							</Button>
						</div>
					)}

					<Modal
						open={showRekeyWarning}
						onOpenChange={setShowRekeyWarning}
						title="Rotate folder key"
						description="Generates a new encryption key and re-wraps every document in this folder."
					>
						<div className="rounded px-3 py-2 text-xs bg-muted mb-4">
							<p className="font-semibold mb-1">This will:</p>
							<ul className="ml-4 list-disc space-y-0.5">
								<li>Generate a new folder encryption key</li>
								<li>
									Re-wrap encryption keys for {documentCount} document{documentCount !== 1 ? "s" : ""}
								</li>
								<li>Save wrapped keys on-chain</li>
								<li>Revoked users lose access to all documents in this folder</li>
							</ul>
							<p className="mt-2 font-semibold">Slow for folders with many documents.</p>
						</div>
						<ModalActions
							onCancel={() => setShowRekeyWarning(false)}
							onSubmit={handleRotateKey}
							submitText={!roomKeyHex ? "Decrypt & Rotate" : "Rotate & Re-wrap"}
							loadingText="Processing…"
							isLoading={false}
						/>
					</Modal>
				</div>
			)}
		</div>
	);
}
