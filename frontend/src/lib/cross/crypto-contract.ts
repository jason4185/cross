import { createClient } from "genlayer-js";
import type { CalldataEncodable } from "genlayer-js/types";
import { contractErrorText, isMarketNotFoundError } from "./errors";
import { CROSS_CHAIN, getCrossCryptoContractAddress } from "./config";
import type {
  BettingState,
  ContractMarketState,
  CryptoAsset,
  CryptoConfig,
  CryptoMarketType,
  DisplayMarketState,
  Market,
  MarketPage,
  Outcome,
  Position,
  SourceAssetEvidence,
  SourceEvidence,
  SourceName,
  SourceStatus,
} from "./types";
import type { CrossWriteCall } from "./contract";

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"] as const;
const SOURCES = ["BINANCE", "GATE", "BITGET"] as const;
const DURATIONS = [3600, 7200] as const;

type RawRecord = Record<string, unknown>;
type Client = ReturnType<typeof createClient>;
type ClientChain = NonNullable<NonNullable<Parameters<typeof createClient>[0]>["chain"]>;
const publicClient: Client = createClient({ chain: CROSS_CHAIN as ClientChain });
let walletClient: Client | null = null;
let walletClientAddress: string | null = null;

function record(value: unknown, label = "CROSS Crypto") {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`The ${label} contract returned an invalid object.`);
  return value as RawRecord;
}
function bigintValue(value: unknown, field: string): bigint {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  } catch {
    // Fall through to one consistent response-validation error.
  }
  throw new Error(`The CROSS Crypto contract returned an invalid ${field}.`);
}
function safeNumber(value: unknown, field: string) {
  const parsed = bigintValue(value, field);
  const result = Number(parsed);
  if (!Number.isSafeInteger(result))
    throw new Error(`The CROSS Crypto contract returned an unsafe ${field}.`);
  return result;
}
function stringValue(value: unknown, field: string) {
  if (typeof value !== "string")
    throw new Error(`The CROSS Crypto contract returned an invalid ${field}.`);
  return value;
}
function booleanValue(value: unknown, field: string) {
  if (typeof value !== "boolean")
    throw new Error(`The CROSS Crypto contract returned an invalid ${field}.`);
  return value;
}
function contractState(value: unknown): ContractMarketState {
  if (
    value === "OPEN" ||
    value === "SETTLEMENT_PENDING" ||
    value === "SETTLED" ||
    value === "INCONCLUSIVE"
  )
    return value;
  throw new Error("The CROSS Crypto contract returned an invalid market state.");
}
function displayState(
  state: ContractMarketState,
  start: number,
  end: number,
  now = Date.now(),
): DisplayMarketState {
  return state === "OPEN" && now >= start && now < end ? "LIVE" : state;
}
function sourceName(value: unknown): SourceName {
  if (SOURCES.includes(value as (typeof SOURCES)[number])) return value as SourceName;
  throw new Error("The CROSS Crypto contract returned an invalid evidence source.");
}
function sourceStatus(value: unknown): SourceStatus {
  if (value === "VALID" || value === "TIE" || value === "UNAVAILABLE" || value === "INVALID")
    return value;
  throw new Error("The CROSS Crypto contract returned an invalid source status.");
}
function assetValue(value: unknown): CryptoAsset {
  if (ASSETS.includes(value as CryptoAsset)) return value as CryptoAsset;
  throw new Error("The CROSS Crypto contract returned an invalid crypto asset.");
}
function assetId(value: CryptoAsset) {
  return ASSETS.indexOf(value);
}
function outcomeValue(value: unknown): Outcome | undefined {
  if (value === "UP" || value === "DOWN" || ASSETS.includes(value as CryptoAsset))
    return value as Outcome;
  if (value === "" || value === undefined || value === null) return undefined;
  throw new Error("The CROSS Crypto contract returned an invalid winner.");
}
function allowedOutcomes(type: CryptoMarketType, subject: string): Outcome[] {
  if (type === "UP_DOWN") return ["UP", "DOWN"];
  if (subject === "MAJORS") return ["BTC", "ETH", "SOL"];
  if (subject === "LARGE_CAP_ALTS") return ["BNB", "XRP", "DOGE"];
  throw new Error("The CROSS Crypto contract returned an invalid dominance category.");
}
function mapMarket(value: unknown, now = Date.now()): Market {
  const raw = record(value);
  const marketType = raw["market_type"];
  if (marketType !== "UP_DOWN" && marketType !== "DOMINANCE")
    throw new Error("The CROSS Crypto contract returned an invalid market type.");
  const subject = stringValue(raw["subject"], "market subject");
  const durationSeconds = safeNumber(raw["duration_seconds"], "duration");
  if (!DURATIONS.includes(durationSeconds as 3600 | 7200))
    throw new Error("The CROSS Crypto contract returned an invalid duration.");
  const outcomes = allowedOutcomes(marketType, subject);
  const rawAllowed = raw["allowed_outcomes"];
  if (!Array.isArray(rawAllowed) || rawAllowed.join(",") !== outcomes.join(","))
    throw new Error("The CROSS Crypto contract returned invalid allowed outcomes.");
  const winner = outcomeValue(raw["winner"]);
  if (winner !== undefined && !outcomes.includes(winner))
    throw new Error("The CROSS Crypto contract returned an invalid market winner.");
  const pools = record(raw["outcome_pools"], "CROSS Crypto market pools");
  const outcomePools = Object.fromEntries(
    outcomes.map((outcome) => [outcome, bigintValue(pools[outcome], `${outcome} pool`)]),
  );
  const start = safeNumber(raw["market_start"], "market start") * 1_000;
  const end = safeNumber(raw["market_end"], "market end") * 1_000;
  const settlementReady = safeNumber(raw["settlement_ready"], "settlement ready") * 1_000;
  const deadline = safeNumber(raw["settlement_deadline"], "settlement deadline") * 1_000;
  const state = contractState(raw["state"]);
  const totalPoolWei = bigintValue(raw["market_pool"], "market pool");
  return {
    source: "CRYPTO",
    marketType,
    subject,
    durationSeconds,
    allowedOutcomes: outcomes,
    id: safeNumber(raw["market_id"], "market id"),
    start,
    end,
    settlementReady,
    settlementDeadline: deadline,
    contractState: state,
    state: displayState(state, start, end, now),
    winner,
    reason: stringValue(raw["reason"], "market reason"),
    totalPoolWei,
    indicesPoolWei: outcomePools["INDICES"] ?? 0n,
    fxPoolWei: outcomePools["FX"] ?? 0n,
    outcomePools,
    winningPoolWei: bigintValue(raw["winning_pool"], "winning pool"),
    claimedPoolWei: bigintValue(raw["claimed_pool"], "claimed pool"),
    refundedPoolWei: bigintValue(raw["refunded_pool"], "refunded pool"),
    remainingPoolWei: bigintValue(raw["remaining_pool"], "remaining pool"),
    bettingOpen: booleanValue(raw["betting_open"], "betting state"),
    settlementAvailable: booleanValue(raw["settlement_available"], "settlement availability"),
    deadlineExpired: state !== "SETTLED" && state !== "INCONCLUSIVE" && Date.now() >= deadline,
  };
}
function emptyPosition(marketId: number): Position {
  return {
    source: "CRYPTO",
    marketId,
    exists: false,
    stakeWei: 0n,
    claimed: false,
    refunded: false,
    claimableWei: 0n,
    claimable: false,
    refundable: false,
    positionWon: false,
    positionLost: false,
    claimType: "NONE",
  };
}
function mapPosition(value: unknown): Position {
  const raw = record(value);
  const marketId = safeNumber(raw["market_id"], "market id");
  const hasPosition = booleanValue(raw["has_position"], "position state");
  if (!hasPosition) return emptyPosition(marketId);
  const selected = outcomeValue(raw["selected_outcome"]);
  if (!selected)
    throw new Error("The CROSS Crypto contract returned a position without an outcome.");
  return {
    source: "CRYPTO",
    marketId,
    exists: true,
    side: selected,
    stakeWei: bigintValue(raw["total_stake"], "wallet stake"),
    claimed: booleanValue(raw["already_claimed"], "claim state"),
    refunded: booleanValue(raw["refunded"], "refund state"),
    claimableWei: bigintValue(raw["claimable_amount"], "claimable amount"),
    claimable: booleanValue(raw["claim_available"], "claim availability"),
    refundable: booleanValue(raw["refund_available"], "refund availability"),
    positionWon: booleanValue(raw["position_won"], "position result"),
    positionLost: booleanValue(raw["position_lost"], "position result"),
    claimType:
      raw["claim_type"] === "WINNINGS" || raw["claim_type"] === "REFUND"
        ? raw["claim_type"]
        : "NONE",
  };
}
function mapPage(value: unknown): MarketPage {
  const raw = record(value);
  if (!Array.isArray(raw["items"]))
    throw new Error("The CROSS Crypto contract returned invalid market pages.");
  return {
    items: raw["items"].map((item) => mapMarket(item)),
    nextCursor: safeNumber(raw["next_offset"], "market offset"),
    hasMore: booleanValue(raw["has_more"], "page state"),
  };
}
function mapPositionPage(value: unknown) {
  const raw = record(value);
  if (!Array.isArray(raw["items"]))
    throw new Error("The CROSS Crypto contract returned invalid position pages.");
  return {
    items: raw["items"].map(mapPosition),
    nextOffset: safeNumber(raw["next_offset"], "position offset"),
    hasMore: booleanValue(raw["has_more"], "page state"),
  };
}
function mapBettingState(value: unknown): BettingState {
  const raw = record(value);
  const stakes = record(raw["outcome_stakes"], "CROSS Crypto outcome pools");
  const outcomeStakesWei: Record<string, bigint> = {};
  for (const [key, amount] of Object.entries(stakes))
    outcomeStakesWei[key] = bigintValue(amount, `${key} stake pool`);
  return {
    totalMarketPoolWei: bigintValue(raw["total_market_pool"], "market pool"),
    outcomeStakesWei,
    bettorOutcome: outcomeValue(raw["bettor_outcome"]),
    bettorStakeWei: bigintValue(raw["bettor_stake"], "wallet stake"),
    claimed: booleanValue(raw["claimed"], "claim state"),
    refunded: booleanValue(raw["refunded"], "refund state"),
    winningPoolWei: bigintValue(raw["winning_pool"], "winning pool"),
    claimedPoolWei: bigintValue(raw["claimed_pool"], "claimed pool"),
    claimedWinningStakeWei: bigintValue(raw["claimed_winning_stake"], "claimed winning stake"),
    refundedPoolWei: bigintValue(raw["refunded_pool"], "refunded pool"),
  };
}
function mapEvidence(value: unknown): SourceEvidence {
  const raw = record(value);
  const source = sourceName(raw["source"]);
  const marketType = raw["market_type"];
  if (marketType !== "UP_DOWN" && marketType !== "DOMINANCE")
    throw new Error("The CROSS Crypto contract returned invalid evidence type.");
  const subject = stringValue(raw["subject"], "evidence subject");
  const durationSeconds = safeNumber(raw["duration_seconds"], "evidence duration");
  if (!DURATIONS.includes(durationSeconds as 3600 | 7200))
    throw new Error("The CROSS Crypto contract returned invalid evidence duration.");
  const expectedAssets =
    marketType === "UP_DOWN"
      ? [assetValue(subject)]
      : subject === "MAJORS"
        ? ["BTC", "ETH", "SOL"]
        : subject === "LARGE_CAP_ALTS"
          ? ["BNB", "XRP", "DOGE"]
          : [];
  const assets = raw["assets"];
  if (!Array.isArray(assets) || assets.length !== expectedAssets.length)
    throw new Error("The CROSS Crypto contract returned invalid evidence assets.");
  const startSeconds = safeNumber(raw["market_start"], "evidence market start");
  const status = sourceStatus(raw["source_status"]);
  const winner = outcomeValue(raw["source_winner"]);
  const validOutcomes = allowedOutcomes(marketType, subject);
  if (winner !== undefined && !validOutcomes.includes(winner))
    throw new Error("The CROSS Crypto contract returned an invalid evidence winner.");
  if (status === "VALID" && winner === undefined)
    throw new Error("The CROSS Crypto contract returned a valid result without a winner.");
  if (status !== "VALID" && winner !== undefined)
    throw new Error("The CROSS Crypto contract returned a winner for a non-valid result.");
  return {
    source,
    status,
    winner,
    reason: stringValue(raw["reason"], "evidence reason"),
    marketType,
    subject,
    durationSeconds,
    marketStart: startSeconds * 1_000,
    marketEnd: startSeconds * 1_000 + durationSeconds * 1_000,
    assets: assets.map((item, index): SourceAssetEvidence => {
      const asset = record(item, "CROSS Crypto evidence asset");
      const candles = asset["candles"];
      const expectedAsset = expectedAssets[index];
      if (
        !Array.isArray(candles) ||
        assetValue(asset["asset"]) !== expectedAsset ||
        safeNumber(asset["asset_id"], "evidence asset id") !== assetId(expectedAsset)
      )
        throw new Error("The CROSS Crypto contract returned invalid evidence candles.");
      const expectedCount = durationSeconds === 3600 ? 1 : 2;
      if (status === "VALID" || status === "TIE") {
        if (asset["valid"] !== true || candles.length !== expectedCount)
          throw new Error("The CROSS Crypto contract returned incomplete valid evidence.");
        candles.forEach((entry, candleIndex) => {
          const candle = record(entry, "CROSS Crypto candle");
          const expected = startSeconds + candleIndex * 3600;
          const timestamp = safeNumber(candle["t"], "candle timestamp");
          const expectedTimestamp = source === "GATE" ? expected : expected * 1000;
          if (timestamp !== expectedTimestamp)
            throw new Error("The CROSS Crypto contract returned a non-canonical candle timestamp.");
        });
      } else if (
        asset["valid"] !== false ||
        candles.length !== 0 ||
        asset["open"] !== "" ||
        asset["close"] !== ""
      ) {
        throw new Error("The CROSS Crypto contract returned invalid failure evidence.");
      }
      const open = stringValue(asset["open"], "evidence opening price");
      const close = stringValue(asset["close"], "evidence closing price");
      if (status === "VALID" || status === "TIE") {
        const first = record(candles[0], "CROSS Crypto first candle");
        const last = record(candles[candles.length - 1], "CROSS Crypto last candle");
        if (open !== first["o"] || close !== last["c"])
          throw new Error("The CROSS Crypto contract returned unlinked aggregate evidence.");
      }
      return {
        asset: assetValue(asset["asset"]),
        open,
        close,
        valid: booleanValue(asset["valid"], "evidence validity"),
        candles: candles.map((entry) => {
          const candle = record(entry, "CROSS Crypto candle");
          return {
            timestamp:
              safeNumber(candle["t"], "candle timestamp") * (source === "GATE" ? 1_000 : 1),
            open: stringValue(candle["o"], "candle open"),
            close: stringValue(candle["c"], "candle close"),
          };
        }),
      };
    }),
  };
}
function client(account?: string) {
  if (!account) return publicClient;
  if (walletClient && walletClientAddress === account) return walletClient;
  walletClient = createClient({
    chain: CROSS_CHAIN as ClientChain,
    account: account as `0x${string}`,
  });
  walletClientAddress = account;
  return walletClient;
}
async function read(functionName: string, args: CalldataEncodable[] = [], account?: string) {
  return client(account).readContract({
    address: getCrossCryptoContractAddress(),
    functionName,
    args,
  });
}
function writeCall(method: string, args: CalldataEncodable[]): CrossWriteCall {
  return { address: getCrossCryptoContractAddress(), method, args, source: "CRYPTO" };
}
function missing(error: unknown) {
  return isMarketNotFoundError(error);
}

