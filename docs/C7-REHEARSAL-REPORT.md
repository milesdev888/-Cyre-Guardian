# $C7 Devnet Rehearsal Report

**Date:** 2026-08-31  
**Cluster:** Solana **devnet only** (`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`)  
**Toolkit:** [MeteoraAg/meteora-invent](https://github.com/MeteoraAg/meteora-invent) `@ 6787734`  
**Config prepared:** [`docs/c7_dbc_config.devnet.jsonc`](./c7_dbc_config.devnet.jsonc)  
**Outcome:** **FAIL** at funding (step 0) — no on-chain create-config / create-pool / swap / migrate ran.

A FAIL report is still a successful rehearsal output: the blocker is documented so tonight’s mainnet path is not surprised by faucet limits.

---

## Throwaway wallet (public only)

| Field | Value |
|---|---|
| Pubkey | `HjNv2uk5ePX9FMHFQ2tyeYaphKU3WKCnPozuYcxYC76X` |
| Keypair path (VM, not committed) | `/tmp/c7-rehearsal/keypair.json` |
| Final balance | **0 SOL** |

Private key / seed phrase: **not committed, not printed in this report.**

---

## Steps attempted

### 0. Fund throwaway wallet — **FAIL**

Target: ≥ 2 SOL (reduced caps: `initialMarketCap` 0.2 → `migrationMarketCap` 1 SOL).

| Source | Result |
|---|---|
| `solana airdrop` → `https://api.devnet.solana.com` | Rate-limit / faucet dry (repeated) |
| `faucet.solana.com` UI / API | UI form automation blocked; API returned “Missing wallet address” / 404 for `/api/airdrop` |
| Helius `requestAirdrop` / `solana airdrop -u https://devnet.helius-rpc.com/?api-key=<REDACTED>` | **HTTP -32403:** `Rate limit exceeded. The devnet faucet has a limit of 1 SOL per project per day.` |

No alternate funding source was used (per hard rules). Balance remained **0 SOL**, so all later Meteora CLI steps were skipped.

### 1–5. Config / pool / swap / migrate — **NOT RUN**

Blocked by step 0. Prepared config uses reduced caps and current schema (see below). Intended command sequence once funded:

```bash
# DEVNET RPC only (public or Helius *devnet*)
solana config set --url https://api.devnet.solana.com
# copy docs/c7_dbc_config.devnet.jsonc → meteora-invent/studio/config/dbc_config.jsonc
# replace <KEYPAIR_PATH> / <WALLET_PUBKEY>; dryRun false
cd meteora-invent/studio
pnpm dbc-create-config --config ./config/dbc_config.jsonc
pnpm dbc-create-pool --config ./config/dbc_config.jsonc
# record baseMint from create-pool output
pnpm dbc-swap --config ./config/dbc_config.jsonc --baseMint <MINT>   # repeat / shrink until graduated
pnpm dbc-migrate-to-damm-v2 --config ./config/dbc_config.jsonc --baseMint <MINT>
# then SDK withdrawLeftover so leftoverReceiver balance can hit 65M (see prior local rehearsal)
```

### 6. On-chain verification checklist

| Check | Result | Notes |
|---|---|---|
| a. Token mint; mint + freeze authority null | **FAIL** (not run) | No mint created |
| b. Leftover receiver balance = 65,000,000 | **FAIL** (not run) | — |
| c. Vesting escrow holds 10,000,000 + cliff params | **FAIL** (not run) | Config encodes 6‑mo cliff + 182 daily periods |
| d. LP permanently locked (100% creator) | **FAIL** (not run) | Config: `creatorPermanentLockedLiquidityPercentage: 100` |
| e. curve-sold + leftover + vesting ≈ 100,000,000 | **FAIL** (not run) | Expected: ~25M + 65M + 10M = 100M |

### Transaction signatures

None. Explorer links: n/a until funding succeeds and the sequence above is re-run.

---

## Config used (intent)

File: `docs/c7_dbc_config.devnet.jsonc`

| Parameter | Value |
|---|---|
| Name / Symbol | CYRE / C7 |
| Image / metadata URI | `https://raw.githubusercontent.com/milesdev888/-Cyre-Guardian/main/cyre-token-512.png` |
| Supply | 100,000,000; `tokenAuthorityOption: 1` (Immutable) |
| Quote | SOL (`So111…112`) |
| Curve | `buildCurveMode: 1`; **initialMarketCap 0.2**; **migrationMarketCap 1** |
| Leftover | 65,000,000 → leftoverReceiver = throwaway wallet |
| Locked vesting | 10,000,000; cliff 15,552,000 s (~6 mo); linear 15,724,800 s / 182 periods (~182 days) |
| LP on migration | 100% creator permanent lock; migration fee 0%; `migrationFeeOption: 2` (1% LP fee) |
| `creatorTradingFeePercentage` | 100 (direct launch; same wallet as partner) |
| Trading fee schedule | Flat 100 bps (anti-sniper decay disabled for tiny-cap rehearsal) |

---

## Schema differences

Compared prompt / older `cyre_dbc_config.devnet.jsonc` names against **today’s** `meteora-invent/studio/config/dbc_config.jsonc` (`6787734`):

| Prompt / older wording | Current schema field | Notes |
|---|---|---|
| “authority option: Immutable” | `dbcConfig.token.tokenAuthorityOption: 1` | Enum: 0 CreatorUpdate…, **1 Immutable**, … |
| “Decimals: default” | `tokenBaseDecimal: 6`, `tokenQuoteDecimal: 9` | Explicit in template; 6 is SPL default for this toolkit |
| Curve caps | `initialMarketCap` / `migrationMarketCap` under `dbcConfig` when `buildCurveMode: 1` | Mode 0 uses `percentageSupplyOnMigration` + `migrationQuoteThreshold` instead — must not mix |
| “migration fee 0%” | `migration.migrationFee.feePercentage: 0` | Separate from `migrationFeeOption` (LP fee tier on DAMM) |
| “migrationFeeOption 2 (1% LP fee)” | `migration.migrationFeeOption: 2` | Unchanged meaning in current comments |
| “LP 100% creator permanently locked” | `liquidityDistribution.creatorPermanentLockedLiquidityPercentage: 100` (+ others 0) | Must total 100%; DAMM v2 needs ≥10% permanent/vesting locked ≥1 day |
| “creatorTradingFeePercentage 100” | `fee.creatorTradingFeePercentage: 100` | Unchanged |
| Team vest cliff / daily linear | `lockedVesting.{totalLockedVestingAmount,numberOfVestingPeriod,cliffUnlockAmount,totalVestingDuration,cliffDurationFromMigrationTime}` | Durations are **seconds**; periods are count of unlock steps |
| Metadata image | Prefer `dbcPool.metadata.uri` **or** `image`+Irys upload fields | Template also supports `description` / `website` / `twitter` / `telegram` when uploading |
| New vs older repo config | `fee.poolCreationFee`, `fee.enableFirstSwapWithMinFee` | Present in current template; set `0` / `false` |
| New vs older | Optional `migratedPoolFee` / LP vesting info / transfer-hook / `buildCurveMode` 2–5 | Not used in this rehearsal |
| RPC for this attempt | Helius **devnet** used for airdrop + balance checks | Committed config keeps public `https://api.devnet.solana.com` (no API key in repo) |

---

## How to finish this rehearsal (operator)

1. Fund `HjNv2uk5ePX9FMHFQ2tyeYaphKU3WKCnPozuYcxYC76X` to **≥ 2 SOL** on **devnet** (wait for Helius project daily faucet reset, or `faucet.solana.com` with GitHub unlock).  
2. Point studio config at the funded keypair; keep `rpcUrl` on **devnet**.  
3. Run create-config → create-pool → swap-to-graduate → migrate-to-damm-v2 → **withdrawLeftover**.  
4. Fill section 6 above with PASS/FAIL + explorer links (`?cluster=devnet`).

Until then, treat allocation math as **unverified on public devnet** (prior **localnet** PASS exists in `REHEARSAL_RESULTS.md` but is not a substitute for this run).
