import { createClient } from "genlayer-js";
import type { CalldataEncodable } from "genlayer-js/types";
import { CROSS_CHAIN, getCrossContractAddress } from "./config";
import { contractErrorText, isMarketNotFoundError } from "./errors";
import type {
  BettingState,
  ContractMarketState,
  CrossConfig,
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

export type CrossWriteCall = {
  address: `0x${string}`;
  method: string;
  args: CalldataEncodable[];
};

export function safeCrossWrite(factory: () => CrossWriteCall) {
  try {
    return factory();
  } catch {
    return null;
  }
}

type RawRecord = Record<string, unknown>;

type CrossClient = ReturnType<typeof createClient>;

type ClientChain = NonNullable<NonNullable<Parameters<typeof createClient>[0]>["chain"]>;

const publicClient: CrossClient = createClient({ chain: CROSS_CHAIN as ClientChain });
let walletClient: CrossClient | null = null;
let walletClientAddress: string | null = null;

function record(value: unknown): RawRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("The CROSS contract returned an invalid object.");
  }
  return value as RawRecord;
}

function bigintValue(value: unknown, field: string): bigint {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  } catch {
    // Use the shared error below for malformed ABI values.
  }
  throw new Error(`The CROSS contract returned an invalid ${field}.`);
}

function optionalBigint(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return bigintValue(value, field);
}

function safeNumber(value: unknown, field: string) {
  const parsed = bigintValue(value, field);
  const result = Number(parsed);
  if (!Number.isSafeInteger(result))
    throw new Error(`The CROSS contract returned an unsafe ${field}.`);
  return result;
}

function secondsToMilliseconds(value: unknown, field: string) {
  const seconds = bigintValue(value, field);
  const milliseconds = seconds * 1_000n;
  const result = Number(milliseconds);
  if (!Number.isSafeInteger(result))
    throw new Error(`The CROSS contract returned an unsafe ${field}.`);
  return result;
}

function stringValue(value: unknown, field: string) {
  if (typeof value !== "string")
    throw new Error(`The CROSS contract returned an invalid ${field}.`);
  return value;
}

function outcomeValue(value: unknown): Outcome | undefined {
  return value === "INDICES" || value === "FX" ? value : undefined;
}

