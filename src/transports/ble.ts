/**
 * BLE transport — writes the signed payload to a peer's GATT characteristic.
 *
 * Status: scaffolded. The on-the-wire shape is finalized (142-byte chunk →
 * fragmented if MTU < 142) but the actual GATT service UUID + characteristic
 * UUID are still being defined alongside the receiver-side reference robot
 * firmware. Track progress at:
 *
 *   https://github.com/OpaquePrivacy/OpaquePrivacy/issues
 *
 * For now the transport encodes the payload into chunks and returns them.
 * Callers can hand the chunks off to web-bluetooth / noble / a native bridge
 * for the actual GATT write.
 */

import type { DeliveryReceipt, PayResult, Transport } from "../types.js";

export interface BleEncoded {
  /** Raw payload chunks split for the chosen MTU (default 20 bytes). */
  chunks: Uint8Array[];
  /** Total payload size in bytes (142 for v2). */
  totalBytes: number;
  /** Recommended MTU used to split. */
  mtu: number;
}

export class BleTransport implements Transport {
  readonly name = "ble";

  /**
   * @param mtu  GATT MTU minus 3 bytes for ATT header. 20 is the default
   *             for legacy 23-byte MTUs; modern stacks negotiate 247 and
   *             can send the full payload in one write.
   */
  constructor(private readonly mtu: number = 20) {}

  encode(payload: PayResult): BleEncoded {
    const raw = payload.raw;
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < raw.length; i += this.mtu) {
      chunks.push(raw.subarray(i, Math.min(i + this.mtu, raw.length)));
    }
    return { chunks, totalBytes: raw.length, mtu: this.mtu };
  }

  /**
   * Stub — wire to your BLE stack (Web Bluetooth, noble, RN-BLE, etc.)
   * Returns "ble_encoded" to signal the caller still needs to do the write.
   */
  async deliver(payload: PayResult): Promise<DeliveryReceipt> {
    const encoded = this.encode(payload);
    return {
      ok: true,
      status: "ble_encoded",
      reference: `${encoded.chunks.length}_chunks`,
    };
  }
}
