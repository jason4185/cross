import { useCallback, useState } from "react";
import { describeOutcome, type TrackedStatus } from "@genlayer/transaction-kit-react";
import { Button } from "@/components/ui/button";
import { useCross } from "@/components/cross/app-context";
import { formatCrossError } from "@/lib/cross/errors";
import { formatGen } from "@/lib/cross/format";
import { useInvalidateCross } from "@/lib/cross/queries";
import type { CrossWriteCall } from "@/lib/cross/contract";
import type { Outcome } from "@/lib/cross/types";
import { useCrossTransactionActivity } from "@/lib/cross/transaction-context";
import { CrossTransactionDialog } from "./transaction-dialog";
import { toast } from "sonner";

export function TransactionAction({
  call,
  userValue,
  label,
  disabled = false,
  onSuccess,
}: {
  call: CrossWriteCall | null;
  userValue?: bigint | undefined;
  label: string;
  disabled?: boolean;
  onSuccess?: (status: TrackedStatus) => void;
}) {
  const { address, connected, refreshWallet } = useCross();
  const invalidate = useInvalidateCross();
  const { active: transactionActive, setActive: setTransactionActive } =
    useCrossTransactionActivity();
  const [open, setOpen] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState<ActiveTransaction | null>(null);

  const done = useCallback(
    async (status: TrackedStatus) => {
      const transaction = activeTransaction;
      if (!transaction) return;
      if (!isSuccessfulStatus(status)) {
        toast.error(
          formatCrossError(status.executionResultName ?? status.statusName ?? "transaction failed"),
        );
        return;
      }
      await invalidate(transaction.call);
      await refreshWallet();
      toast.success(successCopy(transaction));
      transaction.onSuccess?.(status);
      setOpen(false);
      setActiveTransaction(null);
      setTransactionActive(false);
    },
    [activeTransaction, invalidate, refreshWallet, setTransactionActive],
  );
  const handleDone = useCallback((status: TrackedStatus) => void done(status), [done]);

  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      setTransactionActive(nextOpen);
      if (!nextOpen) setActiveTransaction(null);
    },
    [setTransactionActive],
  );

  const beginTransaction = useCallback(() => {
    if (!call || !address || disabled || !connected || open || transactionActive) return;
    const snapshot: ActiveTransaction = {
      account: address,
      call: {
        address: call.address,
        method: call.method,
        args: [...call.args],
      },
      ...(userValue === undefined ? {} : { userValue }),
      ...(onSuccess === undefined ? {} : { onSuccess }),
    };
    setActiveTransaction(snapshot);
    setOpen(true);
    setTransactionActive(true);
  }, [
    address,
    call,
    connected,
    disabled,
    onSuccess,
    open,
    setTransactionActive,
    transactionActive,
    userValue,
  ]);

  const transactionMethod = activeTransaction?.call.method ?? call?.method;

  if (!call && !activeTransaction) {
    return (
      <Button className="mt-5 h-11 w-full" disabled>
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button
        className="mt-5 h-11 w-full"
        onClick={beginTransaction}
        disabled={disabled || !connected || open || (transactionActive && !open)}
      >
        {open ? "Reviewing transaction" : label}
      </Button>
      <CrossTransactionDialog
        open={open}
        onOpenChange={setDialogOpen}
        title={dialogTitle(transactionMethod)}
        description={dialogDescription(transactionMethod)}
        call={activeTransaction?.call ?? null}
        account={activeTransaction?.account ?? ""}
        userValue={activeTransaction?.userValue}
        onDone={handleDone}
      />
    </>
  );
}

interface ActiveTransaction {
  account: string;
  call: CrossWriteCall;
  userValue?: bigint;
  onSuccess?: (status: TrackedStatus) => void;
}

function dialogTitle(method: string | undefined) {
  switch (method) {
    case "create_market":
      return "Create CROSS market";
    case "place_bet":
      return "Place GEN stake";
    case "settle_market":
      return "Settle CROSS market";
    case "claim":
      return "Claim winnings";
    case "claim_refund":
      return "Claim refund";
    default:
      return "Confirm CROSS transaction";
  }
}

function dialogDescription(method: string | undefined) {
  switch (method) {
    case "create_market":
      return "Review the protocol transaction before signing with your wallet.";
    case "place_bet":
      return "Your stake is sent as native GEN and recorded by the CROSS contract.";
    case "settle_market":
      return "Settlement will use the contract's independent GATE and BITGET consensus.";
    case "claim":
      return "Claim the amount calculated by the settled CROSS market.";
    case "claim_refund":
      return "Return the original stake from an officially inconclusive market.";
    default:
      return "Review the protocol transaction before signing with your wallet.";
  }
}

function isSuccessfulStatus(status: TrackedStatus) {
  return describeOutcome(status.statusName, status.executionResultName).tone === "success";
}

function successCopy(transaction: ActiveTransaction) {
  switch (transaction.call.method) {
    case "create_market":
      return "The market was created successfully.";
    case "place_bet": {
      const outcome = transaction.call.args[1];
      const side: Outcome = outcome === "FX" ? "FX" : "INDICES";
      const amount =
        transaction.userValue === undefined ? "Your" : formatGen(transaction.userValue);
      return `Your ${amount === "Your" ? "" : `${amount} `}${side} stake was accepted.`;
    }
    case "settle_market":
      return "The settlement transaction was accepted.";
    case "claim":
      return "Your winnings claim was accepted.";
    case "claim_refund":
      return "Your refund claim was accepted.";
    default:
      return "The transaction was accepted.";
  }
}
