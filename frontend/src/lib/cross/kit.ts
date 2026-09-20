import { useMemo } from "react";
import { createTransactionKit, type TransactionKit } from "@genlayer/transaction-kit";
import { useWallet } from "./wallet";
import { CROSS_CHAIN } from "./config";

export function useCrossTransactionKit(accountOverride?: string): TransactionKit | null {
  const { address } = useWallet();
  const account = accountOverride ?? address;
  return useMemo(() => {
    if (!account || typeof window === "undefined" || !window.ethereum) return null;
    return createTransactionKit({
      chain: CROSS_CHAIN,
      provider: window.ethereum,
      account: account as `0x${string}`,
    });
  }, [account]);
}
