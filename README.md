# CROSS

CROSS is a GenLayer prediction market where users stake GEN on whether an equal-weighted Indices or FX basket performs better over an exact one-hour UTC window.

## Market

INDICES:

- SPY
- QQQ
- IWM

FX:

- EURUSD
- GBPUSD
- USDJPY

USDJPY is direction-normalized so positive performance represents JPY strengthening against USD.

The current contract allows creation for the next exact UTC-hour window. Market duration and basket composition are fixed by the CROSS V1 contract.

## Settlement

- Gate and Bitget independently produce complete source verdicts.
- Settlement requires strict 2-of-2 consensus.
- A 60-second candle finalization grace follows market end.
- The settlement retry period is five hours after `settlement_ready`.

The frontend Bitget live chart is informational only. Official market state, winner, pools, evidence, claims, and refunds are determined by the contract's Gate + Bitget consensus.

## Project structure

```text
contracts/
frontend/
tests/
```

## Frontend

The frontend uses:

- TanStack Start
- React
- Tailwind CSS
- GenLayer Transaction Kit
- Bitget live market-data visualization

## Network

- Network: Studio Next
- Chain ID: 61997
- RPC: `https://studio-next.genlayer.com/api`

Current Studio Next deployment:

`0xA6113D528B144ecA856a704E3331aDD31D12000E`

This address is the current deployment and is not a permanent protocol address.

## Local development

```bash
cd frontend
bun install
bun run dev
```

Copy the example environment file and set the deployed contract address:

```bash
cp .env.example .env
```

Then set `VITE_CROSS_CONTRACT_ADDRESS` to the address for the Studio Next deployment you want to use. Do not commit `.env` files.
