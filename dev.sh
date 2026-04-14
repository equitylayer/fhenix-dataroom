#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ---------- helpers ----------
info()  { printf "\n\033[1;34m▸ %s\033[0m\n" "$*"; }
err()   { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; exit 1; }

# ---------- foundry ----------
install_foundry() {
  if command -v forge &>/dev/null; then
    info "Foundry already installed ($(forge --version | head -1))"
  else
    info "Installing Foundry…"
    curl -L https://foundry.paradigm.xyz | bash
    export PATH="$HOME/.foundry/bin:$PATH"
    foundryup
  fi
}

# ---------- deps ----------
install_deps() {
  info "Installing contract dependencies…"
  cd "$ROOT/contracts"
  yarn install --frozen-lockfile 2>/dev/null || yarn install

  info "Installing workspace dependencies (sdk + dapp)…"
  cd "$ROOT"
  yarn install --frozen-lockfile 2>/dev/null || yarn install
}

# ---------- run the stack ----------
run_stack() {
  info "Starting Anvil…"
  anvil &
  ANVIL_PID=$!
  sleep 2

  # Deploy contracts + pull ABIs (SDK + dapp) + start vite
  info "Deploying contracts & starting dapp…"
  cd "$ROOT/dapp"
  yarn dev:stack &
  VITE_PID=$!

  info "Stack is running!"
  echo "  Anvil:  http://127.0.0.1:8545  (pid $ANVIL_PID)"
  echo "  Dapp:   http://localhost:5173   (pid $VITE_PID)"
  echo ""
  echo "Press Ctrl+C to stop everything."

  trap 'kill $ANVIL_PID $VITE_PID 2>/dev/null; exit' INT TERM
  wait
}

# ---------- main ----------
install_foundry
install_deps
run_stack
