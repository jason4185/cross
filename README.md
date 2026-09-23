# CROSS

CROSS is a GenLayer prediction market where users stake native GEN on whether
an equal-weighted INDICES or FX basket performs better during an exact one-hour
UTC market window.

## How It Works

Each market compares two fixed baskets:

- **INDICES:** SPY, QQQ, IWM
- **FX:** EURUSD, GBPUSD, USDJPY

Markets can be created only for the next exact UTC hour. Users choose one
outcome and may add to that same side before the market starts. A wallet cannot
switch sides within a market.

The minimum stake is 1 GEN. A wallet's cumulative stake is capped at 70 GEN per
market.

Each market runs from `market_start` through `market_start + 3600` seconds.

## Market Lifecycle

```text
Create → Bet → One-hour market window → Settlement → Claim or refund
```

The contract records markets as `OPEN`, `SETTLEMENT_PENDING`, `SETTLED`, or
`INCONCLUSIVE`. Betting closes when the market starts. After the market ends,
settlement waits through a 60-second candle-finalization grace period. A valid
settlement can be retried until the deadline; unresolved markets become
inconclusive.

## Settlement

Gate and Bitget independently fetch the six exact one-hour candles for the
market window and calculate a complete verdict. Prices and returns are never
mixed between sources. Settlement requires strict 2-of-2 agreement: both
sources must produce the same valid winner.

The basket scores use equal weighting. Normal returns are calculated as
`(close - open) / open`. USDJPY uses `(open / close) - 1`, so positive
performance represents JPY strengthening against USD. Scores are compared with
exact rational arithmetic.

Gate uses `SPY_USDT`, `QQQ_USDT`, and `IWM_USDT` futures candles for INDICES,
plus its TradFi K-line family for `EURUSD`, `GBPUSD`, and `USDJPY`. Bitget uses
`SPYUSDT`, `QQQUSDT`, `IWMUSDT`, `EURUSDUSDT`, `GBPUSDUSDT`, and `USDJPYUSDT`.

If source consensus is unavailable, the market remains pending while retries
are available. The settlement deadline is `settlement_ready + 18000` seconds:
five full hours after the 60-second grace period. A zero-backed winner in a
non-empty pool becomes inconclusive and original stakes are refundable.

Winning users share the total pool in proportion to their winning stake. Payouts
use floor rounding, with the final winning claimant receiving the remaining
pool balance. Inconclusive positions can claim their original stake once.

## Contract

Current Studio Next deployment:

`0xA6113D528B144ecA856a704E3331aDD31D12000E`

This is the current deployment, not a permanent protocol address.

- Network: GenLayer Studio Next
- Chain ID: `61997`
- RPC: `https://studio-next.genlayer.com/api`

### Writes

```text
create_market(market_start)
place_bet(market_id, outcome) payable
settle_market(market_id)
claim(market_id)
claim_refund(market_id)
```

`place_bet` receives the stake as native GEN value. The contract derives the
payout recipient from the transaction sender.

### Reads

```text
get_config()
outcomes()
get_market(market_id)
get_markets(cursor, limit)
get_open_markets(cursor, limit)
get_market_count()
get_my_position(market_id)
get_my_market_count()
get_my_positions(offset, limit)
get_user_positions(user, cursor, limit)
get_my_claimable_markets(offset, limit)
get_market_by_start(market_start)
get_source_evidence(market_id, source)
get_betting_state(market_id)
```

## Running Locally

```bash
cd frontend
bun install
cp .env.example .env
bun run dev
```

Set the local environment variable to the Studio Next deployment you want to
use:

```text
VITE_CROSS_CONTRACT_ADDRESS=0xA6113D528B144ecA856a704E3331aDD31D12000E
```

Do not commit `.env` files.

## Frontend

The frontend uses TanStack Start, React, Tailwind CSS, and GenLayer Transaction
Kit. Its Bitget live chart is informational; official market state, winner,
pools, evidence, claims, and refunds come from the CROSS contract and its Gate
+ Bitget settlement consensus.

## Repository Structure

```text
contracts/
  Cross.py

frontend/

tests/
```
