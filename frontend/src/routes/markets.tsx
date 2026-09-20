import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { CircleDollarSign, Clock3, Layers3, Search, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/cross/page-shell";
import { EmptyState, MarketCard, Panel, useNow } from "@/components/cross/primitives";
import { CrossReadError } from "@/components/cross/read-error";
import { useCross } from "@/components/cross/app-context";
import { displayMarketState, formatGen } from "@/lib/cross/format";
import { useCrossConfig, useCrossMarkets, useCrossMyPositions } from "@/lib/cross/queries";
import type { DisplayMarketState, Market } from "@/lib/cross/types";

export const Route = createFileRoute("/markets")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Markets — CROSS" },
      {
        name: "description",
        content: "Browse one-hour INDICES versus FX pooled prediction markets.",
      },
      { property: "og:title", content: "CROSS Markets" },
      {
        property: "og:description",
        content: "One-hour cross-asset markets with strict dual-source settlement.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: MarketsPage,
});

const filters: Array<"ALL" | DisplayMarketState> = [
  "ALL",
  "OPEN",
  "LIVE",
  "SETTLEMENT_PENDING",
  "SETTLED",
  "INCONCLUSIVE",
];
const labels: Record<(typeof filters)[number], string> = {
  ALL: "All Markets",
  OPEN: "Open",
  LIVE: "Live",
  SETTLEMENT_PENDING: "Ready to Settle",
  SETTLED: "Settled",
  INCONCLUSIVE: "Inconclusive",
};

function MarketsPage() {
  const matches = useMatches();
  return matches.some((match) => match.routeId === "/markets/$id") ? (
    <Outlet />
  ) : (
    <MarketsIndexPage />
  );
}

function MarketsIndexPage() {
  const { configError, configLoading } = useCross();
  const configQuery = useCrossConfig();
  const markets = useCrossMarkets();
  const positions = useCrossMyPositions(0, 50);
  const now = useNow();
  const search = Route.useSearch();
  const [filter, setFilter] = useState<(typeof filters)[number]>("ALL");
  const [sort, setSort] = useState("soonest");
  const [query, setQuery] = useState(search.q);
  const positionByMarket = useMemo(
    () => new Map((positions.data ?? []).map((position) => [position.marketId, position])),
    [positions.data],
  );
  const list = useMemo(() => {
    const realMarkets = (markets.data ?? []).map((market) => ({
      ...market,
      state: displayMarketState(market.contractState, market.start, market.end, now ?? Date.now()),
      bettingOpen: market.contractState === "OPEN" && (now ?? Date.now()) < market.start,
      position: positionByMarket.get(market.id),
    }));
    return realMarkets
      .filter(
        (market) =>
          (filter === "ALL" || market.state === filter) &&
          `${market.id} indices fx spy qqq iwm eurusd gbpusd usdjpy`.includes(query.toLowerCase()),
      )
      .sort((a, b) =>
        sort === "newest"
          ? b.id - a.id
          : sort === "pool"
            ? compareBigInt(b.totalPoolWei, a.totalPoolWei)
            : a.end - b.end,
      );
  }, [filter, markets.data, now, positionByMarket, query, sort]);
  const totalOpenPool = (markets.data ?? [])
    .filter(
      (market) =>
        market.bettingOpen && market.contractState === "OPEN" && (now ?? Date.now()) < market.start,
    )
    .reduce((total, market) => total + market.totalPoolWei, 0n);
  const liveCount = (markets.data ?? []).filter(
    (market) =>
      displayMarketState(market.contractState, market.start, market.end, now ?? Date.now()) ===
      "LIVE",
  ).length;
  const readyCount = (markets.data ?? []).filter((market) => market.settlementAvailable).length;
  const yourPositions = positions.data ? positions.data.length : "—";
  const stats = [
    { label: "Open Pool", value: formatGen(totalOpenPool), icon: CircleDollarSign },
    { label: "Live Markets", value: liveCount, icon: Layers3 },
    { label: "Your Positions", value: yourPositions, icon: WalletCards },
    { label: "Ready to Settle", value: readyCount, icon: Clock3 },
  ];

  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border pb-9">
        <div className="subtle-grid absolute inset-0 opacity-15 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative max-w-3xl">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-primary">
            1-HOUR CROSS-ASSET MARKETS
          </p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
            Indices <span className="text-muted-foreground">vs</span> FX
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Each market compares equal-weighted basket performance across one exact UTC hour. Stake
            on the stronger basket, then settle through strict GATE + BITGET consensus.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/create">Create next market</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/how-it-works">How settlement works</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 border-x border-border sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }, index) => (
          <div
            key={label}
            className={`p-4 sm:p-5 ${index < 3 ? "border-r border-border" : ""} ${index === 1 ? "max-sm:border-r-0" : ""} ${index < 2 ? "max-sm:border-b" : ""}`}
          >
            <Icon className="size-4 text-muted-foreground" />
            <p className="mt-5 text-xl font-semibold sm:text-2xl">{value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      {configError ? (
        <CrossReadError
          error={configError}
          onRetry={() => void configQuery.refetch()}
          isRetrying={configQuery.isFetching}
        />
      ) : markets.error ? (
        <CrossReadError
          error={markets.error}
          onRetry={() => void markets.refetch()}
          isRetrying={markets.isFetching}
        />
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Market state
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col">
            {filters.map((item) => (
              <Button
                key={item}
                onClick={() => setFilter(item)}
                variant={filter === item ? "secondary" : "ghost"}
                size="sm"
                className="shrink-0 justify-start"
              >
                {labels[item]}
                <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground lg:inline">
                  {item === "ALL"
                    ? (markets.data?.length ?? 0)
                    : (markets.data ?? []).filter((market) => market.state === item).length}
                </span>
              </Button>
            ))}
          </div>
          <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Sort
          </p>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-secondary px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="soonest">Closing soonest</option>
            <option value="newest">Newest</option>
            <option value="pool">Largest pool</option>
          </select>
        </aside>
        <div>
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="bg-card pl-9"
                placeholder="Search market number or basket"
              />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{list.length} markets</span>
          </div>
          {configLoading || markets.isLoading ? (
            <Panel className="flex min-h-56 items-center justify-center p-6 text-sm text-muted-foreground">
              Loading CROSS markets…
            </Panel>
          ) : list.length ? (
            <div className="space-y-3">
              {list.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No CROSS markets have been created yet"
              copy="Markets created on Studio Next will appear here automatically."
            />
          )}
          <p className="mt-4 text-[10px] text-muted-foreground">
            Loaded from the CROSS contract: {markets.data?.length ?? "—"} market
            {markets.data?.length === 1 ? "" : "s"}.
          </p>
        </div>
      </section>
    </PageShell>
  );
}

function compareBigInt(left: bigint, right: bigint) {
  return left > right ? 1 : left < right ? -1 : 0;
}
