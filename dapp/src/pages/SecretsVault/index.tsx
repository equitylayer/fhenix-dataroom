import { useState } from "react";
import { AlertTriangle, Plus, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateNamespace, useNamespacesByOwner, useSharedNamespaces } from "@/hooks/secretsvault/useNamespaces";
import { createNamespaceSchema } from "@/lib/schemas";
import { NamespaceList } from "./components/NamespaceList";

export function VaultListPage() {
	const { address } = useAccount();
	const { data: owned, isLoading: ownedLoading } = useNamespacesByOwner(address);
	const { data: shared, isLoading: sharedLoading } = useSharedNamespaces(address);
	const [showCreate, setShowCreate] = useState(false);
	const [name, setName] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);
	const { createNamespace, isPending, error } = useCreateNamespace();

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		const result = createNamespaceSchema.safeParse({ name });
		if (!result.success) {
			setValidationError(result.error.issues[0].message);
			return;
		}
		setValidationError(null);
		await createNamespace(name);
		setName("");
		setShowCreate(false);
	};

	const isLoading = ownedLoading || sharedLoading;

	return (
		<div>
			<div id="my-vaults" className="scroll-mt-24">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-semibold">My Vaults</h2>
					<Button variant="textLink" onClick={() => setShowCreate(!showCreate)} size="sm">
						<Plus className="h-4 w-4" />
						{showCreate ? "Cancel" : "New Vault"}
					</Button>
				</div>

				{showCreate && (
					<form onSubmit={handleCreate} className="border border-border rounded-lg bg-card p-4 mb-4 shadow-sm">
						<h3 className="font-semibold text-sm mb-3">New Vault</h3>
						<div className="flex gap-3 items-center">
							<Input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Vault name (e.g. production, staging)"
								className="flex-1"
							/>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Creating…" : "Create"}
							</Button>
							<Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
								Cancel
							</Button>
						</div>
						{(validationError || error) && (
							<p className="mt-2 text-destructive text-xs">{validationError || error}</p>
						)}
					</form>
				)}

				{isPending && (
					<div className="border border-border rounded-lg bg-card p-4 mb-4 flex items-center gap-3 text-sm text-muted-foreground shadow-sm">
						<Loader2 className="h-4 w-4 animate-spin" />
						Confirming transaction…
					</div>
				)}

				{error && !isPending && (
					<div className="mb-4 rounded-lg px-3 py-2 text-xs bg-destructive/10 text-destructive">
						<AlertTriangle className="h-3 w-3 inline mr-1" />
						{error}
					</div>
				)}

				{isLoading ? (
					<div className="border border-border rounded-lg bg-card p-4 flex items-center gap-3 text-sm text-muted-foreground shadow-sm">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading vaults…
					</div>
				) : (
					<NamespaceList namespaces={owned ?? []} emptyText="No vaults yet. Create one to get started." />
				)}
			</div>

			<div id="shared-vaults" className="scroll-mt-24 mt-14">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-semibold">Shared With Me</h2>
				</div>

				{isLoading ? (
					<div className="border border-border rounded-lg bg-card p-4 flex items-center gap-3 text-sm text-muted-foreground shadow-sm">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading shared vaults…
					</div>
				) : (
					<NamespaceList namespaces={shared ?? []} emptyText="No vaults shared with you yet." />
				)}
			</div>
		</div>
	);
}

export default VaultListPage;
