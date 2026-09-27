import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Database, ShieldCheck, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/cross/page-shell";
import { OutcomeChip, Panel } from "@/components/cross/primitives";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How CROSS works" },
      {
        name: "description",
        content: "Learn how CROSS settles indices, FX, and crypto prediction markets.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const steps = [
  {
    number: "01",
    title: "Market end",
    copy: "The exact one-hour UTC window closes after 3,600 seconds.",
    icon: Timer,
  },
  {
    number: "02",
    title: "Finalization grace",
    copy: "A 60-second grace period lets the last hourly candles finalize.",
    icon: ClockIcon,
  },
  {
    number: "03",
    title: "Settlement ready",
    copy: "Anyone can request independent source settlement at this boundary.",
    icon: Database,
  },
  {
    number: "04",
    title: "Full retry window",
    copy: "Retries remain available for 18,000 seconds after settlement_ready.",
    icon: ShieldCheck,
  },
];

function ClockIcon({ className }: { className?: string }) {
  return <Timer className={className} />;
}

function HowItWorksPage() {
  return (
    <PageShell className="max-w-6xl">
      <section className="relative overflow-hidden border-b border-border pb-10">
        <div className="subtle-grid absolute inset-0 opacity-15 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative max-w-3xl">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-primary">PROTOCOL GUIDE</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">How CROSS works</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
            CROSS is one pooled prediction-market product. It supports the original INDICES vs FX
            market plus crypto UP/DOWN and crypto DOMINANCE markets.
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <InfoPanel eyebrow="05 · Dominance" title="Highest exact return wins">
          <p>
            DOMINANCE compares percentage returns using exact rational arithmetic. A least-negative
            return wins when every asset falls, and an exact tie produces no user-resolvable winner.
          </p>
        </InfoPanel>
        <InfoPanel eyebrow="06 · Inconclusive" title="Fail closed, then refund">
          <p>
            If sources disagree, evidence is unavailable, or a consensus winner has zero backing,
            the contract remains retryable until the deadline, then becomes INCONCLUSIVE and refunds
            original stakes.
          </p>
        </InfoPanel>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <InfoPanel eyebrow="01 · Market formats" title="Three CROSS market formats">
          <p>
            CROSS includes INDICES vs FX, crypto UP/DOWN for BTC, ETH, SOL, BNB, XRP, and DOGE, and
            crypto DOMINANCE for MAJORS or LARGE_CAP_ALTS. The contract supplies the allowed
            outcomes.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Rule label="Durations" value="1H or 2H for crypto" />
            <Rule label="Timezone" value="UTC" />
          </div>
        </InfoPanel>
        <InfoPanel eyebrow="02 · Market creation" title="One canonical next-hour window">
          <p>
            Every market is created for the next exact UTC hour in UTC. There is no arbitrary time
            selector, and availability is checked against the deployed contract.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <OutcomeChip side="INDICES" />
            <span className="text-xs text-muted-foreground">SPY / QQQ / IWM</span>
            <OutcomeChip side="UP" />
            <span className="text-xs text-muted-foreground">UP/DOWN or asset dominance</span>
          </div>
        </InfoPanel>
        <InfoPanel eyebrow="03 · Betting" title="Choose one side, then top up">
          <p>
            Stake at least 1 GEN for a new position and no more than 70 GEN cumulatively per wallet
            per market. Same-side top-ups are allowed; switching sides is blocked.
          </p>
          <div className="mt-4 rounded-md border border-fx/25 bg-fx/8 p-4 text-xs leading-5 text-fx">
            Crypto top-ups may be below 1 GEN after the wallet already has a position.
          </div>
        </InfoPanel>
        <InfoPanel eyebrow="04 · Sources" title="Independent strict 2-of-3 crypto consensus">
          <p>
            Binance, Gate, and Bitget independently fetch complete market-candle evidence. Crypto
            settlement requires two matching source results; prices are never mixed across sources.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Source label="BINANCE" />
            <Source label="GATE" />
            <Source label="BITGET" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Settlement requires{" "}
            <strong className="text-foreground">two of three winners must match</strong>. For 2H,
            exactly two consecutive 1H candles are used: first open to second close.
          </p>
        </InfoPanel>
      </div>

      <section className="mt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          SETTLEMENT LIFECYCLE
        </p>
        <div className="mt-4 grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ number, title, copy, icon: Icon }, index) => (
            <div
              key={title}
              className={`relative p-5 ${index < steps.length - 1 ? "border-b sm:border-r lg:border-b-0" : ""} ${index === 1 ? "sm:border-r-0 lg:border-r" : ""}`}
            >
              <span className="font-mono text-[10px] text-primary">{number}</span>
              <Icon className="mt-5 size-5 text-muted-foreground" />
              <h2 className="mt-4 text-sm font-semibold">{title}</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
          market_end → +60s → settlement_ready → +18,000s → settlement_deadline
        </p>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <InfoPanel eyebrow="05 · Economics" title="The entire pool is shared">
          <p>
            Winning wallets share the full market pool pro rata by their winning stake. Floor
            rounding is accounted for, and the final winning claimant receives the remaining pool
            dust.
          </p>
          <p className="mt-3">
            If consensus remains inconclusive, or the winning side has zero backing, the market is
            inconclusive and original stakes are refundable.
          </p>
        </InfoPanel>
        <Panel className="flex flex-col justify-between p-5 sm:p-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              READY TO PARTICIPATE?
            </p>
            <h2 className="mt-3 text-xl font-semibold">Find the next exact-hour market.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Review live pools, inspect source evidence, and place a capped pooled stake through
              your connected Studio Next wallet.
            </p>
          </div>
          <Button asChild className="mt-6 w-fit">
            <Link to="/markets" search={{ q: "" }}>
              Browse markets <ArrowRight />
            </Link>
          </Button>
        </Panel>
      </div>
    </PageShell>
  );
}

function InfoPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Panel className="p-5 sm:p-7">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-lg font-semibold">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </Panel>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xs text-foreground">{value}</p>
    </div>
  );
}

function Source({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-secondary p-3 text-xs">
      <Check className="size-4 text-success" />
      {label}
      <span className="ml-auto font-mono text-[10px] text-success">INDEPENDENT</span>
    </div>
  );
}
