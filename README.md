# Obolos DataRoom

FHE-encrypted document storage and sharing on-chain. Built with Fhenix CoFHE for fully homomorphic encryption of folder keys.

```
contracts/   Solidity (Foundry) — DataRoom contract
dapp/        React + Vite + wagmi — web frontend
```

## Quick Start

```bash
./dev.sh
```

Starts Anvil, etches CoFHE mocks, deploys DataRoom, pulls ABIs, and starts the dapp dev server.

> Please note you need to extract STORACHA env vars. Ask petros@obolos.io

## Deploy to Another Chain

```bash
cd contracts
cp .env.staging .env   # fill in PRIVATE_KEY
source .env

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $RPC_URL \
  --broadcast

cd ../dapp
yarn pull-abis:staging   # generates 84532.contracts.json
git add src/assets/84532.contracts.json && git commit -m "Add staging contracts"
git tag v0.1.0 && git push origin master --tags   # triggers Firebase deploy
```

## Tests

```bash
cd contracts && forge test -vvv
```