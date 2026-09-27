import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, Clock3, Radio, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { countdown, displayMarketState, formatGen, windowLabel } from "@/lib/cross/format";
import type { DisplayMarketState, Market, Outcome } from "@/lib/cross/types";

export function CrossMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative block h-7 w-7 shrink-0", className)} aria-hidden>
      <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rotate-45 bg-primary" />
      <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 -rotate-45 bg-foreground" />
      <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-background" />
    </span>
  );
}

const statusStyle: Record<DisplayMarketState, string> = {
  OPEN: "border-success/30 bg-success/10 text-success",
  LIVE: "border-fx/30 bg-fx/10 text-fx",
  SETTLEMENT_PENDING: "border-warning/30 bg-warning/10 text-warning",
  SETTLED: "border-primary/30 bg-primary/10 text-primary",
  INCONCLUSIVE: "border-muted-foreground/30 bg-muted text-muted-foreground",
};
export function StatusBadge({ state }: { state: DisplayMarketState }) {
  const Icon =
    state === "OPEN"
      ? Radio
      : state === "LIVE" || state === "SETTLEMENT_PENDING"
        ? Clock3
        : state === "SETTLED"
          ? CheckCircle2
          : XCircle;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-[10px] font-semibold tracking-wide",
        statusStyle[state],
      )}
    >
      <Icon className="size-3" />
      {state.replace("_", " ")}
    </span>
  );
}

export function OutcomeChip({ side, active = false }: { side: Outcome; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold",
        side === "INDICES" || side === "UP" || side === "BTC" || side === "SOL" || side === "BNB"
          ? "border-success/25 bg-success/8 text-success"
          : "border-fx/25 bg-fx/8 text-fx",
        active && "ring-1 ring-current",
      )}
    >
      {side}
    </span>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-border bg-card", className)}>{children}</div>;
}
export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="truncate text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function MarketCard({ market }: { market: Market }) {
  const total = market.totalPoolWei;
  const now = useNow();
  const state = displayMarketState(
    market.contractState,
    market.start,
    market.end,
    now ?? Date.now(),
  );
  const statusText =
    state === "OPEN"
      ? `Betting closes in ${countdown(market.start, now)}`
      : state === "LIVE"
        ? `Ends in ${countdown(market.end, now)}`
        : state === "SETTLEMENT_PENDING"
          ? "Consensus pending"
          : state === "SETTLED"
            ? `${market.winner} won`
            : "Refunds available";
  return (
    <Panel className="group overflow-hidden transition-colors hover:border-primary/35">
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              MARKET #{market.id} · {windowLabel(market.start, market.end)}
            </p>
            <h3 className="mt-2 truncate text-lg font-semibold">{marketTitle(market)}</h3>
          </div>
          <StatusBadge state={state} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {market.source === "CROSS" ? (
            <>
              <span className="text-[10px] text-muted-foreground">INDICES</span>
              {["SPY", "QQQ", "IWM"].map((x) => (
                <span key={x} className="asset-chip indices">
                  {x}
                </span>
              ))}
              <span className="mx-1 text-muted-foreground">/</span>
              <span className="text-[10px] text-muted-foreground">FX</span>
              {["EUR", "GBP", "JPY"].map((x) => (
                <span key={x} className="asset-chip fx">
                  {x}
                </span>
              ))}
            </>
          ) : (
            market.allowedOutcomes.map((outcome) => (
              <span key={outcome} className="asset-chip indices">
                {outcome}
              </span>
            ))
          )}
        </div>
        <div className="mt-5">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {market.allowedOutcomes.map((outcome) => (
              <span key={outcome} className="text-muted-foreground">
                {outcome}{" "}
                <strong className="text-foreground">
                  {formatGen(market.outcomePools[outcome] ?? 0n, true)}
                </strong>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border pt-4">
          <div className="min-w-0">
            <p className="text-xs font-medium">{statusText}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {formatGen(total)} total pool{" "}
              {market.position
                ? `· Your ${market.position.side ?? ""} stake: ${formatGen(market.position.stakeWei)}`
                : "· No position"}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link
              to="/markets/$source/$id"
              search={{ q: "" }}
              params={{
                source: market.source === "CROSS" ? "cross" : "crypto",
                id: String(market.id),
              }}
            >
              View <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function marketTitle(market: Market) {
  if (market.source === "CROSS")
    return (
      <>
        INDICES <span className="text-muted-foreground">vs</span> FX
      </>
    );
  return market.marketType === "UP_DOWN" ? (
    <>
      {market.subject} <span className="text-muted-foreground">UP / DOWN</span>
    </>
  ) : (
    <>
      {market.subject} <span className="text-muted-foreground">DOMINANCE</span>
    </>
  );
}

export function EmptyState({
  title,
  copy,
  reset,
}: {
  title: string;
  copy: string;
  reset?: () => void;
}) {
  return (
    <Panel className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
      <RotateCcw className="mb-4 size-7 text-muted-foreground" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{copy}</p>
      {reset && (
        <Button className="mt-5" variant="outline" size="sm" onClick={reset}>
          Reset filters
        </Button>
      )}
    </Panel>
  );
}
