// FHE decryption is host-provided (see DecryptFheKeyFn in types.ts).
// The SDK doesn't ship a default Node/browser implementation — callers wire
// the CoFHE client themselves and pass `decryptFheKey` to `fromClients`.
export {};
