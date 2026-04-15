import type { SecretsVaultClient } from "@obolos/secretsvault-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useSecretsVaultClient } from "../useSecretsVaultClient";

export function useVaultMutation(label: string) {
	const client = useSecretsVaultClient();
	const queryClient = useQueryClient();
	const { push, dismiss } = useToast();
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const execute = useCallback(
		async (fn: (c: SecretsVaultClient) => Promise<unknown>) => {
			if (!client) return;
			setIsPending(true);
			setError(null);
			push({ variant: "loading", title: label });
			try {
				await fn(client);
				dismiss();
				push({ variant: "success", title: "Transaction confirmed" });
				queryClient.invalidateQueries({ refetchType: "all" });
				setTimeout(() => queryClient.invalidateQueries({ refetchType: "all" }), 2500);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : "Failed";
				dismiss();
				if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
					// user cancelled — no toast
				} else {
					setError(msg);
					push({ variant: "error", title: msg.slice(0, 120) });
				}
			} finally {
				setIsPending(false);
			}
		},
		[client, queryClient, label, push, dismiss],
	);

	return { execute, isPending, error };
}
