import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSecretsVaultClient } from "../useSecretsVaultClient";
import { useVaultMutation } from "./useMutation";

export function useNamespaceGrantees(namespaceId: bigint | undefined) {
	const client = useSecretsVaultClient();
	return useQuery({
		queryKey: ["vault", "nsGrantees", namespaceId?.toString()],
		queryFn: () => client!.listNamespaceGrantees(namespaceId!),
		enabled: !!client && namespaceId !== undefined,
	});
}

export function useSecretGrantees(namespaceId: bigint | undefined, key: string | undefined) {
	const client = useSecretsVaultClient();
	return useQuery({
		queryKey: ["vault", "secretGrantees", namespaceId?.toString(), key],
		queryFn: () => client!.listSecretGrantees(namespaceId!, key!),
		enabled: !!client && namespaceId !== undefined && !!key,
	});
}

export function useGrantNamespaceAccess() {
	const { execute, isPending, error } = useVaultMutation("Granting access\u2026");
	const grant = useCallback(
		(namespaceId: bigint, account: string, expiresAt: bigint) =>
			execute((c) => c.grantNamespaceAccess(namespaceId, account as `0x${string}`, expiresAt)),
		[execute],
	);
	return { grant, isPending, error };
}

export function useRevokeNamespaceAccess() {
	const { execute, isPending, error } = useVaultMutation("Revoking access\u2026");
	const revoke = useCallback(
		(namespaceId: bigint, account: string) =>
			execute((c) => c.revokeNamespaceAccess(namespaceId, account as `0x${string}`)),
		[execute],
	);
	return { revoke, isPending, error };
}

export function useGrantSecretAccess() {
	const { execute, isPending, error } = useVaultMutation("Granting secret access\u2026");
	const grant = useCallback(
		(namespaceId: bigint, key: string, account: string, expiresAt: bigint) =>
			execute((c) => c.grantSecretAccess(namespaceId, key, account as `0x${string}`, expiresAt)),
		[execute],
	);
	return { grant, isPending, error };
}

export function useRevokeSecretAccess() {
	const { execute, isPending, error } = useVaultMutation("Revoking secret access\u2026");
	const revoke = useCallback(
		(namespaceId: bigint, key: string, account: string) =>
			execute((c) => c.revokeSecretAccess(namespaceId, key, account as `0x${string}`)),
		[execute],
	);
	return { revoke, isPending, error };
}
