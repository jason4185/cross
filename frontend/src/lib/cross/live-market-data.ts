import type { DisplayMarketState } from "./types";

export const BITGET_REST_URL = "https://api.bitget.com/api/v3/market/candles";
export const BITGET_PUBLIC_WS_URL = "wss://ws.bitget.com/v2/ws/public";
export const BITGET_CATEGORY = "USDT-FUTURES";
export const BITGET_INTERVAL = "1m";
export const LIVE_POLL_INTERVAL_MS = 10_000;

const MINUTE_MS = 60_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_WS_RECONNECTS = 3;
const WS_RECONNECT_BACKOFF_MS = [2_000, 5_000, 10_000] as const;

export const LIVE_ASSETS = [
  { key: "SPY", label: "SPY", symbol: "SPYUSDT", basket: "INDICES" },
  { key: "QQQ", label: "QQQ", symbol: "QQQUSDT", basket: "INDICES" },
  { key: "IWM", label: "IWM", symbol: "IWMUSDT", basket: "INDICES" },
  { key: "EURUSD", label: "EURUSD", symbol: "EURUSDUSDT", basket: "FX" },
  { key: "GBPUSD", label: "GBPUSD", symbol: "GBPUSDUSDT", basket: "FX" },
  { key: "JPY", label: "JPY · USDJPY", symbol: "USDJPYUSDT", basket: "FX" },
] as const;

export type LiveAssetKey = (typeof LIVE_ASSETS)[number]["key"];
export type LiveConnection = "REST" | "WEBSOCKET" | "POLLING" | "DISCONNECTED";
export type MarketDataStatus = "not_started" | "loading" | "live" | "complete" | "unavailable";

export interface LiveCandle {
  timestamp: number;
  open: number;
  close: number;
}

export interface LiveBasketPoint {
  timestamp: number;
  indices: number;
  fx: number;
  constituents: Record<LiveAssetKey, number>;
}

export interface LiveMarketSnapshot {
  status: MarketDataStatus;
  connection: LiveConnection;
  points: LiveBasketPoint[];
  constituentReturns: Record<LiveAssetKey, number> | null;
  lastUpdated: number | null;
  error: string | null;
}

type CandleStore = Record<LiveAssetKey, Map<number, LiveCandle>>;

