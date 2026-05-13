/**
 * HTTP transport — POSTs the signed payload to opaqueprivacy.app's SMS
 * submit endpoint. This is the fastest settlement path when the agent has
 * internet access. Same endpoint Phantom-side dashboard payments use.
 */

import type { DeliveryReceipt, PayResult, Transport } from "../types.js";

export class HttpTransport implements Transport {
  readonly name = "http";

  constructor(
    private readonly gatewayUrl: string,
    private readonly path: string = "/api/sms/submit",
    private readonly timeoutMs: number = 30_000,
  ) {}

  async deliver(payload: PayResult, sender: string): Promise<DeliveryReceipt> {
    const url = `${this.gatewayUrl.replace(/\/$/, "")}${this.path}`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: sender,
          body_b64: payload.body,
          message_id: payload.messageId,
          wallet_signature: payload.signature,
          signed_message: payload.signedMessage,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const text = await resp.text().catch(() => "");
      let parsed: { signature?: string; error?: string; message?: string } = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        /* non-JSON body */
      }

      if (!resp.ok) {
        return {
          ok: false,
          status: String(resp.status),
          error: parsed.error ?? parsed.message ?? text,
        };
      }
      return {
        ok: true,
        reference: parsed.signature,
        status: String(resp.status),
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
