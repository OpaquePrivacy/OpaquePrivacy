/**
 * OpaqueAgent — the SDK entry point.
 *
 * One instance per agent identity. Holds the signer, the gateway URL, and
 * the replay sequence. Knows how to:
 *
 *   - Build and sign a 142-byte OpaquePayload (`prepare`)
 *   - Deliver that payload via any `Transport` (`pay`)
 *
 * Most users will call `agent.pay(...)` and let the SDK do the rest.
 */

import {
  encodePayload,
  buildSigningRegion,
  bytesToBase64,
  buildSignedMessage,
  PrivacyLevel,
  Token,
  type PrivacyLevelId,
  type TokenId,
} from "./codec.js";
import { resolveRecipient } from "./recipients.js";
import { InMemorySequenceStore } from "./signer.js";
import { HttpTransport } from "./transports/http.js";
import type {
  AgentConfig,
  DeliveryReceipt,
  PayInput,
  PayResult,
  Privacy,
  SequenceStore,
  Signer,
  TokenSymbol,
  Transport,
} from "./types.js";

const TOKEN_DECIMALS: Record<TokenSymbol, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  OPAQUE: 6,
};

const TOKEN_ID: Record<TokenSymbol, TokenId> = {
  SOL: Token.SOL,
  USDC: Token.USDC,
  USDT: Token.USDT,
  OPAQUE: Token.OPAQUE,
};

const PRIVACY_ID: Record<Privacy, PrivacyLevelId> = {
  public: PrivacyLevel.Public,
  partial: PrivacyLevel.Partial,
  full: PrivacyLevel.Full,
};

const DEFAULT_GATEWAY = "https://opaqueprivacy.app";

export class OpaqueAgent {
  readonly signer: Signer;
  readonly gatewayUrl: string;
  readonly phoneNumber?: string;
  private readonly sequenceStore: SequenceStore;

  constructor(config: AgentConfig) {
    this.signer = config.signer;
    this.gatewayUrl = config.gatewayUrl ?? DEFAULT_GATEWAY;
    this.phoneNumber = config.phoneNumber;
    this.sequenceStore = config.sequenceStore ?? new InMemorySequenceStore();
  }

  /** The agent's Solana public key (base58). */
  get publicKey(): string {
    return this.signer.publicKey;
  }

  /**
   * Build and sign a payment payload without delivering it. Useful when you
   * want to broadcast over a transport the SDK doesn't ship yet (e.g. a
   * mesh network, a satellite uplink, or printing a QR for someone else to
   * scan into a paying device).
   */
  async prepare(input: PayInput): Promise<PayResult> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("amount must be a positive finite number");
    }
    const decimals = TOKEN_DECIMALS[input.token];
    const atomic = BigInt(Math.round(input.amount * 10 ** decimals));
    const tokenId = TOKEN_ID[input.token];
    const privacyId = PRIVACY_ID[input.privacy ?? "full"];

    const { recipient, isUsername } = await resolveRecipient(input.to);
    const sequence = await this.sequenceStore.next();
    const messageId = randomMessageId();
    const commitment = new Uint8Array(32); // zero — non-shielded for v1

    // Step 1: build the signing region (bytes [0..78]).
    const signingRegion = buildSigningRegion({
      sequence,
      recipient,
      amount: privacyId === PrivacyLevel.Full ? 0n : atomic,
      token: tokenId,
      privacyLevel: privacyId,
      commitment,
      isUsername,
    });
    const signingRegionB64 = bytesToBase64(signingRegion);

    // Step 2: wrap in a human-readable envelope + sign.
    const signedMessage = buildSignedMessage(signingRegionB64, sequence);
    const sigBytes = await this.signer.sign(new TextEncoder().encode(signedMessage));
    if (sigBytes.length !== 64) {
      throw new Error(`signer returned ${sigBytes.length}-byte signature; expected 64`);
    }

    // Step 3: pack the final 142-byte payload with the signature embedded.
    const raw = encodePayload({
      sequence,
      recipient,
      amount: privacyId === PrivacyLevel.Full ? 0n : atomic,
      token: tokenId,
      privacyLevel: privacyId,
      commitment,
      isUsername,
      signature: sigBytes,
    });

    return {
      body: bytesToBase64(raw),
      raw,
      signature: bytesToBase64(sigBytes),
      signedMessage,
      sequence,
      messageId,
    };
  }

  /**
   * Build, sign, and deliver a payment in one call. Defaults to the HTTP
   * transport that posts to opaqueprivacy.app's settlement gateway.
   */
  async pay(input: PayInput, transport?: Transport): Promise<DeliveryReceipt> {
    const payload = await this.prepare(input);
    const t = transport ?? new HttpTransport(this.gatewayUrl);
    return t.deliver(payload, this.phoneNumber ?? this.signer.publicKey);
  }
}

function randomMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `agent-${crypto.randomUUID()}`;
  }
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
