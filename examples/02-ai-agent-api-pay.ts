/**
 * Example 2: AI agent pays for its own API calls.
 *
 * Scenario: a long-running AI agent (LangGraph, autogen, your own) needs
 * to call a paid web service. The service exposes an x402-style invoice:
 * pay $0.02 in USDC to @api-vendor and you'll get a 200 with the data.
 *
 * The agent has internet (it's calling APIs after all), so we use the
 * HTTP transport — fastest settlement.
 */

import { OpaqueAgent, KeypairSigner } from "@opaqueprivacy/agent-sdk";

const { signer } = KeypairSigner.generate();
const agent = new OpaqueAgent({ signer });

async function callPaidApi(endpoint: string): Promise<unknown> {
  let resp = await fetch(endpoint);
  if (resp.status !== 402) return resp.json();

  // Parse the standard x402 challenge.
  const challenge = await resp.json() as { recipient: string; amount: number; token: "USDC" | "USDT" };

  // Pay it.
  const receipt = await agent.pay({
    to: challenge.recipient,
    amount: challenge.amount,
    token: challenge.token,
    privacy: "full",
  });
  if (!receipt.ok) throw new Error(`payment failed: ${receipt.error}`);

  // Retry with the receipt header.
  resp = await fetch(endpoint, {
    headers: { "X-PAYMENT": receipt.reference ?? "" },
  });
  return resp.json();
}

const data = await callPaidApi("https://example.com/api/expensive-llm-eval");
console.log("[agent] got data:", data);
