import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatCrossError } from "@/lib/cross/errors";
import { formatGen, shortAddress } from "@/lib/cross/format";
import { useCross } from "./app-context";
import { CrossMark } from "./primitives";
import { WalletDialog } from "./wallet-dialog";
import { toast } from "sonner";

const nav = [
  { to: "/markets", label: "Markets" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/create", label: "Create Market" },
  { to: "/how-it-works", label: "How it works" },
] as const;

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      {nav.map((item) =>
        mobile ? (
          <SheetClose key={item.to} asChild>
            <Link
              to={item.to}
              search={item.to === "/markets" ? { q: "" } : {}}
              activeProps={{ className: "text-primary bg-accent" }}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          </SheetClose>
        ) : (
          <Link
            key={item.to}
            to={item.to}
            search={item.to === "/markets" ? { q: "" } : {}}
            activeProps={{ className: "text-foreground" }}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {item.label}
          </Link>
        ),
      )}
    </>
  );
}

export function Header() {
  const { address, connected, balanceWei, configError, connectWallet, switchWalletAccount } =
    useCross();
  const [query, setQuery] = useState("");
  const previousAddress = useRef<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const previous = previousAddress.current;
    if (previous && address && previous.toLowerCase() !== address.toLowerCase()) {
      toast.success("Wallet account switched.");
    }
    previousAddress.current = address;
  }, [address]);

  const search = (event: FormEvent) => {
    event.preventDefault();
    void navigate({ to: "/markets", search: { q: query } });
  };
  const connect = async () => {
    try {
      await connectWallet();
      toast.success("Wallet connected to Studio Next.");
    } catch (error) {
      toast.error(formatCrossError(error));
    }
  };
  const switchAccount = async () => {
    try {
      await switchWalletAccount();
    } catch (error) {
      toast.error(formatCrossError(error));
    }
  };
  const walletLabel =
    connected && address
      ? `${shortAddress(address)}${balanceWei === null ? "" : ` · ${formatGen(balanceWei, true)}`}`
      : "Connect Wallet";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 lg:px-6">
          <Link
            to="/markets"
            search={{ q: "" }}
            className="flex shrink-0 items-center gap-2"
            aria-label="CROSS markets"
          >
            <CrossMark />
            <span className="text-base font-bold tracking-[0.16em]">CROSS</span>
          </Link>
          <nav className="ml-5 hidden items-center gap-5 xl:flex">
            <NavLinks />
          </nav>
          <form onSubmit={search} className="relative ml-auto hidden w-full max-w-xs lg:block">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 bg-secondary pl-9 text-xs"
              placeholder="Search markets"
              aria-label="Search markets"
            />
          </form>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-secondary px-2.5 text-[10px] font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success shadow-[0_0_8px_var(--success)]" />
              Studio Next
            </span>
          </div>
          {connected && address ? (
            <WalletDialog address={address} balanceWei={balanceWei} onSwitchAccount={switchAccount}>
              <Button
                variant="secondary"
                size="sm"
                className="hidden shrink-0 cursor-pointer md:inline-flex"
                aria-label={`Open wallet account ${shortAddress(address)}`}
              >
                <Wallet />
                {walletLabel}
              </Button>
            </WalletDialog>
          ) : (
            <Button
              onClick={connect}
              variant="default"
              size="sm"
              className="hidden shrink-0 md:inline-flex"
            >
              <Wallet />
              {walletLabel}
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="ml-auto shrink-0 xl:hidden"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent className="border-border bg-background">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <CrossMark />
                  CROSS
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-1">
                <NavLinks mobile />
              </nav>
              <div className="mt-6 border-t border-border pt-6">
                {connected && address ? (
                  <WalletDialog
                    address={address}
                    balanceWei={balanceWei}
                    onSwitchAccount={switchAccount}
                  >
                    <Button
                      className="w-full cursor-pointer"
                      variant="secondary"
                      aria-label={`Open wallet account ${shortAddress(address)}`}
                    >
                      <Wallet />
                      {walletLabel}
                    </Button>
                  </WalletDialog>
                ) : (
                  <Button onClick={connect} className="w-full" variant="default">
                    <Wallet />
                    {walletLabel}
                  </Button>
                )}
                <p className="mt-3 text-center text-[10px] text-muted-foreground">
                  Studio Next · Chain 61997
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      {configError?.message.includes("configuration") && (
        <div
          role="alert"
          className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-center text-xs text-destructive"
        >
          {configError.message}
        </div>
      )}
    </>
  );
}