export const cryptoContract = {
  async getConfig(): Promise<CryptoConfig> {
    const raw = record(await read("get_config"));
    if (raw["protocol"] !== "CROSS CRYPTO V1")
      throw new Error("The connected contract is not CROSS CRYPTO V1.");
    const assets = raw["assets"];
    const types = raw["market_types"];
    const durations = raw["durations_seconds"];
    const sources = raw["sources"];
    if (
      !Array.isArray(assets) ||
      assets.join(",") !== ASSETS.join(",") ||
      !Array.isArray(types) ||
      types.join(",") !== "UP_DOWN,DOMINANCE" ||
      !Array.isArray(durations) ||
      durations.join(",") !== "3600,7200" ||
      !Array.isArray(sources) ||
      sources.join(",") !== SOURCES.join(",")
    )
      throw new Error("The CROSS Crypto contract returned an unexpected configuration.");
    const categories = record(raw["dominance_categories"], "CROSS Crypto categories");
    const majors = categories["MAJORS"],
      alts = categories["LARGE_CAP_ALTS"];
    if (
      !Array.isArray(majors) ||
      majors.join(",") !== "BTC,ETH,SOL" ||
      !Array.isArray(alts) ||
      alts.join(",") !== "BNB,XRP,DOGE"
    )
      throw new Error("The CROSS Crypto contract returned invalid dominance categories.");
    return {
      protocol: "CROSS CRYPTO V1",
      marketTypes: ["UP_DOWN", "DOMINANCE"],
      assets: [...ASSETS],
      dominanceCategories: {
        MAJORS: ["BTC", "ETH", "SOL"],
        LARGE_CAP_ALTS: ["BNB", "XRP", "DOGE"],
      },
      durationsSeconds: [3600, 7200],
      sources: [...SOURCES],
      minimumBetWei: bigintValue(raw["minimum_bet"], "minimum bet"),
      maximumBetWei: bigintValue(raw["maximum_bet_per_wallet_per_market"], "maximum bet"),
      consensusThreshold: safeNumber(raw["consensus_threshold"], "consensus threshold"),
      settlementGraceSeconds: safeNumber(raw["settlement_grace_seconds"], "settlement grace"),
      settlementRetryWindowSeconds: safeNumber(
        raw["settlement_retry_window_seconds"],
        "settlement retry window",
      ),
      maxPageSize: safeNumber(raw["max_page_size"], "maximum page size"),
      timezone: stringValue(raw["timezone"], "timezone"),
      feeBps: safeNumber(raw["fee_bps"], "fee"),
      returnCalculation: stringValue(raw["return_calculation"], "return calculation"),
      payoutRounding: stringValue(raw["payout_rounding"], "payout rounding"),
      zeroBackedWinnerBehavior: stringValue(
        raw["zero_backed_winner_behavior"],
        "zero-backed behavior",
      ),
    };
  },
  async getMarket(marketId: number) {
    try {
      return mapMarket(await read("get_market", [marketId]));
    } catch (error) {
      if (missing(error)) throw new Error("market not found");
      throw error;
    }
  },
  async getMarkets(offset: number, limit: number) {
    return mapPage(await read("get_markets", [offset, limit]));
  },
  async getOpenMarkets(offset: number, limit: number) {
    return mapPage(await read("get_open_markets", [offset, limit]));
  },
  async getMarketCount() {
    return safeNumber(await read("get_market_count"), "market count");
  },
  async getMyPosition(marketId: number, account: string) {
    return mapPosition(await read("get_my_position", [marketId], account));
  },
  async getMyPositions(offset: number, limit: number, account: string) {
    return mapPositionPage(await read("get_my_positions", [offset, limit], account));
  },
  async getUserPositions(user: string, offset: number, limit: number) {
    return mapPositionPage(await read("get_user_positions", [user, offset, limit]));
  },
  async getMyClaimableMarkets(offset: number, limit: number, account: string) {
    return mapPositionPage(await read("get_my_claimable_markets", [offset, limit], account));
  },
  async getMarketByIdentity(
    marketType: CryptoMarketType,
    subject: string,
    durationSeconds: number,
    marketStart: number,
  ) {
    try {
      return mapMarket(
        await read("get_market_by_identity", [marketType, subject, durationSeconds, marketStart]),
      );
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  },
  async getSourceEvidence(marketId: number, source: SourceName) {
    try {
      return mapEvidence(await read("get_source_evidence", [marketId, source]));
    } catch (error) {
      if (
        contractErrorText(error).includes("source evidence unavailable") ||
        contractErrorText(error).includes("missing or invalid parameters")
      )
        return undefined;
      throw error;
    }
  },
  async getBettingState(marketId: number, account: string) {
    return mapBettingState(await read("get_betting_state", [marketId], account));
  },
  createUpDownMarket(asset: CryptoAsset, durationSeconds: 3600 | 7200, marketStart: number) {
    return writeCall("create_up_down_market", [asset, durationSeconds, marketStart]);
  },
  createDominanceMarket(
    category: "MAJORS" | "LARGE_CAP_ALTS",
    durationSeconds: 3600 | 7200,
    marketStart: number,
  ) {
    return writeCall("create_dominance_market", [category, durationSeconds, marketStart]);
  },
  placeBet(marketId: number, outcome: Outcome) {
    return writeCall("place_bet", [marketId, outcome]);
  },
  settleMarket(marketId: number) {
    return writeCall("settle_market", [marketId]);
  },
  claim(marketId: number) {
    return writeCall("claim", [marketId]);
  },
  claimRefund(marketId: number) {
    return writeCall("claim_refund", [marketId]);
  },
};

export type CryptoContract = typeof cryptoContract;
