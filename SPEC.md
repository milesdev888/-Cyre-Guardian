# CYRE — SITE SPEC (source of truth)

Any agent (Claude, Grok, @claude, human) working on this repo reads this file first.
The spec is the asset; code is rebuildable from it. Update this file whenever a rule
or feature changes — a PR that changes behavior without updating SPEC.md is incomplete.

Repo: `milesdev888/-Cyre-Guardian` · Deploys: Vercel → **cyre.dev** (auto on push to main)
X: @Cyredev888 · Founder approval required for every merge, post, and spend.

---

## 1. WHAT CYRE IS

CYRE — Global Synthetic Intelligence infrastructure for real-world assets on Solana.
Guardian is the AI that **watches** on-chain activity and flags fraud patterns.
Product stance: *watch, don't calculate* — users give an address, Guardian watches it.
Token: **$C7** ("$C7 — the CYRE token"), name CYRE, symbol C7, launching via
Meteora Dynamic Bonding Curve. Tokenomics: 100M supply — 60% dev treasury (2-yr linear
vesting) / 25% community curve / 10% team (12-mo vest, 6-mo cliff) / 3% airdrop
(2M community + 1M creators) / 2% exchange ops. LP 100% locked. CA published ONLY on
cyre.dev/tokenomics and @Cyredev888.

## 2. NON-NEGOTIABLES (apply to every agent, every change)

1. **Never push to `main`.** Work on branches; every change lands as a PR the founder merges.
   Main auto-deploys the live site AND rebuilds two Render crons.
2. **Never invent metrics.** Banned unless founder confirms they are measured:
   revenue/MRR figures, user or customer counts, transaction volumes, accuracy %,
   uptime %, protocol counts, pattern counts. (Scrubbed Aug 11 2026 pre-launch; the
   chat API system prompt enforces the same list.)
3. **Never label an address "scam" or "safe".** Guardian shows patterns and says so.
   "Patterns, not verdicts."
4. **Never present $C7 as an investment.** No price talk, no return promises.
   Early-stage / not-an-offer-of-securities disclosure stays on the site.
5. **Guardian never DMs first, never asks to connect a wallet.** This warning appears
   on /airdrop and must survive every redesign.
6. **No secrets in the repo.** Keys live in Vercel/Render env vars only. The X bridge
   secret is in the connector URL and Render env — never in a file.
7. **Homepage is a full redesign file** (`index.html`), not bolt-ons on the CYRE 7 shell.
   Prefer shipping a clean self-contained homepage on a branch/PR. Rollback = `index-legacy.html`.
   Secondary pages still use bolt-on scripts (§4). See §4.

## 3. FILE INVENTORY (repo root unless noted)

