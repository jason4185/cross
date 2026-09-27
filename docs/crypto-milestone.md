# CROSS Crypto Market Expansion

## Accepted Baseline

CROSS was accepted as a GenLayer prediction market for one exact 1-hour UTC
market format: **INDICES vs FX**.

The original `Cross.py` contract compares:

- **INDICES:** SPY, QQQ, IWM
- **FX:** EURUSD, GBPUSD, USDJPY

Gate and Bitget independently provide the source evidence, and strict 2-of-2
agreement is required for settlement. That accepted contract remains
unchanged.

## Milestone Delta

This milestone extends the same CROSS product with two crypto market formats:

### Crypto UP/DOWN

Users predict whether BTC, ETH, SOL, BNB, XRP, or DOGE finishes UP or DOWN
over an exact 1-hour or 2-hour window. A source reports UP when `close > open`,
DOWN when `close < open`, and TIE when the values are equal. TIE is not a
user-selectable outcome.

### Crypto DOMINANCE

Users predict which asset has the highest percentage return in a fixed basket:

- **MAJORS:** BTC, ETH, SOL
- **LARGE_CAP_ALTS:** BNB, XRP, DOGE

Each source evaluates all three assets. Returns are `(close - open) / open`
and are ranked with exact rational comparison rather than rounded display
percentages. The least-negative return wins when all assets fall, while an
exact highest-return tie produces a source TIE.

The result is one CROSS product with:

- three market formats instead of one;
- 1H and 2H crypto windows;
- six crypto assets and two fixed dominance categories;
- Binance, Gate, and Bitget crypto source settlement;
- strict 2-of-3 consensus;
- a second deployed contract module;
- one frontend with unified creation, markets, portfolio, evidence, claim,
  and refund flows; and
- source-aware market identities and routes so independent contract IDs cannot
  collide.

## New Contract

The crypto expansion is implemented in `contracts/CrossCrypto.py`.

Deployed address:

```text
0x1bDc533e16A78c853bF1Bd9C8B2eCbCcFD593b75
```

The accepted contract remains:

```text
0xA6113D528B144ecA856a704E3331aDD31D12000E
```

The second contract preserves the accepted deployment while providing the
additional market structures and settlement evidence required by the crypto
milestone.

## Settlement Upgrade

Crypto settlement uses comparable USDT-futures market candles from:

- Binance
- Gate
- Bitget

Each source independently fetches the complete required evidence. A source
result is not assembled from prices belonging to another source. Two matching
source results are required for a user-resolvable settlement outcome.

For 1H markets, the source must use the exact 1H candle beginning at the
market start.

For 2H markets, the contract does not use a native exchange 2H candle. It
retrieves exactly two consecutive 1H candles at `T` and `T + 1 hour`:

```text
official open  = candle T open
official close = candle T + 1 hour close
```

The optimized implementation retrieves both required candles in one bounded
request per asset/source and still validates both exact timestamps.

The lifecycle is `OPEN`, `SETTLEMENT_PENDING`, `SETTLED`, or
`INCONCLUSIVE`. Settlement waits for market end plus a 60-second grace period,
then remains retryable for 18,000 seconds after `settlement_ready`. If the
deadline arrives without 2-of-3 consensus, the market becomes inconclusive and
original stakes are refundable. A consensus winner with zero backing is also
inconclusive.

## Frontend Integration

The existing CROSS frontend presents both contracts as one product:

- `/markets` shows both traditional and crypto markets.
- `/create` provides INDICES vs FX, crypto UP/DOWN, and crypto DOMINANCE
  creation flows.
- `/portfolio` aggregates positions from both contracts.
- `/how-it-works` explains the combined protocol.

Market details use source-aware routes such as:

```text
/markets/cross/<id>
/markets/crypto/<id>
```

This is necessary because each contract has its own market counter. The
frontend does not calculate crypto settlement winners; it displays the
contract-authoritative state, pools, source evidence, claims, and refunds.

All creation flows use the next exact UTC-hour start required by the relevant
contract.

## Deployment

| Component | Address |
| --- | --- |
| CROSS — INDICES vs FX | `0xA6113D528B144ecA856a704E3331aDD31D12000E` |
| CROSS — Crypto Markets | `0x1bDc533e16A78c853bF1Bd9C8B2eCbCcFD593b75` |

- Network: GenLayer Studio Next
- Chain ID: `61997`
- RPC: <https://studio-next.genlayer.com/api>
- Explorer: <https://explorer-studio-dev.genlayer.com/>
- Live app: <https://cross-orcin.vercel.app/>
- Repository: <https://github.com/jason4185/cross>

## Verification

Currently verified:

- `CrossCrypto.py` is deployed on Studio Next.
- Both deployed contracts are readable from production.
- The production frontend is integrated with both contract addresses.
- Live end-to-end verification has now covered crypto market creation, GEN bet
  placement, contract settlement, post-settlement result display, and claim
  through the production CROSS frontend.

Refund behavior is implemented and covered by contract/frontend logic, but has
not yet been manually exercised in the live production flow.

Automated/direct contract checks remain separate from the live lifecycle
verification described above.

## Why This Is a Milestone

This work extends the accepted CROSS product with additional market
primitives, crypto source-consensus logic, exact 1H/2H duration handling, a
new deployed contract module, and complete integration into the existing
frontend. It is a CROSS expansion, not a separate prediction-market product.
