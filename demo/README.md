# Cross-network preflight demo (Guardian × cloudpayX)

**Hackathon story (≈60s):** An agent must pay a vendor that accepts **USDC on Base** *or* **RLUSD on XRPL**. Before signing anything, it asks **Guardian** about the Base leg and **cloudpayX** about the XRPL leg, then has Guardian seal one **Decision Receipt** covering both. Two networks, two specialists, one receipt.

Patterns, not verdicts — neither specialist says “safe” or “approved.”

## Run

```bash
# unpaid-demo (default) — no wallet required; exits 0 with stub artifacts
node demo/cross-network-preflight.mjs --config demo/config.example.json

# optional: bypass Guardian 402 with a demo key (never commit the key)
GUARDIAN_DEMO_KEY=… node demo/cross-network-preflight.mjs --config demo/config.example.json

# optional: real Base x402 via awal (needs wallet)
AWAL=1 node demo/cross-network-preflight.mjs --config demo/config.example.json
```

Outputs:

- `demo/out/receipt.json` — raw combined artifact + receipt response
- `demo/out/receipt.md` — human table per leg + verify URL

## What each step means

1. **Discover peers** — Guardian free `/api/hint?q=xrpl` + cloudpayX agent card.
2. **Base leg** — Guardian `/api/gate` (counterparty grade on Base `payTo`).
3. **XRPL leg** — cloudpayX paid REST `POST /agent/v3/stablecoin-route` (x402 in XRP/RLUSD).  
   Note: A2A `message/send` is free discovery only; payment lives on REST resources listed in their `/.well-known/x402`. XRPL payment adapter `payXrpl402` throws `NotImplemented` for Yvon’s side.
4. **Combine** — `intentHash = sha256(JSON.stringify(artifact))`.
5. **Seal** — Guardian `/api/receipt` with `action: cross-network-pay`.
6. **Write** — JSON + markdown artifacts under `demo/out/`.

Zero npm dependencies. No secrets in the repo.
