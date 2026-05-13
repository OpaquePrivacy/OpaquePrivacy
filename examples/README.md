# Examples

| File | Scenario | Transport |
|---|---|---|
| [`01-robot-charger.ts`](01-robot-charger.ts) | Delivery robot pays a charging station from cellular SMS | SMS |
| [`02-ai-agent-api-pay.ts`](02-ai-agent-api-pay.ts) | AI agent pays for its own API call (x402 challenge) | HTTP |
| [`03-ble-tap-to-pay.ts`](03-ble-tap-to-pay.ts) | Two robots transfer payment over BLE in a faraday-shielded depot | BLE |

Run any example with:

```bash
npm install @opaqueprivacy/agent-sdk
npx tsx examples/01-robot-charger.ts
```
