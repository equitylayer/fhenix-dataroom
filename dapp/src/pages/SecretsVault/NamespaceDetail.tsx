import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { KeyRound, Loader2, Shield } from "lucide-react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNamespacesByOwner, useSharedNamespaces } from "@/hooks/secretsvault/useNamespaces";
import { useSecretKeys, useSetSecret } from "@/hooks/secretsvault/useSecrets";
import { setSecretSchema } from "@/lib/schemas";
import { AccessTab } from "./components/AccessTab";
import { SecretRow } from "./components/SecretRow";

type Tab = "secrets" | "access";

export function NamespaceDetailPage() {
	const { nsId } = useParams<{ nsId: string }>();
	const namespaceId = nsId !== undefined ? BigInt(nsId) : undefined;

	const { address } = useAccount();
	const { data: owned, isLoading: ownedLoading } = useNamespacesByOwner(address);
	const { data: shared, isLoading: sharedLoading } = useSharedNamespaces(address);
	const nsLoading = ownedLoading || sharedLoading;
	const namespace = owned?.find((ns) => ns.id === namespaceId) ?? shared?.find((ns) => ns.id === namespaceId);
	const isOwner = !!owned?.find((ns) => ns.id === namespaceId);
	const hasAccess = !!namespace;
	const { data: secretKeys, isLoading } = useSecretKeys(hasAccess ? namespaceId : undefined);
	const { setSecret, isPending, error } = useSetSecret();

	const [activeTab, setActiveTab] = useState<Tab>("secrets");
	const [key, setKey] = useState<string>("");
	const [value, setValue] = useState<string>("");
	const [showForm, setShowForm] = useState<boolean>(false);
	const [validationError, setValidationError] = useState<string | null>(null);

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		const result = setSecretSchema.safeParse({ key, value });
		if (!result.success) {
			setValidationError(result.error.issues[0].message);
			return;
		}
		setValidationError(null);
		await setSecret(namespaceId!, key, value);
		setKey("");
		setValue("");
		setShowForm(false);
	};

	const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
		{ key: "secrets", label: "Secrets", icon: <KeyRound className="h-3.5 w-3.5" /> },
		...(isOwner ? [{ key: "access" as Tab, label: "Access", icon: <Shield className="h-3.5 w-3.5" /> }] : []),
	];

	if (!nsLoading && owned && shared && !hasAccess) {
		return (
			<div className="space-y-6">
				<nav className="flex items-center gap-2 text-sm text-muted-foreground">
					<Link to="/vault" className="text-primary hover:underline">
						Vaults
					</Link>
					<span>/</span>
					<span>#{nsId}</span>
				</nav>
				<div className="border border-dashed border-border rounded-lg bg-card py-16 text-center text-muted-foreground text-sm">
					You don't have access to this vault.
					<div className="mt-4">
						<Link to="/vault" className="text-primary hover:underline text-sm">
							Back to your vaults
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<nav className="flex items-center gap-2 text-sm text-muted-foreground">
				<Link to="/vault" className="text-primary hover:underline">
					Vaults
				</Link>
				<span>/</span>
				<span className="truncate text-foreground">{namespace?.name ?? `#${nsId}`}</span>
			</nav>

			<div className="flex items-center justify-between gap-3">
				<h2 className="text-xl font-semibold truncate">{namespace?.name ?? "…"}</h2>
				{activeTab === "secrets" && isOwner && (
					<Button size="sm" onClick={() => setShowForm(!showForm)}>
						{showForm ? "Cancel" : "+ Add Secret"}
					</Button>
				)}
			</div>

			<div className="flex gap-1 border-b border-border">
				{tabs.map((tab) => (
					<button
						key={tab.key}
						type="button"
						className={`btn-reset flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
							activeTab === tab.key
								? "text-primary border-b-2 border-primary"
								: "text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setActiveTab(tab.key)}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>

			{activeTab === "secrets" && (
				<div className="space-y-6">
					{showForm && (
						<form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
							<Input
								type="text"
								value={key}
								onChange={(e) => setKey(e.target.value)}
								placeholder="Key (e.g. DB_PASSWORD)"
								style={{ fontFamily: "monospace" }}
							/>
							<Input
								type="text"
								value={value}
								onChange={(e) => setValue(e.target.value)}
								placeholder="Value"
							/>
							<div className="flex justify-end gap-2">
								<Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
									Cancel
								</Button>
								<Button type="submit" disabled={isPending}>
									{isPending ? "Saving…" : "Save"}
								</Button>
							</div>
							{(validationError || error) && (
								<p className="text-destructive text-xs">{validationError || error}</p>
							)}
						</form>
					)}

					{isLoading && (
						<div className="border border-border rounded-lg bg-card p-4 flex items-center gap-3 text-sm text-muted-foreground shadow-sm">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading secrets…
						</div>
					)}

					<div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
						{!isLoading && secretKeys?.length === 0 && (
							<p className="px-5 py-12 text-muted-foreground text-sm text-center">
								No secrets yet.{isOwner ? " Add one above." : ""}
							</p>
						)}
						{secretKeys?.map((k) => (
							<SecretRow key={k} namespaceId={namespaceId!} secretKey={k} isOwner={isOwner} />
						))}
					</div>
				</div>
			)}

			{activeTab === "access" && namespaceId !== undefined && <AccessTab namespaceId={namespaceId} />}
		</div>
	);
}

export default NamespaceDetailPage;
