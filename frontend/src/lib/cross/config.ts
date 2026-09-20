import { studioDevnet } from "genlayer-js/chains";

export const CROSS_RPC_URL = "https://studio-next.genlayer.com/api";
export const CROSS_CHAIN_ID = 61997;
export const CROSS_CONTRACT_ADDRESS = import.meta.env["VITE_CROSS_CONTRACT_ADDRESS"] as
  string | undefined;

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export const CROSS_CONFIGURATION_ERROR =
  CROSS_CONTRACT_ADDRESS && ADDRESS_PATTERN.test(CROSS_CONTRACT_ADDRESS)
    ? null
    : "CROSS contract configuration is missing or malformed. Set VITE_CROSS_CONTRACT_ADDRESS to the deployed Studio Next address.";

export const CROSS_CHAIN: typeof studioDevnet = {
  ...studioDevnet,
  id: CROSS_CHAIN_ID,
  name: "GenLayer Studio Next",
  rpcUrls: {
    default: { http: [CROSS_RPC_URL] },
  },
};

export const CROSS_NETWORK = {
  chainId: CROSS_CHAIN_ID,
  chainIdHex: `0x${CROSS_CHAIN_ID.toString(16)}`,
  chainName: "GenLayer Studio Next",
  nativeCurrency: {
    name: "GEN Token",
    symbol: "GEN",
    decimals: 18,
  },
  rpcUrls: [CROSS_RPC_URL],
  blockExplorerUrls: ["https://explorer-studio-dev.genlayer.com/"],
} as const;

export function getCrossContractAddress(): `0x${string}` {
  if (CROSS_CONFIGURATION_ERROR || !CROSS_CONTRACT_ADDRESS) {
    throw new Error(CROSS_CONFIGURATION_ERROR ?? "CROSS contract address is unavailable.");
  }
  return CROSS_CONTRACT_ADDRESS as `0x${string}`;
}
