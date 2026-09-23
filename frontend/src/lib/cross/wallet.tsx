import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CROSS_NETWORK } from "./config";

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export interface WalletState {
  address: string | null;
  chainId: number | null;
  balanceWei: bigint | null;
  isConnected: boolean;
  isLoading: boolean;
  isInstalled: boolean;
  isOnCorrectNetwork: boolean;
}

interface WalletContextValue extends WalletState {
  connectWallet: () => Promise<string>;
  disconnectWallet: () => void;
  switchWalletAccount: () => Promise<string>;
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function provider(): EthereumProvider | null {
  return typeof window === "undefined" ? null : (window.ethereum ?? null);
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function currentChainId(wallet: EthereumProvider) {
  const value = await wallet.request({ method: "eth_chainId" });
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, 16);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function currentAccounts(wallet: EthereumProvider) {
  const value = await wallet.request({ method: "eth_accounts" });
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function currentBalance(wallet: EthereumProvider, address: string) {
  try {
    const value = await wallet.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    });
    return typeof value === "string" && /^0x[0-9a-f]+$/i.test(value) ? BigInt(value) : null;
  } catch {
    return null;
  }
}

async function addNetwork(wallet: EthereumProvider) {
  await wallet.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: CROSS_NETWORK.chainIdHex,
        chainName: CROSS_NETWORK.chainName,
        nativeCurrency: CROSS_NETWORK.nativeCurrency,
        rpcUrls: CROSS_NETWORK.rpcUrls,
        blockExplorerUrls: CROSS_NETWORK.blockExplorerUrls,
      },
    ],
  });
}

async function ensureNetwork(wallet: EthereumProvider) {
  if ((await currentChainId(wallet)) === CROSS_NETWORK.chainId) return;
  try {
    await wallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CROSS_NETWORK.chainIdHex }],
    });
  } catch (error) {
    if (errorCode(error) !== 4902) throw error;
    await addNetwork(wallet);
    await wallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CROSS_NETWORK.chainIdHex }],
    });
  }
  const chainId = await currentChainId(wallet);
  if (chainId !== CROSS_NETWORK.chainId) {
    throw new Error(
      `Wallet network setup failed: wallet is on chain ${chainId ?? "an unsupported network"}; switch to GenLayer Studio Next (chain ${CROSS_NETWORK.chainId}).`,
    );
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    balanceWei: null,
    isConnected: false,
    isLoading: true,
    isInstalled: false,
    isOnCorrectNetwork: false,
  });

  const refreshWallet = useCallback(async () => {
    const wallet = provider();
    if (!wallet) {
      setState((current) => ({
        ...current,
        address: null,
        balanceWei: null,
        isConnected: false,
        isInstalled: false,
        isLoading: false,
        isOnCorrectNetwork: false,
      }));
      return;
    }
    try {
      const [accounts, chainId] = await Promise.all([
        currentAccounts(wallet),
        currentChainId(wallet),
      ]);
      const address = accounts[0] ?? null;
      const balanceWei = address ? await currentBalance(wallet, address) : null;
      setState({
        address,
        chainId,
        balanceWei,
        isConnected: Boolean(address),
        isLoading: false,
        isInstalled: true,
        isOnCorrectNetwork: chainId === CROSS_NETWORK.chainId,
      });
    } catch {
      setState((current) => ({
        ...current,
        isLoading: false,
        isInstalled: true,
      }));
    }
  }, []);

  useEffect(() => {
    void refreshWallet();
    const wallet = provider();
    if (!wallet?.on) return;
    const handleAccounts = () => void refreshWallet();
    const handleChain = () => void refreshWallet();
    const handleDisconnect = () => {
      setState((current) => ({
        ...current,
        address: null,
        balanceWei: null,
        isConnected: false,
      }));
    };
    wallet.on("accountsChanged", handleAccounts);
    wallet.on("chainChanged", handleChain);
    wallet.on("disconnect", handleDisconnect);
    return () => {
      wallet.removeListener?.("accountsChanged", handleAccounts);
      wallet.removeListener?.("chainChanged", handleChain);
      wallet.removeListener?.("disconnect", handleDisconnect);
    };
  }, [refreshWallet]);

  const connectWallet = useCallback(async () => {
    const wallet = provider();
    if (!wallet) throw new Error("A compatible wallet extension was not found.");
    setState((current) => ({ ...current, isLoading: true, isInstalled: true }));
    try {
      const value = await wallet.request({ method: "eth_requestAccounts" });
      const accounts = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
      if (!accounts[0]) throw new Error("No wallet account was selected.");
      try {
        await ensureNetwork(wallet);
      } catch (error) {
        if (errorCode(error) === 4001) throw error;
        throw new Error(`Wallet network setup failed: ${errorMessage(error)}`);
      }
      await refreshWallet();
      return accounts[0];
    } catch (error) {
      setState((current) => ({ ...current, isLoading: false }));
      if (errorCode(error) === 4001) throw new Error("The wallet connection was cancelled.");
      throw new Error(errorMessage(error));
    }
  }, [refreshWallet]);

  const switchWalletAccount = useCallback(async () => {
    const wallet = provider();
    if (!wallet) throw new Error("A compatible wallet extension was not found.");
    try {
      await wallet.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = await currentAccounts(wallet);
      if (!accounts[0]) throw new Error("No wallet account was selected.");
      await refreshWallet();
      return accounts[0];
    } catch (error) {
      if (errorCode(error) === 4001) throw new Error("The wallet account switch was cancelled.");
      throw new Error(errorMessage(error));
    }
  }, [refreshWallet]);

  const disconnectWallet = useCallback(() => {
    setState((current) => ({
      ...current,
      address: null,
      balanceWei: null,
      isConnected: false,
    }));
  }, []);

  const value = useMemo(
    () => ({ ...state, connectWallet, disconnectWallet, switchWalletAccount, refreshWallet }),
    [state, connectWallet, disconnectWallet, switchWalletAccount, refreshWallet],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used within WalletProvider");
  return value;
}