| File | What it is |
|---|---|
| `index.html` | **Homepage redesign** (Aug 2026): self-contained cinematic AI page — headline "The chain has a witness.", eyebrow **Synthetic Intelligence · RWA fraud-watch**, cyan `#5fd0ff` + violet `#9b7bff` + sparse gold particle accents, **wireframe/particle Guardian head** (idle morph dust→mesh→photo→dust; soft eye bloom on mesh, no cartoon eyes), orbit rings, compact status chips LIVE / RISK LOW / WATCHING beside head, cyan-glow Check CTA + transparent outline Talk to Guardian, single nav (no duplicate Tools strip), Oracle Pulse/Watchlist/Forensics/Passport/Signals cards, trust strip (no fake metrics). Hero morph may show `/guardian2.jpg` during photo phase; FAB/popout still uses `/guardian2.jpg`. Loads `homepage.css`, `vortex.js`, `guardian-head.js`, `guardian-popout.js`, `access-form.js`, `rwa-widget.js`, `ai-presence.js`, `footer-polish.js`. |
| `index-legacy.html` | Pre-redesign CYRE 7 shell snapshot for rollback. Do not serve as `/`. |
| `nav-tools.js` | Tools dropdown/strip: Watch, Passport, Check, Score, Oracle, Forensics, Signals, Tokenomics, Roadmap, Airdrop (cyan/violet glass menus). Auto demoted. |
| `watch.html` | Watch v1 — real-time wallet monitor + measured alerts board → cyre.dev/watch. Default list empty; quiet wallets only. No CDN cache on `/api/watch` (fresh measured run). |
| `passport.html` | Passport v1 — portable RWA profile from measured address signals → cyre.dev/passport. Share/download PNG dossier + JSON. Visible disclaimer: Patterns, not verdicts. No CDN cache on `/api/passport`. |
| `check.html` | Free Solana address checker → cyre.dev/check. |
| `score.html` | Wallet Score Card — canvas dossier PNG + share loop → cyre.dev/score. |
| `oracle.html` | Oracle Pulse v1 — RWA mint/oracle feed monitor → cyre.dev/oracle. Not a wallet paste tool. Patterns: stale / spike / divergence only. `cache:'no-store'` + inflight. |
| `auto.html` | Use Case 01 — tokenized dealer lot demo (synthetic). **Archived demo** at `/auto` with soft banner → `/oracle`. Primary product is Oracle Pulse. |
| `forensics.html` | Forensics v1 — single-address RWA pattern board → cyre.dev/forensics. Measured only; `Cache-Control: no-store`. |
| `signals.html` | Signals v1 — public RWA pattern feed board → cyre.dev/signals. Default list empty (same Watch policy); measured hits only; `Cache-Control: no-store` on `/api/signals`. |
| `api/oracle.js` | GET /api/oracle — Oracle Pulse v1 RWA feed monitor. NestUSD Pyth Lazer seeds AAPLx=1792, TSLAx=1847, SPYx=1843; USDY/OUSG/syrupUSDC deferred (`evaluated:false`). Patterns: stale / spike / divergence from last-update age, move window, peer spread. Soft-fail; `Cache-Control: no-store`. Optional `PYTH_LAZER_API_KEY`. Never invent Hermes hex / prices. No LLM. |
| `api/watch.js` | GET /api/watch — `?address=` and optional `?list=` (≤10). Reuses address signals; fresh-window alerts; counters from this measured run only; `Cache-Control: no-store`. No LLM. Env `SOLANA_RPC`. |
| `api/passport.js` | GET /api/passport — `?address=`. Stable Passport JSON; `Cache-Control: no-store`. No LLM. Env `SOLANA_RPC`. |
| `api/forensics.js` | GET /api/forensics — `?address=` (single). Measured patterns; `Cache-Control: no-store`. No LLM. Env `SOLANA_RPC`. |
| `api/signals.js` | GET /api/signals — optional `?address=` / `?list=` (≤10). Empty default → empty feed; `Cache-Control: no-store`. No LLM. Env `SOLANA_RPC`. |
| `api/address.js` | GET /api/address — 1,000-sig window, 6 explainable signals, LOW/MED/HIGH. Env `SOLANA_RPC`. |
| `api/chat.js` | Guardian chat (Anthropic). HARDENED: origin-locked to cyre.dev. Keep all guardrails. |
| `vercel.json` | `{cleanUrls:true, trailingSlash:false}` — pages served extensionless. |

### Watch v1 — RWA mint/protocol interest set (not a default wallet list)

Default watchlist is **empty**. Once `SOLANA_RPC` can pull holders without public-RPC 429s, seed ≤10 quiet wallets from top holders of these mints (drop known CEX/hot dumps; mark noisy if sig rate blows the quiet window):

| Token | Mint | Notes |
|---|---|---|
| USDY | `A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6` | Ondo treasuries |
| OUSG | `i7u4r16TcsJTgq1kAG8opmVZyVnAKBwLKu6ZPMwzxNc` | Ondo |
| syrupUSDC | `AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj` | Maple credit |
| AAPLx | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` | xStocks equity (Kamino collateral) |
| TSLAx | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` | xStocks |
| SPYx | `XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W` | xStocks ETF |

Alert patterns in Watch v1 (measured only): dormant→active, burst, failure spike.

### Oracle Pulse v1 — RWA feed monitor (patterns only; no verdicts)

Mint/oracle-level feed monitor for the SPEC Watch seed set. **Not a wallet paste tool.**

| Symbol | Source | Feed | v1 status |
|---|---|---|---|
| USDY | deferred | — | `evaluated:false` — no verified public Pyth Lazer/Hermes ID (do not invent Hermes hex) |
| OUSG | deferred | — | `evaluated:false` — no verified public feed |
| syrupUSDC | deferred | — | `evaluated:false` — no verified public feed |
| AAPLx | NestUSD Pyth Lazer | `1792` | evaluated when `PYTH_LAZER_API_KEY` set; else documented ID + deferred measure |
| TSLAx | NestUSD Pyth Lazer | `1847` | same |
| SPYx | NestUSD Pyth Lazer | `1843` | same |

