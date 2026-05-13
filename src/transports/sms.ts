/**
 * SMS transport — encodes the signed payload as a ready-to-send SMS body.
 *
 * This transport does NOT itself send the SMS. It returns the exact text
 * the agent's modem (or a connected phone) should transmit. Use this when:
 *
 *   • The agent has no internet (offline robot, field IoT sensor)
 *   • The agent has cellular but no data plan
 *   • The agent runs on a feature phone via a serial/AT-command modem
 *
 * The returned body is the same Base64 string the dashboard sends. Drop it
 * straight into your AT+CMGS, Twilio sendMessage, etc.
 */

import type { DeliveryReceipt, PayResult, Transport } from "../types.js";

export interface SmsEncoded {
  /** The full SMS body — copy/paste into a messaging app or modem. */
  body: string;
  /** Destination phone number for the SMS (the Opaque gateway). */
  to: string;
  /** Convenience deep-link for iOS/Android: sms:<to>?body=... */
  smsUri: string;
  /** Optional QR-code image URL that encodes the SMS deep link. */
  qrUrl: (size?: number) => string;
}

export class SmsTransport implements Transport {
  readonly name = "sms";

  constructor(private readonly gatewayPhoneNumber: string) {}

  /**
   * Returns a structured object the caller can hand off to whatever
   * actually sends the SMS — Twilio API, AT command, Android SMS Manager,
   * print on a paper receipt, etc.
   */
  encode(payload: PayResult): SmsEncoded {
    const body = payload.body;
    const to = this.gatewayPhoneNumber;
    const smsUri = `sms:${to}?body=${encodeURIComponent(body)}`;
    return {
      body,
      to,
      smsUri,
      qrUrl: (size = 320) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(smsUri)}`,
    };
  }

  /**
   * The Transport interface requires deliver(). For SMS this just returns
   * the encoded body — sending is the caller's responsibility (they have
   * the modem / Twilio account, not the SDK).
   */
  async deliver(payload: PayResult): Promise<DeliveryReceipt> {
    const encoded = this.encode(payload);
    return {
      ok: true,
      reference: encoded.smsUri,
      status: "sms_encoded",
    };
  }
}
