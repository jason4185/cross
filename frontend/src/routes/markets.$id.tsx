import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Database, Info, RefreshCw, WifiOff } from "lucide-react";
import { useMemo } from "react";
import { PageShell } from "@/components/cross/page-shell";
import { CrossReadError } from "@/components/cross/read-error";
import { CrossMark, OutcomeChip, Panel, StatusBadge, useNow } from "@/components/cross/primitives";
import { TradePanel } from "@/components/cross/trade-panel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { displayMarketState, formatGen, formatUtc, percent } from "@/lib/cross/format";
import { contractErrorText } from "@/lib/cross/errors";
import { LIVE_ASSETS, type LiveAssetKey } from "@/lib/cross/live-market-data";
import { useLiveMarketData } from "@/lib/cross/use-live-market-data";
import { useCrossEvidence, useCrossMarket, useCrossMyPosition } from "@/lib/cross/queries";
import type { Market, SourceEvidence } from "@/lib/cross/types";

export const Route = createFileRoute("/markets/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Market #${params.id} — CROSS` },
      {
        name: "description",
        content:
          "Review live basket performance, source consensus, and stake in this CROSS market.",
      },
      { property: "og:title", content: `CROSS Market #${params.id}` },
      { property: "og:description", content: "INDICES versus FX over one exact UTC hour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketDetail,
});

function MarketDetail() {
  const { id } = Route.useParams();
  const marketId = Number(id);
  const now = useNow();
  const marketQuery = useCrossMarket(marketId);
  const positionQuery = useCrossMyPosition(marketId);
  const evidenceEnabled = Boolean(marketQuery.data && marketQuery.data.contractState !== "OPEN");
  const gateEvidence = useCrossEvidence(marketId, "GATE", evidenceEnabled);
  const bitgetEvidence = useCrossEvidence(marketId, "BITGET", evidenceEnabled);
  if (marketQuery.isLoading) return <DetailLoading />;
  if (marketQuery.error || !marketQuery.data) {
    if (contractErrorText(marketQuery.error).includes("market not found") || !marketQuery.error) {
      return <MarketNotFound />;
    }
    return <DetailError error={marketQuery.error} onRetry={() => void marketQuery.refetch()} />;
  }
  const market: Market = {
    ...marketQuery.data,
    state: displayMarketState(
      marketQuery.data.contractState,
      marketQuery.data.start,
      marketQuery.data.end,
      now ?? Date.now(),
    ),
    bettingOpen:
      marketQuery.data.contractState === "OPEN" && (now ?? Date.now()) < marketQuery.data.start,
    position: positionQuery.data?.exists ? positionQuery.data : undefined,
  };

  return (
    <MarketDetailView
      market={market}
      evidence={[gateEvidence.data, bitgetEvidence.data].filter((item): item is SourceEvidence =>
        Boolean(item),
      )}
    />
  );
}

