import { useState, type ReactElement } from "react";
import { Check, Copy, RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatGen, shortAddress } from "@/lib/cross/format";
import { CROSS_NETWORK } from "@/lib/cross/config";

interface WalletDialogProps {
  address: string;
  balanceWei: bigint | null;
  onSwitchAccount: () => Promise<void>;
  children: ReactElement;
}

export function WalletDialog({
  address,
  balanceWei,
  onSwitchAccount,
  children,
}: WalletDialogProps) {
  const [switching, setSwitching] = useState(false);

  const copyAddress = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(address);
      toast.success("Wallet address copied.");
    } catch {
      toast.error("We couldn't copy the wallet address. Please try again.");
    }
  };

  const switchAccount = async () => {
    setSwitching(true);
    try {
      await onSwitchAccount();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't switch wallet accounts.");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[calc(100vw-24px)] max-w-[480px] gap-0 overflow-y-auto border-primary/25 bg-card p-0 shadow-2xl">
        <DialogHeader className="border-b border-border px-5 py-5 pr-12 text-left sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
              <WalletCards className="size-4" />
            </span>
            <div>
              <DialogTitle>Connected wallet</DialogTitle>
              <DialogDescription className="mt-1">
                Your active Studio Next account.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-5 sm:p-6">
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Connected account
            </p>
            <p className="mt-2 font-mono text-sm font-semibold text-foreground">
              {shortAddress(address)}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] leading-5 text-muted-foreground">
              {address}
            </p>
            <Button className="mt-3" size="sm" variant="outline" onClick={copyAddress}>
              <Copy />
              Copy address
            </Button>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-secondary/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Network
              </p>
              <p className="mt-2 text-sm font-semibold">Studio Next</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Chain ID {CROSS_NETWORK.chainId}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-success">
                <Check className="size-3" /> Connected
              </p>
            </div>
            <div className="rounded-md border border-border bg-secondary/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Balance
              </p>
              <p className="mt-2 font-mono text-lg font-semibold">
                {balanceWei === null ? "Unavailable" : formatGen(balanceWei, true)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Native GEN</p>
            </div>
          </section>
        </div>

        <DialogFooter className="border-t border-border px-5 py-4 sm:px-6">
          <Button variant="outline" onClick={switchAccount} disabled={switching}>
            <RefreshCw className={switching ? "animate-spin" : ""} />
            {switching ? "Opening wallet…" : "Switch account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
