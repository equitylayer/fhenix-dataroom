#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAPP_ROOT="$(dirname "$SCRIPT_DIR")"
CONTRACTS_ROOT="$DAPP_ROOT/../contracts"

# Anvil default accounts (#0 deploys & is admin, #9 = operator)
export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export ADMIN_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
export OPERATOR_ADDRESS="0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"

RPC_URL="http://127.0.0.1:8545"

echo "▸ Building contracts…"
cd "$CONTRACTS_ROOT"
forge build

echo "▸ Deploying to local Anvil ($RPC_URL)…"
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --broadcast

echo "▸ Pulling ABIs and contract addresses…"
cd "$DAPP_ROOT"
node scripts/pull-abis.js ../contracts --chain-id 31337

echo "▸ Generating TypeChain types…"
yarn gen

echo "✓ Done — contracts deployed and dapp types updated"
