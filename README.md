# Fhenix Dataroom

A privacy-preserving dataroom built on [Fhenix](https://fhenix.io/) using Fully Homomorphic Encryption (FHE).

## Structure

- **contracts/** — Solidity smart contracts (Foundry)
- **dapp/** — Frontend application (Vite + React)

## Quick Start

Run the full local stack (installs Foundry, deps, deploys to Anvil, starts the dapp):

```bash
./dev.sh
```

## Manual Setup

### Contracts

```bash
cd contracts
cp .env.template .env   # fill in your values
yarn install
forge build
forge test
```

### Dapp

```bash
cd dapp
cp .env.template .env   # fill in your values
yarn install
yarn dev
```
