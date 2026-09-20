import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCross } from "@/components/cross/app-context";
import { PageShell } from "@/components/cross/page-shell";
import { Panel, useNow } from "@/components/cross/primitives";
import { CrossReadError } from "@/components/cross/read-error";
import { TransactionAction } from "@/components/cross/transaction-action";
import { crossContract, safeCrossWrite } from "@/lib/cross/contract";
import { formatCrossError } from "@/lib/cross/errors";
import { formatUtc, HOUR, nextMarketStart } from "@/lib/cross/format";
import { useCrossConfig, useCrossMarketByStart } from "@/lib/cross/queries";
import { toast } from "sonner";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create the next market — CROSS" },
      { name: "description", content: "Permissionlessly create the next exact-hour CROSS market." },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const now = useNow();
  const navigate = useNavigate();
  const { connected, connectWallet, config, configError } = useCross();
  const configQuery = useCrossConfig();
  const start = nextMarketStart(now ?? Date.now());
  const startSeconds = Math.floor(start / 1_000);
  const end = start + HOUR;
  const ready = end + 60_000;
  const deadline = ready + 18_000_000;
  const existing = useCrossMarketByStart(startSeconds);
  const connect = async () => {
    try {
      await connectWallet();
      toast.success("Wallet connected to Studio Next.");
    } catch (error) {
      toast.error(formatCrossError(error));
    }
  };
  const created = async () => {
    const result = await existing.refetch();
    if (result.data) {
      void navigate({
        to: "/markets/$id",
        params: { id: String(result.data.id) },
        search: { q: "" },
      });
    } else {
      void navigate({ to: "/markets", search: { q: "" } });
    }
  };

  return (
    <PageShell className="max-w-5xl">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-primary">
        PERMISSIONLESS SCHEDULING
      </p>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Create the next CROSS market</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Anyone can create the single canonical market for the next exact UTC hour. Timing and
        matchup are fixed by protocol.
      </p>
      {configError && (
        <CrossReadError
          error={configError}
          onRetry={() => void configQuery.refetch()}
          isRetrying={configQuery.isFetching}
        />
      )}
      {existing.error && (
        <CrossReadError
          error={existing.error}
          onRetry={() => void existing.refetch()}
          isRetrying={existing.isFetching}
        />
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="p-5 sm:p-7">
          <div className="flex items-center gap-3 border-b border-border pb-5">
            <CalendarClock className="size-5 text-primary" />
            <div>
              <p className="font-semibold">Next exact UTC hour</p>
              <p className="text-xs text-muted-foreground">Calculated automatically</p>
            </div>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Item l="Matchup" v="INDICES vs FX" />
            <Item l="Current UTC time" v={now ? formatUtc(now) : "Synchronizing…"} />
            <Item l="Market starts" v={formatUtc(start)} />
            <Item l="Market ends" v={formatUtc(end)} />
            <Item l="Settlement ready (+60s)" v={formatUtc(ready)} />
            <Item l="Retry deadline (+5h)" v={formatUtc(deadline)} />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Basket title="INDICES" chips={["SPY", "QQQ", "IWM"]} />
            <Basket title="FX" chips={["EURUSD", "GBPUSD", "USDJPY"]} />
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-md border border-border bg-secondary p-3 text-xs text-muted-foreground">
            <LockKeyhole className="size-4 text-primary" />
            {existing.data
              ? `Market #${existing.data.id} already exists for this start.`
              : existing.isLoading
                ? "Checking the CROSS contract…"
                : "This exact-hour market is available on the contract."}
          </div>
          {existing.data ? (
            <Button asChild className="mt-5 h-11 w-full">
              <Link to="/markets/$id" params={{ id: String(existing.data.id) }} search={{ q: "" }}>
                View existing market <ArrowRight />
              </Link>
            </Button>
          ) : connected ? (
            <TransactionAction
              call={safeCrossWrite(() => crossContract.createMarket(startSeconds))}
              label="Create Market"
              disabled={Boolean(config && config.durationSeconds !== 3600)}
              onSuccess={() => void created()}
            />
          ) : (
            <Button className="mt-5 h-11 w-full" onClick={connect}>
              Connect Wallet
            </Button>
          )}
        </Panel>
        <Panel className="h-fit p-5">
          <h2 className="text-sm font-semibold">What happens next?</h2>
          <ol className="mt-5 space-y-5">
            {[
              "The market opens immediately for pooled stakes.",
              "Betting locks at the exact UTC start.",
              "Both baskets run for precisely one hour.",
              "After 60 seconds, anyone can request dual-source settlement.",
            ].map((item, index) => (
              <li key={item} className="flex gap-3 text-xs leading-5 text-muted-foreground">
                <span className="font-mono text-primary">0{index + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </PageShell>
  );
}

function Item({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</p>
      <p className="mt-1 font-mono text-sm">{v}</p>
    </div>
  );
}

function Basket({ title, chips }: { title: string; chips: string[] }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-xs font-semibold">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span className={`asset-chip ${title === "FX" ? "fx" : "indices"}`} key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