function MarketDetailView({ market, evidence }: { market: Market; evidence: SourceEvidence[] }) {
  const liveData = useLiveMarketData(market.start, market.end, market.state);
  const chartData = useMemo(
    () =>
      liveData.points.map((point) => ({
        ...point,
        time: formatUtc(point.timestamp, false).replace(" UTC", ""),
      })),
    [liveData.points],
  );
  const latest = liveData.points.at(-1);
  const total = market.totalPoolWei;
  const isBeforeStart = market.contractState === "OPEN" && market.bettingOpen;
  const timeline = [
    { label: "Betting closes", timestamp: market.start },
    { label: "Market ends", timestamp: market.end },
    { label: "Settlement ready (+60s)", timestamp: market.settlementReady },
    { label: "Deadline (+5h)", timestamp: market.settlementDeadline },
  ];

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="mb-5">
        <Link to="/markets" search={{ q: "" }}>
          <ArrowLeft />
          All markets
        </Link>
      </Button>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <header>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="flex min-w-0 gap-3">
                <CrossMark className="mt-1" />
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-muted-foreground">MARKET #{market.id}</p>
                  <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
                    INDICES <span className="text-muted-foreground">vs</span> FX
                  </h1>
                </div>
              </div>
              <StatusBadge state={market.state} />
            </div>
            <p className="mt-4 text-base text-foreground">
              Which basket performs better from {formatUtc(market.start, false).replace(" UTC", "")}
              –{formatUtc(market.end, false)}?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Exact UTC window · {formatUtc(market.start)} to {formatUtc(market.end)}
            </p>
          </header>

          <LivePerformancePanel
            marketState={market.state}
            marketStart={market.start}
            chartData={chartData}
            latest={latest}
            status={liveData.status}
            connection={liveData.connection}
            lastUpdated={liveData.lastUpdated}
            error={liveData.error}
            isBeforeStart={isBeforeStart}
            officialWinner={market.winner}
            onRetry={liveData.retry}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {(["INDICES", "FX"] as const).map((side) => {
              const pool = side === "INDICES" ? market.indicesPoolWei : market.fxPoolWei;
              return (
                <Panel
                  key={side}
                  className={`p-5 ${market.winner === side ? "border-primary/50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <OutcomeChip side={side} />
                    {market.winner === side && (
                      <span className="text-[10px] font-bold text-primary">WINNER</span>
                    )}
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {side === "INDICES" ? "SPY / QQQ / IWM" : "EURUSD / GBPUSD / USDJPY"}
                  </p>
                  <p className="mt-5 text-2xl font-semibold">{formatGen(pool)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {total > 0n ? Number((pool * 100n) / total) : 50}% of pool · Your stake{" "}
                    {market.position?.side === side ? formatGen(market.position.stakeWei) : "—"}
                  </p>
                </Panel>
              );
            })}
          </div>

          <Constituents returns={liveData.constituentReturns} />

          <Panel className="p-5">
            <h2 className="text-sm font-semibold">Protocol timeline</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-4">
              {timeline.map((item, index) => (
                <div key={item.label} className="relative border-l border-primary/40 pl-3">
                  <p className="text-[10px] text-muted-foreground">0{index + 1}</p>
                  <p className="mt-1 text-xs font-medium">{item.label}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {formatUtc(item.timestamp, false)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Database className="size-4 text-primary" />
              Source consensus
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Strict 2-of-2 complete verdicts required.
            </p>
            <Accordion type="multiple" className="mt-3">
              {["GATE", "BITGET"].map((source) => {
                const item = evidence.find((entry) => entry.source === source);
                return (
                  <AccordionItem key={source} value={source}>
                    <AccordionTrigger>
                      <span className="flex items-center gap-3">
                        {source}
                        <span
                          className={item?.status === "VALID" ? "text-success" : "text-warning"}
                        >
                          {item?.status ?? "PENDING"}
                        </span>
                        {item?.winner && <OutcomeChip side={item.winner} />}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item ? (
                        <EvidenceDetails evidence={item} />
                      ) : (
                        "Settlement evidence is not available yet."
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </Panel>

          <Panel className="p-5">
            <Accordion type="single" collapsible>
              <AccordionItem value="rules">
                <AccordionTrigger>Market rules & resolution</AccordionTrigger>
                <AccordionContent className="space-y-2 text-muted-foreground">
                  <p>
                    Each basket is the equal-weighted mean of three normalized instrument returns
                    over the exact one-hour window.
                  </p>
                  <p>
                    USDJPY is direction-normalized: positive JPY means the yen strengthened against
                    USD.
                  </p>
                  <p>
                    If sources disagree, evidence is incomplete, or the winning side has zero
                    backing, the market is inconclusive and all stakes are refundable.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq">
                <AccordionTrigger>Can I change sides or sell?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  No. A wallet may only top up its first selected side, up to 70 GEN cumulative
                  stake. Positions are pooled claims, not tradable shares.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="settle">
                <AccordionTrigger>Who can settle the market?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Anyone can trigger settlement after the 60-second finalization grace. Retries
                  remain available for the full five-hour window.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Panel>
        </div>
        <aside>
          <TradePanel market={market} />
        </aside>
      </div>
    </PageShell>
  );
}

function DetailLoading() {
  return (
    <PageShell>
      <Panel className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        Loading market from Studio Next…
      </Panel>
    </PageShell>
  );
}

function DetailError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <PageShell>
      <CrossReadError error={error} onRetry={onRetry} />
    </PageShell>
  );
}

function EvidenceDetails({ evidence }: { evidence: SourceEvidence }) {
  return (
    <div className="space-y-3 text-xs">
      <p>
        Canonical {evidence.source} evidence returned by the CROSS contract. Window:{" "}
        {formatUtc(evidence.marketStart)} → {formatUtc(evidence.marketEnd)}.
      </p>
      {evidence.winner && (
        <p className="text-foreground">Official source vote: {evidence.winner}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {evidence.assets.map((asset) => (
          <div key={asset.asset} className="rounded-md border border-border bg-secondary/35 p-3">
            <div className="flex items-center justify-between gap-2 text-foreground">
              <span>{asset.asset}</span>
              <span className="font-mono text-[10px]">{asset.symbol}</span>
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              O {asset.open} · C {asset.close}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {asset.returnDirection === "inverse_price"
                ? "Inverse USDJPY return"
                : "Normal return"}{" "}
              · {asset.valid ? "validated" : "invalid"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketNotFound() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <CrossMark className="mx-auto size-12" />
        <p className="mt-6 font-mono text-xs text-primary">404 · OFF AXIS</p>
        <h1 className="mt-2 text-3xl font-semibold">Market not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This market ID does not exist in the current CROSS market index.
        </p>
        <Button asChild className="mt-6">
          <Link to="/markets" search={{ q: "" }}>
            Back to Markets
          </Link>
        </Button>
      </div>
    </div>
  );
}

interface ChartPoint {
  timestamp: number;
  time: string;
  indices: number;
  fx: number;
}

function LivePerformancePanel({
  marketState,
  marketStart,
  chartData,
  latest,
  status,
  connection,
  lastUpdated,
  error,
  isBeforeStart,
  officialWinner,
  onRetry,
}: {
  marketState: "OPEN" | "LIVE" | "SETTLEMENT_PENDING" | "SETTLED" | "INCONCLUSIVE";
  marketStart: number;
  chartData: ChartPoint[];
  latest: { indices: number; fx: number } | undefined;
  status: "not_started" | "loading" | "live" | "complete" | "unavailable";
  connection: "REST" | "WEBSOCKET" | "POLLING" | "DISCONNECTED";
  lastUpdated: number | null;
  error: string | null;
  isBeforeStart: boolean;
  officialWinner: "INDICES" | "FX" | undefined;
  onRetry: () => void;
}) {
  const isOfficiallySettled = marketState === "SETTLED";
  const isWindowComplete =
    !isBeforeStart &&
    (marketState === "OPEN" ||
      marketState === "SETTLEMENT_PENDING" ||
      marketState === "SETTLED" ||
      marketState === "INCONCLUSIVE");
  const displayIndices = latest?.indices ?? 0;
  const displayFx = latest?.fx ?? 0;
  const hasChart = chartData.length > 0;
  const statusText = isBeforeStart
    ? `Performance begins when the market starts at ${formatUtc(marketStart, false)}.`
    : status === "loading"
      ? "Loading exact-window Bitget candles…"
      : status === "unavailable"
        ? (error ?? "Live market data temporarily unavailable.")
        : isWindowComplete
          ? marketState === "SETTLED"
            ? "Completed exact-window performance"
            : marketState === "INCONCLUSIVE"
              ? "Market window complete · official result inconclusive"
              : "Market window complete · awaiting settlement"
          : "Live market data · Bitget";
  const connectionText = bitgetStatusLabel(status, connection);

  return (
    <Panel className="p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Basket performance %</h2>
            {!isBeforeStart && (
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/20 bg-primary/8 px-2 py-1 text-[9px] font-bold tracking-wide text-primary">
                <span
                  className={`size-1.5 rounded-full ${status === "live" ? "bg-success shadow-[0_0_8px_var(--success)]" : "bg-primary"}`}
                />
                {status === "live" ? "LIVE" : "BITGET"}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{statusText}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] lg:justify-end">
          <span className="text-success">● INDICES</span>
          <span className="text-fx">● FX</span>
          <span className="text-muted-foreground">{connectionText}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-y border-border py-3 sm:gap-4">
        <LiveMetric
          label={isOfficiallySettled ? "Final INDICES" : "BITGET INDICES"}
          value={latest ? percent(displayIndices) : "—"}
          tone="indices"
        />
        <LiveMetric
          label={isOfficiallySettled ? "Final FX" : "BITGET FX"}
          value={latest ? percent(displayFx) : "—"}
          tone="fx"
        />
        <LiveMetric
          label="Difference"
          value={
            latest
              ? `${displayIndices - displayFx >= 0 ? "+" : ""}${(displayIndices - displayFx).toFixed(2)} pp`
              : "—"
          }
        />
      </div>

      {isBeforeStart ? (
        <ChartEmpty title="Market not started" copy={statusText} />
      ) : hasChart ? (
        <div className="mt-5 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <ReferenceLine
                y={0}
                stroke="var(--muted-foreground)"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                unit="%"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(value: number) => `${value.toFixed(2)}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={(label) => `Time: ${String(label)} UTC`}
                formatter={(value, name) => [
                  percent(Number(value)),
                  name === "indices" ? "INDICES" : "FX",
                ]}
              />
              <Area
                type="monotone"
                dataKey="indices"
                fill="color-mix(in oklab, var(--success) 10%, transparent)"
                stroke="transparent"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="indices"
                stroke="var(--success)"
                strokeWidth={
                  marketState === "SETTLED" && latest ? (latest.indices >= latest.fx ? 3 : 2) : 2
                }
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="fx"
                stroke="var(--fx)"
                strokeWidth={
                  marketState === "SETTLED" && latest ? (latest.fx >= latest.indices ? 3 : 2) : 2
                }
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty
          title="Live chart data unavailable"
          copy={statusText}
          {...(status === "unavailable" ? { retry: onRetry } : {})}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Info className="size-3.5 text-primary" />
          Live chart uses Bitget market data for visualization. Official settlement requires
          independent Gate + Bitget consensus.
        </span>
        {!isBeforeStart && (
          <span className="shrink-0 font-mono">
            Last update: {lastUpdated ? formatUtc(lastUpdated, false) : "—"}
          </span>
        )}
      </div>
      {marketState === "INCONCLUSIVE" && (
        <p className="mt-3 rounded-md border border-warning/25 bg-warning/8 p-3 text-xs text-warning">
          Official market result: Inconclusive. The informational chart does not determine payout.
        </p>
      )}
      {marketState === "SETTLED" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Official winner:{" "}
          <strong className="text-foreground">{officialWinner ?? "Unavailable"}</strong>
        </p>
      )}
    </Panel>
  );
}

function LiveMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "indices" | "fx";
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-mono text-sm font-semibold ${tone === "indices" ? "text-success" : tone === "fx" ? "text-fx" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function bitgetStatusLabel(
  status: "not_started" | "loading" | "live" | "complete" | "unavailable",
  connection: "REST" | "WEBSOCKET" | "POLLING" | "DISCONNECTED",
) {
  if (status === "unavailable") {
    if (connection === "DISCONNECTED") return "Bitget · Reconnecting";
    if (connection === "POLLING") return "Bitget · Connected";
    return "Bitget · Unavailable";
  }
  if (status === "live") return connection === "POLLING" ? "Bitget · Connected" : "Bitget · Live";
  return "Bitget";
}

function ChartEmpty({ title, copy, retry }: { title: string; copy: string; retry?: () => void }) {
  return (
    <div className="mt-5 flex h-72 flex-col items-center justify-center rounded-md border border-dashed border-border bg-secondary/35 px-6 text-center">
      <WifiOff className="size-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{copy}</p>
      {retry && (
        <Button className="mt-4" size="sm" variant="outline" onClick={retry}>
          <RefreshCw />
          Retry
        </Button>
      )}
    </div>
  );
}

function Constituents({ returns }: { returns: Record<LiveAssetKey, number> | null }) {
  return (
    <Panel className="p-5">
      <Accordion type="single" collapsible>
        <AccordionItem value="constituents">
          <AccordionTrigger>Basket constituents</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <ConstituentGroup title="INDICES" keys={["SPY", "QQQ", "IWM"]} returns={returns} />
              <ConstituentGroup title="FX" keys={["EURUSD", "GBPUSD", "JPY"]} returns={returns} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Panel>
  );
}

function ConstituentGroup({
  title,
  keys,
  returns,
}: {
  title: string;
  keys: LiveAssetKey[];
  returns: Record<LiveAssetKey, number> | null;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <OutcomeChip side={title === "INDICES" ? "INDICES" : "FX"} />
        <span className="text-[10px] text-muted-foreground">normalized return</span>
      </div>
      <div className="divide-y divide-border rounded-md border border-border">
        {keys.map((key) => {
          const asset = LIVE_ASSETS.find((item) => item.key === key);
          return (
            <div key={key} className="flex items-center justify-between px-3 py-2 text-xs">
              <span>{asset?.label ?? key}</span>
              <span
                className={`font-mono ${returns ? (returns[key] >= 0 ? "text-success" : "text-destructive") : "text-muted-foreground"}`}
              >
                {returns ? percent(returns[key]) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
