# CROSS frontend

This is the single Studio Next frontend for the CROSS product. It reads and
writes both deployed CROSS contracts:

- `Cross.py` for the original INDICES vs FX market.
- `CrossCrypto.py` for crypto UP/DOWN and DOMINANCE markets.

The frontend keeps contract state authoritative and uses source-aware market
identities so equal market IDs from the two contracts cannot collide.

## Network configuration

Set both deployed addresses in `.env`:

```text
VITE_CROSS_CONTRACT_ADDRESS=0xA6113D528B144ecA856a704E3331aDD31D12000E
VITE_CROSS_CRYPTO_CONTRACT_ADDRESS=0x1bDc533e16A78c853bF1Bd9C8B2eCbCcFD593b75
```

The frontend targets GenLayer Studio Next, chain `61997`, at
`https://studio-next.genlayer.com/api`.

## Routes

- `/markets`
- `/markets/cross/$id`
- `/markets/crypto/$id`
- `/create`
- `/portfolio`
- `/how-it-works`

The root route redirects to `/markets`; unsupported routes use the branded
not-found view.

## Development

```bash
bun install
bun run dev
```

Quality checks:

```bash
bunx tsc --noEmit
bun run test:integration
bun run lint
bun run build
```

External chart data is informational only. Official market state, pools,
positions, settlement, evidence, claims, and refunds remain contract-
controlled.
