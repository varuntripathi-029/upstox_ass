# Tax & Cost Insights — a concept for Upstox

**Know what you keep, before you sell.**

A product case study with a working demo, built for the Upstox Developer API assignment: *build a small feature using Upstox Developer APIs that is useful, interesting or cool*. The answer here is a **decision layer on top of the reports Upstox already has** — useful to anyone who sells, because everyone pays tax and charges.

> Not an official Upstox product. Estimates only, not tax advice.

---

## The problem

Upstox already gives users the raw facts: Ledger, P&L, Dividend, Tax, Holdings and Trade reports, all in **Funds → Reports**. They are **records of the past** — downloads you read at ITR time. None of them answer the questions an investor has **before acting**:

- *If I sell this today, how much tax do I pay? What if I wait?*
- *How much of my profit do I actually keep, after tax **and** charges?*
- *Am I wasting my ₹1.25L tax-free limit this year?*
- *Are ₹20-per-order charges eating my small trades?*
- *My income is under ₹12L, so my stock gains are tax-free, right?* (No — the Section 156 rebate does not cover tax on stock gains.)

Upstox's own newsroom (29 Jul 2026) reports tax experts saying first-time investors struggle with LTCG reporting: they confuse short- and long-term gains, pick the wrong ITR form, and assume the ₹1.25L exemption means no filing is needed — *"a false sense of safety"*.

The result: people sell a few days before a holding turns long-term, waste a tax-free limit that resets every 1 April, and never notice charges eating their returns.

## What it does

Five things, in the places users already look:

1. **Tax if you sold today**, on every holding — with the date it turns long-term and the rupees waiting would save.
2. **You actually keep ₹X**: gains − tax − charges, not just after-charges P&L.
3. **The ₹1.25L limit tracker**: used, left, and the exact quantity you can sell today at zero tax (gain harvesting).
4. **Charges you can act on**: as a share of your gains, and by order size — where a flat ₹20 hurts.
5. **Warnings that matter**: the Section 156 rebate trap, the unused basic exemption, advance-tax dates, and the right ITR form.

For mutual funds it adds the SIP view: **every instalment is its own lot with its own 12-month clock**, FIFO redemptions explained lot by lot, how much can be withdrawn today at ₹0 tax, and an **ELSS unlock timeline** (3-year lock-in, per instalment).

## Building on what Upstox already ships

Upstox launched **tax-loss harvesting** (downloadable Mar 2025, in-app Mar 2026). This concept deliberately **does not rebuild it** — loss insights hand off to the Upstox TLH page. TLH handles the 31 March moment; Tax & Cost Insights handles the other eleven months, before every sell.

What is new (no public evidence of these at Upstox, Zerodha or Groww for stocks): days-to-long-term with the rupee value of waiting, tax if sold today on unsold holdings, keep-after-tax-and-charges, the ₹1.25L used/left tracker outside a report, **gain** harvesting, charges as a share of gains and by order size, the Section 156 warning, advance tax computed from your own trades, a lot-level view (which Upstox users asked for in TLH), SIP lot splitting and the ELSS unlock tracker.

## Where it would live

Inside Upstox web, not as a separate app: chips on the **Holdings** rows, and a new **Tax & cost insights** card in **Funds → Reports**, next to the existing Tax and P&L reports — the same place the tax-loss harvesting entry point sits.

## The demo

`/` is the case-study page with an Upstox-web-style frame around a live engine: every number is computed from raw trades by a pure TypeScript tax engine, not hard-coded. `/debug` shows the engine's output as plain tables.

Six seed personas, each proving a different rule:

| Persona | What it shows |
|---|---|
| **Priya** — salaried ₹9L | The Section 156 trap; wait 23 days, save ₹1,872; charges at 8% of gains |
| **Arjun** — student, no other income | The unused ₹4L basic exemption makes short-term gains tax-free |
| **Meera** — investor, ₹18L | The ₹1.25L limit nearly used; gain harvesting down to the exact share count |
| **Rohit** — small active trader | Charges taking more than a third of gains |
| **Kabir** — intraday + F&O | Slab-rate trading income, ITR-3, advance-tax instalments, STT |
| **Neha** — SIP investor | 66 SIP lots with their own clocks, FIFO redemption, ELSS unlock dates |

You can also change **today's date**, edit the settings (income, regime, other gains), **simulate a sell**, add or edit trades, and reset. Everything recalculates. There is no database: personas are bundled JSON and edits live in the browser's local storage (the demo works with storage blocked).

## About the APIs

The app supports multiple data sources, switchable in the UI:

