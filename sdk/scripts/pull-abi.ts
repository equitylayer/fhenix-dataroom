#!/usr/bin/env tsx
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const contractsDir = process.argv[2] ?? resolve(__dirname, "../../contracts");
const srcDir = resolve(__dirname, "../src");

let chainId = "31337";
for (let i = 2; i < process.argv.length; i++) {
	if (process.argv[i] === "--chain-id" || process.argv[i] === "-c") {
		chainId = process.argv[i + 1];
		i++;
	}
}

// --- ABI ---
const artifactPath = resolve(contractsDir, "out/SecretsVault.sol/SecretsVault.json");
const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));

writeFileSync(
	join(srcDir, "abi.ts"),
	`// Auto-generated. DO NOT edit.\n\nexport const SECRETS_VAULT_ABI = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`,
);
console.log(`Wrote ABI (${artifact.abi.length} entries) to src/abi.ts`);

// --- Deployments ---
const broadcastDir = join(contractsDir, "broadcast");
if (!existsSync(broadcastDir)) {
	console.warn(`No broadcast dir at ${broadcastDir}, skipping deployment extraction`);
	process.exit(0);
}

const addresses: Record<string, string> = {};

const scripts = readdirSync(broadcastDir, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name);

for (const script of scripts) {
	const runPath = join(broadcastDir, script, chainId, "run-latest.json");
	if (!existsSync(runPath)) continue;

	const data = JSON.parse(readFileSync(runPath, "utf-8"));
	for (const tx of data.transactions ?? []) {
		if (tx.transactionType === "CREATE" && tx.contractName && tx.contractAddress) {
			const name = tx.contractName.replace(/\.\d+\.\d+\.\d+$/, "");
			addresses[name] = tx.contractAddress;
			console.log(`Found ${name} at ${tx.contractAddress} (chain ${chainId})`);
		}
	}
}

// Read existing deployments, merge in new chain
const deploymentsPath = join(srcDir, "deployments.ts");
let existing: Record<string, Record<string, string>> = {};
if (existsSync(deploymentsPath)) {
	const content = readFileSync(deploymentsPath, "utf-8");
	const match = content.match(/=\s*(\{[\s\S]*?\})\s*as const/);
	if (match) {
		try {
			existing = JSON.parse(match[1].replace(/\/\/.*/g, "").replace(/,\s*}/g, "}"));
		} catch {
			/* start fresh */
		}
	}
}

existing[chainId] = addresses;

const deploymentsContent = `// Auto-generated. DO NOT edit.

import type { HexAddress } from "./types";

export const DEPLOYMENTS: Record<string, Record<string, HexAddress>> = ${JSON.stringify(existing, null, 2)} as const;
`;

writeFileSync(deploymentsPath, deploymentsContent);
console.log(`Wrote deployments for chain ${chainId} to src/deployments.ts`);
