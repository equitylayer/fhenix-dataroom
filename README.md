# Obolos Personal Cloud

Self-sovereign cloud — encrypted document storage and secrets management on-chain, keys in your wallet. Two products sharing one control plane: **Data Room** and **Secrets Vault**. Built with Fhenix CoFHE.

```
contracts/   Solidity (Foundry/Fhenix)    :: DataRoom + SecretsVault
sdk/         @obolos/secretsvault-sdk     :: client + CoFHE wiring
dapp/        React + Vite + wagmi         :: dApp
```

## Quick Start

```bash
./dev.sh
```

Starts Anvil, etches CoFHE mocks, deploys DataRoom + SecretsVault, pulls ABIs, and starts the dapp dev server.

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

## What's new in this round

**Product**

* Secrets Vault — a second product alongside the Data Room, sharing a wallet and an FHE key-custody model. [sdk/](sdk/) ships `@obolos/secretsvault-sdk` for programmatic use.
* File viewer modal — click any document to preview (images, PDFs, text, video) inline instead of downloading. Route `/room/:roomId/folder/:folderId/doc/:docIndex` is a shareable deep link.
* Access-management UX overhaul — Data Room and Secrets Vault now share a single grant/access component and a consistent layout (room-wide + per-folder / namespace-wide + per-secret).

**Expiring access (Data Room)**

* Grants now carry an `expiresAt` timestamp. UI picker is permanent-by-default with an explicit datetime override — matches the SecretsVault pattern.
* `hasAccess` and every downstream gate (`getRoomKey`, `getDocument`, …) refuse reads after expiry. Owner and operator bypass.
* "Soft" expiry by default: after `expiresAt` the contract refuses fresh handle reads, but a cached FHE handle still decrypts. For hard-revoke, the UI shows a red banner when any folder has expired members — one click runs `revokeAndRekey` + the existing rewrap flow, rotating the folder key and leaving expired users on the old key version. Trade-off explained in [TODO.md](TODO.md).
* `rekeyRoom` skips expired members when re-allowing on the new key, so post-rotation they can't decrypt even with a cached handle.
* New views: `getMemberExpiry`, `getRoomWideExpiry`, `getExpiredMembers`.

**Room-wide access — now correct**

* Prior release derived "room-wide access" by intersecting per-folder memberships. Single-folder rooms falsely marked every member as room-wide, and two coincidental per-folder grants looked identical to a room-wide grant.
* Now tracked explicitly on-chain via `_roomWideAccess[parentId]`. `createFolder` propagates existing room-wide grants (with their expiry) to the new folder, so room-wide means "all folders, including ones created later".
* Per-folder access UI splits members into **direct** and **inherited from room-level access** (collapsible).

**SDK + build**

* Root yarn workspace (`sdk` + `dapp`). One `./dev.sh` stands up both contracts, pulls ABIs for the SDK and the dapp, and starts vite.
* `via_ir` + explicit `yulDetails.optimizerSteps = "u"` in foundry.toml — works around a solc Yul-CSE miscompilation (`block.timestamp + 1 hours` was being folded to a constant across tx boundaries).
* Write flows (`setSecret`, `grantAccess`, etc.) check `receipt.status === "success"` and surface the actual revert reason via an eth_call replay — previously reverted TXs were silently swallowed.

## Known follow-ups

Tracked in [TODO.md](TODO.md). The big one is **dual-wrap documents** — designed, scoped, not landed. It makes `grantAccessToAllFolders` O(1) and removes the per-folder loop on `createFolder`, at the cost of ~15 files of refactor and a migration for existing documents. Current O(folders × grantees) model is fine at team-room scale (< ~30 folders / ~30 room-wide users); revisit when pushing past that.

## AI disclosure

We used LLMs as engineering assistants for:
- Coding assistance and pair programming
- Documentation and knowledge discovery
- UX design under guidance
- Test generation and coverage analysis
