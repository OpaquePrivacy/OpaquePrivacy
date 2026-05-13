/**
 * Example 3: Two robots tap-to-pay over BLE.
 *
 * Scenario: a courier robot needs to transfer payment to a sorting-station
 * robot at a depot. No cellular, no Wi-Fi (faraday cage). Both devices
 * speak Bluetooth Low Energy.
 *
 * The courier prepares a signed payload, splits it into MTU-sized chunks,
 * and writes them to a GATT characteristic on the sorter. The sorter
 * caches the bytes until it has internet again, then replays them to the
 * Opaque gateway.
 *
 * NOTE: the actual BLE write is your bridge's job. The SDK gives you the
 * chunks and the framing.
 */

import { OpaqueAgent, KeypairSigner, BleTransport } from "@opaqueprivacy/agent-sdk";

const { signer } = KeypairSigner.generate();
const courier = new OpaqueAgent({ signer });

const ble = new BleTransport(/* mtu */ 20);

const payload = await courier.prepare({
  to: "@sorter-station-2",
  amount: 0.10,
  token: "USDC",
  privacy: "full",
});

const encoded = ble.encode(payload);
console.log(`[courier] payload: ${encoded.totalBytes} bytes, ${encoded.chunks.length} chunks @ MTU ${encoded.mtu}`);

// Hand each chunk to your BLE library:
// for (const chunk of encoded.chunks) await bleChar.writeValue(chunk);
