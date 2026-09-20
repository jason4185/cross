# CROSS frontend

CROSS is a Studio Next frontend for one-hour pooled prediction markets comparing the fixed INDICES basket (SPY, QQQ, IWM) with the fixed FX basket (EURUSD, GBPUSD, USDJPY).

The application reads protocol state from the deployed CROSS contract through the typed adapter in `src/lib/cross/contract.ts`. It uses React Query for refresh/invalidation and the Studio Next Transaction Kit for wallet-confirmed writes.

## Network configuration

Set the deployed address in `.env`:

```text
VITE_CROSS_CONTRACT_ADDRESS=0xA6113D528B144ecA856a704E3331aDD31D12000E
```

The frontend targets Studio Next, chain `61997`, at `https://studio-next.genlayer.com/api`.

## Routes

- `/markets`
- `/markets/$id`
- `/create`
- `/portfolio`
- `/how-it-works`

The root route redirects to `/markets`; unsupported routes use the branded not-found view.

## Development

```bash
bun install
bun run dev
```

Quality checks:

```bash
bunx tsc --noEmit
bun run lint
bun run build
```

Bitget candle data is used only for the informational live chart. Official market state, pools, positions, settlement, evidence, claims, and refunds remain contract-controlled.
