export { SecretsVaultClient } from "./client";
export { encryptSecret, decryptSecret, IV_BYTES } from "./crypto";
export { SECRETS_VAULT_ABI } from "./abi";
export { getVaultAddress } from "./chains";
export { resolveAddress, resolveEnsName } from "./ens";
export { PERMANENT } from "./types";
export type {
	ClientConfig,
	DecryptFheKeyFn,
	HexAddress,
	HexString,
	Namespace,
	SecretValue,
	Grantee,
} from "./types";
