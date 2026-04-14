import { ChevronDown, ChevronRight, Shield } from "lucide-react";
import { useState } from "react";
import { useSecretKeys } from "@/hooks/secretsvault/useSecrets";
import { NamespaceAccessPanel } from "./NamespaceAccessPanel";
import { SecretAccessPanel } from "./SecretAccessPanel";

export function AccessTab({ namespaceId }: { namespaceId: bigint }) {
	const { data: secretKeys } = useSecretKeys(namespaceId);
	const [expandedSecret, setExpandedSecret] = useState<string | null>(null);

	return (
		<div className="space-y-8">
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

			{secretKeys && secretKeys.length > 0 && (
				<div className="space-y-3">
					<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
						Per-Secret Access
					</h3>
					<p className="text-xs text-muted-foreground">Grant access to individual secrets only.</p>

					<div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
						{secretKeys.map((k) => (
							<div key={k}>
								<button
									type="button"
									className="btn-reset w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
									onClick={() => setExpandedSecret(expandedSecret === k ? null : k)}
								>
									<span className="text-sm font-mono font-medium">{k}</span>
									{expandedSecret === k ? (
										<ChevronDown className="h-4 w-4 text-muted-foreground" />
									) : (
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									)}
								</button>

								{expandedSecret === k && (
									<div className="px-4 py-4 border-t border-border bg-accent/10">
										<SecretAccessPanel namespaceId={namespaceId} secretKey={k} />
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
