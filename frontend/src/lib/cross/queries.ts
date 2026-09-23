import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "./wallet";
import { crossContract, type CrossWriteCall } from "./contract";
import { useCrossTransactionActivity } from "./transaction-context";
import type {
  Market,
  MarketPage,
  PortfolioPosition,
  Position,
  SourceEvidence,
  BettingState,
  CrossConfig,
} from "./types";

export const crossKeys = {
  config: ["cross", "config"] as const,
  outcomes: ["cross", "outcomes"] as const,
  markets: ["cross", "markets"] as const,
  market: (marketId: number) => ["cross", "market", marketId] as const,
  marketCount: ["cross", "market-count"] as const,
  openMarkets: ["cross", "open-markets"] as const,
  position: (address: string | null, marketId: number) =>
    ["cross", "my-position", address, marketId] as const,
  positions: (address: string | null, offset: number, limit: number) =>
    ["cross", "my-positions", address, offset, limit] as const,
  positionList: (address: string | null, offset: number, limit: number) =>
    ["cross", "my-position-list", address, offset, limit] as const,
  claimable: (address: string | null, offset: number, limit: number) =>
    ["cross", "my-claimable-markets", address, offset, limit] as const,
  bettingState: (address: string | null, marketId: number) =>
    ["cross", "betting-state", address, marketId] as const,
  evidence: (marketId: number, source: string) =>
    ["cross", "source-evidence", marketId, source] as const,
  marketByStart: (marketStartSeconds: number) =>
    ["cross", "market-by-start", marketStartSeconds] as const,
  myMarketCount: (address: string | null) => ["cross", "my-market-count", address] as const,
};

const pageSize = 50;

async function fetchAllMarkets(openOnly = false): Promise<Market[]> {
  const items: Market[] = [];
  let cursor = 0;
  for (let page = 0; page < 21; page += 1) {
    const result: MarketPage = openOnly
      ? await crossContract.getOpenMarkets(cursor, pageSize)
      : await crossContract.getMarkets(cursor, pageSize);
    items.push(...result.items);
    if (!result.hasMore || result.nextCursor <= cursor) break;
    cursor = result.nextCursor;
  }
  return items;
}

async function fetchPortfolio(
  address: string,
  offset: number,
  limit: number,
): Promise<PortfolioPosition[]> {
  const positions = await crossContract.getMyPositions(offset, limit, address);
  return Promise.all(
    positions.map(async (position) => ({
      position,
      market: await crossContract.getMarket(position.marketId),
    })),
  );
}

async function fetchClaimable(
  address: string,
  offset: number,
  limit: number,
): Promise<PortfolioPosition[]> {
  const positions = await crossContract.getMyClaimableMarkets(offset, limit, address);
  return Promise.all(
    positions.map(async (position) => ({
      position,
      market: await crossContract.getMarket(position.marketId),
    })),
  );
}

