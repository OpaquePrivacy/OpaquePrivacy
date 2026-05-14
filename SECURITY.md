# Security Policy

We take the security of the Opaque Privacy Agent SDK seriously. This SDK
moves real money on behalf of autonomous agents — every line of crypto
and every transport adapter is in scope.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.**

Email [security@opaqueprivacy.app](mailto:security@opaqueprivacy.app) with:

- A clear description of the issue and its impact
- Reproduction steps (proof-of-concept code is ideal)
- The version of the SDK affected (commit SHA or npm version)
- Your name and how you would like to be credited (or "anonymous")

We aim to acknowledge every report within **48 hours** and provide a
status update within **7 days**.

## Scope

In scope for this repository:

- The SDK source under [`src/`](src/) — codec, signer, transports, agent
- The example code under [`examples/`](examples/)
- The published `@opaqueprivacy/agent-sdk` npm package
- The CI workflow and release process

Out of scope (report to the relevant project instead):

- The Opaque Privacy web application (`opaqueprivacy.app`) — report to
  `security@opaqueprivacy.app` and mention "web application"
- The settlement gateway, intermediate-wallet pool, or relayer keys —
  same address, mention "gateway infrastructure"
- Third-party dependencies — please file with the upstream project,
  then notify us so we can pin or fork while a patch is published

## Supported versions

| Version | Supported |
|---|---|
| `0.x` | ✅ Active development. Security fixes back-ported to the latest minor. |
| Older `0.x` | ❌ Please upgrade to the latest patch release. |

We will publish a 1.0 with a formal audit before any version drops out
of support.

## Disclosure policy

- We work in coordinated disclosure. Reporters who follow this policy
  will be credited in the changelog (with permission).
- We will not pursue legal action against good-faith security research
  conducted under this policy.
- Severe bugs (key compromise, signature forgery, replay across the
  network) will get a same-day patch release and a public advisory once
  patches are widely available.

## Known sharp edges

These are not vulnerabilities — they are documented limitations that
operators must handle correctly:

1. **In-memory sequence counter resets on restart.** If your agent
   process restarts, the in-memory `SequenceStore` resets to zero. Use a
   persistent store (file, Redis, etc.) for any agent that survives a
   restart. Otherwise the gateway will reject every payment until the
   sequence exceeds the previous high water mark.
2. **The SDK does not yet enforce a maximum per-payment amount.** Bound
   `amount` in your own application code before calling `pay()`.
3. **Custom signers are trusted blindly.** If you implement the `Signer`
   interface yourself, the SDK has no way to verify your implementation
   handles the secret material safely. Audit your signer.
4. **The BLE transport is scaffolded but unaudited.** The GATT UUIDs are
   not yet finalized. Do not use BLE for production payments until the
   1.0 release.

## Cryptography

The SDK uses:

- **Ed25519** for payload signatures, via [tweetnacl](https://github.com/dchest/tweetnacl-js).
- **SHA-256** for username hashing, via the Web Crypto API.
- **Base58** for Solana key serialization, via [bs58](https://github.com/cryptocoinjs/bs58).

The SDK does **not** implement custom cryptography. If you find a flaw
in one of the above dependencies, please report it upstream first.
