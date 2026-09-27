import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Database, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/cross/page-shell";
import { CrossMark, OutcomeChip, Panel, StatusBadge, useNow } from "@/components/cross/primitives";
import { CrossReadError } from "@/components/cross/read-error";
import { TradePanel } from "@/components/cross/trade-panel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { displayMarketState, formatGen, formatUtc } from "@/lib/cross/format";
import { formatCrossError } from "@/lib/cross/errors";
import { useEvidence, useMarket, useMyPosition } from "@/lib/cross/queries";
import type { Market, SourceEvidence } from "@/lib/cross/types";
import { MarketDetail } from "./markets.$id";

export const Route = createFileRoute("/markets/$source/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Market #${params.id} — CROSS` },
      {
        name: "description",
        content: "Review a live CROSS market and its contract-authoritative settlement evidence.",
      },
    ],
  }),
  component: SourceMarketDetail,
});

function SourceMarketDetail() {
  const { source, id } = Route.useParams();
  const marketId = Number(id);
  if (source === "cross") return <MarketDetail source="CROSS" marketId={marketId} />;
  if (source === "crypto") return <CryptoMarketDetail marketId={marketId} />;
  return <NotFound />;
}

function CryptoMarketDetail({ marketId }: { marketId: number }) {
  const now = useNow();
  const marketQuery = useMarket("CRYPTO", marketId);
  const positionQuery = useMyPosition("CRYPTO", marketId);
  const market = marketQuery.data;
  const enabled = Boolean(market && market.contractState !== "OPEN");
  const binanceEvidence = useEvidence("CRYPTO", marketId, "BINANCE", enabled);
  const gateEvidence = useEvidence("CRYPTO", marketId, "GATE", enabled);
  const bitgetEvidence = useEvidence("CRYPTO", marketId, "BITGET", enabled);
  const evidence = [
    { source: "BINANCE" as const, query: binanceEvidence },
    { source: "GATE" as const, query: gateEvidence },
    { source: "BITGET" as const, query: bitgetEvidence },
  ];
  if (marketQuery.isLoading) return <Loading />;
  if (!market)
    return marketQuery.error ? (
      <DetailError error={marketQuery.error} onRetry={() => void marketQuery.refetch()} />
    ) : (
      <NotFound />
    );
  const current: Market = {
    ...market,
    state: displayMarketState(market.contractState, market.start, market.end, now ?? Date.now()),
    bettingOpen: market.contractState === "OPEN" && (now ?? Date.now()) < market.start,
    position: positionQuery.data?.exists ? positionQuery.data : undefined,
  };
  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="mb-5">
        <Link to="/markets" search={{ q: "" }}>
          <ArrowLeft /> All markets
        </Link>
      </Button>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <header>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="flex min-w-0 gap-3">
                <CrossMark className="mt-1" />
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-muted-foreground">
                    CRYPTO MARKET #{current.id}
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
                    {current.subject}{" "}
                    <span className="text-muted-foreground">
                      {current.marketType === "UP_DOWN" ? "UP / DOWN" : "DOMINANCE"}
                    </span>
                  </h1>
                </div>
              </div>
              <StatusBadge state={current.state} />
            </div>
            <p className="mt-4 text-base">
              {current.marketType === "UP_DOWN"
                ? "Will this asset finish above or below its opening price?"
                : "Which asset performs best during this window?"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Exact UTC window · {formatUtc(current.start)} to {formatUtc(current.end)} ·{" "}
              {current.durationSeconds / 3600} hour{current.durationSeconds === 3600 ? "" : "s"}
            </p>
          </header>
          {current.marketType === "UP_DOWN" ? (
            <Panel className="p-5">
              <h2 className="text-sm font-semibold">UP / DOWN resolution</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                UP means the closing price is above the opening price. DOWN means it is below. The
                contract resolves this from independent market candles; TIE is never a betting
                choice.
              </p>
            </Panel>
          ) : (
            <Panel className="p-5">
              <h2 className="text-sm font-semibold">Dominance category</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The highest exact percentage return wins, including when all returns are negative.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {current.allowedOutcomes.map((outcome) => (
                  <OutcomeChip key={outcome} side={outcome} />
                ))}
              </div>
            </Panel>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {current.allowedOutcomes.map((outcome) => {
              const pool = current.outcomePools[outcome] ?? 0n;
              return (
                <Panel
                  key={outcome}
                  className={`p-5 ${current.winner === outcome ? "border-primary/50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <OutcomeChip side={outcome} />
                    {current.winner === outcome && (
                      <span className="text-[10px] font-bold text-primary">WINNER</span>
                    )}
                  </div>
                  <p className="mt-5 text-2xl font-semibold">{formatGen(pool)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your stake{" "}
                    {current.position?.side === outcome
                      ? formatGen(current.position.stakeWei)
                      : "—"}
                  </p>
                </Panel>
              );
            })}
          </div>
          <Panel className="p-5">
            <h2 className="text-sm font-semibold">Protocol timeline</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-4">
              {[
                ["Betting closes", current.start],
                ["Market ends", current.end],
                ["Settlement ready (+60s)", current.settlementReady],
                ["Deadline (+5h)", current.settlementDeadline],
              ].map(([label, timestamp], index) => (
                <div key={String(label)} className="border-l border-primary/40 pl-3">
                  <p className="text-[10px] text-muted-foreground">0{index + 1}</p>
                  <p className="mt-1 text-xs font-medium">{label}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {formatUtc(Number(timestamp), false)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Database className="size-4 text-primary" /> Source consensus
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Binance, Gate, and Bitget must produce matching complete results; the contract is
              authoritative.
            </p>
            <Accordion type="multiple" className="mt-3">
              {evidence.map(({ source, query }) => (
                <AccordionItem key={source} value={source}>
                  <AccordionTrigger>
                    <span className="flex items-center gap-3">
                      {source}
                      <span
                        className={query.data?.status === "VALID" ? "text-success" : "text-warning"}
                      >
                        {query.data?.status ??
                          (query.error ? "ERROR" : query.isLoading ? "LOADING" : "PENDING")}
                      </span>
                      {query.data?.winner && <OutcomeChip side={query.data.winner} />}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {query.data ? (
                      <CryptoEvidenceDetails evidence={query.data} />
                    ) : query.error ? (
                      <div className="space-y-3">
                        <p>{formatCrossError(query.error)}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void query.refetch()}
                          disabled={query.isFetching}
                        >
                          <RefreshCw className={query.isFetching ? "animate-spin" : ""} /> Retry
                        </Button>
                      </div>
                    ) : (
                      "Settlement evidence is not available yet."
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Panel>
          <Panel className="p-5">
            <h2 className="text-sm font-semibold">Market rules</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {current.marketType === "UP_DOWN"
                ? "Only UP and DOWN can be selected. A wallet can top up its original side up to 70 GEN cumulative."
                : `Only ${current.allowedOutcomes.join(", ")} can be selected in this category.`}{" "}
              If no 2-of-3 consensus is reached by the deadline, the market becomes inconclusive and
              original stakes are refundable.
            </p>
          </Panel>
        </div>
        <aside>
          <TradePanel market={current} />
        </aside>
      </div>
    </PageShell>
  );
}

function CryptoEvidenceDetails({ evidence }: { evidence: SourceEvidence }) {
  return (
    <div className="space-y-3 text-xs">
      <p>
        {evidence.reason} · Window {formatUtc(evidence.marketStart)} →{" "}
        {formatUtc(evidence.marketEnd)}.
      </p>
      {evidence.assets.map((asset) => (
        <div key={asset.asset} className="rounded-md border border-border bg-secondary/35 p-3">
          <div className="flex items-center justify-between text-foreground">
            <span>{asset.asset}</span>
            <span>{asset.valid ? "VALID" : "INVALID"}</span>
          </div>
          <div className="mt-2 space-y-1 font-mono text-[10px]">
            {asset.candles?.map((candle) => (
              <p key={candle.timestamp}>
                {formatUtc(candle.timestamp, false)} · {candle.open} → {candle.close}
              </p>
            ))}
          </div>
          <p className="mt-1 text-[10px]">
            Aggregate: {asset.open} → {asset.close}
          </p>
        </div>
      ))}
    </div>
  );
}
function Loading() {
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
function NotFound() {
  return (
    <PageShell>
      <Panel className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
        <CrossMark className="size-12" />
        <h1 className="mt-5 text-2xl font-semibold">Market not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This source-aware market identity does not exist.
        </p>
        <Button asChild className="mt-5">
          <Link to="/markets" search={{ q: "" }}>
            Back to Markets
          </Link>
        </Button>
      </Panel>
    </PageShell>
  );
}
