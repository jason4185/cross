import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Info, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TransactionAction } from "./transaction-action";
import { Panel } from "./primitives";
import { useCross } from "./app-context";
import { formatCrossError } from "@/lib/cross/errors";
import { crossContract, safeCrossWrite } from "@/lib/cross/contract";
import { GEN_WEI, formatGen, parseGen } from "@/lib/cross/format";
import { useCrossMyPosition } from "@/lib/cross/queries";
import type { Market, Outcome, Position } from "@/lib/cross/types";

export function TradePanel({ market }: { market: Market }) {
  const { connected, connectWallet, balanceWei, config } = useCross();
  const positionQuery = useCrossMyPosition(market.id);
  const position = positionQuery.data;
  const [side, setSide] = useState<Outcome>(position?.side ?? "INDICES");
  const [amount, setAmount] = useState("");
  const minimum = config?.minimumBetWei ?? GEN_WEI;
  const maximum = config?.maximumBetWei ?? 70n * GEN_WEI;
  const remaining =
    maximum - (position?.stakeWei ?? 0n) > 0n ? maximum - (position?.stakeWei ?? 0n) : 0n;
  useEffect(() => {
    if (position?.side) setSide(position.side);
  }, [position?.side]);
  const parsed = useMemo(() => {
    try {
      return parseGen(amount);
    } catch {
      return null;
    }
  }, [amount]);
  const valid = Boolean(
    parsed !== null &&
    parsed >= minimum &&
    parsed <= remaining &&
    (balanceWei === null || parsed <= balanceWei),
  );
  const unresolved =
    market.contractState === "OPEN" || market.contractState === "SETTLEMENT_PENDING";
  const canSettle =
    connected &&
    unresolved &&
    !market.deadlineExpired &&
    (market.contractState === "SETTLEMENT_PENDING" || market.settlementAvailable);
  const canFinalizeInconclusive = connected && unresolved && market.deadlineExpired;
  const claimable = Boolean(position?.claimable);
  const refundable = Boolean(position?.refundable);
  const claimableAmount = claimable ? (position?.claimableWei ?? 0n) : 0n;
  const connectedMessage = async () => {
    try {
      await connectWallet();
      toast.success("Wallet connected to Studio Next.");
    } catch (error) {
      toast.error(formatCrossError(error));
    }
  };
  const validateStake = () => {
    if (parsed === null) {
      toast.error("Enter a valid GEN amount.");
      return false;
    }
    if (parsed < minimum) {
      toast.error(`The minimum stake is ${formatGen(minimum)}.`);
      return false;
    }
    if (parsed > remaining) {
      toast.error(`You can stake up to ${formatGen(remaining)} more on this market.`);
      return false;
    }
    if (balanceWei !== null && parsed > balanceWei) {
      toast.error("Your wallet balance is not sufficient for this stake.");
      return false;
    }
    return true;
  };

  if (!connected) {
    return (
      <Panel className="sticky top-20 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <Wallet className="size-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Take a position</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Connect a wallet to stake GEN.
            </p>
          </div>
        </div>
        <Button className="mt-5 h-11 w-full" onClick={connectedMessage}>
          Connect Wallet
        </Button>
      </Panel>
    );
  }

  const walletDataError = positionQuery.data ? null : positionQuery.error;
  if (walletDataError) {
    const retrying = positionQuery.isFetching;
    return (
      <Panel className="sticky top-20 p-4 sm:p-5">
        <div className="rounded-md border border-destructive/25 bg-destructive/8 p-4">
          <p className="text-sm font-semibold text-destructive">Wallet position unavailable</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {formatCrossError(walletDataError)}
          </p>
          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            onClick={() => void positionQuery.refetch()}
            disabled={retrying}
          >
            <RefreshCw className={retrying ? "animate-spin" : ""} />
            {retrying ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="sticky top-20 p-4 sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div>
          <p className="text-sm font-semibold">Take a position</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Pooled stake · no selling</p>
        </div>
        <span className="rounded-sm border border-success/25 bg-success/8 px-2 py-1 text-[9px] font-bold text-success">
          ON-CHAIN
        </span>
      </div>

      {market.contractState === "OPEN" && market.bettingOpen && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(["INDICES", "FX"] as Outcome[]).map((item) => (
              <Button
                key={item}
                onClick={() => setSide(item)}
                disabled={Boolean(position?.side && position.side !== item)}
                variant={side === item ? (item === "INDICES" ? "default" : "secondary") : "outline"}
                className={
                  side === item && item === "INDICES"
                    ? "bg-success text-success-foreground hover:bg-success/90"
                    : side === item
                      ? "border-fx/50 bg-fx/15 text-fx"
                      : ""
                }
              >
                {item}
              </Button>
            ))}
          </div>
          {position?.side && (
            <div className="mt-3 flex gap-2 rounded-md bg-secondary p-3 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>You can only top up your existing side in this market.</span>
            </div>
          )}
          <label className="mt-5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Amount in GEN
          </label>
          <div className="relative mt-2">
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="text"
              inputMode="decimal"
              className="h-12 bg-secondary pr-14 font-mono text-base"
              placeholder="0.00"
              aria-label="Stake amount in GEN"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              GEN
            </span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[1, 5, 10].map((value) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                onClick={() => {
                  const current = parsed ?? 0n;
                  const next = current + BigInt(value) * GEN_WEI;
                  setAmount(formatGen(next > remaining ? remaining : next).replace(" GEN", ""));
                }}
              >
                +{value}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAmount(formatGen(remaining).replace(" GEN", ""))}
            >
              Max
            </Button>
          </div>
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
            <Row label="Current wallet stake" value={formatGen(position?.stakeWei ?? 0n)} />
            <Row label="Remaining allowance" value={formatGen(remaining)} />
            <Row
              label="Wallet balance"
              value={balanceWei === null ? "Unavailable" : formatGen(balanceWei)}
            />
            <Row label="Protocol range" value={`${formatGen(minimum)}–${formatGen(maximum)}`} />
          </div>
          <TransactionAction
            call={safeCrossWrite(() => crossContract.placeBet(market.id, side))}
            userValue={parsed ?? undefined}
            label={position?.side ? "Top Up Stake" : "Place Stake"}
            disabled={!valid}
            onSuccess={() => setAmount("")}
          />
          {!valid && amount && (
            <p className="mt-2 text-center text-[10px] text-warning">
              Check the amount and wallet balance.
            </p>
          )}
        </>
      )}

      {market.state === "LIVE" && <ClosedMessage>Betting is closed for this market.</ClosedMessage>}
      {market.contractState === "OPEN" && !market.bettingOpen && market.state !== "LIVE" && (
        <ClosedMessage>Betting is closed for this market.</ClosedMessage>
      )}

      {canSettle && (
        <TransactionAction
          call={safeCrossWrite(() => crossContract.settleMarket(market.id))}
          label={
            market.contractState === "SETTLEMENT_PENDING" ? "Retry settlement" : "Settle Market"
          }
        />
      )}
      {market.contractState === "OPEN" &&
        !market.settlementAvailable &&
        !market.deadlineExpired &&
        !market.bettingOpen &&
        market.state !== "LIVE" && (
          <ClosedMessage>
            Settlement becomes available after the 60-second finalization period.
          </ClosedMessage>
        )}
      {market.contractState === "SETTLEMENT_PENDING" && !market.deadlineExpired && (
        <SettlementMessage>
          <p>Settlement is pending a valid 2-of-2 source consensus.</p>
          <p className="mt-1">
            Gate and Bitget did not reach 2-of-2 consensus. Settlement can be retried until the
            deadline.
          </p>
        </SettlementMessage>
      )}
      {canFinalizeInconclusive && (
        <SettlementMessage>
          <p className="font-semibold text-warning">Settlement deadline expired.</p>
          <p className="mt-1">
            No valid 2-of-2 consensus was reached before the deadline. Finalize the market as
            inconclusive to enable refunds.
          </p>
          <TransactionAction
            call={safeCrossWrite(() => crossContract.settleMarket(market.id))}
            label="Finalize inconclusive"
          />
        </SettlementMessage>
      )}

      {claimable && (
        <div className="my-5 rounded-md border border-success/25 bg-success/8 p-4">
          <p className="text-xs text-success">Claimable winnings</p>
          <p className="mt-1 text-2xl font-semibold">{formatGen(claimableAmount)}</p>
          <TransactionAction
            call={safeCrossWrite(() => crossContract.claim(market.id))}
            label="Claim Winnings"
          />
        </div>
      )}
      {refundable && (
        <div className="my-5 rounded-md border border-primary/25 bg-primary/8 p-4">
          <p className="text-xs text-primary">Full refund available</p>
          <p className="mt-1 text-2xl font-semibold">{formatGen(position?.stakeWei)}</p>
          <TransactionAction
            call={safeCrossWrite(() => crossContract.claimRefund(market.id))}
            label="Claim Refund"
          />
        </div>
      )}
      {market.contractState === "SETTLED" && !claimable && position?.positionLost && (
        <ClosedMessage>
          Official winner: {market.winner ?? "Unavailable"}. This position did not win.
        </ClosedMessage>
      )}
      {market.contractState === "INCONCLUSIVE" && !refundable && (
        <ClosedMessage>
          {position?.refunded
            ? "This position has already been refunded."
            : "No refundable stake was found for this wallet."}
        </ClosedMessage>
      )}
      {positionQuery.isLoading ? (
        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          Refreshing wallet position…
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-success" /> Contract state and balances are
        authoritative.
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="font-mono text-right text-foreground">{value}</span>
    </div>
  );
}

function ClosedMessage({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 rounded-md bg-secondary p-3 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

function SettlementMessage({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-md border border-warning/25 bg-warning/8 p-3 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}
