import { sepolia } from "wagmi/chains";

/**
 * Deployed StrategyRegistry — override with VITE_CONTRACT_ADDRESS in .env
 */
export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

/**
 * Chain id used to namespace localStorage (align with VITE_CHAIN_ID or default Sepolia).
 * Switching contract or chain uses a different storage bucket so stale UI data does not leak.
 */
const rawPersistChain = import.meta.env.VITE_CHAIN_ID;
const parsedPersistChain =
  rawPersistChain !== undefined && rawPersistChain !== ""
    ? Number(rawPersistChain)
    : NaN;
export const PERSISTENCE_CHAIN_ID =
  Number.isFinite(parsedPersistChain) && parsedPersistChain > 0
    ? parsedPersistChain
    : sepolia.id;

const addrLower = CONTRACT_ADDRESS.toLowerCase();
const storageAddrPart =
  addrLower === "0x0000000000000000000000000000000000000000"
    ? "unconfigured"
    : addrLower;

/** Single namespace string: contract (or unconfigured) + chain. */
export const APP_STORAGE_SCOPE = `${storageAddrPart}-${PERSISTENCE_CHAIN_ID}`;

/** Legacy: full strategy rows — only read once to migrate buy/sell hints into metadata. */
export const STRATEGIES_STORAGE_KEY = `stealthvault-strategies-v2-${APP_STORAGE_SCOPE}`;
export const TX_LOG_STORAGE_KEY = `stealthvault-txlog-v2-${APP_STORAGE_SCOPE}`;
/** Optional UI hints (buy/sell thresholds you entered at create) — not used for list membership. */
export const STRATEGY_METADATA_STORAGE_KEY = `stealthvault-strategy-meta-v2-${APP_STORAGE_SCOPE}`;

export function persistenceScopeLabel(): string {
  const a = CONTRACT_ADDRESS;
  const short =
    a.toLowerCase() === "0x0000000000000000000000000000000000000000"
      ? "not set"
      : a.length > 14
        ? `${a.slice(0, 8)}…${a.slice(-4)}`
        : a;
  return `${short} · chain ${PERSISTENCE_CHAIN_ID}`;
}

/** Block explorer base URL (no trailing slash). Default: Sepolia Etherscan. */
export const EXPLORER_BASE = (
  import.meta.env.VITE_EXPLORER_URL || "https://sepolia.etherscan.io"
).replace(/\/$/, "");

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

export function explorerAddressUrl(addr: string): string {
  return `${EXPLORER_BASE}/address/${addr}`;
}

/** Optional: fetch older txs via Etherscan API V2 (unified multichain). */
export const ETHERSCAN_API_KEY = (
  import.meta.env.VITE_ETHERSCAN_API_KEY || ""
).trim();

/** V2 base path — see https://docs.etherscan.io/v2-migration */
export const ETHERSCAN_API_BASE = (
  import.meta.env.VITE_ETHERSCAN_API_BASE || "https://api.etherscan.io/v2/api"
).replace(/\/$/, "");

/** Target chain for V2 `chainid` (defaults to Sepolia, same as wagmi config). */
export const ETHERSCAN_CHAIN_ID =
  Number(import.meta.env.VITE_ETHERSCAN_CHAIN_ID) || sepolia.id;
