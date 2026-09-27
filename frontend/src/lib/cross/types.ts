export type MarketSource = "CROSS" | "CRYPTO";
export type Outcome = "INDICES" | "FX" | "UP" | "DOWN" | CryptoAsset;
export type CrossOutcome = "INDICES" | "FX";
export type CryptoAsset = "BTC" | "ETH" | "SOL" | "BNB" | "XRP" | "DOGE";
export type CryptoMarketType = "UP_DOWN" | "DOMINANCE";
export type MarketType = "INDICES_FX" | CryptoMarketType;
export type ContractMarketState = "OPEN" | "SETTLEMENT_PENDING" | "SETTLED" | "INCONCLUSIVE";
export type DisplayMarketState = ContractMarketState | "LIVE";
export type SourceName = "GATE" | "BITGET" | "BINANCE";
export type SourceStatus = "VALID" | "TIE" | "UNAVAILABLE" | "INVALID";

export interface CrossConfig {
  protocol: string;
  outcomes: CrossOutcome[];
  indicesBasket: ["SPY", "QQQ", "IWM"];
  fxBasket: ["EURUSD", "GBPUSD", "USDJPY"];
  sources: ["GATE", "BITGET"];
  durationSeconds: number;
  minimumBetWei: bigint;
  maximumBetWei: bigint;
  consensusThreshold: number;
  settlementGraceSeconds: number;
  settlementRetryWindowSeconds: number;
  settlementDeadlineAnchor: string;
  pricePrecision: number;
  returnPrecision: number;
  maxMarkets: number;
  maxPositions: number;
  maxPageSize: number;
  timezone: string;
  returnCalculation: string;
  payoutRounding: string;
  zeroBackedWinnerBehavior: string;
  symbolsBySource: Record<string, string[]>;
}

export interface CryptoConfig {
  protocol: string;
  marketTypes: ["UP_DOWN", "DOMINANCE"];
  assets: CryptoAsset[];
  dominanceCategories: Record<"MAJORS" | "LARGE_CAP_ALTS", CryptoAsset[]>;
  durationsSeconds: [3600, 7200];
  sources: ["BINANCE", "GATE", "BITGET"];
  minimumBetWei: bigint;
  maximumBetWei: bigint;
  consensusThreshold: number;
  settlementGraceSeconds: number;
  settlementRetryWindowSeconds: number;
  maxPageSize: number;
  timezone: string;
  feeBps: number;
  returnCalculation: string;
  payoutRounding: string;
  zeroBackedWinnerBehavior: string;
}

export interface Position {
  source?: MarketSource;
  marketId: number;
  exists: boolean;
  side?: Outcome | undefined;
  stakeWei: bigint;
  claimed: boolean;
  refunded: boolean;
  claimableWei: bigint;
  claimable: boolean;
  refundable: boolean;
  positionWon: boolean;
  positionLost: boolean;
  claimType: "NONE" | "WINNINGS" | "REFUND";
}

export interface Market {
  source: MarketSource;
  marketType: MarketType;
  subject: string;
  durationSeconds: number;
  allowedOutcomes: Outcome[];
  id: number;
  start: number;
  end: number;
  settlementReady: number;
  settlementDeadline: number;
  contractState: ContractMarketState;
  state: DisplayMarketState;
  winner?: Outcome | undefined;
  reason: string;
  totalPoolWei: bigint;
  indicesPoolWei: bigint;
  fxPoolWei: bigint;
  outcomePools: Record<string, bigint>;
  winningPoolWei: bigint;
  claimedPoolWei: bigint;
  refundedPoolWei: bigint;
  remainingPoolWei: bigint;
  bettingOpen: boolean;
  settlementAvailable: boolean;
  deadlineExpired: boolean;
  position?: Position | undefined;
}

export interface MarketPage {
  items: Market[];
  nextCursor: number;
  hasMore: boolean;
}

export interface BettingState {
  totalMarketPoolWei: bigint;
  outcomeStakesWei: Record<string, bigint>;
  bettorOutcome?: Outcome | undefined;
  bettorStakeWei: bigint;
  claimed: boolean;
  refunded: boolean;
  winningPoolWei: bigint;
  claimedPoolWei: bigint;
  claimedWinningStakeWei: bigint;
  refundedPoolWei: bigint;
}

export interface SourceAssetEvidence {
  asset: string;
  symbol?: string;
  marketFamily?: string;
  candleTimestamp?: number | null;
  timestampUnit?: string;
  interval?: string;
  open: string;
  close: string;
  returnDirection?: string;
  returnNumerator?: string;
  returnDenominator?: string;
  candles?: Array<{ timestamp: number; open: string; close: string }>;
  valid: boolean;
}

export interface SourceEvidence {
  source: SourceName;
  status: SourceStatus;
  winner?: Outcome | undefined;
  marketStart: number;
  marketEnd: number;
  marketType?: MarketType;
  subject?: string;
  durationSeconds?: number;
  reason?: string;
  indicesScoreNumerator?: string | undefined;
  indicesScoreDenominator?: string | undefined;
  fxScoreNumerator?: string | undefined;
  fxScoreDenominator?: string | undefined;
  assets: SourceAssetEvidence[];
}

export interface PortfolioPosition {
  source: MarketSource;
  market: Market;
  position: Position;
}
