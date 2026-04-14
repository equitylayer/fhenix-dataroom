export type HexAddress = `0x${string}`;
export type HexString = `0x${string}`;

export type DecryptFheKeyFn = (handle: string) => Promise<string>;

export interface ClientConfig<TPublic = unknown, TWallet = unknown> {
	publicClient: TPublic;
	walletClient: TWallet;
	vaultAddress?: HexAddress;
	chainId: number;
	decryptFheKey: DecryptFheKeyFn;
}

export interface Namespace {
	id: bigint;
	owner: HexAddress;
	name: string;
	secretCount: bigint;
}

export interface SecretValue {
	value: string;
	createdAt: number;
	updatedAt: number;
}

export interface Grantee {
	address: HexAddress;
	expiresAt: bigint;
	permanent: boolean;
	expired: boolean;
}

export const PERMANENT = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
