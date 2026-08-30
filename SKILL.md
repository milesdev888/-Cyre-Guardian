---
name: cyre-guardian
description: Risk-grade Solana wallets/tokens, issue Passports, Handshake counterparties, Intent-Preflight before signing, seal Decision Receipts, Passport Delta, Settlement Batch, Program Brief, Counterparty Alerts, or Oracle Pulse. Pay-per-request in USDC via x402 (Base mainnet). Use when the user mentions CYRE, Guardian, wallet risk, passport, handshake, preflight, receipt, delta, batch settlement, program novelty, watchlist alerts, RWA oracle, rug check, or counterparty check. Patterns, not verdicts.
---

# CYRE Guardian

Guardian reads on-chain history and returns explainable risk signals — each with points and a plain-English reason — so an agent can decide for itself. It never says "safe" or "scam"; it shows patterns.

Paid endpoints + free verifiers. No API keys, no accounts. Listed on Agentic Market (agentic.market → search "guardian").

| Endpoint | What it does | Price |
|---|---|---|
| `GET https://cyre.dev/api/address?address=<base58>` | Wallet risk profile | $0.005 |
| `GET https://cyre.dev/api/token?mint=<base58>` | Token mint facts | $0.01 |
| `GET https://cyre.dev/api/passport?address=<base58>` | Signed 24h Passport | $0.005 |
| `GET https://cyre.dev/api/handshake?tokenA=<t>&tokenB=<t>` | Bilateral Passport Handshake | $0.01 |
| `GET https://cyre.dev/api/preflight?from=<base58>&to=<base58>` | Intent Preflight before sign | $0.01 |
| `GET/POST https://cyre.dev/api/receipt` | Decision Receipt (seal intent + action) | $0.005 |
| `GET https://cyre.dev/api/delta?token=<prior passport>` | Passport Delta (what changed) | $0.01 |
| `GET https://cyre.dev/api/batch?from=<payer>&list=<a,b>` | Settlement Batch screen (≤10) | $0.02 |
| `GET https://cyre.dev/api/program?programId=<id>` | Program novelty brief (+ optional `address`) | $0.01 |
| `GET https://cyre.dev/api/alerts?list=<a,b>&minRisk=HIGH` | Counterparty alert poll (≤10) | $0.015 |
| `GET https://cyre.dev/api/oracle` | RWA Oracle Pulse (stale/spike/divergence) | $0.01 |
| `GET https://cyre.dev/api/passport/verify?token=` | Verify Passport | Free |
| `GET https://cyre.dev/api/receipt/verify?token=` | Verify Decision Receipt | Free |

Payment network: **Base mainnet (eip155:8453), USDC.** A Solana lane also appears in the 402 offer but is currently devnet — pay on Base.

## How to pay

Any x402 client works. The endpoint returns HTTP 402 with the price; your client signs a USDC payment and retries; Guardian settles it and returns the result in the same call.

**Shell-capable agents — Coinbase Agentic Wallet:**

```bash
npx awal status
npx awal x402 pay "https://cyre.dev/api/address" --query '{"address":"<base58>"}'
npx awal x402 pay "https://cyre.dev/api/token" --query '{"mint":"<base58>"}'
npx awal x402 pay "https://cyre.dev/api/passport" --query '{"address":"<base58>"}'
npx awal x402 pay "https://cyre.dev/api/handshake" --query '{"tokenA":"<passport>","tokenB":"<passport>"}'
npx awal x402 pay "https://cyre.dev/api/preflight" --query '{"from":"<base58>","to":"<base58>","mint":"<base58>"}'
npx awal x402 pay "https://cyre.dev/api/receipt" --query '{"actor":"<base58>","intentHash":"<hash>","action":"transfer","score":"24","riskLevel":"LOW"}'
npx awal x402 pay "https://cyre.dev/api/delta" --query '{"token":"<prior-passport>"}'
npx awal x402 pay "https://cyre.dev/api/batch" --query '{"from":"<payer>","list":"<addr1,addr2>"}'
npx awal x402 pay "https://cyre.dev/api/program" --query '{"programId":"<base58>","address":"<wallet>"}'
npx awal x402 pay "https://cyre.dev/api/alerts" --query '{"list":"<addr1,addr2>","minRisk":"HIGH"}'
npx awal x402 pay "https://cyre.dev/api/oracle"
```

