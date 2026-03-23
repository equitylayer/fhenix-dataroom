#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAPP_ROOT="$(dirname "$SCRIPT_DIR")"
CONTRACTS_ROOT="$DAPP_ROOT/../contracts"
ABI_DIR="$DAPP_ROOT/src/assets/abis"

# Anvil default accounts (#0 deploys & is admin, #9 = operator)
export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export ADMIN_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
export OPERATOR_ADDRESS="0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"

RPC_URL="http://127.0.0.1:8545"

echo "▸ Building contracts…"
cd "$CONTRACTS_ROOT"
forge build

echo "▸ Deploying to local Anvil ($RPC_URL)…"
OUTPUT=$(forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --broadcast 2>&1)

echo "$OUTPUT"

# Extract deployed address from forge output
DEPLOYED_ADDRESS=$(echo "$OUTPUT" | grep -oE "DataRoom deployed at: 0x[0-9a-fA-F]+" | grep -oE "0x[0-9a-fA-F]+")

echo "▸ Copying ABIs to dapp…"
mkdir -p "$ABI_DIR"
python3 -c "
import json, sys
with open('$CONTRACTS_ROOT/out/DataRoom.sol/DataRoom.json') as f:
    data = json.load(f)
with open('$ABI_DIR/DataRoom.json', 'w') as f:
    json.dump(data['abi'], f, indent=2)
"

echo "▸ ABI written to src/assets/abis/DataRoom.json"

if [ -n "${DEPLOYED_ADDRESS:-}" ]; then
  echo "▸ DataRoom deployed at: $DEPLOYED_ADDRESS"
fi
