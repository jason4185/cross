import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cryptoContract } from "./crypto-contract";
import { useWallet } from "./wallet";
import { crossContract, type CrossWriteCall } from "./contract";
import { useCrossTransactionActivity } from "./transaction-context";
import type {
  BettingState,
  CrossConfig,
  CryptoConfig,
  CryptoMarketType,
  Market,
  MarketPage,
  MarketSource,
  PortfolioPosition,
  Position,
  SourceEvidence,
  SourceName,
} from "./types";

export const pageSize = 50;
export const crossKeys = {
  config: ["config", "CROSS"] as const,
  outcomes: ["outcomes", "CROSS"] as const,
  markets: ["markets", "CROSS"] as const,
  market: (id: number) => ["market", "CROSS", id] as const,
  marketCount: ["market-count", "CROSS"] as const,
  openMarkets: ["open-markets", "CROSS"] as const,
  position: (address: string | null, id: number) => ["position", "CROSS", address, id] as const,
  positions: (address: string | null, offset: number, limit: number) =>
    ["positions", "CROSS", address, offset, limit] as const,
  positionList: (address: string | null, offset: number, limit: number) =>
    ["position-list", "CROSS", address, offset, limit] as const,
  claimable: (address: string | null, offset: number, limit: number) =>
    ["claimable", "CROSS", address, offset, limit] as const,
  bettingState: (address: string | null, id: number) =>
    ["betting-state", "CROSS", address, id] as const,
  evidence: (id: number, source: string) => ["evidence", "CROSS", id, source] as const,
  marketByStart: (start: number) => ["market-by-start", "CROSS", start] as const,
};
export const cryptoKeys = {
  config: ["config", "CRYPTO"] as const,
  markets: ["markets", "CRYPTO"] as const,
  market: (id: number) => ["market", "CRYPTO", id] as const,
  marketCount: ["market-count", "CRYPTO"] as const,
  openMarkets: ["open-markets", "CRYPTO"] as const,
  position: (address: string | null, id: number) => ["position", "CRYPTO", address, id] as const,
  positions: (address: string | null, offset: number, limit: number) =>
    ["positions", "CRYPTO", address, offset, limit] as const,
  positionList: (address: string | null, offset: number, limit: number) =>
    ["position-list", "CRYPTO", address, offset, limit] as const,
  claimable: (address: string | null, offset: number, limit: number) =>
    ["claimable", "CRYPTO", address, offset, limit] as const,
  bettingState: (address: string | null, id: number) =>
    ["betting-state", "CRYPTO", address, id] as const,
  evidence: (id: number, source: string) => ["evidence", "CRYPTO", id, source] as const,
  identity: (type: CryptoMarketType, subject: string, duration: number, start: number) =>
    ["market-identity", "CRYPTO", type, subject, duration, start] as const,
};
function keys(source: MarketSource) {
  return source === "CROSS" ? crossKeys : cryptoKeys;
}