Patterns (only): **stale** (last-update age vs threshold), **spike** (move % over 1h window), **divergence** (peer equity Hermes spread when Lazer primary measured). Soft-fail. API always returns `kind:'cyre-oracle'`, `version:1`, `disclaimer:'Patterns, not verdicts.'`, `Cache-Control: no-store`. Client: `cache:'no-store'` + inflight. Optional env `PYTH_LAZER_API_KEY` (or `PYTH_PRO_API_KEY`). Never invent prices or Hermes hex primary IDs.

### Forensics v1 — pattern taxonomy (patterns only; no verdicts)

| Pattern | v1 status | Measured from |
|---|---|---|
| dormant→active | evaluated | 1k-sig `blockTime` gaps + idleDays |
| burst | evaluated | last24h / lastHour counts in this run |
| failure spike | evaluated | failed sig ratio |
| mint-affinity | evaluated | `getTokenAccountsByOwner` hold/touch yes|no vs SPEC seed mints |
| collateral-loop | deferred | needs instruction decode |
| transfer-hook / eligibility friction | deferred | Token-2022 extension introspection |

### Signals v1 — public pattern feed (patterns only; no verdicts)

Public feed of recent/public measured pattern hits across an optional address list (≤10). Default list is **empty** until quiet holders are filtered from SPEC seed mints.

API always returns `kind:'cyre-signals'`, `version:1`, `disclaimer:'Patterns, not verdicts.'`, `Cache-Control: no-store`. No LLM. No invented metrics.

## 4. HOMEPAGE + BOLT-ON PATTERN

**Homepage:** `index.html` is a clean self-contained modern page. Rollback at `index-legacy.html`.

**Bolt-ons (secondary pages):** self-mounting JS at repo root. Secondary pages (`watch`/`passport`/`oracle`/`forensics`/`signals`/`check`/`score`/`auto`/…) stay standalone HTML and load `ai-vibe-loader.js`.

## 5. DESIGN SYSTEM — crystal blue glass (+ AI-vibe)

- Ice blue `#5fd0ff` · violet `#9b7bff` · cyan `#4fe3d0`
- Single primary nav (Watch/Passport/Check/Score/Oracle/Forensics/Signals/Tokenomics/Roadmap/Airdrop; Auto demoted to archived demo)
- Everything respects reduced-motion and keyboard focus.

## 6. LIVE SERVICES

- **Vercel**: env `ANTHROPIC_API_KEY`, `COINGECKO_API_KEY`, `SOLANA_RPC`, optional `PYTH_LAZER_API_KEY`.
- **Render** crons + `cyre-x-bridge`. Crons auto-deploy on main — another reason for §2.1.
- **X**: @Cyredev888 via the bridge.

## 7. VERIFY BEFORE DECLARING DONE

`curl` 200: `/` `/oracle` `/watch` `/passport` `/forensics` `/signals` `/check` `/score` `/auto` `/tokenomics` `/roadmap` `/airdrop`.
Then `/api/oracle` → expect `ok:true`, `kind:"cyre-oracle"`, `version:1`, `disclaimer:"Patterns, not verdicts."`, `Cache-Control: no-store` (deferred feeds allowed when Lazer key unset).

## 8. CURRENT STATE + OPEN ITEMS (Aug 23 2026)

Live & verified: glass/AI-vibe layer, vortex, talking Guardian, checker, score card,
tokenomics/roadmap/airdrop/auto/forensics/signals pages, Oracle Pulse v1 on branch,
clean URLs, hardened chat API, both crons (mention-grader in DRY_RUN).
Open before launch: devnet DBC rehearsal, www.cyre.dev attach, mention-grader DRY_RUN→false,
Anthropic spend limit, optional `PYTH_LAZER_API_KEY` for measured Lazer prices.

## 9. AGENT LANES

- **Grok** — creative assets, content drafts, new standalone pages ON BRANCHES. Reads this spec first. Never touches api/, crons, or anything in §2.
- **Claude** — deploys, Render/X operations, code review of every PR, launch mechanics, this spec's upkeep.
- **@claude (GitHub App)** — tagged in issues/PRs for scoped repo edits.
- **Founder** — merges, spends, posts. The only human in the loop, and the only one who can change §2.
