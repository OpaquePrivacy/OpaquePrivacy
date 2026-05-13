/**
 * Example 1: Delivery robot pays a charging station privately.
 *
 * Scenario: an autonomous delivery robot pulls into a charging station.
 * The station has a registered Opaque handle (@charging-station-7). The
 * robot needs to pay $0.05/min for power. It has a phone-bound wallet
 * but no internet at the depot — only cellular for emergency telemetry.
 *
 * Solution: build a signed payment payload, hand it to the robot's modem
 * as an SMS body, settle privately on Solana within ~10s.
 */

import { OpaqueAgent, KeypairSigner, SmsTransport } from "@opaqueprivacy/agent-sdk";

// In production the robot's secret key lives in its secure element,
// loaded by your firmware at boot. For this example we generate fresh.
const { signer } = KeypairSigner.generate();

const robot = new OpaqueAgent({
  signer,
  // Phone number the robot's modem will broadcast from.
  phoneNumber: "+14155551234",
});

const sms = new SmsTransport("+18556200610"); // Opaque public gateway

async function payCharger(minutes: number) {
  const dollars = minutes * 0.05;

  // Build the signed payload — does NOT hit the network yet.
  const payload = await robot.prepare({
    to: "@charging-station-7",
    amount: dollars,
    token: "USDC",
    privacy: "full", // amount hidden from the public chain
    memo: `${minutes}m power`,
  });

  // Encode as an SMS body. Hand the returned `body` + `to` to the modem.
  const encoded = sms.encode(payload);

  console.log(`[robot] modem: send "${encoded.body}" to ${encoded.to}`);

  // Hypothetical modem driver — replace with your AT+CMGS / Twilio call.
  // await modem.send(encoded.to, encoded.body);
}

await payCharger(15);
