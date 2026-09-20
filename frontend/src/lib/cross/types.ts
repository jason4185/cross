export type Outcome = "INDICES" | "FX";
export type ContractMarketState = "OPEN" | "SETTLEMENT_PENDING" | "SETTLED" | "INCONCLUSIVE";
export type DisplayMarketState = ContractMarketState | "LIVE";
export type SourceName = "GATE" | "BITGET";
export type SourceStatus = "VALID" | "TIE" | "UNAVAILABLE" | "INVALID";

export interface CrossConfig {
  protocol: string;
  outcomes: Outcome[];
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

export interface Position {
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
  outcomeStakesWei: Record<Outcome, bigint>;
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
  symbol: string;
  marketFamily: string;
  candleTimestamp: number | null;
  timestampUnit: string;
  interval: string;
  open: string;
  close: string;
  returnDirection: string;
  returnNumerator: string;
  returnDenominator: string;
  valid: boolean;
}

export interface SourceEvidence {
  source: SourceName;
  status: SourceStatus;
  winner?: Outcome | undefined;
  marketStart: number;
  marketEnd: number;
  indicesScoreNumerator?: string | undefined;
  indicesScoreDenominator?: string | undefined;
  fxScoreNumerator?: string | undefined;
  fxScoreDenominator?: string | undefined;
  assets: SourceAssetEvidence[];
}

export interface PortfolioPosition {
  market: Market;
  position: Position;
}