function emptyStore(): CandleStore {
  return {
    SPY: new Map(),
    QQQ: new Map(),
    IWM: new Map(),
    EURUSD: new Map(),
    GBPUSD: new Map(),
    JPY: new Map(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePositiveNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseCandleRow(value: unknown): LiveCandle | null {
  if (!Array.isArray(value) || value.length < 5) return null;
  const timestamp = Number(value[0]);
  const open = parsePositiveNumber(value[1]);
  const close = parsePositiveNumber(value[4]);
  if (!Number.isFinite(timestamp) || timestamp % MINUTE_MS !== 0 || !open || !close) return null;
  return { timestamp, open, close };
}

function parseCandlePayload(body: string, symbol: string) {
  if (body.length > MAX_RESPONSE_BYTES)
    throw new Error("Bitget response exceeded the chart limit.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    throw new Error("Bitget returned malformed chart data.");
  }
  if (!isRecord(parsed) || parsed["code"] !== "00000" || !Array.isArray(parsed["data"])) {
    throw new Error(`Bitget returned no valid ${symbol} candle data.`);
  }
  const candles = parsed["data"]
    .map(parseCandleRow)
    .filter((candle): candle is LiveCandle => candle !== null);
  if (!candles.length) throw new Error(`Bitget returned no usable ${symbol} candles.`);
  return candles.sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchCandles(symbol: string, start: number, end: number, signal: AbortSignal) {
  const params = new URLSearchParams({
    category: BITGET_CATEGORY,
    symbol,
    interval: BITGET_INTERVAL,
    startTime: String(start),
    endTime: String(end),
    limit: "1000",
  });
  const response = await fetch(`${BITGET_REST_URL}?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`Bitget chart request failed (${response.status}).`);
  return parseCandlePayload(await response.text(), symbol);
}

async function fetchAllAssets(start: number, end: number, signal: AbortSignal) {
  const results = await Promise.all(
    LIVE_ASSETS.map(
      async (asset) => [asset.key, await fetchCandles(asset.symbol, start, end, signal)] as const,
    ),
  );
  return results.reduce<CandleStore>((store, [key, candles]) => {
    candles.forEach((candle) => store[key].set(candle.timestamp, candle));
    return store;
  }, emptyStore());
}

function normalizedReturn(asset: LiveAssetKey, opening: number, current: number) {
  return asset === "JPY" ? opening / current - 1 : current / opening - 1;
}

export function calculateBasketPoints(
  store: CandleStore,
  marketStart: number,
  marketEnd: number,
  now: number,
) {
  const openings = {} as Record<LiveAssetKey, LiveCandle>;
  for (const asset of LIVE_ASSETS) {
    const opening = store[asset.key].get(marketStart);
    if (!opening)
      return { points: [], reason: `Waiting for the exact ${asset.label} opening candle.` };
    openings[asset.key] = opening;
  }

  const upperBound = Math.min(marketEnd, Math.max(marketStart, now));
  const timestamps = [...store.SPY.keys()]
    .filter((timestamp) => timestamp >= marketStart && timestamp < upperBound)
    .filter((timestamp) => LIVE_ASSETS.every((asset) => store[asset.key].has(timestamp)))
    .sort((a, b) => a - b);

  const points = timestamps.map((timestamp) => {
    const constituents = {} as Record<LiveAssetKey, number>;
    for (const asset of LIVE_ASSETS) {
      const candle = store[asset.key].get(timestamp);
      const currentPrice = timestamp === marketStart ? openings[asset.key].open : candle?.close;
      constituents[asset.key] = currentPrice
        ? normalizedReturn(asset.key, openings[asset.key].open, currentPrice) * 100
        : 0;
    }
    return {
      timestamp,
      indices: (constituents.SPY + constituents.QQQ + constituents.IWM) / 3,
      fx: (constituents.EURUSD + constituents.GBPUSD + constituents.JPY) / 3,
      constituents,
    };
  });

  return { points, reason: points.length ? null : "Waiting for a complete cross-source minute." };
}

function initialSnapshot(state: DisplayMarketState): LiveMarketSnapshot {
  return {
    status: state === "OPEN" ? "not_started" : "loading",
    connection: "REST",
    points: [],
    constituentReturns: null,
    lastUpdated: null,
    error: null,
  };
}

export class MarketDataController {
  private readonly store = emptyStore();
  private readonly abortController = new AbortController();
  private readonly listeners = new Set<(snapshot: LiveMarketSnapshot) => void>();
  private socket: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private wsReconnects = 0;
  private snapshot: LiveMarketSnapshot;
  private readonly live: boolean;

  constructor(
    private readonly marketStart: number,
    private readonly marketEnd: number,
    state: DisplayMarketState,
  ) {
    this.live = state === "LIVE";
    this.snapshot = initialSnapshot(state);
  }

  subscribe(listener: (snapshot: LiveMarketSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.snapshot;
  }

  async start() {
    if (this.stopped) return;
    if (Date.now() < this.marketStart) {
      this.setSnapshot({ status: "not_started", error: null });
      return;
    }
    try {
      await this.loadWindow(this.marketStart, Math.min(this.marketEnd - 1, Date.now()));
      this.emitCalculated();
      if (this.live) this.connectWebSocket();
    } catch (error) {
      this.setSnapshot({
        status: "unavailable",
        error: error instanceof Error ? error.message : "Live market data temporarily unavailable.",
      });
      if (this.live) this.startPolling();
    }
  }

  retry() {
    if (this.stopped) return;
    this.stopSocket();
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.pollTimer = null;
    this.reconnectTimer = null;
    this.wsReconnects = 0;
    this.setSnapshot({ status: "loading", connection: "REST", error: null });
    void this.start();
  }

  stop() {
    this.stopped = true;
    this.abortController.abort();
    this.stopSocket();
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.pollTimer = null;
    this.reconnectTimer = null;
    this.listeners.clear();
  }

  private async loadWindow(start: number, end: number) {
    if (end < start) return;
    const store = await fetchAllAssets(start, end, this.abortController.signal);
    for (const asset of LIVE_ASSETS) {
      store[asset.key].forEach((candle, timestamp) => this.store[asset.key].set(timestamp, candle));
    }
  }

  private emitCalculated() {
    const calculated = calculateBasketPoints(
      this.store,
      this.marketStart,
      this.marketEnd,
      Date.now(),
    );
    const latest = calculated.points.at(-1);
    const currentStatus = calculated.points.length
      ? this.live
        ? "live"
        : "complete"
      : "unavailable";
    this.setSnapshot({
      status: currentStatus,
      points: calculated.points,
      constituentReturns: latest?.constituents ?? null,
      lastUpdated: calculated.points.length ? Date.now() : null,
      error: calculated.reason,
    });
  }

  private setSnapshot(update: Partial<LiveMarketSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  private connectWebSocket() {
    if (this.stopped || typeof WebSocket === "undefined") {
      this.startPolling();
      return;
    }
    this.wsReconnects += 1;
    try {
      const socket = new WebSocket(BITGET_PUBLIC_WS_URL);
      this.socket = socket;
      socket.onopen = () => {
        if (this.stopped) return;
        socket.send(
          JSON.stringify({
            op: "subscribe",
            args: LIVE_ASSETS.map((asset) => ({
              instType: BITGET_CATEGORY,
              channel: "candle1m",
              instId: asset.symbol,
            })),
          }),
        );
        this.setSnapshot({ connection: "WEBSOCKET", status: "live", error: null });
        this.watchdog = setTimeout(() => socket.close(), 15_000);
        this.heartbeat = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send("ping");
        }, 25_000);
      };
      socket.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const message = JSON.parse(String(event.data)) as unknown;
          if (!isRecord(message) || !isRecord(message["arg"]) || !Array.isArray(message["data"]))
            return;
          const symbol = message["arg"]["instId"];
          const asset = LIVE_ASSETS.find((item) => item.symbol === symbol);
          if (!asset) return;
          if (this.watchdog) clearTimeout(this.watchdog);
          this.watchdog = null;
          message["data"]
            .map(parseCandleRow)
            .filter((candle): candle is LiveCandle => candle !== null)
            .forEach((candle) => this.store[asset.key].set(candle.timestamp, candle));
          this.emitCalculated();
        } catch {
          this.setSnapshot({ status: "unavailable", error: "Bitget sent malformed live data." });
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        this.clearHeartbeat();
        if (this.watchdog) clearTimeout(this.watchdog);
        this.watchdog = null;
        if (this.stopped) return;
        this.socket = null;
        if (this.wsReconnects < MAX_WS_RECONNECTS) {
          const delay =
            WS_RECONNECT_BACKOFF_MS[this.wsReconnects - 1] ?? WS_RECONNECT_BACKOFF_MS.at(-1)!;
          this.setSnapshot({
            status: "unavailable",
            connection: "DISCONNECTED",
            error: "Live stream disconnected. Reconnecting…",
          });
          this.reconnectTimer = setTimeout(() => this.connectWebSocket(), delay);
        } else {
          this.startPolling();
        }
      };
    } catch {
      this.startPolling();
    }
  }

  private startPolling() {
    if (this.stopped || !this.live || this.pollTimer) return;
    this.setSnapshot({
      connection: "POLLING",
      error: "Bitget live updates are reconnecting; market data may be delayed.",
    });
    const poll = async () => {
      this.pollTimer = null;
      if (this.stopped) return;
      try {
        const now = Date.now();
        await this.loadWindow(
          Math.max(this.marketStart, now - 2 * MINUTE_MS),
          Math.min(this.marketEnd - 1, now),
        );
        this.emitCalculated();
      } catch {
        this.setSnapshot({
          status: "unavailable",
          connection: "POLLING",
          error: "Live market data temporarily unavailable.",
        });
      } finally {
        if (!this.stopped) this.pollTimer = setTimeout(poll, LIVE_POLL_INTERVAL_MS);
      }
    };
    this.pollTimer = setTimeout(poll, LIVE_POLL_INTERVAL_MS);
  }

  private stopSocket() {
    this.clearHeartbeat();
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
    if (this.socket) this.socket.close();
    this.socket = null;
  }

  private clearHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
}

export function createMarketDataController(
  marketStart: number,
  marketEnd: number,
  state: DisplayMarketState,
) {
  return new MarketDataController(marketStart, marketEnd, state);
}
