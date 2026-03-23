const contractModules = import.meta.glob<Record<string, string>>("@/assets/*.contracts.json", {
	eager: true,
	import: "default",
});

export type HexAddress = `0x${string}`;

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || "31337");

const contractsKey = Object.keys(contractModules).find((key) => key.includes(`${CHAIN_ID}.contracts.json`));

if (!contractsKey) {
	throw new Error(`Contracts file not found for chain ${CHAIN_ID}. Expected: ${CHAIN_ID}.contracts.json`);
}

const contracts = contractModules[contractsKey];

const dataRoomAddress = contracts.DataRoom;

if (!dataRoomAddress) {
	throw new Error(`DataRoom not found in ${CHAIN_ID}.contracts.json`);
}

export const DATAROOM_ADDRESS = dataRoomAddress as HexAddress;
export const CONTRACTS_MAP = contracts;
