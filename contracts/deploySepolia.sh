#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${PRIVATE_KEY:?PRIVATE_KEY is required}"
: "${ADMIN_ADDRESS:?ADMIN_ADDRESS is required}"
: "${OPERATOR_ADDRESS:?OPERATOR_ADDRESS is required}"
: "${RPC_URL:?RPC_URL is required}"

cd "$ROOT_DIR"

echo "▸ Building contracts..."
forge build

VERIFY_FLAGS=()
if [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
  VERIFY_FLAGS=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
fi

# Deploy DataRoom
echo ""
echo "▸ Deploying DataRoom..."
DATAROOM_OUT=$(forge create src/DataRoom.sol:DataRoom \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  "${VERIFY_FLAGS[@]}" 2>&1 | tee /dev/stderr)

DATAROOM_ADDR=$(echo "$DATAROOM_OUT" | grep -E "Deployed to:" | awk '{print $NF}')
if [[ -z "$DATAROOM_ADDR" ]]; then
  echo "✗ Failed to extract DataRoom address" >&2
  exit 1
fi
echo "  → DataRoom: $DATAROOM_ADDR"

# Initialize DataRoom
echo ""
echo "▸ Initializing DataRoom (admin=$ADMIN_ADDRESS, operator=$OPERATOR_ADDRESS)..."
cast send "$DATAROOM_ADDR" \
  "initialize(address,address)" "$ADMIN_ADDRESS" "$OPERATOR_ADDRESS" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null
echo "  ✓ Initialized"

# Deploy SecretsVault
echo ""
echo "▸ Deploying SecretsVault (owner=$ADMIN_ADDRESS)..."
VAULT_OUT=$(forge create src/SecretsVault.sol:SecretsVault \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --constructor-args "$ADMIN_ADDRESS" \
  "${VERIFY_FLAGS[@]}" 2>&1 | tee /dev/stderr)

VAULT_ADDR=$(echo "$VAULT_OUT" | grep -E "Deployed to:" | awk '{print $NF}')
if [[ -z "$VAULT_ADDR" ]]; then
  echo "✗ Failed to extract SecretsVault address" >&2
  exit 1
fi
echo "  → SecretsVault: $VAULT_ADDR"

CHAIN_ID="${CHAIN_ID:-84532}"

# Update dapp contracts JSON + SDK deployments.ts (forge create doesn't write
# broadcast files that pull-abis.js can read, so we patch them directly).
DAPP_CONTRACTS="$ROOT_DIR/../dapp/src/assets/${CHAIN_ID}.contracts.json"
SDK_DEPLOYMENTS="$ROOT_DIR/../sdk/src/deployments.ts"

if [[ -f "$DAPP_CONTRACTS" ]]; then
  echo ""
  echo "▸ Updating $DAPP_CONTRACTS"
  cat > "$DAPP_CONTRACTS" <<EOF
{
  "DataRoom": "$DATAROOM_ADDR",
  "SecretsVault": "$VAULT_ADDR"
}
EOF
fi

if [[ -f "$SDK_DEPLOYMENTS" ]]; then
  echo "▸ Updating $SDK_DEPLOYMENTS for chain $CHAIN_ID"
  # In-place sed: replace the chain block. macOS sed needs '' after -i.
  python3 - "$SDK_DEPLOYMENTS" "$CHAIN_ID" "$DATAROOM_ADDR" "$VAULT_ADDR" <<'PY'
import json, re, sys
path, chain, dataroom, vault = sys.argv[1:]
content = open(path).read()
match = re.search(r"=\s*(\{[\s\S]*?\})\s*as const", content)
data = json.loads(match.group(1))
data[chain] = {"DataRoom": dataroom, "SecretsVault": vault}
new = (
    "// Auto-generated. DO NOT edit.\n\n"
    'import type { HexAddress } from "./types";\n\n'
    f"export const DEPLOYMENTS: Record<string, Record<string, HexAddress>> = {json.dumps(data, indent=2)} as const;\n"
)
open(path, "w").write(new)
PY
fi

# Copy ABIs from forge build output to dapp + SDK, then regenerate TypeChain.
DAPP_ABI_DIR="$ROOT_DIR/../dapp/src/assets/abis"
SDK_ABI="$ROOT_DIR/../sdk/src/abi.ts"

if [[ -d "$DAPP_ABI_DIR" ]]; then
  for c in DataRoom SecretsVault; do
    src="$ROOT_DIR/out/$c.sol/$c.json"
    if [[ -f "$src" ]]; then
      python3 -c "import json; d=json.load(open('$src')); json.dump(d['abi'], open('$DAPP_ABI_DIR/$c.json','w'), indent=2)"
    fi
  done
fi

if [[ -f "$SDK_ABI" ]]; then
  src="$ROOT_DIR/out/SecretsVault.sol/SecretsVault.json"
  if [[ -f "$src" ]]; then
    python3 -c "
import json
abi = json.load(open('$src'))['abi']
open('$SDK_ABI','w').write('// Auto-generated. DO NOT edit.\n\nexport const SECRETS_VAULT_ABI = ' + json.dumps(abi, indent=2) + ' as const;\n')
"
  fi
fi

cd "$ROOT_DIR/../dapp" 2>/dev/null && yarn gen >/dev/null 2>&1 || true

echo ""
echo "✓ Done"
echo "  DataRoom:     $DATAROOM_ADDR"
echo "  SecretsVault: $VAULT_ADDR"
