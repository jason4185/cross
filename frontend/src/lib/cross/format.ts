import type { ContractMarketState, DisplayMarketState } from "./types";

export const HOUR = 3_600_000;
export const MINUTE = 60_000;
export const SECOND = 1_000;
export const GEN_WEI = 1_000_000_000_000_000_000n;
export const SETTLEMENT_GRACE = 60 * SECOND;
export const SETTLEMENT_RETRY_WINDOW = 18_000 * SECOND;

export function displayMarketState(
  state: ContractMarketState,
  start: number,
  end: number,
  now = Date.now(),
): DisplayMarketState {
  return state === "OPEN" && now >= start && now < end ? "LIVE" : state;
}

export function nextMarketStart(timestamp: number) {
  const seconds = Math.floor(timestamp / SECOND);
  return (Math.floor(seconds / 3_600) + 1) * HOUR;
}

export function settlementReady(marketEnd: number) {
  return marketEnd + SETTLEMENT_GRACE;
}

export function settlementDeadline(marketEnd: number) {
  return settlementReady(marketEnd) + SETTLEMENT_RETRY_WINDOW;
}

export function parseGen(value: string): bigint {
  const text = value.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("Enter a valid GEN amount.");
  const parts = text.split(".");
  const whole = parts[0] ?? "";
  const fraction = parts[1] ?? "";
  if (fraction.length > 18) throw new Error("GEN amounts support at most 18 decimal places.");
  return BigInt(whole) * GEN_WEI + BigInt(fraction.padEnd(18, "0") || "0");
}

export function formatGen(value: bigint | null | undefined, compact = false) {
  if (value === null || value === undefined) return "—";
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / GEN_WEI;
  const fraction = (absolute % GEN_WEI).toString().padStart(18, "0").replace(/0+$/, "");
  if (!fraction) return `${sign}${whole.toLocaleString("en-US")} GEN`;
  const shownFraction = compact ? fraction.slice(0, 2).replace(/0+$/, "") : fraction;
  return `${sign}${whole.toLocaleString("en-US")}.${shownFraction} GEN`;
}

export function formatWei(value: bigint | null | undefined) {
  return value === null || value === undefined ? "—" : `${value.toLocaleString("en-US")} wei`;
}

export function formatUtc(timestamp: number, includeDate = true) {
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      ...(includeDate ? { day: "2-digit", month: "short", year: "numeric" } : {}),
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(timestamp)
      .replace(",", "") + " UTC"
  );
}

export function windowLabel(start: number, end: number) {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  }).format(start);
  const time = (value: number) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(value);
  return `${date} · ${time(start)}–${time(end)} UTC`;
}

export function countdown(target: number, now: number | null) {
  if (!now) return "—";
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / HOUR);
  const m = Math.floor((diff % HOUR) / MINUTE);
  const s = Math.floor((diff % MINUTE) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function payoutFor(pool: bigint, winnerPool: bigint, stake: bigint) {
  return winnerPool > 0n ? (stake * pool) / winnerPool : 0n;
}

export function percent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
