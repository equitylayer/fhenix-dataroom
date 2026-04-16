import { AlertTriangle, ChevronDown, ChevronRight, KeyRound, Loader2, RefreshCw, Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ModalActions } from "@/components/ui/ModalActions";
import { useReEncryptNamespace } from "@/hooks/secretsvault/useReEncrypt";
import { useSecretKeys } from "@/hooks/secretsvault/useSecrets";
import { NamespaceAccessPanel } from "./NamespaceAccessPanel";
import { SecretAccessPanel } from "./SecretAccessPanel";

export function AccessTab({ namespaceId }: { namespaceId: bigint }) {
	const { data: secretKeys } = useSecretKeys(namespaceId);
	const [expandedSecret, setExpandedSecret] = useState<string | null>(null);
	const [showReEncrypt, setShowReEncrypt] = useState(false);
	const { reEncrypt, progress } = useReEncryptNamespace();

	const hasSecrets = !!secretKeys && secretKeys.length > 0;
	const isBusy = progress.phase !== "idle" && progress.phase !== "done" && progress.phase !== "error";

	const handleReEncrypt = async () => {
		setShowReEncrypt(false);
		await reEncrypt(namespaceId);
	};

	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
				<div className="flex items-center gap-2">
					<Shield className="h-4 w-4 text-primary" />
					<h3 className="text-sm font-semibold">Vault-wide Access</h3>
				</div>
				<p className="text-xs text-muted-foreground">
					Grants read access to all secrets in this vault.
				</p>
				<NamespaceAccessPanel namespaceId={namespaceId} />

				{!isBusy && progress.phase !== "error" && hasSecrets && (
					<div className="flex justify-end pt-1">
						<Button
							variant="textLink"
							size="xs"
							onClick={() => setShowReEncrypt(true)}
							className="!text-[0.65rem] !text-muted-foreground"
						>
							Re-encrypt vault
						</Button>
					</div>
				)}

				{isBusy && (
					<div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-1">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						{progress.phase === "decrypting" &&
							`Decrypting secrets ${progress.current}/${progress.total}…`}
						{progress.phase === "rotating" && "Generating new encryption key…"}
						{progress.phase === "re-encrypting" &&
							`Re-encrypting ${progress.current}/${progress.total}…`}
					</div>
				)}

				{progress.phase === "error" && (
					<div className="rounded px-3 py-2 text-xs bg-destructive/10 text-destructive flex items-center justify-between gap-2">
						<span className="flex items-center gap-1 min-w-0">
							<AlertTriangle className="h-3 w-3 shrink-0" />
							<span className="truncate">{progress.error}</span>
						</span>
						<Button variant="textLink" size="xs" onClick={handleReEncrypt}>
							<RefreshCw className="h-3 w-3" />
							Retry
						</Button>
					</div>
				)}
			</div>

			<div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
				<div className="flex items-center gap-2">
					<KeyRound className="h-4 w-4 text-primary" />
					<h3 className="text-sm font-semibold">Per-Secret Access</h3>
				</div>
				<p className="text-xs text-muted-foreground">Grant access to individual secrets only.</p>

				{!hasSecrets ? (
					<p className="py-6 text-sm text-muted-foreground text-center">
						No secrets to grant access to yet.
					</p>
				) : (
					<div className="rounded-md border border-border overflow-hidden divide-y divide-border">
						{secretKeys!.map((k) => {
							const isOpen = expandedSecret === k;
							return (
								<div key={k}>
									<button
										type="button"
										onClick={() => setExpandedSecret(isOpen ? null : k)}
										className="w-full flex items-center justify-between px-4 py-3 transition-colors cursor-pointer !border-none !shadow-none !bg-transparent hover:!bg-accent/40"
									>
										<span className="text-sm font-mono font-medium">{k}</span>
										{isOpen ? (
											<ChevronDown className="h-4 w-4 text-muted-foreground" />
										) : (
											<ChevronRight className="h-4 w-4 text-muted-foreground" />
										)}
									</button>

									{isOpen && (
										<div className="px-4 py-4 border-t border-border bg-accent/10">
											<SecretAccessPanel namespaceId={namespaceId} secretKey={k} />
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>

			<Modal
				open={showReEncrypt}
				onOpenChange={setShowReEncrypt}
				title="Re-encrypt vault"
				description="Generate a fresh encryption key and re-encrypt every secret in this vault."
			>
				<div className="rounded px-3 py-2 text-xs bg-muted mb-4">
					<p className="font-semibold mb-1">What this does:</p>
					<ul className="ml-4 list-disc space-y-0.5">
						<li>Decrypts every secret with the current key</li>
						<li>Generates a new FHE encryption key on-chain</li>
						<li>Re-encrypts every secret with the new key</li>
						<li>Existing grantees keep access (re-granted automatically)</li>
						<li>Previously revoked wallets can no longer decrypt, even cached values</li>
					</ul>
					<p className="mt-2 font-semibold">
						Requires signing {secretKeys?.length ?? 0} transaction{(secretKeys?.length ?? 0) === 1 ? "" : "s"} + 1 key rotation.
					</p>
				</div>
				<ModalActions
					onCancel={() => setShowReEncrypt(false)}
					onSubmit={handleReEncrypt}
					submitText="Re-encrypt"
					loadingText="Processing…"
					isLoading={false}
				/>
			</Modal>
		</div>
	);
}
