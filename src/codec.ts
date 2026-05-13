/**
 * 142-byte OpaquePayload codec — the canonical wire format for Opaque
 * Privacy payments. Same layout used by the dashboard, the SMS gateway,
 * and this SDK.
 *
 * Byte layout (offsets are inclusive of `from`, exclusive of `to`):
 *
 *   [0]        version            (1)
 *   [1]        type-nibble        (1)   high nibble: 0x10 if username, else 0; low nibble: reserved
 *   [2-4]      sequence           (2)   u16 big-endian — replay nonce
 *   [4-36]     recipient          (32)  Solana pubkey, or zero-padded 8-byte SHA-256 username prefix
 *   [36-44]    amount             (8)   u64 little-endian, in atomic units (e.g. 1_000_000 = 1 USDC)
 *   [44]       token              (1)   0x01 SOL · 0x02 USDC · 0x03 USDT · 0x04 OPAQUE
 *   [45]       privacy            (1)   0x00 Public · 0x01 Partial · 0x02 Full
 *   [46-78]    commitment         (32)  ZK commitment (zeros for non-shielded paths)
 *   [78-142]   signature          (64)  Ed25519 over the SIGNING REGION wrapper
 *
 * The signing region is bytes [0..78] — everything except the signature
 * itself. That's what the wallet signs (wrapped in a human-readable envelope
 * to keep Phantom/Solflare happy). Embedding the signature into bytes
 * [78..142] never invalidates the wrapper because the wrapper commits to
 * the bytes BEFORE the signature, not after.
 */

const PAYLOAD_LEN = 142;
const SIGNED_LEN = 78;

export const PROTOCOL_VERSION = 0x02;

export const Token = {
  SOL: 0x01,
  USDC: 0x02,
  USDT: 0x03,
  OPAQUE: 0x04,
} as const;
export type TokenId = (typeof Token)[keyof typeof Token];

export const PrivacyLevel = {
  Public: 0x00,
  Partial: 0x01,
  Full: 0x02,
} as const;
export type PrivacyLevelId = (typeof PrivacyLevel)[keyof typeof PrivacyLevel];

export interface EncodeInput {
  version?: number;
  /** Optional sub-type — reserved, currently 0. */
  type?: number;
  /** Set when recipient is the SHA-256 prefix of a username, not a pubkey. */
  isUsername?: boolean;
  sequence: number;
  recipient: Uint8Array;
  amount: bigint;
  token: TokenId;
  privacyLevel: PrivacyLevelId;
  commitment: Uint8Array;
  signature: Uint8Array;
}

export function encodePayload(input: EncodeInput): Uint8Array {
  if (input.recipient.length !== 32) throw new Error("recipient must be 32 bytes");
  if (input.commitment.length !== 32) throw new Error("commitment must be 32 bytes");
  if (input.signature.length !== 64) throw new Error("signature must be 64 bytes");
  if (input.sequence < 0 || input.sequence > 0xffff) throw new Error("sequence out of u16 range");
  if (input.amount < 0n || input.amount > 0xffffffffffffffffn) throw new Error("amount out of u64 range");

  const out = new Uint8Array(PAYLOAD_LEN);
  const view = new DataView(out.buffer);

  out[0] = input.version ?? PROTOCOL_VERSION;
  const lowNibble = (input.type ?? 0) & 0x0f;
  const highNibble = input.isUsername ? 0x10 : 0x00;
  out[1] = highNibble | lowNibble;
  view.setUint16(2, input.sequence, false); // big-endian
  out.set(input.recipient, 4);
  view.setBigUint64(36, input.amount, true); // little-endian
  out[44] = input.token;
  out[45] = input.privacyLevel;
  out.set(input.commitment, 46);
  out.set(input.signature, 78);
  return out;
}

export function buildSigningRegion(input: Omit<EncodeInput, "signature">): Uint8Array {
  const placeholder = new Uint8Array(64);
  return encodePayload({ ...input, signature: placeholder }).slice(0, SIGNED_LEN);
}

export function bytesToBase64(bytes: Uint8Array): string {
  // Node and browsers both have native Base64 — feature-detect.
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // eslint-disable-next-line no-undef
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  // eslint-disable-next-line no-undef
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** SHA-256 prefix used by username-keyed payloads. Returns first 8 bytes. */
export async function usernameHash(username: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(username.toLowerCase().trim());
  const digest = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(digest).slice(0, 8);
}

/** Pads an 8-byte username hash to 32 bytes (zero-padded right) for the recipient field. */
export function paddedUsernameRecipient(hash8: Uint8Array): Uint8Array {
  if (hash8.length !== 8) throw new Error("username hash must be 8 bytes");
  const out = new Uint8Array(32);
  out.set(hash8, 0);
  return out;
}

/**
 * Build the canonical wrapper text that the wallet's signMessage sees. The
 * wrapper binds the SIGNING REGION (Base64) and the replay sequence. Server
 * rebuilds the same string byte-for-byte and verifies the Ed25519 signature.
 */
export function buildSignedMessage(signingRegionBase64: string, sequence: number): string {
  return [
    "Opaque Privacy Payment",
    `Sequence: ${sequence}`,
    `Payload: ${signingRegionBase64}`,
  ].join("\n");
}
