import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCross } from "@/components/cross/app-context";
import { PageShell } from "@/components/cross/page-shell";
import { Panel, useNow } from "@/components/cross/primitives";
import { CrossReadError } from "@/components/cross/read-error";
import { TransactionAction } from "@/components/cross/transaction-action";
import { crossContract, safeCrossWrite } from "@/lib/cross/contract";
import { cryptoContract } from "@/lib/cross/crypto-contract";
import { formatCrossError } from "@/lib/cross/errors";
import { formatLocal, formatUtc, HOUR, nextMarketStart } from "@/lib/cross/format";
import {
  useCrossConfig,
  useCrossMarketByStart,
  useCryptoConfig,
  useCryptoMarketByIdentity,
} from "@/lib/cross/queries";
import type { CryptoAsset, CryptoMarketType } from "@/lib/cross/types";
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

type Format = "INDICES_FX" | "UP_DOWN" | "DOMINANCE";
const assets: CryptoAsset[] = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"];

function CreatePage() {
  const now = useNow();
  const navigate = useNavigate();
  const { connected, connectWallet, config, configError, cryptoConfig, cryptoConfigError } =
    useCross();
  const crossConfig = useCrossConfig();
  const cryptoConfigQuery = useCryptoConfig();
  const [format, setFormat] = useState<Format>("INDICES_FX");
  const [asset, setAsset] = useState<CryptoAsset>("BTC");
  const [category, setCategory] = useState<"MAJORS" | "LARGE_CAP_ALTS">("MAJORS");
  const [duration, setDuration] = useState<3600 | 7200>(3600);
  const start = nextMarketStart(now ?? Date.now());
  const startSeconds = Math.floor(start / 1_000);
  const end = start + duration * 1_000;
  const ready = end + 60_000;
  const deadline = ready + 18_000_000;
  const crossExisting = useCrossMarketByStart(startSeconds);
  const cryptoType: CryptoMarketType = format === "DOMINANCE" ? "DOMINANCE" : "UP_DOWN";
  const subject = format === "DOMINANCE" ? category : asset;
  const cryptoExisting = useCryptoMarketByIdentity(cryptoType, subject, duration, startSeconds);
  const existing = format === "INDICES_FX" ? crossExisting.data : cryptoExisting.data;
  const readError =
    format === "INDICES_FX"
      ? (crossExisting.error ?? (!crossConfig.data ? (crossConfig.error ?? configError) : null))
      : (cryptoExisting.error ??
        (!cryptoConfig ? (cryptoConfigQuery.error ?? cryptoConfigError) : null));
  const available =
    (format === "INDICES_FX" ? crossExisting.isSuccess : cryptoExisting.isSuccess) &&
    existing === null;
  const protocolReady =
    format === "INDICES_FX"
      ? Boolean(config && config.durationSeconds === 3600)
      : Boolean(cryptoConfig && cryptoConfig.durationsSeconds.includes(duration));
  const canCreate = connected && protocolReady && available;
  const retry = async () => {
    if (format === "INDICES_FX") {
      await Promise.all([crossConfig.refetch(), crossExisting.refetch()]);
    } else {
      await Promise.all([cryptoConfigQuery.refetch(), cryptoExisting.refetch()]);
    }
  };
  const connect = async () => {
    try {
      await connectWallet();
      toast.success("Wallet connected to Studio Next.");
    } catch (error) {
      toast.error(formatCrossError(error));
    }
  };
  const created = async () => {
    const result =
      format === "INDICES_FX" ? await crossExisting.refetch() : await cryptoExisting.refetch();
    if (result.data)
      void navigate({
        to: "/markets/$source/$id",
        params: {
          source: format === "INDICES_FX" ? "cross" : "crypto",
          id: String(result.data.id),
        },
        search: { q: "" },
      });
    else void navigate({ to: "/markets", search: { q: "" } });
  };
  const call =
    format === "INDICES_FX"
      ? safeCrossWrite(() => crossContract.createMarket(startSeconds))
      : format === "UP_DOWN"
        ? safeCrossWrite(() => cryptoContract.createUpDownMarket(asset, duration, startSeconds))
        : safeCrossWrite(() =>
            cryptoContract.createDominanceMarket(category, duration, startSeconds),
          );
  return (
    <PageShell className="max-w-5xl">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-primary">
        PERMISSIONLESS SCHEDULING
      </p>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Create the next CROSS market</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Choose one of the three CROSS market formats. Every format uses the next exact UTC hour from
        the deployed contract.
      </p>
      {readError && (
        <CrossReadError
          error={readError}
          onRetry={() => void retry()}
          isRetrying={
            crossConfig.isFetching ||
            cryptoConfigQuery.isFetching ||
            crossExisting.isFetching ||
            cryptoExisting.isFetching
          }
        />
      )}
      <Panel className="mt-8 p-5 sm:p-7">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Market format
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(["INDICES_FX", "UP_DOWN", "DOMINANCE"] as const).map((item) => (
            <Button
              key={item}
              variant={format === item ? "secondary" : "outline"}
              onClick={() => setFormat(item)}
            >
              {item === "INDICES_FX"
                ? "Indices vs FX"
                : item === "UP_DOWN"
                  ? "Crypto UP / DOWN"
                  : "Crypto Dominance"}
            </Button>
          ))}
        </div>
        {format === "UP_DOWN" && (
          <Select
            label="Asset"
            value={asset}
            onChange={(value) => setAsset(value as CryptoAsset)}
            options={assets}
          />
        )}
        {format === "DOMINANCE" && (
          <>
            <Select
              label="Category"
              value={category}
              onChange={(value) => setCategory(value as typeof category)}
              options={["MAJORS", "LARGE_CAP_ALTS"]}
            />
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              Members:{" "}
              {(
                cryptoConfig?.dominanceCategories[category] ??
                (category === "MAJORS" ? ["BTC", "ETH", "SOL"] : ["BNB", "XRP", "DOGE"])
              ).join(" · ")}
            </div>
          </>
        )}
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Duration
          </p>
          {format === "INDICES_FX" ? (
            <p className="mt-2 text-sm">1 hour · 3,600 seconds</p>
          ) : (
            <div className="mt-2 flex gap-2">
              {([3600, 7200] as const).map((item) => (
                <Button
                  key={item}
                  variant={duration === item ? "secondary" : "outline"}
                  onClick={() => setDuration(item)}
                >
                  {item / 3600} hour{item === 3600 ? "" : "s"}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-6 grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
          <Item l="Current local time" v={now ? formatLocal(now) : "Synchronizing…"} />
          <Item l="Current UTC time" v={now ? formatUtc(now) : "Synchronizing…"} />
          <Item l="Next market starts (local)" v={formatLocal(start)} />
          <Item l="Next market starts (UTC)" v={formatUtc(start)} />
          <Item l="Market ends" v={formatUtc(end)} />
          <Item l="Retry deadline (+5h)" v={formatUtc(deadline)} />
        </div>
        <div className="mt-6 flex items-center gap-2 rounded-md border border-border bg-secondary p-3 text-xs text-muted-foreground">
          <LockKeyhole className="size-4 text-primary" />
          {readError
            ? "Market availability could not be verified on Studio Next."
            : existing
              ? `Matching ${format === "INDICES_FX" ? "CROSS" : "crypto"} market #${existing.id} already exists.`
              : "This exact-hour identity is available on the contract."}
        </div>
        {existing ? (
          <Button asChild className="mt-5 h-11 w-full">
            <Link
              to="/markets/$source/$id"
              params={{
                source: format === "INDICES_FX" ? "cross" : "crypto",
                id: String(existing.id),
              }}
              search={{ q: "" }}
            >
              View existing market
            </Link>
          </Button>
        ) : connected ? (
          <TransactionAction
            call={call}
            label="Create Market"
            disabled={!canCreate}
            onSuccess={() => void created()}
          />
        ) : (
          <Button className="mt-5 h-11 w-full" onClick={connect}>
            Connect Wallet
          </Button>
        )}
      </Panel>
      <Panel className="mt-6 p-5">
        <div className="flex items-center gap-3">
          <CalendarClock className="size-5 text-primary" />
          <div>
            <p className="font-semibold">Contract-driven scheduling</p>
            <p className="text-xs text-muted-foreground">
              The displayed next-hour timestamp is recalculated continuously and sent as Unix
              seconds.
            </p>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="mt-5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-input bg-secondary px-3 text-sm text-foreground outline-none"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
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
