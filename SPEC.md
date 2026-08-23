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
7. **Never edit `index.html` directly** except one-line `<script>`/`<link>` includes.
   See §4.

## 3. FILE INVENTORY (repo root unless noted)

| File | What it is |
|---|---|
| `index.html` | The site shell. Portraits use `/guardian2.jpg`. Touch only to add one-line includes. |
| `theme-glass.css` | Crystal glassmorphism skin (loaded by launch-banner.js). Delete = revert skin. |
| `theme-blue.css` | Blue token overrides + avatar swap (`.portrait img` / `.g-av img` → /guardian2.jpg). |
| `theme-ai-vibe.css` | AI-vibe skin: deeper black, cyan `#5fd0ff` + violet `#9b7bff`, bloom/glow, glass. Tools dropdowns, HUD chips, RWA ticker. No gold leftovers. `prefers-reduced-motion` safe. |
| `guardian-popout.js` | FAB (`/guardian2.jpg` + LIVE) → glass panel with `/guardian-video.mp4` + chat POST `/api/chat`. Does not replace `guardian-voice.js`. |
| `nav-tools.js` | Tools dropdown/strip: Check, Score, Auto, Tokenomics, Roadmap, Airdrop (cyan/violet glass menus). |
| `ai-vibe-loader.js` | Injects theme + ensures nav-tools, guardian-popout, rwa/vortex/voice/access. Loaded by `launch-banner.js`. |
| `footer-polish.js` | Footer Docs/Security → `/roadmap`; Privacy/Terms/Support → mailto. |
| `launch-banner.js` | Self-mounting: 3D word-funnel canvas banner (robot core), $C7 + Roadmap nav links, hero $C7 button (emblem), glass CSS loader, AI-vibe loader hook, claims-safe HUD bar. |
| `vortex.js` | Hero background canvas — tilted glyph vortex, red/green status words, breathing ice rim. |
| `guardian-voice.js` | "Hear Guardian": tap → talking video → mp3 → speech-synth fallback chain; robot morph. |
| `guardian-video.mp4` | 480² talking-Guardian clip (preload=none). |
| `guardian2.jpg` | Guardian portrait (blue girlbot, 600²). `robot.jpg` = robot face for morph/funnel core. |
| `check-link.js` | Adds "Check an address" + "Grade your wallet" buttons to hero CTA row. |
| `access-form.js` | Early-access modal → Formspree `xqpzddvy`. |
| `rwa-widget.js` | Live RWA market strip under hero (pinned CoinGecko ids; keep "Data by CoinGecko"). Styled by AI-vibe theme. |
| `check.html` | Free Solana address checker → cyre.dev/check. |
| `score.html` | Wallet Score Card — canvas dossier PNG + share loop → cyre.dev/score. |
| `tokenomics.html` | Donut + locks + CA box ("TBA — only here and @Cyredev888"). |
| `roadmap.html` | 4 phases: Shipped / Now / Next / Exploring (agent-economy items = research framing). |
| `airdrop.html` | 3M $C7, tabs Community (2M) / Creators (1M, #creators deep link), Guardian warning. |
| `auto.html` | Use Case 01 — tokenized dealer lot demo. |
| `watcher.js` | Render cron `guardian-watcher` (*/15): anomaly detector → drafts/tweets. Stateless window dedup. |
| `mention-grader.js` | Render cron `guardian-mention-grader` (*/10): @mention + address → public grade reply via bridge. |
| `api/chat.js` | Guardian chat (Anthropic). HARDENED: origin-locked to cyre.dev, role-sanitized, haiku model, daily cap. Keep all guardrails. |
| `api/address.mjs` | GET /api/address — 1,000-sig window, 6 explainable signals, LOW/MED/HIGH. Env `SOLANA_RPC`. |
| `api/rwa.mjs` | CoinGecko proxy, 60s cache, last-good fallback. Env `COINGECKO_API_KEY`. |
| `cyre-token-256/512.png` | C7 emblem. 512 = mint metadata image URI (GitHub raw path, immutable). |
| `vercel.json` | `{cleanUrls:true, trailingSlash:false}` — pages served extensionless. |

Off-repo: `cyre-x-bridge` (Render web service — X API bridge, MCP connector + cron relay);
`cyre-fraud-prediction` (separate repo/deploy, linked from the Fraud Prediction card);
`cyre_dbc_config.jsonc` (local-only Meteora CLI config, holds the 60/25/10/3/2 math).

## 4. THE BOLT-ON PATTERN (how every feature ships)

index.html is too large to regenerate and too fragile to hand-edit on mobile. So:
every feature is a **self-mounting JS file at repo root** + at most ONE line in
index.html (`<script src="/file.js" defer></script>` before `</body>`). Scripts find
their anchor in the DOM, inject their own markup/styles, remove themselves cleanly on
failure, respect `prefers-reduced-motion`, and pause off-screen (IntersectionObserver).
CSS skins are bolt-on files loaded the same way. Revert anything = delete its file.
New pages are standalone self-contained HTML files (own CSS inline) at root.

## 5. DESIGN SYSTEM — "crystal blue glass" (+ AI-vibe layer)

AI-vibe overlay (`theme-ai-vibe.css`): deeper ink `#05060a`, ice `#5fd0ff`, violet `#9b7bff`.
Nav Tools dropdowns, secondary tool strips, HUD chips, and RWA ticker use this palette —
no leftover gold (`#d9b36c`/`#d4a84b`), no white bootstrap menus, no mismatched mint.

### Base — crystal blue glass

- Ink backgrounds: `#07080b` / `#0d1017` panels / `#1f2634` lines
- Ice blue `#5fd0ff` (primary, was gold — `--gold` is redefined to ice) · cyan `#4fe3d0` · frost white `#eefaff`
- Status: red `rgb(255,77,94)` = FLAG/HOLD/RISK · green `rgb(61,220,132)` = SETTLED/SIG VALID/ATTEST · amber `#ffb454` = MEDIUM risk
- Type: Sora (display 700–800) · Inter (body) · IBM Plex Mono (data)
- Glass: blur 14–20px panels, `rgba(95,208,255,.18)` borders, pill radius 999px, gradient CTAs, two fixed blur blobs, sticky frosted pill nav
- Signature: circular Guardian portrait + counter-rotating orbit rings (r1 50s / r2 36s / r3 pulse) with satellite dots
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
`/check` `/score` `/auto` `/theme-glass.css` `/launch-banner.js` `/vortex.js`
`/guardian-voice.js` `/guardian-video.mp4` `/theme-ai-vibe.css` `/guardian-popout.js` `/nav-tools.js` `/ai-vibe-loader.js` `/cyre-token-256.png` `/cyre-token-512.png`
— all 200. Then `/api/address?address=5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9`
→ expect `score:24, riskLevel:LOW`. Check served index.html references each script
exactly once. Verify against `cyre.dev/` (root path — `/index.html` redirects).
Mobile-upload gotchas: iOS renames downloads ("file 2.ext"), GitHub web-editor paste
truncates silently, uploads sometimes don't replace — always re-fetch the raw file
after commit and diff.

## 8. CURRENT STATE + OPEN ITEMS (Aug 22 2026)

Live & verified: full glass reskin, vortex, funnel banner, talking Guardian, checker
(capped-age fix settled), score card, tokenomics/roadmap/airdrop/auto pages, clean
URLs, hardened chat API, both crons built (mention-grader in DRY_RUN).
In PR (stacks on polish/professional-quick-wins): AI-vibe theme + Guardian video pop-out + Tools nav + RWA/HUD ticker restyle.
Open before launch: devnet DBC rehearsal (verify 60/25/10/3/2 leftover math),
www.cyre.dev attach, mention-grader DRY_RUN→false after draft review, Anthropic
spend limit + credit top-up (chat in demo mode until then), guardian-voice.mp3,
Vercel Analytics snippet on index.html (only check.html has it), stray root
`address.js` delete (api/address.js is the live one — do not touch).

## 9. AGENT LANES

- **Grok** — creative assets (images/video — proven lane), content drafts, new
  standalone pages ON BRANCHES. Reads this spec first. Never touches api/, crons,
  index.html, or anything in §2.
- **Claude** — deploys, Render/X operations, code review of every PR, launch
  mechanics, this spec's upkeep.
- **@claude (GitHub App)** — tagged in issues/PRs for scoped repo edits once Actions
  is confirmed firing. Point it at exact sections; never let it explore index.html.
- **Founder** — merges, spends, posts. The only human in the loop, and the only one
  who can change §2.
