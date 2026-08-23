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
| `index.html` | **Homepage redesign** (Aug 2026): self-contained cinematic AI page — headline "The chain has a witness.", eyebrow **Synthetic Intelligence · RWA fraud-watch**, cyan `#5fd0ff` + violet `#9b7bff` + sparse gold particle accents, **wireframe/particle Guardian head** (idle morph dust→mesh→photo→dust; soft eye bloom on mesh, no cartoon eyes), orbit rings, compact status chips LIVE / RISK LOW / WATCHING beside head, cyan-glow Check CTA + transparent outline Talk to Guardian, single nav (no duplicate Tools strip), Watchlist/Forensics/Passport cards, trust strip (no fake metrics). Hero morph may show `/guardian2.jpg` during photo phase; FAB/popout still uses `/guardian2.jpg`. Loads `homepage.css`, `vortex.js`, `guardian-head.js`, `guardian-popout.js`, `access-form.js`, `rwa-widget.js`, `ai-presence.js`, `footer-polish.js`. |
| `index-legacy.html` | Pre-redesign CYRE 7 shell snapshot for rollback. Do not serve as `/`. |
| `theme-glass.css` | Crystal glassmorphism skin (loaded by launch-banner.js). Delete = revert skin. |
| `theme-purple-deep.css` | Darker-purple mood overrides: deeper violet `#7048dc`, shadow boosts, hero ambient shift. Loaded by `index.html` (after homepage.css) + injected by `ai-vibe-loader.js`. |
| `theme-blue.css` | Blue token overrides + avatar swap (`.portrait img` / `.g-av img` → /guardian2.jpg). |
| `guardian-popout.js` | FAB (`/guardian2.jpg` + LIVE) → glass panel with `/guardian-video.mp4` + chat POST `/api/chat`. Does not replace `guardian-voice.js`. |
| `nav-tools.js` | Tools dropdown/strip: Watch, Passport, Check, Score, Auto, Forensics, Tokenomics, Roadmap, Airdrop (cyan/violet glass menus). |
| `ai-vibe-loader.js` | Injects `theme-ai-vibe.css` + `theme-purple-deep.css`; ensures nav-tools, guardian-popout, ai-presence, rwa/vortex/voice/access. Loaded by `launch-banner.js` (+ one-line on secondary pages). |
| `ai-presence.js` | SUPER AI idle: denser glow, orbit breathe/pulse, `.portrait` / orb rings (works with wireframe head wrap); reduced-motion safe. Loaded by `ai-vibe-loader.js`. |
| `footer-polish.js` | Footer Docs/Security → `/roadmap`; Privacy/Terms/Support → mailto. |
| `launch-banner.js` | Self-mounting: 3D word-funnel canvas banner (robot core), $C7 + Roadmap nav links, hero $C7 button (emblem), glass CSS loader, AI-vibe loader hook, claims-safe HUD bar. |
| `vortex.js` | Living particle/network mesh behind hero — violet-heavy mood (`#7048dc` / `#9b7bff`) with cyan accents (`#5fd0ff`) and sparse gold/amber dots (~12%; `#d4a84b` / `#ffb454`); continuous motion; static frame if `prefers-reduced-motion`. |
| `homepage.css` | Homepage redesign styles (cyan Check glow, wireframe head stage, compact chips, single nav). |
| `guardian-head.js` | Homepage hero canvas — **dust → mesh → photo → dust** (~22s): 0–16% dust; 16–30% dust→mesh; 30–48% dense violet/cyan particle wireframe head (soft eye bloom, no solid cartoon eyes); 48–60% mesh→photo; 60–82% her photo (`/guardian2.jpg` full-portrait crossfade, no circle crop/rim); 82–100% photo→dust. Fallback `/robot.jpg` if portrait fails. `prefers-reduced-motion` → static mesh. FAB/popout still uses `/guardian2.jpg`. |
| `guardian-voice.js` | "Hear Guardian": tap → talking video → mp3 → speech-synth fallback chain; robot morph. |
| `guardian-video.mp4` | 480² talking-Guardian clip (preload=none). |
| `guardian2.jpg` | Guardian portrait (blue girlbot, 600²) — FAB / popout / secondary avatars; also shown in hero morph photo phase. `robot.jpg` = fallback if portrait fails + funnel core. |
| `check-link.js` | Adds "Check an address" + "Grade your wallet" buttons to hero CTA row. |
| `access-form.js` | Early-access modal → Formspree `xqpzddvy`. |
| `rwa-widget.js` | Live RWA market strip under hero (pinned CoinGecko ids; keep "Data by CoinGecko"). Styled by AI-vibe theme. |
| `watch.html` | Watch v1 — real-time wallet monitor + measured alerts board → cyre.dev/watch. Default list empty; quiet wallets only. No CDN cache on `/api/watch` (fresh measured run). |
| `passport.html` | Passport v1 — portable RWA profile from measured address signals → cyre.dev/passport. Share/download PNG dossier + JSON. Visible disclaimer: Patterns, not verdicts. No CDN cache on `/api/passport`. |
| `check.html` | Free Solana address checker → cyre.dev/check. |
| `score.html` | Wallet Score Card — canvas dossier PNG + share loop → cyre.dev/score. |
| `tokenomics.html` | Donut + locks + CA box ("TBA — only here and @Cyredev888"). |
| `roadmap.html` | 4 phases: Shipped / Now / Next / Exploring (agent-economy items = research framing). |
| `airdrop.html` | 3M $C7, tabs Community (2M) / Creators (1M, #creators deep link), Guardian warning. |
| `auto.html` | Use Case 01 — tokenized dealer lot demo (synthetic). Kept at `/auto`; product Forensics lives at `/forensics`. |
| `forensics.html` | Forensics v1 — single-address RWA pattern board → cyre.dev/forensics. Measured only; `Cache-Control: no-store`. |
| `watcher.js` | Render cron `guardian-watcher` (*/15): anomaly detector → drafts/tweets. Stateless window dedup. |
| `mention-grader.js` | Render cron `guardian-mention-grader` (*/10): @mention + address → public grade reply via bridge. |
| `api/chat.js` | Guardian chat (Anthropic). HARDENED: origin-locked to cyre.dev, role-sanitized, haiku model, daily cap. Keep all guardrails. |
| `api/address.js` | GET /api/address — 1,000-sig window, 6 explainable signals, LOW/MED/HIGH. Env `SOLANA_RPC`. (Live file; SPEC formerly said `.mjs`.) |
| `api/watch.js` | GET /api/watch — `?address=` and optional `?list=` (≤10). Reuses address signals; fresh-window alerts; counters from this measured run only; `Cache-Control: no-store` (no CDN reuse). Marks noisy if last24h ≥ 200. No LLM. Env `SOLANA_RPC`. |
| `api/passport.js` | GET /api/passport — `?address=`. Stable Passport JSON (`version`/`kind`/`address`/`fetchedAt`/`score`/`riskLevel`/`profile`/`signals`/`mintAffinity`/`window`/`disclaimer`). Same measured 1k-sig window as `/api/address`; one `getTokenAccountsByOwner` for SPEC seed mints → `mintAffinity` hold/touch yes|no vs seed (no weights); `Cache-Control: no-store`. No LLM. Env `SOLANA_RPC`. |
| `api/forensics.js` | GET /api/forensics — `?address=` (single). Measured patterns: dormant→active, burst, failure spike, mint-affinity hold/touch vs SPEC seed mints. Same 1k-sig window + one token-accounts call as Passport; collateral-loop + transfer-hook/eligibility friction named but `evaluated:false` in v1; `Cache-Control: no-store`. No LLM. Env `SOLANA_RPC`. |
| `api/rwa.mjs` | CoinGecko proxy, 60s cache, last-good fallback. Env `COINGECKO_API_KEY`. |
| `cyre-token-256/512.png` | C7 emblem. 512 = mint metadata image URI (GitHub raw path, immutable). |
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

### Forensics v1 — pattern taxonomy (patterns only; no verdicts)

| Pattern | v1 status | Measured from |
|---|---|---|
| dormant→active | evaluated | 1k-sig `blockTime` gaps + idleDays (same family as Watch/address) |
| burst | evaluated | last24h / lastHour counts in this run |
| failure spike | evaluated | failed sig ratio (window + last-hour) |
| mint-affinity | evaluated | `getTokenAccountsByOwner` hold/touch yes|no vs SPEC seed mints (no weights) |
| collateral-loop | deferred | needs instruction decode — not cheap in v1 |
| transfer-hook / eligibility friction | deferred | Token-2022 extension introspection — cost-deferred |

Forensics is single-address only (quiet/cost-safe). Still patterns, not accusations.

Off-repo: `cyre-x-bridge` (Render web service — X API bridge, MCP connector + cron relay);
`cyre-fraud-prediction` (separate repo/deploy, linked from the Fraud Prediction card);
`cyre_dbc_config.jsonc` (local-only Meteora CLI config, holds the 60/25/10/3/2 math).

## 4. HOMEPAGE + BOLT-ON PATTERN

**Homepage (Aug 2026 redesign):** `index.html` is a clean self-contained modern page matching
founder-approved mocks — not the old CYRE 7 shell with bolt-ons. Brand: **Synthetic Intelligence**
infrastructure for RWAs; hero kicker spells that out; headline stays "The chain has a witness."
Rollback copy lives at `index-legacy.html`. Prefer regenerating/replacing the homepage file on a
branch rather than stacking more skins on the legacy shell.

**Bolt-ons (secondary pages + shared widgets):** Features that attach to many pages are still
**self-mounting JS at repo root** (+ one-line `<script>` includes). Scripts find their DOM anchor,
inject markup/styles, fail cleanly, respect `prefers-reduced-motion`, and pause off-screen
(IntersectionObserver). CSS skins load the same way. Revert = delete the file.
Secondary pages (`watch`/`passport`/`forensics`/`check`/`score`/`auto`/…) stay standalone HTML and load `ai-vibe-loader.js` for
shared nav/popout/theme.

## 5. DESIGN SYSTEM — "crystal blue glass" (+ AI-vibe layer)

AI-vibe overlay (`theme-ai-vibe.css`): deeper ink `#05060a`, ice `#5fd0ff`, violet `#9b7bff`.
Nav Tools dropdowns, secondary tool strips, HUD chips, and RWA ticker use this palette —
no leftover gold chrome in UI (`#d9b36c`/`#d4a84b` as button/nav accents), no white bootstrap menus, no mismatched mint.
**Exception (hero particles only):** sparse gold/amber dots (`#d4a84b` / `#ffb454`) in `vortex.js` + `guardian-head.js` as a premium accent mix — keep density low (~12%).

### Base — crystal blue glass

- Ink backgrounds: `#07080b` / `#0d1017` panels / `#1f2634` lines
- Ice blue `#5fd0ff` (primary, was gold — `--gold` is redefined to ice) · cyan `#4fe3d0` · frost white `#eefaff`
- Status: red `rgb(255,77,94)` = FLAG/HOLD/RISK · green `rgb(61,220,132)` = SETTLED/SIG VALID/ATTEST · amber `#ffb454` = MEDIUM risk
- Type: Sora (display 700–800) · Inter (body) · IBM Plex Mono (data)
- Glass: blur 14–20px panels, `rgba(95,208,255,.18)` borders, pill radius 999px, gradient CTAs, two fixed blur blobs, sticky frosted pill nav
- Signature: **darker-purple mood** (`theme-purple-deep.css` on top of AI-vibe) — deeper violet `#7048dc` ambient, violet-heavy particles; cyan `#5fd0ff` / violet `#9b7bff` / sparse gold `~12%` wireframe/particle Guardian head (canvas) with **dust→mesh→photo→dust** idle cycle (~22 s) + counter-rotating orbit rings; hero morph may show `/guardian2.jpg` during photo phase; FAB/popout still uses `/guardian2.jpg`
- Hero status chips (system status, not wallet verdicts): **LIVE** / **RISK LOW** / **WATCHING**
- Primary CTA: Check — cyan fill + outer glow (not violet gradient); Talk to Guardian — transparent outline
- Single primary nav (Watch/Passport/Check/Score/Auto/Forensics/Tokenomics/Roadmap/Airdrop) — no duplicate Tools strip under nav
- Compact status chips beside wireframe head (not large banners over the face)
- Watchlist/Forensics/Passport cards kept in early viewport
- Everything respects reduced-motion and keyboard focus.

## 6. LIVE SERVICES

- **Vercel** (personal acct, project serves cyre.dev): env `ANTHROPIC_API_KEY`,
  `COINGECKO_API_KEY`, `SOLANA_RPC` (Helius when upgraded). www.cyre.dev NOT attached yet — pre-launch task.
- **Render** workspace `tea-d9sgsmh42hec73c9sqjg`: crons `guardian-watcher`
  (crn-da2j9smgekts73b2vq50) + `guardian-mention-grader` (crn-da3tddm1egvs73ar5k20),
  web service `cyre-x-bridge`. Crons auto-deploy on main commits — another reason for §2.1.
- **X**: @Cyredev888 via the bridge. Posting is founder-approval-gated, always.
- Costs learned: exchange wallets in any watchlist = call-volume bomb. Watchlists use
  QUIET wallets (whales/treasuries). Claude-per-tx loops need ≥300s cooldowns.

## 7. VERIFY BEFORE DECLARING DONE (curl checklist)

`curl -s -o /dev/null -w "%{http_code}"` each: `/` `/tokenomics` `/roadmap` `/airdrop`
`/watch` `/passport` `/forensics` `/check` `/score` `/auto` `/theme-glass.css` `/launch-banner.js` `/vortex.js`
`/guardian-voice.js` `/guardian-video.mp4` `/theme-ai-vibe.css` `/guardian-popout.js` `/nav-tools.js` `/ai-vibe-loader.js` `/ai-presence.js` `/homepage.css` `/guardian-head.js` `/cyre-token-256.png` `/cyre-token-512.png`
— all 200. Then `/api/address?address=5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9`
→ expect `score:24, riskLevel:LOW`. Then `/api/watch?address=5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9`
→ expect `ok:true` with measured `counters` and a patterns-not-verdicts `disclaimer` (response must not be CDN-cached). Then `/api/passport?address=5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9`
→ expect `ok:true`, `kind:"cyre-passport"`, measured `score`/`riskLevel`/`profile`, `disclaimer:"Patterns, not verdicts."`, and `Cache-Control: no-store`. Then `/api/forensics?address=5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9`
→ expect `ok:true`, `kind:"cyre-forensics"`, measured `patterns`/`counters`/`mintAffinity`, `disclaimer:"Patterns, not verdicts."`, and `Cache-Control: no-store`. Check served index.html references each script
exactly once. Verify against `cyre.dev/` (root path — `/index.html` redirects).
Mobile-upload gotchas: iOS renames downloads ("file 2.ext"), GitHub web-editor paste
truncates silently, uploads sometimes don't replace — always re-fetch the raw file
after commit and diff.

## 8. CURRENT STATE + OPEN ITEMS (Aug 23 2026)

Live & verified: glass/AI-vibe layer, vortex, talking Guardian, checker, score card,
tokenomics/roadmap/airdrop/auto/forensics pages, clean URLs, hardened chat API, both crons
(mention-grader in DRY_RUN), Guardian pop-out + AI presence.
Homepage: mock visual match — Synthetic Intelligence branding, "The chain has a witness.",
**darker-purple mood** (`theme-purple-deep.css`): deeper violet ambient; **dust→mesh→photo→dust ~22 s morph**
(0–16% dust, 16–30% dust→mesh, 30–48% dense violet/cyan particle wireframe head with soft eye bloom / no cartoon eyes, 48–60% mesh→photo, 60–82% her photo `/guardian2.jpg` full-portrait crossfade (no circle crop/rim), 82–100% photo→dust; fallback `/robot.jpg` if portrait fails);
violet-heavy particle field + cyan accents + sparse gold (~12%); LIVE/RISK LOW/WATCHING chips, glowing Check CTA (cyan),
living mesh, feature cards, trust strip; hero morph may show `/guardian2.jpg` during photo phase; FAB/popout still uses `/guardian2.jpg`; legacy shell at `index-legacy.html`.
Open before launch: devnet DBC rehearsal (verify 60/25/10/3/2 leftover math),
www.cyre.dev attach, mention-grader DRY_RUN→false after draft review, Anthropic
spend limit + credit top-up (chat in demo mode until then), guardian-voice.mp3,
Vercel Analytics snippet on index.html (only check.html has it), stray root
`address.js` delete (api/address.js is the live one — do not touch).

## 9. AGENT LANES

- **Grok** — creative assets (images/video — proven lane), content drafts, new
  standalone pages ON BRANCHES. Reads this spec first. Never touches api/, crons, or anything in §2. Homepage redesigns go on branches/PRs.
- **Claude** — deploys, Render/X operations, code review of every PR, launch
  mechanics, this spec's upkeep.
- **@claude (GitHub App)** — tagged in issues/PRs for scoped repo edits once Actions
  is confirmed firing. Point it at exact sections; never let it explore index.html.
- **Founder** — merges, spends, posts. The only human in the loop, and the only one
  who can change §2.
