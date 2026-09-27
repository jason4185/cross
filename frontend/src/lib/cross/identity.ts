import type { CryptoAsset, CryptoMarketType, MarketSource } from "./types";

export function marketIdentityKey(source: MarketSource, marketId: number) {
  return `${source}:${marketId}`;
}

export function marketRoute(source: MarketSource, marketId: number) {
  return `/markets/${source === "CROSS" ? "cross" : "crypto"}/${marketId}`;
}

export function cryptoAllowedOutcomes(
  type: CryptoMarketType,
  subject: string,
): CryptoAsset[] | ["UP", "DOWN"] {
  if (type === "UP_DOWN") return ["UP", "DOWN"];
  return subject === "MAJORS" ? ["BTC", "ETH", "SOL"] : ["BNB", "XRP", "DOGE"];
}

export function validStake(
  amount: bigint,
  minimum: bigint,
  currentStake: bigint,
  maximum: bigint,
  balance: bigint | null,
) {
  const remaining = maximum > currentStake ? maximum - currentStake : 0n;
  return (
    amount > 0n &&
    amount <= remaining &&
    (currentStake > 0n || amount >= minimum) &&
    (balance === null || amount <= balance)
  );
}