export function useCrossConfig() {
  return useQuery<CrossConfig>({
    queryKey: crossKeys.config,
    queryFn: () => crossContract.getConfig(),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossOutcomes() {
  return useQuery({
    queryKey: crossKeys.outcomes,
    queryFn: () => crossContract.outcomes(),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossMarkets() {
  const { active } = useCrossTransactionActivity();
  return useQuery({
    queryKey: crossKeys.markets,
    queryFn: () => fetchAllMarkets(),
    staleTime: 30_000,
    refetchInterval: active ? false : 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossOpenMarkets() {
  const { active } = useCrossTransactionActivity();
  return useQuery({
    queryKey: crossKeys.openMarkets,
    queryFn: () => fetchAllMarkets(true),
    staleTime: 30_000,
    refetchInterval: active ? false : 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossMarket(marketId: number) {
  const { active } = useCrossTransactionActivity();
  return useQuery({
    queryKey: crossKeys.market(marketId),
    queryFn: () => crossContract.getMarket(marketId),
    enabled: Number.isSafeInteger(marketId) && marketId > 0,
    staleTime: 30_000,
    refetchInterval: (query) => {
      if (active) return false;
      const market = query.state.data;
      return market &&
        (market.contractState === "OPEN" || market.contractState === "SETTLEMENT_PENDING")
        ? 30_000
        : false;
    },
    refetchOnWindowFocus: false,
  });
}

export function useCrossMarketCount() {
  return useQuery({
    queryKey: crossKeys.marketCount,
    queryFn: () => crossContract.getMarketCount(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossMyPosition(marketId: number) {
  const { address } = useWallet();
  return useQuery<Position>({
    queryKey: crossKeys.position(address, marketId),
    queryFn: () => crossContract.getMyPosition(marketId, address!),
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossMyMarketCount() {
  const { address } = useWallet();
  return useQuery({
    queryKey: crossKeys.myMarketCount(address),
    queryFn: () => crossContract.getMyMarketCount(address!),
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossPortfolio(offset = 0, limit = pageSize) {
  const { address } = useWallet();
  return useQuery<PortfolioPosition[]>({
    queryKey: crossKeys.positions(address, offset, limit),
    queryFn: () => fetchPortfolio(address!, offset, limit),
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossMyPositions(offset = 0, limit = pageSize) {
  const { address } = useWallet();
  return useQuery<Position[]>({
    queryKey: crossKeys.positionList(address, offset, limit),
    queryFn: () => crossContract.getMyPositions(offset, limit, address!),
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossClaimable(offset = 0, limit = pageSize) {
  const { address } = useWallet();
  return useQuery<PortfolioPosition[]>({
    queryKey: crossKeys.claimable(address, offset, limit),
    queryFn: () => fetchClaimable(address!, offset, limit),
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossBettingState(marketId: number) {
  const { address } = useWallet();
  return useQuery<BettingState>({
    queryKey: crossKeys.bettingState(address, marketId),
    queryFn: () => crossContract.getBettingState(marketId, address!),
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossEvidence(marketId: number, source: "GATE" | "BITGET", enabled = true) {
  return useQuery<SourceEvidence | undefined>({
    queryKey: crossKeys.evidence(marketId, source),
    queryFn: () => crossContract.getSourceEvidence(marketId, source),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCrossMarketByStart(marketStartSeconds: number) {
  return useQuery<Market | null>({
    queryKey: crossKeys.marketByStart(marketStartSeconds),
    queryFn: () => crossContract.getMarketByStart(marketStartSeconds),
    enabled: Number.isSafeInteger(marketStartSeconds) && marketStartSeconds > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateCross() {
  const queryClient = useQueryClient();
  const { address } = useWallet();
  return useCallback(
    async (call: CrossWriteCall) => {
      const marketId = typeof call.args[0] === "number" ? call.args[0] : undefined;
      const invalidate = (queryKey: readonly unknown[]) =>
        queryClient.invalidateQueries({ queryKey });
      switch (call.method) {
        case "create_market":
          await Promise.all([
            invalidate(crossKeys.markets),
            invalidate(crossKeys.openMarkets),
            invalidate(crossKeys.marketByStart(Number(call.args[0]))),
          ]);
          break;
        case "place_bet":
          if (marketId === undefined) break;
          await Promise.all([
            invalidate(crossKeys.market(marketId)),
            invalidate(crossKeys.position(address, marketId)),
            invalidate(crossKeys.bettingState(address, marketId)),
            invalidate(crossKeys.positions(address, 0, pageSize)),
            invalidate(crossKeys.positionList(address, 0, pageSize)),
          ]);
          break;
        case "settle_market":
          if (marketId === undefined) break;
          await Promise.all([
            invalidate(crossKeys.market(marketId)),
            invalidate(crossKeys.evidence(marketId, "GATE")),
            invalidate(crossKeys.evidence(marketId, "BITGET")),
            invalidate(crossKeys.claimable(address, 0, pageSize)),
            invalidate(crossKeys.positions(address, 0, pageSize)),
            invalidate(crossKeys.positionList(address, 0, pageSize)),
          ]);
          break;
        case "claim":
        case "claim_refund":
          if (marketId === undefined) break;
          await Promise.all([
            invalidate(crossKeys.market(marketId)),
            invalidate(crossKeys.position(address, marketId)),
            invalidate(crossKeys.claimable(address, 0, pageSize)),
            invalidate(crossKeys.positions(address, 0, pageSize)),
            invalidate(crossKeys.positionList(address, 0, pageSize)),
          ]);
          break;
        default:
          break;
      }
    },
    [address, queryClient],
  );
}
