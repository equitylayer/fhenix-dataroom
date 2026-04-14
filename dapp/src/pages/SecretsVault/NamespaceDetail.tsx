import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { KeyRound, Loader2, Plus, Shield } from "lucide-react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNamespacesByOwner, useSharedNamespaces } from "@/hooks/secretsvault/useNamespaces";
import { useSecretKeys, useSetSecret } from "@/hooks/secretsvault/useSecrets";
import { cn } from "@/lib/utils";
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

			<div className="flex items-center justify-between gap-3 flex-wrap">
				<h2 className="text-xl font-semibold truncate">{namespace?.name ?? "…"}</h2>

				<div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
					{tabs.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => setActiveTab(tab.key)}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs orbitron uppercase tracking-wider transition-colors cursor-pointer",
								"!border-none !shadow-none",
								activeTab === tab.key
									? "!bg-primary/10 !text-primary"
									: "!bg-transparent !text-muted-foreground hover:!text-foreground hover:!bg-accent/50",
							)}
						>
							{tab.icon}
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{activeTab === "secrets" && (
				<div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<KeyRound className="h-4 w-4 text-primary" />
							<h3 className="text-sm font-semibold">Secrets</h3>
						</div>
						{isOwner && (
							<Button variant="textLink" size="sm" onClick={() => setShowForm(!showForm)}>
								<Plus className="h-4 w-4" />
								{showForm ? "Cancel" : "Add Secret"}
							</Button>
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						Encrypted values stored on-chain. Only granted wallets can decrypt.
					</p>

					{showForm && (
						<form
							onSubmit={handleAdd}
							className="space-y-3 rounded-md border border-border bg-accent/20 p-4"
						>
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

					{isLoading ? (
						<div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
							<Loader2 className="h-3 w-3 animate-spin" />
							Loading secrets…
						</div>
					) : secretKeys?.length === 0 ? (
						<p className="py-8 text-muted-foreground text-sm text-center">
							No secrets yet.{isOwner ? " Add one above." : ""}
						</p>
					) : (
						<div className="divide-y divide-border rounded-md border border-border overflow-hidden">
							{secretKeys?.map((k) => (
								<SecretRow key={k} namespaceId={namespaceId!} secretKey={k} isOwner={isOwner} />
							))}
						</div>
					)}
				</div>
			)}

			{activeTab === "access" && namespaceId !== undefined && <AccessTab namespaceId={namespaceId} />}
		</div>
	);
}

export default NamespaceDetailPage;
