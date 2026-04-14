# TODO

## Data Room

- **Expiring access.** SecretsVault supports `expiresAt` on both namespace- and per-secret grants. DataRoom's `grantAccess` / `grantAccessToAllFolders` are boolean-only. Port the expiry model:
  - Contract: add `uint256 expiresAt` to grant functions; track expiry per folder-member pair; include expiry check in the access gate.
  - SDK / dapp: pass expiry through (permanent / datetime picker, same UX as SecretsVault's `GrantAccessForm`).
  - Consider whether to keep the simple boolean path for backwards compat, or do a clean migration.

- **Dual-wrap documents for scalable room-wide access** (mirror SecretsVault's `value` + `nsValue` pattern). Current `grantAccessToAllFolders` is `O(folders)` in writes + FHE.allow calls, and `createFolder` is `O(room-wide grantees)` after the propagation fix. Both scale poorly past ~30 folders or ~30 room-wide users.
  - Contract: add `bytes wrappedByRoom` to `Document` alongside existing `wrappedKey`; update `addDocuments` + `updateDocumentKeys` to accept both wraps; drop the propagation loops — `grantAccessToAllFolders` becomes a single `FHE.allow(roomKey, user)`; `createFolder` no longer loops grantees.
  - SDK / dapp: upload wraps CEK twice (with folder key + room key); download path tries folder wrap first, falls back to room wrap — same fallback as `getSecret`.
  - Backfill: existing docs without `wrappedByRoom` need a migration tx per folder on the first room-wide grant after upload (decrypt each CEK with folder key, re-wrap with room key, submit via `updateDocumentKeys`). Same two-phase flow as SecretsVault's `setSecret`.
  - Revoke-room-wide stays `O(total docs)` (rekey room + rewrap every `wrappedByRoom`). Fine at team-room scale; revisit if multi-thousand-doc rooms become real.

- **Same bugs exist in `../contracts/src/DataRoom.sol`** (the main Obolos dapp's copy). That version has no `_roomWideAccess` tracking at all, so the UI there can't distinguish room-wide intent from per-folder grants. File upstream: port the `_roomWideAccess` set, `getRoomWideGrantees` view, and `createFolder` propagation from [contracts/src/DataRoom.sol](contracts/src/DataRoom.sol). Note: solc 0.8.34 needs `via_ir = true` in foundry.toml after the change (`Tag too large for reserved space` internal compiler error otherwise).

## Secrets Vault

- **Rotating per-secret / namespace keys.** DataRoom rotates folder keys + re-wraps document CEKs on revoke (`revokeAndRekey` + `updateDocumentKeys`). SecretsVault currently has no equivalent — revoking access leaves the revoked wallet's FHE permit in place for past ciphertexts (they could still decrypt historical `s.value` / `s.nsValue` blobs already observed).
  - Decide whether this is a real threat model concern (secrets are typically rotated by setting a new value, which also rotates the per-secret FHE key via `deleteSecret` + `setSecret`).
  - If needed: contract-side `rotateNamespaceKey` / `rotateSecretKey` that generates a fresh `euint128` + re-encrypts stored ciphertexts. Requires client to decrypt old values, re-encrypt with new key, and update storage — same two-phase flow as DataRoom's rekey+rewrap.