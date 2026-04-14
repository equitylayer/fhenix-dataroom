import type { Namespace } from "@obolos/secretsvault-sdk";
import { Link } from "react-router-dom";
import { ChevronRight, KeyRound } from "lucide-react";

interface Props {
	namespaces: Namespace[];
	emptyText: string;
}

export function NamespaceList({ namespaces, emptyText }: Props) {
	if (namespaces.length === 0) {
		return (
			<div className="border border-dashed border-border rounded-lg bg-card py-12 text-center text-muted-foreground text-sm shadow-sm">
				{emptyText}
			</div>
		);
	}

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{namespaces.map((ns) => (
				<Link
					key={ns.id.toString()}
					to={`/vault/${ns.id.toString()}`}
					className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
					style={{ textDecoration: "none", color: "inherit" }}
				>
					<div className="flex items-center gap-3 min-w-0">
						<div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
							<KeyRound className="h-4 w-4" />
						</div>
						<div className="min-w-0">
							<p className="font-semibold text-sm truncate">{ns.name}</p>
							<p className="text-xs text-muted-foreground">
								{ns.secretCount.toString()} secret{ns.secretCount !== 1n ? "s" : ""}
							</p>
						</div>
					</div>
					<ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
				</Link>
			))}
		</div>
	);
}
