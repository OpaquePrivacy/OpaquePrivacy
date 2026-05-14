# Opaque Privacy — Agent SDK

**Private payments for AI agents and autonomous machines. Pay over SMS, BLE, or HTTP — no wallet UI required.**

[![npm](https://img.shields.io/npm/v/@opaqueprivacy/agent-sdk.svg)](https://www.npmjs.com/package/@opaqueprivacy/agent-sdk)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-mainnet-9945FF.svg)](https://solana.com)

---

## Why this exists

The next billion economic actors aren't humans. They're delivery robots
paying for parking. AI agents paying for API calls. Field sensors paying
for satellite uplink. Drones paying for landing fees. None of them have
a wallet UI. Most of them don't have reliable internet.

**Existing payment SDKs assume a human at the keyboard.** Stripe needs a
browser. Wallet adapters need a popup. Even crypto SDKs assume a human
unlocks a wallet to sign each transaction.

**Opaque Privacy was built for the offline case from day one.** Our SMS
rail signs a 142-byte payload locally and ships it over the only network
that works everywhere on earth. The same payload travels just as cleanly
over BLE, satellite, mesh, or a plain HTTP POST.

This SDK packages that primitive for autonomous agents.

```ts
import { OpaqueAgent, KeypairSigner } from "@opaqueprivacy/agent-sdk";

const { signer } = KeypairSigner.generate();
const agent = new OpaqueAgent({ signer });

await agent.pay({
  to: "@charging-station-7",
  amount: 0.05,
  token: "USDC",
  privacy: "full",
});
```

That's the whole API. Three lines for a private dollar payment from a
robot to a service. Settles on Solana in under 10 seconds.

---

## Quick start

```bash
npm install @opaqueprivacy/agent-sdk
```

### Pay over HTTP (agent has internet)

```ts
import { OpaqueAgent, KeypairSigner } from "@opaqueprivacy/agent-sdk";

const signer = KeypairSigner.fromBase58(process.env.AGENT_SECRET_KEY!);
const agent = new OpaqueAgent({ signer });

const receipt = await agent.pay({
  to: "@api-vendor",
  amount: 0.02,
  token: "USDC",
});
console.log(receipt.ok ? "paid" : receipt.error);
```

### Pay over SMS (agent has cellular, no data)

```ts
import { OpaqueAgent, KeypairSigner, SmsTransport } from "@opaqueprivacy/agent-sdk";

const signer = KeypairSigner.fromBase58(process.env.ROBOT_SECRET_KEY!);
const robot = new OpaqueAgent({
  signer,
  phoneNumber: "+14155551234",
});

const sms = new SmsTransport("+18556200610"); // Opaque public gateway

const payload = await robot.prepare({
  to: "@charging-station-7",
  amount: 0.50,
  token: "USDC",
});

const encoded = sms.encode(payload);

// Hand to your modem driver:
await modem.send(encoded.to, encoded.body);
```

### Pay over BLE (agent has neither)

```ts
import { OpaqueAgent, KeypairSigner, BleTransport } from "@opaqueprivacy/agent-sdk";

const signer = KeypairSigner.fromBase58(process.env.COURIER_KEY!);
const courier = new OpaqueAgent({ signer });
const ble = new BleTransport(/* MTU */ 20);

const payload = await courier.prepare({ to: "@sorter-2", amount: 0.10, token: "USDC" });
const { chunks } = ble.encode(payload);

// Hand the chunks to your BLE GATT writer.
```

See [`examples/`](examples/) for runnable scenarios.

---

## What you get

| | |
|---|---|
| **Privacy by default** | Amounts and counterparties hidden inside a ZK proof. The public chain sees a commitment, not a transfer. |
| **Truly offline-capable** | Sign on-device with a keypair the agent owns. Hand the payload to any transport that can move 142 bytes. |
| **Stable handles** | Pay `@username` instead of base58 pubkeys. The gateway resolves at settlement time, so agents can pay services that haven't been provisioned yet. |
| **Sub-15-second settlement** | Solana finality, Jupiter routing. Faster than card networks. |
| **Universal recipient** | Anything with an Opaque profile or a Solana address. No off-chain ledger to reconcile. |
| **One signature, any transport** | A signed payload is bytes. Carry it over SMS, BLE, HTTP, NFC, sneakernet — the gateway accepts it the same way. |

---

## How it works

The SDK builds a **142-byte OpaquePayload** containing the recipient,
amount, token, privacy level, and a 64-byte Ed25519 signature over the
first 78 bytes. The signing scheme is wallet-friendly — it wraps the
binary signing region in a human-readable envelope so Phantom, Solflare,
and any other Solana wallet will sign it without complaining about
"transactions that look weird."

```
┌─[0]──┬─[1]─────────┬─[2-4]────┬─[4-36]─────┬─[36-44]┬─[44]──┬─[45]────┬─[46-78]─────┬─[78-142]─┐
│ ver  │ type+isUser │ sequence │ recipient  │ amount │ token │ privacy │ commitment  │ Ed25519  │
│  1B  │     1B      │    2B    │    32B     │   8B   │  1B   │   1B    │     32B     │   64B    │
└──────┴─────────────┴──────────┴────────────┴────────┴───────┴─────────┴─────────────┴──────────┘
                                                                                ↑
                                                                 signs bytes [0..78]
```

The gateway:

1. Receives the payload (via any transport — webhook, SMS provider, BLE relay).
2. Verifies the Ed25519 signature against the sender's known signing pubkey.
3. Resolves the recipient (`@username` → wallet via Supabase + SNS fallback).
4. Settles on Solana through our [NolviPay program](https://solscan.io/account/4VBEvYSEFBr7B3b6ahgUdMnR9hPZLnZJy6rHVM8kcMsn) using a custodial relayer.
5. Replies with a settlement signature.

The sender's private key never leaves the device. The gateway never sees
plaintext amounts when `privacy: "full"` is set — only the commitment.

---

## Concepts

### Signers

A `Signer` is anything that can produce an Ed25519 signature over a byte
buffer. Built-in options:

- **`KeypairSigner`** — direct device keypair. Use this when the agent
  owns its key (most cases).
- **Custom `Signer`** — implement the interface to delegate to AWS KMS,
  a YubiKey, a Phantom-style external wallet, an enclave, etc.

### Transports

A `Transport` delivers the signed payload to a settlement gateway. The
SDK ships three:

| Transport | When to use | Settlement latency |
|---|---|---|
| **HTTP** | Agent has data | 5–15 seconds |
| **SMS** | Agent has cellular but no data, or is on a feature phone | 10–60 seconds |
| **BLE** | Agent has neither, but is near a peer or relay | Whenever the relay gets internet |

Transports are pluggable. Write your own for satellite uplink, LoRaWAN,
Bluetooth Mesh, or a printer that emits QR codes for humans to scan.

### Recipients

Pass anything to `pay({ to: ... })`:

- `"@alice"` — Opaque or Telegram handle (resolved via SHA-256 prefix)
- `"alice"` — bare handle, the `@` is optional
- `"GdR1...kQpz"` — base58 Solana pubkey

The SDK auto-detects. Username-keyed payments set bit 5 of the type
nibble so the gateway knows to resolve them at settlement time.

### Privacy levels

```ts
agent.pay({ ..., privacy: "public" });   // amount + recipient visible on chain
agent.pay({ ..., privacy: "partial" });  // recipient hidden, amount visible
agent.pay({ ..., privacy: "full" });     // both hidden inside a ZK commitment (default)
```

---

## Use cases

- **Robot payments** — autonomous EV chargers, drone landing fees,
  delivery robot tolls, agricultural sensors paying for water rights.
- **AI agent settlement** — agents paying for their own API calls,
  compute time, data feeds. No human in the loop.
- **Machine-to-machine** — two devices in the same supply chain settling
  internal accounts (sorter pays scanner, scanner pays conveyor, …).
- **Offline humans** — yes, this works for people too. Pay by text from
  a $20 flip phone in any country.

---

## Status

| | |
|---|---|
| Version | **0.1.0** (early access) |
| Network | Solana mainnet-beta |
| Audits | None yet — see [security notes](#security) |
| Tested transports | HTTP ✅ · SMS ✅ · BLE 🟡 (encoder works, GATT UUIDs being finalized) |

We're shipping in public. Breaking changes are possible before 1.0.

---

## Security

- Private keys never leave the device. The SDK signs locally.
- The gateway verifies the Ed25519 signature against the registered
  signing pubkey on every payload — replay protection comes from the
  monotonic `sequence` field plus the gateway's idempotency key check.
- Token amounts above `0xffffffffffffffff` atomic units are rejected at
  encode time.
- Use a persistent `SequenceStore` if your agent restarts — otherwise
  the in-memory counter resets and replays become possible.

This SDK has not been audited. For high-value or production-critical
agents, please wait for the 1.0 audit.

---

## Roadmap

- [ ] BLE GATT service UUIDs + reference receiver firmware
- [ ] Native React Native + Capacitor adapters
- [ ] Webhook receipts (DM the agent's owner when a payment lands)
- [ ] Subscription / streaming payments
- [ ] Hardware-wallet signers (Ledger Solana app, Trezor)
- [ ] AWS Nitro Enclave signer for cloud-resident agents

---

## License

[MIT](LICENSE)

---

Built by [Opaque Privacy](https://opaqueprivacy.app). For questions,
issues, or production access: [support@opaqueprivacy.app](mailto:support@opaqueprivacy.app).
