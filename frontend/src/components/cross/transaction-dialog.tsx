import { memo, useMemo } from "react";
import {
  GenLayerTransactionPanel,
  type SubmitInput,
  type TrackedStatus,
} from "@genlayer/transaction-kit-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CrossWriteCall } from "@/lib/cross/contract";
import { CROSS_NETWORK } from "@/lib/cross/config";
import { useCrossTransactionKit } from "@/lib/cross/kit";

interface CrossTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  call: CrossWriteCall | null;
  account: string;
  userValue?: bigint | undefined;
  onDone: (status: TrackedStatus) => void;
}

export const CrossTransactionDialog = memo(function CrossTransactionDialog({
  open,
  onOpenChange,
  title,
  description,
  call,
  account,
  userValue,
  onDone,
}: CrossTransactionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && call ? (
        <DialogContent className="w-[calc(100vw-24px)] max-w-[680px] gap-0 overflow-hidden border-primary/25 bg-card p-0 shadow-2xl">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription className="text-xs leading-5">{description}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(90dvh-108px)] overflow-y-auto p-4 sm:p-6">
            <TransactionDialogBody
              call={call}
              account={account}
              userValue={userValue}
              onDone={onDone}
            />
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
});

function TransactionDialogBody({
  call,
  account,
  userValue,
  onDone,
}: {
  call: NonNullable<CrossTransactionDialogProps["call"]>;
  account: string;
  userValue?: bigint | undefined;
  onDone: (status: TrackedStatus) => void;
}) {
  const kit = useCrossTransactionKit(account);
  const tx = useMemo<SubmitInput>(
    () => ({
      kind: "write",
      address: call.address,
      method: call.method,
      args: call.args,
    }),
    [call],
  );

  if (!kit) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Connect a wallet on Studio Next before starting this transaction.
      </p>
    );
  }

  return (
    <GenLayerTransactionPanel
      kit={kit}
      tx={tx}
      network={CROSS_NETWORK.chainName}
      theme="dark"
      trackUntil="decided"
      onDone={onDone}
      {...(userValue === undefined ? {} : { userValue })}
    />
  );
}
