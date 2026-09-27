# CROSS

CROSS is a GenLayer prediction market for comparing market performance across
traditional and crypto assets. It is one product with multiple market formats,
settled by the deployed contracts and funded with native GEN.

Live app: <https://cross-orcin.vercel.app/>

## What CROSS Does

CROSS currently supports three market formats:

1. **INDICES vs FX** — the original accepted CROSS market.
2. **Crypto UP/DOWN** — whether one crypto asset finishes above or below its
   opening price.
3. **Crypto DOMINANCE** — which asset in a fixed category has the highest
   percentage return.

Markets start at the next exact UTC hour. Betting is pooled and pari-mutuel;
the contract is the source of truth for market state, pools, settlement
evidence, claims, and refunds.

## Markets

### Original CROSS: INDICES vs FX

The accepted `Cross.py` contract compares two fixed baskets over one hour:

- **INDICES:** SPY, QQQ, IWM
- **FX:** EURUSD, GBPUSD, USDJPY

Gate and Bitget independently provide the exact market-window candles. A
strict 2-of-2 agreement is required before a directional winner can settle.

### Milestone Expansion

The accepted CROSS product originally provided one 1-hour INDICES-vs-FX market.
This milestone extends that same product with crypto market primitives and a
second deployed contract module.

#### Crypto UP/DOWN

Supported assets are BTC, ETH, SOL, BNB, XRP, and DOGE. Users choose **UP** or
**DOWN** for a 1-hour or 2-hour market window:

- `close > open` → UP
- `close < open` → DOWN
- `close == open` → source TIE

TIE is a settlement-source result, not a user betting choice.

#### Crypto DOMINANCE

Users choose the asset with the highest exact percentage return in one of two
fixed categories:

- **MAJORS:** BTC, ETH, SOL
- **LARGE_CAP_ALTS:** BNB, XRP, DOGE

Each source evaluates all three assets independently. The return is
`(close - open) / open`, compared with exact rational arithmetic. This handles
positive, mixed, and all-negative returns; when every return is negative, the
least-negative return is highest. An exact tie for the highest return is a
source TIE.

Crypto markets support exactly `3600`-second (1H) and `7200`-second (2H)
durations.

### What Changed

| Accepted CROSS | Milestone CROSS |
| --- | --- |
| One market format | Three market formats |
| INDICES vs FX | INDICES vs FX plus crypto UP/DOWN and DOMINANCE |
| One-hour window | 1H and 2H crypto windows |
| Six traditional/FX instruments | Six crypto assets and two fixed crypto categories |
| Gate + Bitget settlement | Binance + Gate + Bitget crypto settlement |
| One contract/frontend path | Two contracts presented through one CROSS frontend |

The expansion adds new market structures, source-consensus logic, exact 2H
window construction, source-aware routing, unified creation, and a portfolio
that can represent positions from both contracts without market-ID collisions.

## How Settlement Works

### Crypto source evidence

`CrossCrypto.py` uses Binance, Gate, and Bitget market/trading USDT-futures
candles. Each source fetches and validates its own complete evidence; prices
are never mixed between sources.

For a 1H market, settlement uses the exact 1H candle starting at the market
start. For a 2H market, the contract does not use a native 2H candle. It
retrieves exactly two consecutive 1H candles, at `T` and `T + 1 hour`, and
uses:

```text
official open  = first candle open
official close = second candle close
```

The optimized path retrieves both required 1H candles in one bounded request
per asset and source while still validating both exact timestamps.

Crypto settlement requires two of the three source results to agree on the
same user-resolvable outcome. If consensus is unavailable, the market remains
`SETTLEMENT_PENDING` while retries are available. At the deadline it becomes
`INCONCLUSIVE`. A zero-backed consensus winner also becomes inconclusive.

The crypto lifecycle is:

```text
OPEN → SETTLEMENT_PENDING → SETTLED
                         ↘ INCONCLUSIVE
```

Settlement becomes ready after the market end plus a 60-second candle-finality
grace period. The retry window is 18,000 seconds after `settlement_ready`.
Inconclusive positions can receive their original stakes back.

### Betting and payouts

For crypto markets:

- Minimum initial position: **1 GEN**
- Maximum cumulative position per wallet per market: **70 GEN**
- Same-side top-ups: allowed
- Switching sides: blocked
- Protocol fee: `0`
- Payouts: pari-mutuel with floor rounding

The final winning claimant receives the remaining pool balance so rounding
remainder is not trapped. Claims and refunds are sender-only contract writes.

## Architecture

The accepted `Cross.py` contract remains unchanged. The crypto expansion lives
in `CrossCrypto.py` because it introduces different market structures and
settlement requirements while the accepted contract is already near the
GenLayer contract-size ceiling.

```text
CROSS frontend
├── Cross.py
│   └── INDICES vs FX
└── CrossCrypto.py
    ├── Crypto UP/DOWN
    └── Crypto DOMINANCE
```

Both contracts are presented as one CROSS product. Their independent market
counters are kept distinct in the frontend through source-aware identities and
routes such as `/markets/cross/1` and `/markets/crypto/1`.

## Frontend

The same frontend provides:

- `/markets` — unified markets page
- `/create` — unified creation flow for all three formats
- `/portfolio` — positions aggregated from both contracts
- `/how-it-works` — protocol and settlement explanation

The Create page uses `Cross.py` for INDICES vs FX and `CrossCrypto.py` for
crypto UP/DOWN or DOMINANCE. All formats use the next exact UTC-hour start
required by their contract.

## Deployed Contracts

| Component | Address |
| --- | --- |
| CROSS — INDICES vs FX | `0xA6113D528B144ecA856a704E3331aDD31D12000E` |
| CROSS — Crypto Markets | `0x1bDc533e16A78c853bF1Bd9C8B2eCbCcFD593b75` |

- Network: GenLayer Studio Next
- Chain ID: `61997`
- RPC: <https://studio-next.genlayer.com/api>
- Explorer: <https://explorer-studio-dev.genlayer.com/>

## Milestone Progress

Verified:

- `CrossCrypto.py` is deployed on Studio Next.
- Both deployed contracts are readable from the production frontend.
- The production frontend is wired to both contracts.
- A real crypto market was created through the frontend.
- A real crypto GEN bet was placed through the frontend.

Not yet manually verified end-to-end:

- Live crypto settlement after the created market closes.
- Post-settlement source-evidence verification.
- A real crypto claim or refund following that settlement.

Automated and direct contract checks are separate from this pending live
lifecycle verification.

## Run Locally

```bash
cd frontend
bun install
cp .env.example .env
bun run dev
```

Set both deployed addresses when using the milestone deployment:

```text
VITE_CROSS_CONTRACT_ADDRESS=0xA6113D528B144ecA856a704E3331aDD31D12000E
VITE_CROSS_CRYPTO_CONTRACT_ADDRESS=0x1bDc533e16A78c853bF1Bd9C8B2eCbCcFD593b75
```

The frontend targets Studio Next, chain `61997`, at
`https://studio-next.genlayer.com/api`. Do not commit `.env` files.

## Verify

From `frontend/`:

```bash
bunx tsc --noEmit
bun run test:integration
bun run lint
bun run build
```

The live application and deployed contracts remain the authoritative source
for current runtime state.

## Repository Structure

```text
contracts/
  Cross.py
  CrossCrypto.py
docs/
  crypto-milestone.md
frontend/
```

See [the crypto milestone review document](docs/crypto-milestone.md) for the
accepted baseline, milestone delta, deployment details, and verification
status.