**MCP hosts:** `check-payment-requirements` then `make-x402-request`. Tell the user the cost first.

**Any other x402 v2 client:** `accepts[]` + `PAYMENT-SIGNATURE`.

## Guardian MCP server

`io.github.milesdev888/guardian` — Streamable HTTP `https://cyre-fraud-prediction.onrender.com/mcp` — tools `grade_address`, `scan_token`, `batch_grade`.

## What you get back

### /api/address

```json
{
  "ok": true,
  "address": "9WzD…AWWM",
  "score": 24,
  "riskLevel": "LOW",
  "signalsTriggered": 1,
  "signalsEvaluated": 6,
  "signals": [
    { "id": "burst", "name": "Activity burst", "points": 24, "triggered": true,
      "detail": "45 transactions in the last 24 hours" }
  ],
  "profile": { "ageDays": 33, "transactionsSeen": 1000, "last24h": 45, "balanceSol": 1.2 },
  "checkedAt": "2026-08-29T15:57:24Z"
}
```

Signal ids: `age`, `burst`, `failures`, `dormant`, `balance`, `history`. Score bands: LOW < 30, MEDIUM 30–69, HIGH ≥ 70. Empty wallets return `empty: true`.

### /api/token

Mint/freeze authority, holder concentration, supply. Scoring: active mint +30, freeze +25, top1 >20% +15, top10 >60% +15. LP lock **not** assessed.

### /api/passport

Address grade + `mintAffinity` + Ed25519 attestation (`X-Guardian-Passport` header). Expires 24h. Verify free at `/api/passport/verify`.

### /api/handshake

Two Passports (`tokenA`+`tokenB`) or two addresses → `delta` + compatibility `brief`. Invalid tokens refuse before settle.

### /api/preflight

Before sign: `from` required; optional `to`, `mint`, `programIds`. Scoped signals (`from`/`to`/`mint`/`program`/`pair`). Not a simulator.

### /api/receipt

Seal a decision for later audit:

```json
{
  "ok": true,
  "kind": "cyre-receipt",
  "attestation": {
    "claims": {
      "kind": "cyre-decision-receipt",
      "actor": "…",
      "intentHash": "sha256:…",
      "action": "transfer",
      "score": 24,
      "riskLevel": "LOW",
      "counterparties": []
    },
    "token": "<base64url>.<sig>"
  },
  "verify": "https://cyre.dev/api/receipt/verify"
}
```

`action`: `transfer` | `swap` | `settle` | `handshake` | `preflight` | `other`. Hash the intent **locally** first; Guardian stores the hash, not the raw intent. Receipts default to 30-day TTL. Free verify at `/api/receipt/verify`.

### /api/delta

Prior Passport `token` (expired OK) → re-measure → `scoreDrift`, `riskLevelChanged`, `brief`. Optional `issueFresh=true` to mint a new Passport in the same call.

### /api/batch

`from` payer + `list` ≤10 payouts → recipients ranked by `scoreGap` vs payer.

### /api/program

`programId` novelty/age; optional `address` for wallet-vs-program age context. Not an allowlist approval.

### /api/alerts

Poll ≤10 counterparties; returns `hits` with reasons (`risk_high`, `dormant`, `burst`, `failures`, …). `minRisk` default `HIGH`.

### /api/oracle

RWA feed patterns: stale / spike / divergence on NestUSD Lazer seeds (AAPLx/TSLAx/SPYx). Deferred feeds named, never invented.

## Rules for using the result

- **Patterns, not verdicts.** Never tell the user an address is "safe" or "a scam."
- HIGH means show why before proceeding; LOW does not mean go.
- Large `balanceSol` + burst is often an exchange/program — say so.
- Receipts prove what the agent *claimed* it saw — not that the chain action succeeded.
- Not investment advice. Not KYC/AML.

## Costs and refusals

- Charged only on success. Bad input (400) refuses **before** settle.
- Repeated 402 = need USDC on Base (`npx awal balance`).
- 502 = facilitator/RPC hiccup; retry; nothing settled.

## Free for humans

`https://cyre.dev/check` (address) · `https://cyre.dev/scan` (token) · site origin stays free on the APIs above.

## Links

- Site: https://cyre.dev · Listing: https://agentic.market (search "guardian") · Updates: https://x.com/Cyredev888
- CYRE token: **$C7 — the CYRE token.** CA only at https://cyre.dev/tokenomics and @Cyredev888.
