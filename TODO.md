# TODO

## Data Room

- **Expiring access.** SecretsVault supports `expiresAt` on both namespace- and per-secret grants. DataRoom's `grantAccess` / `grantAccessToAllFolders` are boolean-only. Port the expiry model:
  - Contract: add `uint256 expiresAt` to grant functions; track expiry per folder-member pair; include expiry check in the access gate.
  - SDK / dapp: pass expiry through (permanent / datetime picker, same UX as SecretsVault's `GrantAccessForm`).
  - Consider whether to keep the simple boolean path for backwards compat, or do a clean migration.

## Secrets Vault

- **Rotating per-secret / namespace keys.** DataRoom rotates folder keys + re-wraps document CEKs on revoke (`revokeAndRekey` + `updateDocumentKeys`). SecretsVault currently has no equivalent — revoking access leaves the revoked wallet's FHE permit in place for past ciphertexts (they could still decrypt historical `s.value` / `s.nsValue` blobs already observed).
  - Decide whether this is a real threat model concern (secrets are typically rotated by setting a new value, which also rotates the per-secret FHE key via `deleteSecret` + `setSecret`).
  - If needed: contract-side `rotateNamespaceKey` / `rotateSecretKey` that generates a fresh `euint128` + re-encrypts stored ciphertexts. Requires client to decrypt old values, re-encrypt with new key, and update storage — same two-phase flow as DataRoom's rekey+rewrap.