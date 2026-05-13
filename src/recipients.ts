/**
 * Recipient resolution.
 *
 * An `@username` is hashed to 8 bytes via SHA-256, zero-padded to 32 bytes,
 * and the type-nibble has its `isUsername` bit set. The gateway resolves the
 * hash back to a wallet at settlement time.
 *
 * A base58 Solana public key is decoded directly into the 32-byte recipient
 * field with `isUsername` = false.
 */

import { PublicKey } from "@solana/web3.js";
import { usernameHash, paddedUsernameRecipient } from "./codec.js";

export interface ResolvedRecipient {
  recipient: Uint8Array; // 32 bytes
  isUsername: boolean;
}

const BASE58_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function resolveRecipient(input: string): Promise<ResolvedRecipient> {
  const trimmed = input.trim();
  const looksLikeHandle = trimmed.startsWith("@") || !BASE58_PUBKEY_RE.test(trimmed);

  if (looksLikeHandle) {
    const name = trimmed.replace(/^@/, "");
    if (name.length < 3) throw new Error("username must be at least 3 chars");
    const h = await usernameHash(name);
    return { recipient: paddedUsernameRecipient(h), isUsername: true };
  }

  const pk = new PublicKey(trimmed);
  return { recipient: pk.toBytes(), isUsername: false };
}
