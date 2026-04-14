import { GrantAccessForm } from "@/components/access/GrantAccessForm";
import { GranteeList } from "@/components/access/GranteeList";
import {
	useGrantSecretAccess,
	useRevokeSecretAccess,
	useSecretGrantees,
} from "@/hooks/secretsvault/useAccess";

interface Props {
	namespaceId: bigint;
	secretKey: string;
}

export function SecretAccessPanel({ namespaceId, secretKey }: Props) {
	const { data: grantees, isLoading } = useSecretGrantees(namespaceId, secretKey);
	const { grant, isPending: granting, error: grantError } = useGrantSecretAccess();
	const { revoke, isPending: revoking } = useRevokeSecretAccess();

	return (
		<div className="space-y-4">
			<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
				Access for <span className="text-foreground font-mono">{secretKey}</span>
			</h4>

			<GrantAccessForm
				onGrant={async (address, expiresAt) => {
					await grant(namespaceId, secretKey, address, expiresAt);
				}}
				isPending={granting}
			/>
			{grantError && <p className="text-destructive text-xs">{grantError}</p>}

			{isLoading ? (
				<p className="text-muted-foreground text-xs">Loading…</p>
			) : (
				<GranteeList
					grantees={grantees ?? []}
					onRevoke={async (address) => {
						await revoke(namespaceId, secretKey, address);
					}}
					isPending={revoking}
				/>
			)}
		</div>
	);
}
