import { createContext, useContext, type ReactNode } from "react";
import { useCrossConfig } from "@/lib/cross/queries";
import { WalletProvider, useWallet } from "@/lib/cross/wallet";
import { CrossTransactionProvider } from "@/lib/cross/transaction-state";
import type { CrossConfig } from "@/lib/cross/types";

interface AppState {
  address: string | null;
  connected: boolean;
  walletLoading: boolean;
  walletInstalled: boolean;
  walletOnCorrectNetwork: boolean;
  balanceWei: bigint | null;
  config?: CrossConfig | undefined;
  configLoading: boolean;
  configError: Error | null;
  connectWallet: () => Promise<string>;
  disconnectWallet: () => void;
  switchWalletAccount: () => Promise<string>;
  refreshWallet: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

function CrossRuntime({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const config = useCrossConfig();
  return (
    <AppContext.Provider
      value={{
        address: wallet.address,
        connected: wallet.isConnected && wallet.isOnCorrectNetwork,
        walletLoading: wallet.isLoading,
        walletInstalled: wallet.isInstalled,
        walletOnCorrectNetwork: wallet.isOnCorrectNetwork,
        balanceWei: wallet.balanceWei,
        config: config.data,
        configLoading: config.isLoading,
        configError: config.error instanceof Error && !config.data ? config.error : null,
        connectWallet: wallet.connectWallet,
        disconnectWallet: wallet.disconnectWallet,
        switchWalletAccount: wallet.switchWalletAccount,
        refreshWallet: wallet.refreshWallet,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function CrossProvider({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <CrossTransactionProvider>
        <CrossRuntime>{children}</CrossRuntime>
      </CrossTransactionProvider>
    </WalletProvider>
  );
}

export function useCross() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useCross must be used within CrossProvider");
  return context;
}
