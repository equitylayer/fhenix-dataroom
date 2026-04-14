import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSecretsVaultClient } from "../useSecretsVaultClient";
import { useVaultMutation } from "./useMutation";

export function useSecretKeys(namespaceId: bigint | undefined) {
	const client = useSecretsVaultClient();
	return useQuery({
		queryKey: ["vault", "secretKeys", namespaceId?.toString()],
		queryFn: () => client!.listSecrets(namespaceId!),
		enabled: !!client && namespaceId !== undefined,
	});
}

export function useSecret(namespaceId: bigint | undefined, key: string | undefined) {
	const client = useSecretsVaultClient();
	return useQuery({
		queryKey: ["vault", "secret", namespaceId?.toString(), key],
		queryFn: () => client!.getSecret(namespaceId!, key!),
		enabled: !!client && namespaceId !== undefined && !!key,
	});
}

export function useSetSecret() {
	const { execute, isPending, error } = useVaultMutation("Saving secret\u2026");

	const setSecret = useCallback(
		(namespaceId: bigint, key: string, value: string) => execute((c) => c.setSecret(namespaceId, key, value)),
		[execute],
	);

	return { setSecret, isPending, error };
}

export function useDeleteSecret() {
	const { execute, isPending, error } = useVaultMutation("Deleting secret\u2026");

	const deleteSecret = useCallback(
		(namespaceId: bigint, key: string) => execute((c) => c.deleteSecret(namespaceId, key)),
		[execute],
	);

	return { deleteSecret, isPending, error };
}
