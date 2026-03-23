#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
let chainId = "31337";
let forgePath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--chain-id" || args[i] === "-c") {
    chainId = args[i + 1];
    i++;
  } else if (!args[i].startsWith("-")) {
    forgePath = args[i];
  }
}

if (!forgePath) {
  console.error("Error: Contracts path is required");
  console.log("Usage: node pull-abis.js <contracts-path> [--chain-id <id>]");
  process.exit(1);
}

const forgeProjectPath = path.resolve(forgePath);
const broadcastDir = path.join(forgeProjectPath, "broadcast");
const outPath = path.join(forgeProjectPath, "out");

const projectRoot = path.resolve(__dirname, "..");
const assetsPath = path.join(projectRoot, "src", "assets");
const abiPath = path.join(assetsPath, "abis");
const contractsJsonPath = path.join(assetsPath, `${chainId}.contracts.json`);

if (!fs.existsSync(broadcastDir)) {
  console.error(`Error: Broadcast directory not found at ${broadcastDir}`);
  process.exit(1);
}

const deploymentScripts = fs
  .readdirSync(broadcastDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

if (deploymentScripts.length === 0) {
  console.error(`Error: No deployment scripts found in ${broadcastDir}`);
  process.exit(1);
}

console.log(`Found ${deploymentScripts.length} deployment script(s): ${deploymentScripts.join(", ")}`);

const contracts = {};

for (const script of deploymentScripts) {
  const broadcastPath = path.join(broadcastDir, script, chainId, "run-latest.json");

  console.log(`\nChecking: ${script}/${chainId}/run-latest.json`);

  if (!fs.existsSync(broadcastPath)) {
    console.log(`  ⚠ Skipping: run-latest.json not found for chain ${chainId}`);
    continue;
  }

  let broadcastData;
  try {
    broadcastData = JSON.parse(fs.readFileSync(broadcastPath, "utf-8"));
  } catch (error) {
    console.warn(`  ⚠ Could not read broadcast file: ${error.message}`);
    continue;
  }

  const transactions = broadcastData.transactions || [];
  console.log(`  Found ${transactions.length} transaction(s)`);

  for (const tx of transactions) {
    if (tx.transactionType === "CREATE" && tx.contractName && tx.contractAddress) {
      const baseName = tx.contractName.replace(/\.\d+\.\d+\.\d+$/, "");
      console.log(`  Found contract: ${baseName} at ${tx.contractAddress}`);
      contracts[baseName] = tx.contractAddress;

      // Copy ABI
      const abiSourcePath = path.join(outPath, `${baseName}.sol`, `${baseName}.json`);
      if (fs.existsSync(abiSourcePath)) {
        try {
          const abiData = JSON.parse(fs.readFileSync(abiSourcePath, "utf-8"));
          fs.mkdirSync(abiPath, { recursive: true });
          const abiDestPath = path.join(abiPath, `${baseName}.json`);
          fs.writeFileSync(abiDestPath, JSON.stringify(abiData.abi, null, 2));
          console.log(`    ✓ Copied ABI to ${path.relative(projectRoot, abiDestPath)}`);
        } catch (error) {
          console.warn(`    ⚠ Could not copy ABI for ${baseName}: ${error.message}`);
        }
      }
    }
  }
}

fs.mkdirSync(assetsPath, { recursive: true });

try {
  fs.writeFileSync(contractsJsonPath, JSON.stringify(contracts, null, 2));
  console.log(`\n✓ Written contracts to ${path.relative(projectRoot, contractsJsonPath)}`);
  console.log(`✓ Found ${Object.keys(contracts).length} contract(s)`);
} catch (error) {
  console.error(`Error writing contracts.json: ${error.message}`);
  process.exit(1);
}
