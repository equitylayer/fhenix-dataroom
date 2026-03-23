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

CMD=(
  forge script script/Deploy.s.sol:Deploy
  --rpc-url "$RPC_URL"
  --broadcast
)

if [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
  CMD+=(
    --verify
    --etherscan-api-key "$ETHERSCAN_API_KEY"
  )
  echo "▸ Deploying and verifying..."
else
  echo "▸ Deploying..."
fi

"${CMD[@]}"
