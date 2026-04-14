import { ChevronDown, ChevronRight, KeyRound, Shield } from "lucide-react";
import { useState } from "react";
import { useSecretKeys } from "@/hooks/secretsvault/useSecrets";
import { NamespaceAccessPanel } from "./NamespaceAccessPanel";
import { SecretAccessPanel } from "./SecretAccessPanel";

export function AccessTab({ namespaceId }: { namespaceId: bigint }) {
	const { data: secretKeys } = useSecretKeys(namespaceId);
	const [expandedSecret, setExpandedSecret] = useState<string | null>(null);

	const hasSecrets = !!secretKeys && secretKeys.length > 0;

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
		</div>
	);
}
