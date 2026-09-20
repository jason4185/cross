import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCross } from "@/components/cross/app-context";
import { PageShell } from "@/components/cross/page-shell";
import { EmptyState, OutcomeChip, Panel, StatusBadge } from "@/components/cross/primitives";
import { TransactionAction } from "@/components/cross/transaction-action";
import { crossContract, safeCrossWrite } from "@/lib/cross/contract";
import { formatGen, formatUtc, windowLabel } from "@/lib/cross/format";
import { useCrossClaimable, useCrossPortfolio } from "@/lib/cross/queries";
import type { PortfolioPosition } from "@/lib/cross/types";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — CROSS" },
      { name: "description", content: "Track CROSS stakes, settled outcomes, and claimable GEN." },
    ],
  }),
  component: PortfolioPage,
});

type PortfolioTab = "active" | "claimable" | "history";

function PortfolioPage() {
  const { connected, connectWallet } = useCross();
  const [tab, setTab] = useState<PortfolioTab>("active");
  const positions = useCrossPortfolio();
  const claimable = useCrossClaimable();
  const claimableByMarket = useMemo(
    () => new Map((claimable.data ?? []).map((item) => [item.market.id, item])),
    [claimable.data],
  );
  const totalStaked = (positions.data ?? []).reduce(
    (sum, item) => sum + item.position.stakeWei,
    0n,
  );
  const totalClaimable = (claimable.data ?? []).reduce(
    (sum, item) => sum + item.position.claimableWei,
    0n,
  );
  const active = (positions.data ?? []).filter(
    (item) => item.market.contractState === "OPEN",
  ).length;
  const settled = (positions.data ?? []).filter(
    (item) => item.market.contractState !== "OPEN",
  ).length;
  const visible = (positions.data ?? []).filter((item) => {
    if (tab === "active") return item.market.contractState === "OPEN";
    if (tab === "claimable") return claimableByMarket.has(item.market.id);
    return item.market.contractState !== "OPEN" && !claimableByMarket.has(item.market.id);
  });
  const stats = [
    { label: "Total staked", value: formatGen(totalStaked), icon: CircleDollarSign },
    { label: "Claimable", value: formatGen(totalClaimable), icon: CheckCircle2 },
    { label: "Active positions", value: active, icon: WalletCards },
    { label: "Settled positions", value: settled, icon: Clock3 },
  ];

  return (
    <PageShell>
      <section className="border-b border-border pb-8">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-primary">ACCOUNT</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Your Portfolio</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Track your GEN exposure, settlement outcomes and claimable balances across CROSS markets.
        </p>
      </section>
      <section className="mt-6 grid grid-cols-2 border-x border-border sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }, index) => (
          <div
            key={label}
            className={`p-4 sm:p-5 ${index < 3 ? "border-r border-border" : ""} ${index < 2 ? "max-sm:border-b" : ""}`}
          >
            <Icon className="size-4 text-muted-foreground" />
            <p className="mt-5 text-xl font-semibold sm:text-2xl">{value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      {!connected ? (
        <Panel className="mt-8 flex min-h-64 flex-col items-center justify-center px-6 text-center">
          <WalletCards className="size-8 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">
            Connect your wallet to view your CROSS positions.
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Positions, claims, and refunds are read directly from Studio Next.
          </p>
          <Button className="mt-5" onClick={() => void connectWallet()}>
            Connect Wallet
          </Button>
        </Panel>
      ) : (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex flex-wrap gap-2">
              {(["active", "claimable", "history"] as const).map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={tab === item ? "secondary" : "ghost"}
                  onClick={() => setTab(item)}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </Button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {positions.data?.length ?? "—"} loaded contract position
              {positions.data?.length === 1 ? "" : "s"}
            </span>
          </div>
          {(positions.isLoading || claimable.isLoading) && (
            <Panel className="mt-4 p-6 text-center text-sm text-muted-foreground">
              Loading wallet positions…
            </Panel>
          )}
          {(positions.error || claimable.error) && (
            <Panel className="mt-4 p-6 text-center text-sm text-destructive">
              Wallet positions could not be loaded from Studio Next.
            </Panel>
          )}
          {!positions.isLoading && !positions.error && !visible.length && (
            <div className="mt-4">
              <EmptyState
                title={
                  tab === "active"
                    ? "No positions found for this wallet."
                    : tab === "claimable"
                      ? "You do not have any claimable positions right now."
                      : "No position history found."
                }
                copy="Your portfolio is populated from the CROSS contract after a confirmed stake or settlement."
              />
            </div>
          )}
          <div className="mt-4 space-y-3">
            {visible.map((item) => (
              <PositionCard
                key={item.market.id}
                item={item}
                claimable={claimableByMarket.get(item.market.id)}
              />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}

function PositionCard({
  item,
  claimable,
}: {
  item: PortfolioPosition;
  claimable?: PortfolioPosition | undefined;
}) {
  const { market, position } = item;
  const action = claimable?.position.refundable
    ? "refund"
    : claimable?.position.claimable
      ? "claim"
      : null;
  return (
    <Panel className="p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] text-muted-foreground">MARKET #{market.id}</p>
            <StatusBadge state={market.state} />
          </div>
          <h2 className="mt-2 text-base font-semibold">
            INDICES <span className="text-muted-foreground">vs</span> FX
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {windowLabel(market.start, market.end)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <OutcomeChip side={position.side ?? "INDICES"} active />
            <span className="text-xs text-muted-foreground">
              Stake{" "}
              <strong className="font-mono text-foreground">{formatGen(position.stakeWei)}</strong>
            </span>
            {market.winner && (
              <span className="text-xs text-muted-foreground">
                Winner <strong className="text-foreground">{market.winner}</strong>
              </span>
            )}
            {claimable && (
              <span className="text-xs text-success">
                {action === "refund" ? "Refundable" : "Claimable"}{" "}
                <strong className="font-mono">{formatGen(claimable.position.claimableWei)}</strong>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button asChild variant="outline" size="sm">
            <Link to="/markets/$id" search={{ q: "" }} params={{ id: String(market.id) }}>
              View Market <ArrowUpRight />
            </Link>
          </Button>
          {action === "claim" && (
            <TransactionAction
              call={safeCrossWrite(() => crossContract.claim(market.id))}
              label="Claim winnings"
            />
          )}
          {action === "refund" && (
            <TransactionAction
              call={safeCrossWrite(() => crossContract.claimRefund(market.id))}
              label="Claim refund"
            />
          )}
          {!action && (position.claimed || position.refunded) && (
            <span className="inline-flex items-center gap-2 px-3 text-xs text-muted-foreground">
              <CheckCircle2 className="size-4" />
              Completed
            </span>
          )}
        </div>
      </div>
    </Panel>
  );
}
