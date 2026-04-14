import { DEPLOYMENTS } from "./deployments";
import type { HexAddress } from "./types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function getVaultAddress(chainId: number): HexAddress {
	const deployment = DEPLOYMENTS[String(chainId)];
	const addr = deployment?.SecretsVault;
	if (!addr || addr === ZERO_ADDRESS) {
		throw new Error(
			`No SecretsVault deployment for chain ${chainId}. Run: yarn workspace @obolos/secretsvault-sdk pull-abi --chain-id ${chainId}`,
		);
	}
	return addr;
}
