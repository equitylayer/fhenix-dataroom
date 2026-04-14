import type { Grantee } from "@obolos/secretsvault-sdk";
import { CopyableAddress } from "@/components/Button/CopyableAddress";
import { Button } from "@/components/ui/button";
import { useEnsNames } from "@/hooks/useEnsNames";
import { formatExpiry } from "@/lib/format";

interface Props {
	grantees: Grantee[];
	onRevoke: (address: string) => Promise<void>;
	isPending: boolean;
}

export function GranteeList({ grantees, onRevoke, isPending }: Props) {
	const ensNames = useEnsNames(grantees.map((g) => g.address));

	if (grantees.length === 0) {
		return <p className="text-muted-foreground text-xs">No access granted yet.</p>;
	}

	return (
		<div className="space-y-2">
			{grantees.map((g) => (
				<div
					key={g.address}
					className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-card"
				>
					<div className="min-w-0">
						<CopyableAddress value={g.address} label={ensNames[g.address] ?? undefined} />
						<p className={`text-xs mt-0.5 ${g.expired ? "text-destructive" : "text-muted-foreground"}`}>
							{formatExpiry(g)}
						</p>
					</div>
					<Button
						variant="dangerLink"
						size="sm"
						disabled={isPending}
						onClick={() => onRevoke(g.address)}
					>
						Revoke
					</Button>
				</div>
			))}
		</div>
	);
}
