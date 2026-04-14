import { Eye, EyeOff, Lock, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ModalActions } from "@/components/ui/ModalActions";
import { useDeleteSecret, useSecret, useSetSecret } from "@/hooks/secretsvault/useSecrets";

interface Props {
	namespaceId: bigint;
	secretKey: string;
	isOwner: boolean;
}

export function SecretRow({ namespaceId, secretKey, isOwner }: Props) {
	const [revealed, setRevealed] = useState(false);
	const [editing, setEditing] = useState(false);
	const [newValue, setNewValue] = useState("");
	const [confirmDelete, setConfirmDelete] = useState(false);

	// Only fetch the secret value when revealed (triggers FHE decrypt + permit)
	const {
		data,
		isLoading: decrypting,
		error,
	} = useSecret(namespaceId, revealed || editing ? secretKey : undefined);
	const { setSecret, isPending } = useSetSecret();
	const { deleteSecret, isPending: isDeleting } = useDeleteSecret();

	const handleDelete = async () => {
		await deleteSecret(namespaceId, secretKey);
		setConfirmDelete(false);
	};

	const handleSave = async () => {
		if (!newValue.trim()) return;
		await setSecret(namespaceId, secretKey, newValue);
		setEditing(false);
		setNewValue("");
		setRevealed(false);
	};

	if (editing) {
		return (
			<div className="px-4 py-3 space-y-3">
				<p className="text-sm font-mono font-medium">{secretKey}</p>
				<div className="flex gap-2">
					<Input
						type="text"
						value={newValue}
						onChange={(e) => setNewValue(e.target.value)}
						placeholder="New value"
						className="flex-1"
						autoFocus
					/>
					<Button size="sm" disabled={isPending} onClick={handleSave}>
						{isPending ? "..." : "Save"}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => {
							setEditing(false);
							setRevealed(false);
						}}
					>
						Cancel
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
			<Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

			<div className="flex items-center gap-3 min-w-0">
				<span className="text-sm font-mono font-medium shrink-0">{secretKey}</span>
				{revealed ? (
					decrypting ? (
						<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Loader2 className="h-3 w-3 animate-spin" /> Decrypting…
						</span>
					) : error ? (
						<span className="text-xs text-destructive">Failed to decrypt</span>
					) : (
						<span className="text-sm text-muted-foreground font-mono truncate">{data?.value}</span>
					)
				) : (
					<span className="text-base text-muted-foreground/60 select-none tracking-widest">••••••••</span>
				)}
			</div>

			<span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
				{data ? new Date(data.updatedAt * 1000).toLocaleDateString() : ""}
			</span>

			<div className="flex items-center gap-0.5 shrink-0">
				<button
					type="button"
					className="btn-reset p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
					onClick={() => setRevealed(!revealed)}
					title={revealed ? "Hide value" : "Reveal value"}
				>
					{revealed ? <EyeOff size={15} /> : <Eye size={15} />}
				</button>
				{isOwner && (
					<>
						<button
							type="button"
							className="btn-reset p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
							title="Edit secret"
							onClick={() => {
								setRevealed(true);
								setNewValue(data?.value ?? "");
								setEditing(true);
							}}
						>
							<Pencil size={15} />
						</button>
						<button
							type="button"
							className="btn-reset p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
							title="Delete secret"
							onClick={() => setConfirmDelete(true)}
						>
							<Trash2 size={15} />
						</button>
					</>
				)}
			</div>

			<Modal
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title="Delete secret"
				description={`Permanently delete "${secretKey}"? This cannot be undone.`}
			>
				<ModalActions
					onCancel={() => setConfirmDelete(false)}
					onSubmit={handleDelete}
					submitText="Delete"
					loadingText="Deleting…"
					isLoading={isDeleting}
				/>
			</Modal>
		</div>
	);
}