**1. Live now, no token.** Two public Upstox instrument files, downloaded, gunzipped and filtered **server-side** (they are megabytes; only the demo's rows reach the browser):

| Purpose | Source |
|---|---|
| Current NAV and `scheme_type` (EQUITY / ELSS / DEBT) per fund | `assets.upstox.com/…/mf-instruments.json.gz` |
| `instrument_key`, ISIN, trading symbol, tick size | `assets.upstox.com/…/NSE.json.gz` |

**2. Live with an optional Analytics Token or Session Login** (read-only, GET-only; none of these need a static IP):

| Purpose | Endpoint |
|---|---|
| Current prices for "tax if sold today" | `GET /v3/market-quote/ltp` |
| Real cost to sell and buy back (harvest panel) | `GET /v2/charges/brokerage` |
| 31-Jan-2018 price for grandfathered cost | `GET /v3/historical-candle/{key}/days/1/{to}/{from}` |
| Splits, bonuses, dividends | `GET /v2/fundamentals/{isin}/corporate-actions` |

Without a token these four routes answer **501** and the UI falls back silently to cached values, tagged *"Using cached values"*.

**3. Account APIs (Recorded or Live via OAuth)**:
Because this is a **personal developer app**, OAuth login is limited to the app owner only. Additionally, because the owner's demat account is inactive (returns empty), the app gracefully handles empty states by displaying the sample data below an empty-state warning. The recorded responses ensure the demo works without login using the exact real mapping code:

| Purpose | Endpoint |
|---|---|
| Holdings | `GET /v2/portfolio/long-term-holdings` |
| Trade history incl. MF (3 FYs) | `GET /v2/charges/historical-trades?segment=EQ\|FO\|COM\|CD\|MF` |
| Realized P&L | `GET /v2/trade/profit-loss/data` |
| Trade charges | `GET /v2/trade/profit-loss/charges` |
| MF holdings & SIPs | `GET /v2/mf/holdings`, `GET /v2/mf/sips` |


Two things worth knowing, both verified against the docs and handled in the mapping:

- **MF trade `quantity` is an integer**, so units come from `amount ÷ price` (the docs' own example: 999.9852 ÷ 71.9 = 13.908 units, reported as 13).
- **Charges are reported per segment and financial year, not per trade**, so account mode allocates the aggregate across that year's trades (brokerage per order, STT and fees by value, stamp duty over buys, DP over sells, GST over its base) and the parts add back up exactly.

Every live number carries a source tag: *"NAV from Upstox · 20 Sep"*, *"Price from Upstox · 15:21 IST"* or *"Using cached values"*.

All Upstox calls run in serverless functions under `/api/upstox/*` — GET only, with validated parameters and CDN caching (12h for NAVs, 24h for instrument files and static history, 60s for quotes). **The token is read inside the function and never reaches the browser, a URL or a log.**

## The tax engine

Pure TypeScript, no network, no React: money in integer paise, dates in `Asia/Kolkata`, FIFO lots rebuilt from raw trades. It implements 25 rules with their sources in comments — 12.5% / 20% equity rates and the ₹1.25L shared limit, 4% cess, the Section 156 rebate, the unused basic exemption, loss set-off, same-day trades as intraday, F&O and intraday at slab rates via a marginal-tax delta, STT, ICAI turnover, grandfathered cost (31 Jan 2018 FMV), splits and bonuses, MF stamp duty of 0.005%, and the ELSS 3-year lock-in per instalment. Long-term means **held more than 12 months**, so the first long-term day is the day after the 12-month anniversary — leap years included.

158 tests cover a worked example per rule, every figure in the case study, the persona seeds, the API mapping and the live/fallback paths. Tests never hit the network.

## Run

```bash
npm install
npm run dev      # http://localhost:5173 — app plus the /api routes via a dev-only plugin
npm test         # Vitest
npm run build
vercel dev       # runs the /api routes exactly as production does
```

Node 24.x (see `engines`). Deploys to Vercel as a plain Vite app; `vercel.json` rewrites everything except `/api` to the SPA.

## Environment

```bash
cp .env.example .env.local   # git-ignored
```

One optional variable, `UPSTOX_ANALYTICS_TOKEN`. Leave it empty and everything still works: sample data, plus live NAVs and instrument data from the public files. Paste a read-only Analytics Token (Upstox Developer Apps → Analytics) to also enable live prices, brokerage, the 2018 candle and corporate actions.

On Vercel: Settings → Environment Variables → add `UPSTOX_ANALYTICS_TOKEN` → redeploy.

## Layout

| Path | What |
|---|---|
| `src/engine/` | The tax engine: rules, FIFO ledger, buckets, metrics, strategies, MF lots. Pure, tested, no network. |
| `src/sample/` | Six personas as raw engine inputs, NSE holidays, cached NAVs. |
| `src/upstox/` | The Upstox layer: response types, gz filters, mapping into the engine, recorded responses, browser client. |
| `api/upstox/` | Six serverless GET routes (two public, four token-gated). |
| `src/demo/` | The Upstox-style frame, views, strategy panels, sell simulator, date control, trade editor, data-source switch. |
| `src/case/` | The case-study page around the demo. |
| `scripts/` | Data generation: NAV cache, persona build, recorded responses. |

---

Built as a PM case study by Varun Tripathi. Not affiliated with or endorsed by Upstox.
