import { GrantAccessForm } from "@/components/secretsvault/GrantAccessForm";
import { GranteeList } from "@/components/secretsvault/GranteeList";
import {
	useGrantNamespaceAccess,
	useNamespaceGrantees,
	useRevokeNamespaceAccess,
} from "@/hooks/secretsvault/useAccess";

export function NamespaceAccessPanel({ namespaceId }: { namespaceId: bigint }) {
	const { data: grantees, isLoading } = useNamespaceGrantees(namespaceId);
	const { grant, isPending: granting, error: grantError } = useGrantNamespaceAccess();
	const { revoke, isPending: revoking } = useRevokeNamespaceAccess();

	return (
		<div className="space-y-4">
			<GrantAccessForm
				onGrant={async (address, expiresAt) => {
					await grant(namespaceId, address, expiresAt);
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
						await revoke(namespaceId, address);
					}}
					isPending={revoking}
				/>
			)}
		</div>
	);
}
