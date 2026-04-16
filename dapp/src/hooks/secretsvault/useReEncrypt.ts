import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useSecretsVaultClient } from "../useSecretsVaultClient";

export interface ReEncryptProgress {
	phase: "idle" | "decrypting" | "rotating" | "re-encrypting" | "done" | "error";
	current: number;
	total: number;
	error?: string;
}

export function useReEncryptNamespace() {
	const client = useSecretsVaultClient();
	const queryClient = useQueryClient();
	const { push, dismiss } = useToast();
	const [progress, setProgress] = useState<ReEncryptProgress>({
		phase: "idle",
		current: 0,
		total: 0,
	});

	const reEncrypt = useCallback(
		async (namespaceId: bigint) => {
			if (!client) return;
			setProgress({ phase: "decrypting", current: 0, total: 0 });
			push({ variant: "loading", title: "Re-encrypting vault…" });
			try {
				await client.reEncryptNamespace(namespaceId, (current, total) => {
					const half = Math.floor(total / 2);
					if (current < half) {
						setProgress({ phase: "decrypting", current, total: half });
					} else if (current === half) {
						setProgress({ phase: "rotating", current: 0, total: half });
					} else {
						setProgress({ phase: "re-encrypting", current: current - half, total: half });
					}
				});
				setProgress({ phase: "done", current: 0, total: 0 });
				dismiss();
				push({ variant: "success", title: "Vault re-encrypted" });
				queryClient.invalidateQueries({ refetchType: "all" });
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : "Failed";
				dismiss();
				if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
					setProgress({ phase: "idle", current: 0, total: 0 });
				} else {
					setProgress({ phase: "error", current: 0, total: 0, error: msg });
					push({ variant: "error", title: msg.slice(0, 120) });
				}
			}
		},
		[client, queryClient, push, dismiss],
	);

	return { reEncrypt, progress };
}
