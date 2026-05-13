/**
 * @opaqueprivacy/agent-sdk — Public surface.
 *
 *   import { OpaqueAgent, KeypairSigner } from "@opaqueprivacy/agent-sdk";
 *
 *   const { signer } = KeypairSigner.generate();
 *   const agent = new OpaqueAgent({ signer });
 *   await agent.pay({ to: "@charging-station-7", amount: 0.05, token: "USDC" });
 */

export { OpaqueAgent } from "./agent.js";
export { KeypairSigner, InMemorySequenceStore } from "./signer.js";
export {
  encodePayload,
  buildSigningRegion,
  buildSignedMessage,
  bytesToBase64,
  base64ToBytes,
  usernameHash,
  paddedUsernameRecipient,
  PROTOCOL_VERSION,
  Token,
  PrivacyLevel,
  type TokenId,
  type PrivacyLevelId,
  type EncodeInput,
} from "./codec.js";
export { resolveRecipient, type ResolvedRecipient } from "./recipients.js";

// Re-export transports under one barrel for convenience.
export { HttpTransport, SmsTransport, BleTransport } from "./transports/index.js";
export type { SmsEncoded, BleEncoded } from "./transports/index.js";

// Public types
export type {
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
