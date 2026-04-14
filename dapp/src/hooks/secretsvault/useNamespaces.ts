import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSecretsVaultClient } from "../useSecretsVaultClient";
import { useVaultMutation } from "./useMutation";

export function useNamespacesByOwner(owner: string | undefined) {
	const client = useSecretsVaultClient();
	return useQuery({
		queryKey: ["vault", "namespaces", owner],
		queryFn: () => client!.listNamespaces(owner as `0x${string}`),
		enabled: !!client && !!owner,
	});
}

export function useSharedNamespaces(account: string | undefined) {
	const client = useSecretsVaultClient();
	return useQuery({
		queryKey: ["vault", "sharedNamespaces", account],
		queryFn: () => client!.listSharedNamespaces(account as `0x${string}`),
		enabled: !!client && !!account,
	});
}

export function useCreateNamespace() {
	const { execute, isPending, error } = useVaultMutation("Creating vault\u2026");

	const createNamespace = useCallback((name: string) => execute((c) => c.createNamespace(name)), [execute]);

	return { createNamespace, isPending, error };
}
