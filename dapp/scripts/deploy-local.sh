#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAPP_ROOT="$(dirname "$SCRIPT_DIR")"
CONTRACTS_ROOT="$DAPP_ROOT/../contracts"

set -a
source "$CONTRACTS_ROOT/.env.local"
set +a

echo "▸ Building contracts…"
cd "$CONTRACTS_ROOT"
forge build

echo "▸ Etching CoFHE mocks at hardcoded addresses…"
TM_CODE=$(forge inspect MockTaskManager deployedBytecode)
ACL_CODE=$(forge inspect ForgeMockACL deployedBytecode)
ZK_CODE=$(forge inspect MockZkVerifier deployedBytecode)
TN_CODE=$(forge inspect MockThresholdNetwork deployedBytecode)
cast rpc anvil_setCode 0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9 "$TM_CODE" --rpc-url "$RPC_URL" > /dev/null
cast rpc anvil_setCode 0xa6Ea4b5291d044D93b73b3CFf3109A1128663E8B "$ACL_CODE" --rpc-url "$RPC_URL" > /dev/null
cast rpc anvil_setCode 0x0000000000000000000000000000000000005001 "$ZK_CODE" --rpc-url "$RPC_URL" > /dev/null
cast rpc anvil_setCode 0x0000000000000000000000000000000000005002 "$TN_CODE" --rpc-url "$RPC_URL" > /dev/null

echo "▸ Deploying DataRoom + SecretsVault (+ initialising CoFHE mocks)…"
forge script script/DeployLocal.s.sol:DeployLocal \
  --rpc-url "$RPC_URL" \
  --broadcast

echo "▸ Pulling ABI for SecretsVault SDK…"
cd "$DAPP_ROOT/../sdk"
yarn pull-abi ../contracts --chain-id 31337

echo "▸ Pulling ABIs and contract addresses…"
cd "$DAPP_ROOT"
node scripts/pull-abis.js ../contracts --chain-id 31337

echo "▸ Generating TypeChain types…"
yarn gen

echo "✓ Done — contracts deployed and dapp types updated"