function emptyPosition(marketId: number): Position {
  return {
    marketId,
    exists: false,
    side: undefined,
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

function contractState(value: unknown): ContractMarketState {
  if (
    value === "OPEN" ||
    value === "SETTLEMENT_PENDING" ||
    value === "SETTLED" ||
    value === "INCONCLUSIVE"
  ) {
    return value;
  }
  throw new Error("The CROSS contract returned an invalid market state.");
}

function displayState(
  state: ContractMarketState,
  start: number,
  end: number,
  now = Date.now(),
): DisplayMarketState {
  return state === "OPEN" && now >= start && now < end ? "LIVE" : state;
}

function mapMarket(value: unknown, now = Date.now()): Market {
  const raw = record(value);
  const start = secondsToMilliseconds(raw["market_start"], "market start");
  const end = secondsToMilliseconds(raw["market_end"], "market end");
  const state = contractState(raw["state"]);
  return {
    id: safeNumber(raw["market_id"] ?? raw["id"], "market id"),
    start,
    end,
    settlementReady: secondsToMilliseconds(raw["settlement_ready"], "settlement ready time"),
    settlementDeadline: secondsToMilliseconds(raw["settlement_deadline"], "settlement deadline"),
    contractState: state,
    state: displayState(state, start, end, now),
    winner: outcomeValue(raw["winner"]),
    reason: typeof raw["reason"] === "string" ? raw["reason"] : "",
    totalPoolWei: bigintValue(raw["total_pool"] ?? raw["market_pool"], "total pool"),
    indicesPoolWei: bigintValue(raw["indices_pool"], "INDICES pool"),
    fxPoolWei: bigintValue(raw["fx_pool"], "FX pool"),
    winningPoolWei: bigintValue(raw["winning_pool"], "winning pool"),
    claimedPoolWei: bigintValue(raw["claimed_pool"], "claimed pool"),
    refundedPoolWei: bigintValue(raw["refunded_pool"], "refunded pool"),
    remainingPoolWei: bigintValue(raw["remaining_pool"], "remaining pool"),
    bettingOpen: raw["betting_open"] === true,
    settlementAvailable: raw["settlement_available"] === true,
    deadlineExpired: raw["deadline_expired"] === true,
  };
}

function mapPosition(value: unknown): Position {
  const raw = record(value);
  const marketId = safeNumber(raw["market_id"], "market id");
  const hasPosition = raw["has_position"];
  if (hasPosition !== true && hasPosition !== false) {
    throw new Error("The CROSS contract returned an invalid position state.");
  }
  if (!hasPosition) return emptyPosition(marketId);
  return {
    marketId,
    exists: true,
    side: outcomeValue(raw["selected_outcome"] ?? raw["user_outcome"]),
    stakeWei: bigintValue(raw["user_stake"] ?? raw["total_stake"], "wallet stake"),
    claimed: raw["claimed"] === true || raw["already_claimed"] === true,
    refunded: raw["refunded"] === true,
    claimableWei: bigintValue(raw["claimable_amount"], "claimable amount"),
    claimable: raw["claim_available"] === true,
    refundable: raw["refund_available"] === true,
    positionWon: raw["position_won"] === true,
    positionLost: raw["position_lost"] === true,
    claimType:
      raw["claim_type"] === "WINNINGS" || raw["claim_type"] === "REFUND"
        ? raw["claim_type"]
        : "NONE",
  };
}

function mapPage(value: unknown): MarketPage {
  const raw = record(value);
  const items = Array.isArray(raw["items"]) ? raw["items"].map((item) => mapMarket(item)) : [];
  return {
    items,
    nextCursor: safeNumber(raw["next_cursor"] ?? 0, "next cursor"),
    hasMore: raw["has_more"] === true,
  };
}

function mapBettingState(value: unknown): BettingState {
  const raw = record(value);
  const stakes = record(raw["outcome_stakes"]);
  return {
    totalMarketPoolWei: bigintValue(raw["total_market_pool"], "market pool"),
    outcomeStakesWei: {
      INDICES: bigintValue(stakes["INDICES"] ?? 0, "INDICES stake pool"),
      FX: bigintValue(stakes["FX"] ?? 0, "FX stake pool"),
    },
    bettorOutcome: outcomeValue(raw["bettor_outcome"]),
    bettorStakeWei: bigintValue(raw["bettor_stake"], "wallet stake"),
    claimed: raw["claimed"] === true,
    refunded: raw["refunded"] === true,
    winningPoolWei: bigintValue(raw["winning_pool"], "winning pool"),
    claimedPoolWei: bigintValue(raw["claimed_pool"], "claimed pool"),
    claimedWinningStakeWei: bigintValue(raw["claimed_winning_stake"], "claimed winning stake"),
    refundedPoolWei: bigintValue(raw["refunded_pool"], "refunded pool"),
  };
}

function sourceStatus(value: unknown): SourceStatus {
  if (value === "VALID" || value === "TIE" || value === "UNAVAILABLE" || value === "INVALID")
    return value;
  throw new Error("The CROSS contract returned an invalid source status.");
}

function mapEvidence(value: unknown): SourceEvidence {
  const raw = record(value);
  const source = raw["source"] === "GATE" || raw["source"] === "BITGET" ? raw["source"] : null;
  if (!source) throw new Error("The CROSS contract returned an invalid evidence source.");
  const assets = Array.isArray(raw["assets"]) ? raw["assets"] : [];
  return {
    source,
    status: sourceStatus(raw["source_status"]),
    winner: outcomeValue(raw["source_winner"]),
    marketStart: secondsToMilliseconds(raw["market_start"], "evidence market start"),
    marketEnd: secondsToMilliseconds(raw["market_end"], "evidence market end"),
    indicesScoreNumerator:
      typeof raw["indices_score_numerator"] === "string"
        ? raw["indices_score_numerator"]
        : undefined,
    indicesScoreDenominator:
      typeof raw["indices_score_denominator"] === "string"
        ? raw["indices_score_denominator"]
        : undefined,
    fxScoreNumerator:
      typeof raw["fx_score_numerator"] === "string" ? raw["fx_score_numerator"] : undefined,
    fxScoreDenominator:
      typeof raw["fx_score_denominator"] === "string" ? raw["fx_score_denominator"] : undefined,
    assets: assets.map((item) => {
      const asset = record(item);
      const timestamp = asset["candle_timestamp"];
      const unit = typeof asset["timestamp_unit"] === "string" ? asset["timestamp_unit"] : "";
      return {
        asset: stringValue(asset["asset"], "evidence asset"),
        symbol: stringValue(asset["symbol"], "evidence symbol"),
        marketFamily: stringValue(asset["market_family"], "evidence market family"),
        candleTimestamp:
          typeof timestamp === "string" && timestamp
            ? unit === "s"
              ? Number(timestamp) * 1_000
              : Number(timestamp)
            : null,
        timestampUnit: unit,
        interval: stringValue(asset["interval"], "evidence interval"),
        open: stringValue(asset["open"], "evidence opening price"),
        close: stringValue(asset["close"], "evidence closing price"),
        returnDirection: stringValue(asset["return_direction"], "evidence return direction"),
        returnNumerator: stringValue(asset["return_numerator"], "evidence return numerator"),
        returnDenominator: stringValue(asset["return_denominator"], "evidence return denominator"),
        valid: asset["valid"] === true,
      } satisfies SourceAssetEvidence;
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
    address: getCrossContractAddress(),
    functionName,
    args,
  });
}

function writeCall(method: string, args: CalldataEncodable[]): CrossWriteCall {
  return { address: getCrossContractAddress(), method, args };
}

function isContractMissingRead(error: unknown) {
  return isMarketNotFoundError(error);
}

export const crossContract = {
  async getConfig(): Promise<CrossConfig> {
    const raw = record(await read("get_config"));
    if (raw["protocol"] !== "CROSS V1") throw new Error("The connected contract is not CROSS V1.");
    const outcomes = Array.isArray(raw["outcomes"])
      ? raw["outcomes"].filter((item): item is Outcome => item === "INDICES" || item === "FX")
      : [];
    if (outcomes.join(",") !== "INDICES,FX")
      throw new Error("The CROSS contract returned an invalid outcome configuration.");
    const indicesBasket = raw["indices_basket"];
    const fxBasket = raw["fx_basket"];
    const sources = raw["sources"];
    if (
      !Array.isArray(indicesBasket) ||
      indicesBasket.join(",") !== "SPY,QQQ,IWM" ||
      !Array.isArray(fxBasket) ||
      fxBasket.join(",") !== "EURUSD,GBPUSD,USDJPY" ||
      !Array.isArray(sources) ||
      sources.join(",") !== "GATE,BITGET"
    )
      throw new Error("The CROSS contract returned an unexpected protocol configuration.");
    return {
      protocol: "CROSS V1",
      outcomes,
      indicesBasket: ["SPY", "QQQ", "IWM"],
      fxBasket: ["EURUSD", "GBPUSD", "USDJPY"],
      sources: ["GATE", "BITGET"],
      durationSeconds: safeNumber(raw["duration_seconds"], "duration"),
      minimumBetWei: bigintValue(raw["minimum_bet"], "minimum bet"),
      maximumBetWei: bigintValue(raw["maximum_bet_per_wallet_per_market"], "maximum bet"),
      consensusThreshold: safeNumber(raw["consensus_threshold"], "consensus threshold"),
      settlementGraceSeconds: safeNumber(raw["settlement_grace_seconds"], "settlement grace"),
      settlementRetryWindowSeconds: safeNumber(
        raw["settlement_retry_window_seconds"],
        "settlement retry window",
      ),
      settlementDeadlineAnchor: stringValue(
        raw["settlement_deadline_anchor"],
        "settlement deadline anchor",
      ),
      pricePrecision: safeNumber(raw["price_precision"], "price precision"),
      returnPrecision: safeNumber(raw["return_precision"], "return precision"),
      maxMarkets: safeNumber(raw["max_markets"], "maximum markets"),
      maxPositions: safeNumber(raw["max_positions"], "maximum positions"),
      maxPageSize: safeNumber(raw["max_page_size"], "maximum page size"),
      timezone: stringValue(raw["timezone"], "timezone"),
      returnCalculation: stringValue(raw["return_calculation"], "return calculation"),
      payoutRounding: stringValue(raw["payout_rounding"], "payout rounding"),
      zeroBackedWinnerBehavior: stringValue(
        raw["zero_backed_winner_behavior"],
        "zero-backed behavior",
      ),
      symbolsBySource: record(raw["symbols_by_source"]) as Record<string, string[]>,
    };
  },
  async outcomes(): Promise<Outcome[]> {
    const value = await read("outcomes");
    if (!Array.isArray(value)) throw new Error("The CROSS contract returned invalid outcomes.");
    return value.filter((item): item is Outcome => item === "INDICES" || item === "FX");
  },
  async getMarket(marketId: number) {
    try {
      return mapMarket(await read("get_market", [marketId]));
    } catch (error) {
      if (isContractMissingRead(error)) throw new Error("market not found");
      throw error;
    }
  },
  async getMarkets(cursor: number, limit: number) {
    return mapPage(await read("get_markets", [cursor, limit]));
  },
  async getOpenMarkets(cursor: number, limit: number) {
    return mapPage(await read("get_open_markets", [cursor, limit]));
  },
  async getMarketCount() {
    return safeNumber(await read("get_market_count"), "market count");
  },
  async getMyPosition(marketId: number, account: string) {
    return mapPosition(await read("get_my_position", [marketId], account));
  },
  async getMyMarketCount(account: string) {
    return safeNumber(await read("get_my_market_count", [], account), "wallet market count");
  },
  async getMyPositions(offset: number, limit: number, account: string) {
    const value = await read("get_my_positions", [offset, limit], account);
    if (!Array.isArray(value))
      throw new Error("The CROSS contract returned invalid wallet positions.");
    return value.map(mapPosition);
  },
  async getUserPositions(user: string, cursor: number, limit: number) {
    const raw = record(await read("get_user_positions", [user, cursor, limit]));
    const items = Array.isArray(raw["items"]) ? raw["items"].map(mapPosition) : [];
    return {
      items,
      nextCursor: safeNumber(raw["next_cursor"] ?? 0, "position cursor"),
      hasMore: raw["has_more"] === true,
    };
  },
  async getMyClaimableMarkets(offset: number, limit: number, account: string) {
    const value = await read("get_my_claimable_markets", [offset, limit], account);
    if (!Array.isArray(value))
      throw new Error("The CROSS contract returned invalid claimable positions.");
    return value.map(mapPosition);
  },
  async getMarketByStart(marketStartSeconds: number): Promise<Market | null> {
    try {
      return mapMarket(await read("get_market_by_start", [marketStartSeconds]));
    } catch (error) {
      if (isContractMissingRead(error)) return null;
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
  createMarket(marketStartSeconds: number) {
    return writeCall("create_market", [marketStartSeconds]);
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

export type CrossContract = typeof crossContract;
