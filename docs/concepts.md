# Concepts

A deeper dive into the primitives the SDK exposes. Read this if you want
to write a custom transport, implement your own signer, or extend the
codec.

## The 142-byte payload

The wire format is fixed at 142 bytes. Layout:

| Offset | Bytes | Field | Notes |
|---|---|---|---|
| 0 | 1 | `version` | Always `0x02` today |
| 1 | 1 | `type-nibble` | High nibble bit 0x10 = recipient is a username hash; low nibble reserved |
| 2 | 2 | `sequence` | u16 big-endian — replay nonce, monotonic per sender |
| 4 | 32 | `recipient` | Solana pubkey OR 8-byte username SHA-256 prefix zero-padded |
| 36 | 8 | `amount` | u64 little-endian, atomic units (`1_000_000` = 1 USDC) |
| 44 | 1 | `token` | `0x01` SOL · `0x02` USDC · `0x03` USDT · `0x04` OPAQUE |
| 45 | 1 | `privacy` | `0x00` Public · `0x01` Partial · `0x02` Full |
| 46 | 32 | `commitment` | ZK commitment when shielded; zeros otherwise |
| 78 | 64 | `signature` | Ed25519 over the wrapper text (see below) |

## The wrapper text

Wallets refuse to sign raw byte arrays that look like Solana transactions.
The SDK wraps the **signing region** (bytes [0..78]) in human-readable
text before asking the signer for a signature:

```
Opaque Privacy Payment
Sequence: 42
Payload: <base64 of bytes [0..78]>
```

The signature is then embedded back into bytes [78..142]. The gateway
re-renders the same wrapper text and verifies against the registered
signing pubkey — the embedded signature doesn't invalidate the wrapper
because the wrapper covers the bytes _before_ the signature, not the
bytes _after_.

## Signers

Anything implementing this interface:

```ts
interface Signer {
  publicKey: string;
  sign(message: Uint8Array): Promise<Uint8Array>;
}
```

Built-in: `KeypairSigner`. Bring your own for KMS, enclave, hardware.

## Sequence replay protection

Each payment consumes a sequence number. The gateway tracks the highest
sequence it has seen for each signing pubkey and rejects anything that
is not strictly higher. **Persist the counter** if your agent restarts —
otherwise a fresh agent process will reset to 1 and the gateway will
reject every payment until you exceed the previous high water mark.

```ts
class FileSequenceStore implements SequenceStore {
  constructor(private path: string) {}
  async next(): Promise<number> {
    const current = await fs.readFile(this.path, "utf8").then(Number).catch(() => 0);
    const n = current + 1;
    await fs.writeFile(this.path, String(n));
    return n;
  }
}
```

## Recipient resolution

The codec stores either a 32-byte Solana pubkey OR a username SHA-256
prefix. The choice is signaled by the `isUsername` bit in the type
nibble:

- **Pubkey recipient**: `isUsername = 0`, bytes [4..36] = `pubkey.toBytes()`
- **Username recipient**: `isUsername = 1`, bytes [4..12] = `sha256(username.lower())[0..8]`, bytes [12..36] = zeros

The gateway resolves usernames at settlement time against:

1. The local Opaque `user_profiles` table
2. (planned) SNS `.sol` domains
3. (planned) ENS names

## Privacy levels

| Level | Amount on-chain | Recipient on-chain |
|---|---|---|
| Public | Visible | Visible |
| Partial | Visible | Hidden (via commitment) |
| Full | Hidden | Hidden |

For `full`, the SDK zeros out the amount field in the encoded payload
and binds the real amount inside the commitment. The gateway proves the
amount is in the valid range without revealing it.