async function fetchAllMarkets(source: MarketSource, openOnly = false): Promise<Market[]> {
  const items: Market[] = [];
  let cursor = 0;
  for (let page = 0; page < 21; page += 1) {
    const result: MarketPage =
      source === "CROSS"
        ? openOnly
          ? await crossContract.getOpenMarkets(cursor, pageSize)
          : await crossContract.getMarkets(cursor, pageSize)
        : openOnly
          ? await cryptoContract.getOpenMarkets(cursor, pageSize)
          : await cryptoContract.getMarkets(cursor, pageSize);
    items.push(...result.items);
    if (!result.hasMore || result.nextCursor <= cursor) break;
    cursor = result.nextCursor;
  }
  return items;
}
async function fetchPortfolio(
  source: MarketSource,
  address: string,
  offset: number,
  limit: number,
  claimable = false,
): Promise<PortfolioPosition[]> {
  let positions: Position[];
  if (source === "CROSS") {
    positions = claimable
      ? await crossContract.getMyClaimableMarkets(offset, limit, address)
      : await crossContract.getMyPositions(offset, limit, address);
  } else {
    positions = [];
    let cursor = offset;
    for (let page = 0; page < 21; page += 1) {
      const result = claimable
        ? await cryptoContract.getMyClaimableMarkets(cursor, limit, address)
        : await cryptoContract.getMyPositions(cursor, limit, address);
      positions.push(...result.items);
      if (!result.hasMore || result.nextOffset <= cursor) break;
      cursor = result.nextOffset;
    }
  }
  const getMarket = source === "CROSS" ? crossContract.getMarket : cryptoContract.getMarket;
  return Promise.all(
    positions.map(async (position) => ({
      source,
      position: { ...position, source },
      market: await getMarket(position.marketId),
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
export function useCryptoConfig() {
  return useQuery<CryptoConfig>({
    queryKey: cryptoKeys.config,
    queryFn: () => cryptoContract.getConfig(),
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
function useSourceMarkets(source: MarketSource) {
  const { active } = useCrossTransactionActivity();
  const sourceKeys = keys(source);
  return useQuery({
    queryKey: sourceKeys.markets,
    queryFn: () => fetchAllMarkets(source),
    staleTime: 30_000,
    refetchInterval: active ? false : 30_000,
    refetchOnWindowFocus: false,
  });
}
export function useCrossMarkets() {
  return useSourceMarkets("CROSS");
}
export function useCryptoMarkets() {
  return useSourceMarkets("CRYPTO");
}
export function useCrossOpenMarkets() {
  return useQuery({
    queryKey: crossKeys.openMarkets,
    queryFn: () => fetchAllMarkets("CROSS", true),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
export function useAllMarkets() {
  const cross = useCrossMarkets();
  const crypto = useCryptoMarkets();
  return {
    data: cross.data && crypto.data ? [...cross.data, ...crypto.data] : undefined,
    isLoading: cross.isLoading || crypto.isLoading,
    isFetching: cross.isFetching || crypto.isFetching,
    error: cross.error ?? crypto.error,
    refetch: async () => {
      await Promise.all([cross.refetch(), crypto.refetch()]);
    },
    cross,
    crypto,
  };
}
export function useMarket(source: MarketSource, id: number) {
  const { active } = useCrossTransactionActivity();
  const sourceKeys = keys(source);
  return useQuery({
    queryKey: sourceKeys.market(id),
    queryFn: () =>
      source === "CROSS" ? crossContract.getMarket(id) : cryptoContract.getMarket(id),
    enabled: Number.isSafeInteger(id) && id > 0,
    staleTime: 30_000,
    refetchInterval: (query) =>
      active
        ? false
        : query.state.data &&
            (query.state.data.contractState === "OPEN" ||
              query.state.data.contractState === "SETTLEMENT_PENDING")
          ? 30_000
          : false,
    refetchOnWindowFocus: false,
  });
}
export function useCrossMarket(id: number) {
  return useMarket("CROSS", id);
}
export function useCryptoMarket(id: number) {
  return useMarket("CRYPTO", id);
}
export function useCrossMarketCount() {
  return useQuery({
    queryKey: crossKeys.marketCount,
    queryFn: () => crossContract.getMarketCount(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
export function useCryptoMarketCount() {
  return useQuery({
    queryKey: cryptoKeys.marketCount,
    queryFn: () => cryptoContract.getMarketCount(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
export function usePosition(source: MarketSource, id: number) {
  const { address } = useWallet();
  const sourceKeys = keys(source);
  return useQuery<Position>({
    queryKey: sourceKeys.position(address, id),
    queryFn: () =>
      source === "CROSS"
        ? crossContract.getMyPosition(id, address!)
        : cryptoContract.getMyPosition(id, address!),
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
export function useCrossMyPosition(id: number) {
  return usePosition("CROSS", id);
}
export function useMyPosition(source: MarketSource, id: number) {
  return usePosition(source, id);
}
function usePortfolioQuery(
  source: MarketSource,
  claimable: boolean,
  offset: number,
  limit: number,
) {
  const { address } = useWallet();
  const sourceKeys = keys(source);
  const key = claimable ? sourceKeys.claimable : sourceKeys.positions;
  return useQuery<PortfolioPosition[]>({
    queryKey: key(address, offset, limit),
    queryFn: () => fetchPortfolio(source, address!, offset, limit, claimable),
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
export function useCrossPortfolio(offset = 0, limit = pageSize) {
  return usePortfolioQuery("CROSS", false, offset, limit);
}
export function useCryptoPortfolio(offset = 0, limit = pageSize) {
  return usePortfolioQuery("CRYPTO", false, offset, limit);
}
export function useCrossClaimable(offset = 0, limit = pageSize) {
  return usePortfolioQuery("CROSS", true, offset, limit);
}
export function useCryptoClaimable(offset = 0, limit = pageSize) {
  return usePortfolioQuery("CRYPTO", true, offset, limit);
}
export function useAllPortfolio(offset = 0, limit = pageSize) {
  const cross = useCrossPortfolio(offset, limit);
  const crypto = useCryptoPortfolio(offset, limit);
  return {
    data: cross.data && crypto.data ? [...cross.data, ...crypto.data] : undefined,
    isLoading: cross.isLoading || crypto.isLoading,
    isFetching: cross.isFetching || crypto.isFetching,
    error: cross.error ?? crypto.error,
    refetch: async () => {
      await Promise.all([cross.refetch(), crypto.refetch()]);
    },
  };
}
export function useAllClaimable(offset = 0, limit = pageSize) {
  const cross = useCrossClaimable(offset, limit);
  const crypto = useCryptoClaimable(offset, limit);
  return {
    data: cross.data && crypto.data ? [...cross.data, ...crypto.data] : undefined,
    isLoading: cross.isLoading || crypto.isLoading,
    isFetching: cross.isFetching || crypto.isFetching,
    error: cross.error ?? crypto.error,
    refetch: async () => {
      await Promise.all([cross.refetch(), crypto.refetch()]);
    },
  };
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
export function useBettingState(source: MarketSource, id: number) {
  const { address } = useWallet();
  const sourceKeys = keys(source);
  return useQuery<BettingState>({
    queryKey: sourceKeys.bettingState(address, id),
    queryFn: () =>
      source === "CROSS"
        ? crossContract.getBettingState(id, address!)
        : cryptoContract.getBettingState(id, address!),
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
export function useCrossBettingState(id: number) {
  return useBettingState("CROSS", id);
}
export function useEvidence(
  source: MarketSource,
  id: number,
  sourceName: SourceName,
  enabled = true,
) {
  const sourceKeys = keys(source);
  return useQuery<SourceEvidence | undefined>({
    queryKey: sourceKeys.evidence(id, sourceName),
    queryFn: () =>
      source === "CROSS"
        ? crossContract.getSourceEvidence(id, sourceName as "GATE" | "BITGET")
        : cryptoContract.getSourceEvidence(id, sourceName),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
export function useCrossEvidence(id: number, source: "GATE" | "BITGET", enabled = true) {
  return useEvidence("CROSS", id, source, enabled);
}
export function useMarketByStart(start: number) {
  return useQuery<Market | null>({
    queryKey: crossKeys.marketByStart(start),
    queryFn: () => crossContract.getMarketByStart(start),
    enabled: Number.isSafeInteger(start) && start > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
export function useCrossMarketByStart(start: number) {
  return useMarketByStart(start);
}
export function useCryptoMarketByIdentity(
  type: CryptoMarketType,
  subject: string,
  duration: 3600 | 7200,
  start: number,
) {
  return useQuery<Market | null>({
    queryKey: cryptoKeys.identity(type, subject, duration, start),
    queryFn: () => cryptoContract.getMarketByIdentity(type, subject, duration, start),
    enabled: Number.isSafeInteger(start) && start > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
export function useInvalidateCross() {
  const queryClient = useQueryClient();
  const { address } = useWallet();
  return useCallback(
    async (call: CrossWriteCall) => {
      const source = call.source ?? "CROSS";
      const sourceKeys = keys(source);
      const id = typeof call.args[0] === "number" ? call.args[0] : undefined;
      if (
        call.method === "create_market" ||
        call.method === "create_up_down_market" ||
        call.method === "create_dominance_market"
      ) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: sourceKeys.markets }),
          queryClient.invalidateQueries({ queryKey: sourceKeys.openMarkets }),
        ]);
        return;
      }
      if (id === undefined) return;
      const evidenceSources =
        source === "CRYPTO" ? ["BINANCE", "GATE", "BITGET"] : ["GATE", "BITGET"];
      const pending = [
        queryClient.invalidateQueries({ queryKey: sourceKeys.market(id) }),
        queryClient.invalidateQueries({ queryKey: sourceKeys.position(address, id) }),
        queryClient.invalidateQueries({ queryKey: sourceKeys.bettingState(address, id) }),
        queryClient.invalidateQueries({ queryKey: sourceKeys.positions(address, 0, pageSize) }),
        queryClient.invalidateQueries({ queryKey: sourceKeys.claimable(address, 0, pageSize) }),
      ];
      if (call.method === "settle_market")
        pending.push(
          ...evidenceSources.map((name) =>
            queryClient.invalidateQueries({ queryKey: sourceKeys.evidence(id, name) }),
          ),
        );
      await Promise.all(pending);
    },
    [address, queryClient],
  );
}
