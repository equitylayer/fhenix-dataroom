# Obolos Personal Cloud

Self-sovereign cloud — encrypted document storage and secrets management on-chain, keys in your wallet. Two products sharing one control plane: **Data Room** and **Secrets Vault**. Built with Fhenix CoFHE.

```
contracts/   Solidity (Foundry/Fhenix)    :: DataRoom + SecretsVault
sdk/         @obolos/secretsvault-sdk       :: client + CoFHE wiring
dapp/        React + Vite + wagmi           :: dApp
```

## Quick Start

```bash
./dev.sh
```

Starts Anvil, etches CoFHE mocks, deploys DataRoom + SecretsVault, pulls ABIs, and starts the dapp dev server.

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