/**
 * Public types for @opaqueprivacy/agent-sdk.
 *
 * Kept deliberately small — most of the work happens in the codec and the
 * Agent class. These types are what consumer code touches.
 */

export type TokenSymbol = "SOL" | "USDC" | "USDT" | "OPAQUE";

export type Privacy = "public" | "partial" | "full";

export interface PayInput {
  /**
   * Either an `@username` (Opaque or Telegram handle) or a base58 Solana
   * public key. The SDK auto-detects.
   */
  to: string;
  /** Amount in human-readable units (e.g. 5 = 5 USDC). */
  amount: number;
  token: TokenSymbol;
  /** Optional, defaults to "full" (recipient + amount hidden). */
  privacy?: Privacy;
  /** Optional, useful when paying for a specific invoice or service. */
  memo?: string;
}

export interface PayResult {
  /**
   * The 142-byte payload the agent's wallet signed, base64-encoded. This is
   * what travels over the wire — SMS body, BLE GATT write, HTTP body, etc.
   */
  body: string;
  /** Raw bytes (use this if you need to embed in a binary transport). */
  raw: Uint8Array;
  /** The same Ed25519 signature embedded in the body, separately exposed. */
  signature: string;
  /** The exact text the wallet signed (the wrapper envelope). */
  signedMessage: string;
  /** Sender sequence consumed by this payment. */
  sequence: number;
  /** Server-side idempotency key. */
  messageId: string;
}

/**
 * Anything that can sign with the agent's wallet. Use `KeypairSigner` for
 * direct device keys, or implement this interface to delegate to a remote
 * KMS / Phantom / hardware wallet.
 */
export interface Signer {
  /** Returns the agent's public key in base58. */
  publicKey: string;
  /** Signs an arbitrary byte buffer with the underlying private key. */
  sign(message: Uint8Array): Promise<Uint8Array>;
}

/**
 * A transport adapter delivers the signed payload to a settlement gateway.
 * Built-in transports: HTTP, SMS (offline-encoded), BLE.
 */
export interface Transport {
  name: string;
  deliver(payload: PayResult, sender: string): Promise<DeliveryReceipt>;
}

export interface DeliveryReceipt {
  ok: boolean;
  /** Transport-specific reference: tx signature for HTTP, message ID for SMS. */
  reference?: string;
  /** Transport-specific status text. */
  status?: string;
  error?: string;
}

export interface AgentConfig {
  /** Signer that backs the agent's wallet. */
  signer: Signer;
  /** Phone number the agent broadcasts from (for SMS) — E.164 format. */
  phoneNumber?: string;
  /**
   * Override the gateway URL for the HTTP transport. Defaults to the public
   * Opaque Privacy production gateway at https://opaqueprivacy.app.
   */
  gatewayUrl?: string;
  /**
   * Persistence hook for the sender-side sequence counter. Defaults to an
   * in-memory counter — fine for short-lived agents, but you should supply
   * persistent storage for any agent that survives a restart.
   */
  sequenceStore?: SequenceStore;
}

export interface SequenceStore {
  next(): Promise<number>;
}
