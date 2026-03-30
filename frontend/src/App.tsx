import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import {
  CONTRACT_ADDRESS,
  explorerAddressUrl,
  explorerTxUrl,
  STRATEGIES_STORAGE_KEY,
  STRATEGY_METADATA_STORAGE_KEY,
  TX_LOG_STORAGE_KEY,
} from "./config";
import { strategyRegistryAbi } from "./abi/strategyRegistry";

type Tab = "dashboard" | "strategies" | "create";
type ActionLabel = "BUY" | "SELL" | "HOLD" | "-";

type TxLogEntry = {
  id: string;
  hash: string;
  title: string;
  status: "pending" | "confirmed" | "failed";
  error?: string;
  /** When the tx was observed or loaded (ms), for sorting */
  ts?: number;
  /** Parsed from receipt logs — what the contract actually emitted */
  detail?: string;
};

type PersistedTxLogRow = {
  hash: string;
  title: string;
  status: TxLogEntry["status"];
  error?: string;
  ts?: number;
  detail?: string;
};

type Strategy = {
  strategyId: string;
  buyPrice: number;
  sellPrice: number;
  vaultWei: bigint;
  lastAction: ActionLabel;
  depositedWei: bigint;
};

/** Legacy full-row localStorage shape (migrated into metadata hints only). */
type LegacyPersistedStrategyRow = {
  strategyId: string;
  buyPrice: number;
  sellPrice: number;
  vaultWei?: string;
  lastAction?: ActionLabel;
  depositedWei?: string;
};

const MAX_TX_LOG = 500;

const registryIface = new ethers.Interface(strategyRegistryAbi);

function parseLastStrategyEvaluated(receipt: ethers.TransactionReceipt): {
  nonce: bigint;
  oraclePrice: bigint;
} {
  let nonce = 0n;
  let oraclePrice = 0n;
  for (const log of receipt.logs) {
    try {
      const parsed = registryIface.parseLog({ topics: log.topics, data: log.data });
      if (parsed?.name === "StrategyEvaluated") {
        nonce = parsed.args.nonce as bigint;
        oraclePrice = parsed.args.oraclePrice as bigint;
      }
    } catch {
      // ignore
    }
  }
  return { nonce, oraclePrice };
}

function parseVaultDeposited(receipt: ethers.TransactionReceipt): {
  strategyId: string;
  amountWei: bigint;
} | null {
  for (const log of receipt.logs) {
    try {
      const parsed = registryIface.parseLog({ topics: log.topics, data: log.data });
      if (parsed?.name === "VaultDeposited") {
        return {
          strategyId: String(parsed.args.strategyId),
          amountWei: parsed.args.amount as bigint,
        };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function shortId(id: string) {
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

function shortTxHash(hash: string) {
  if (hash.length < 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function newTxLogId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function parseError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function hasKnownThresholds(strategy: Strategy) {
  return !(strategy.buyPrice <= 0 && strategy.sellPrice <= 0);
}

/** Map common custom errors to judge-friendly copy for the demo. */
function humanizeContractError(message: string): string {
  const raw = message;
  const m = message.toLowerCase();
  if (m.includes("staleexecution") || m.includes("stale execution")) {
    return "Stale settlement: applyResult must use the nonce from the latest executeStrategy for this strategy. If two executes happened, settle the newest one first (or avoid double-execute before settle).";
  }
  if (m.includes("alreadysettled") || m.includes("already settled")) {
    return "Already settled: this nonce was applied (e.g. backend keeper got there first). Refresh and try a new execute.";
  }
  if (m.includes("invalidthresholds")) {
    return "On-chain rejected: buy must be strictly less than sell.";
  }
  if (m.includes("strategynotfound")) return "Strategy not found on this contract.";
  if (m.includes("strategyinactive")) return "Strategy is deactivated.";
  if (m.includes("strategyispaused")) return "Strategy is paused.";
  return raw;
}

/** Buy/sell hints for UI (Create Strategy); list + balances always come from chain. */
function readStrategyMetadataHints(): Record<string, { buyPrice: number; sellPrice: number }> {
  try {
    const raw = localStorage.getItem(STRATEGY_METADATA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { buyPrice?: number; sellPrice?: number }>;
      if (parsed && typeof parsed === "object") {
        const out: Record<string, { buyPrice: number; sellPrice: number }> = {};
        for (const [k, v] of Object.entries(parsed)) {
          out[k.toLowerCase()] = {
            buyPrice: Number(v?.buyPrice) || 0,
            sellPrice: Number(v?.sellPrice) || 0,
          };
        }
        return out;
      }
    }
    const leg = localStorage.getItem(STRATEGIES_STORAGE_KEY);
    if (leg) {
      const arr = JSON.parse(leg) as unknown;
      if (Array.isArray(arr)) {
        const out: Record<string, { buyPrice: number; sellPrice: number }> = {};
        for (const row of arr as LegacyPersistedStrategyRow[]) {
          if (row?.strategyId) {
            out[String(row.strategyId).toLowerCase()] = {
              buyPrice: Number(row.buyPrice) || 0,
              sellPrice: Number(row.sellPrice) || 0,
            };
          }
        }
        return out;
      }
    }
  } catch {
    /* ignore */
  }
  return {};
}

function loadPersistedTxLog(): TxLogEntry[] {
  try {
    const raw = localStorage.getItem(TX_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedTxLogRow[];
    if (!Array.isArray(parsed)) return [];
    const byHash = new Map<string, TxLogEntry>();
    for (const row of parsed) {
      const h = typeof row.hash === "string" ? row.hash.toLowerCase() : "";
      if (!h) continue;
      const ts = typeof row.ts === "number" ? row.ts : 0;
      const st = row.status;
      const status: TxLogEntry["status"] =
        st === "pending" || st === "failed" || st === "confirmed" ? st : "confirmed";
      const entry: TxLogEntry = {
        id: `persisted-${row.hash}-${ts}`,
        hash: row.hash,
        title: row.title || "Transaction",
        status,
        error: row.error,
        ts: row.ts,
        detail: row.detail,
      };
      const prev = byHash.get(h);
      if (!prev || (entry.ts ?? 0) >= (prev.ts ?? 0)) byHash.set(h, entry);
    }
    return [...byHash.values()]
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
      .slice(0, MAX_TX_LOG);
  } catch {
    return [];
  }
}

function persistTxLogToStorage(list: TxLogEntry[]) {
  try {
    const sorted = [...list].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)).slice(0, MAX_TX_LOG);
    const out: PersistedTxLogRow[] = sorted.map((e) => ({
      hash: e.hash,
      title: e.title,
      status: e.status,
      error: e.error,
      ts: e.ts,
      detail: e.detail,
    }));
    localStorage.setItem(TX_LOG_STORAGE_KEY, JSON.stringify(out));
  } catch {
    // ignore quota errors
  }
}

function isExplorerTitle(title: string) {
  return title.startsWith("On-chain ·");
}

/** Prefer in-app labels over generic explorer rows for the same hash. */
function betterTxEntry(a: TxLogEntry, b: TxLogEntry): TxLogEntry {
  const exA = isExplorerTitle(a.title);
  const exB = isExplorerTitle(b.title);
  if (exA && !exB) return b;
  if (!exA && exB) return a;
  if ((a.ts ?? 0) !== (b.ts ?? 0)) return (a.ts ?? 0) > (b.ts ?? 0) ? a : b;
  if (a.status === "pending" && b.status !== "pending") return b;
  if (b.status === "pending" && a.status !== "pending") return a;
  if (a.detail && !b.detail) return a;
  if (!a.detail && b.detail) return b;
  return a;
}

function mergeAndDedupeTxLog(entries: TxLogEntry[]): TxLogEntry[] {
  const byHash = new Map<string, TxLogEntry>();
  for (const e of entries) {
    const h = e.hash.toLowerCase();
    const cur = byHash.get(h);
    byHash.set(h, cur ? betterTxEntry(cur, e) : e);
  }
  return [...byHash.values()]
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    .slice(0, MAX_TX_LOG);
}

function App() {
  const missingAddr =
    CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000";
  const [tab, setTab] = useState<Tab>("dashboard");
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [buyInput, setBuyInput] = useState("100");
  const [sellInput, setSellInput] = useState("150");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [errorText, setErrorText] = useState<string>("");
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [txLog, setTxLog] = useState<TxLogEntry[]>(() => loadPersistedTxLog());
  /** Public oracle price passed to executeStrategy (keeper decrypts & applyResult off-chain). */
  const [oraclePriceInput, setOraclePriceInput] = useState("120");
  const [connectOpen, setConnectOpen] = useState(false);
  const [registryBalanceWei, setRegistryBalanceWei] = useState<bigint | null>(null);
  const { address, isConnected, connector } = useAccount();
  const { connectAsync, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();

  const totalVaultEth = useMemo(
    () =>
      strategies
        .reduce((acc, s) => acc + Number(ethers.formatEther(s.vaultWei)), 0)
        .toFixed(4),
    [strategies],
  );
  function parseOraclePriceForTx(): number {
    const v = Number(oraclePriceInput);
    if (!Number.isFinite(v) || v < 0 || v > 1_000_000) {
      throw new Error("Enter a valid oracle price (0 … 1,000,000).");
    }
    return Math.trunc(v);
  }

  function appendTxPending(hash: string, title: string) {
    const now = Date.now();
    const row: TxLogEntry = {
      id: newTxLogId(),
      hash,
      title,
      status: "pending",
      ts: now,
    };
    setTxLog((prev) =>
      mergeAndDedupeTxLog([
        row,
        ...prev.filter((e) => e.hash.toLowerCase() !== hash.toLowerCase()),
      ]),
    );
  }

  function settleTxByHash(hash: string, ok: boolean, err?: string) {
    const h = hash.toLowerCase();
    setTxLog((prev) =>
      mergeAndDedupeTxLog(
        prev.map((e) =>
          e.hash.toLowerCase() === h && e.status === "pending"
            ? {
                ...e,
                status: ok ? "confirmed" : "failed",
                error: ok ? undefined : err,
                ts: e.ts ?? Date.now(),
              }
            : e,
        ),
      ),
    );
  }

  function patchTxLogByHash(
    hash: string,
    patch: Partial<Pick<TxLogEntry, "title" | "detail">>,
  ) {
    const h = hash.toLowerCase();
    setTxLog((prev) =>
      mergeAndDedupeTxLog(
        prev.map((e) => (e.hash.toLowerCase() === h ? { ...e, ...patch } : e)),
      ),
    );
  }

  useEffect(() => {
    if (strategies.length === 0) return;
    try {
      const out: Record<string, { buyPrice: number; sellPrice: number }> = {};
      for (const s of strategies) {
        if (s.buyPrice > 0 || s.sellPrice > 0) {
          out[s.strategyId.toLowerCase()] = {
            buyPrice: s.buyPrice,
            sellPrice: s.sellPrice,
          };
        }
      }
      localStorage.setItem(STRATEGY_METADATA_STORAGE_KEY, JSON.stringify(out));
    } catch {
      /* ignore quota */
    }
  }, [strategies]);

  useEffect(() => {
    persistTxLogToStorage(txLog);
  }, [txLog]);


  async function connectWallet(connectorId: string) {
    setErrorText("");
    try {
      const selected = connectors.find((c) => c.id === connectorId);
      if (!selected) {
        setErrorText("Connector not found.");
        return;
      }
      await connectAsync({ connector: selected });
      setConnectOpen(false);
      setStatus(`Connected with ${selected.name}.`);
    } catch (error) {
      setErrorText(humanizeContractError(parseError(error)));
      console.error(error);
    }
  }

  async function refreshStrategies(
    activeContract = contract,
    owner = address ?? "",
  ) {
    if (!activeContract || !owner) return;
    setRefreshing(true);
    setErrorText("");
    try {
      const hints = readStrategyMetadataHints();
      const count = Number(await activeContract.getStrategyCount(owner));
      const next: Strategy[] = [];
      for (let i = 0; i < count; i++) {
        const id = await activeContract.strategiesByOwner(owner, BigInt(i));
        const idKey = String(id).toLowerCase();
        const vaultWei = await activeContract.vaultValue(id);
        const depositedWei = await activeContract.getUserBalance(id, owner);
        const hint = hints[idKey];
        next.push({
          strategyId: String(id),
          buyPrice: hint?.buyPrice ?? 0,
          sellPrice: hint?.sellPrice ?? 0,
          vaultWei,
          lastAction: "-",
          depositedWei,
        });
      }
      setStrategies(next);
    } catch (error) {
      setErrorText(humanizeContractError(parseError(error)));
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  }

  async function initContractFromConnector() {
    if (!isConnected || !connector || !address) {
      setContract(null);
      setStrategies([]);
      return;
    }
    try {
      const fromConnector =
        "getProvider" in connector && typeof connector.getProvider === "function"
          ? await connector.getProvider()
          : undefined;
      const fromWindow = (
        window as Window & { ethereum?: ethers.Eip1193Provider }
      ).ethereum;
      const eip1193 = (fromConnector || fromWindow) as
        | ethers.Eip1193Provider
        | undefined;
      if (!eip1193) {
        throw new Error(
          "No wallet provider available from connector. Reconnect wallet.",
        );
      }
      const browserProvider = new ethers.BrowserProvider(
        eip1193 as ethers.Eip1193Provider,
      );
      // Use connected address explicitly; avoids extra account-request prompts.
      const signer = await browserProvider.getSigner(address);
      const c = new ethers.Contract(CONTRACT_ADDRESS, strategyRegistryAbi, signer);
      setContract(c);
      await refreshStrategies(c, address);
    } catch (error) {
      setErrorText(humanizeContractError(parseError(error)));
      console.error(error);
    }
  }

  useEffect(() => {
    void initContractFromConnector();
  }, [isConnected, connector?.id, address]);

  useEffect(() => {
    if (missingAddr) {
      setRegistryBalanceWei(null);
      return;
    }
    let cancelled = false;
    const eth = (
      window as Window & { ethereum?: ethers.Eip1193Provider }
    ).ethereum;
    if (!eth) return () => {};
    (async () => {
      try {
        const browserProvider = new ethers.BrowserProvider(eth);
        const bal = await browserProvider.getBalance(CONTRACT_ADDRESS);
        if (!cancelled) setRegistryBalanceWei(bal);
      } catch {
        if (!cancelled) setRegistryBalanceWei(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missingAddr, isConnected, address]);

  async function createStrategy() {
    if (!contract) return;
    setBusy(true);
    setErrorText("");
    setStatus("");
    let sentHash = "";
    try {
      const buy = Number(buyInput);
      const sell = Number(sellInput);
      if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) {
        setErrorText("Enter positive buy and sell prices (same units as the market simulator).");
        return;
      }
      if (buy >= sell) {
        setErrorText("Buy must be strictly less than sell — that matches the on-chain demo check.");
        return;
      }
      const tx = await contract.registerStrategySimple(BigInt(buy), BigInt(sell));
      sentHash = tx.hash;
      appendTxPending(tx.hash, "Create strategy");
      const receipt = await tx.wait();
      settleTxByHash(tx.hash, true);
      let strategyId = "";
      for (const log of receipt.logs) {
        try {
          const parsed = registryIface.parseLog({ topics: log.topics, data: log.data });
          if (parsed?.name === "StrategyRegistered") {
            strategyId = String(parsed.args.strategyId);
            break;
          }
        } catch {
          // ignore unrelated log
        }
      }
      patchTxLogByHash(tx.hash, {
        title: strategyId
          ? `registerStrategySimple · ${shortId(strategyId)}`
          : "registerStrategySimple",
        detail: strategyId
          ? "Contract: StrategyRegistered — buy/sell stored as FHE ciphertext (thresholds not readable on-chain)."
          : "Contract: registration confirmed; open tx on explorer for StrategyRegistered log.",
      });
      console.info("[StealthVault] registerStrategySimple", {
        hash: tx.hash,
        strategyId: strategyId || null,
      });
      setStatus(
        `Strategy created: ${strategyId ? shortId(strategyId) : "(parse id from explorer)"} · ${shortTxHash(tx.hash)}`,
      );
      await refreshStrategies();
      setStrategies((prev) =>
        prev.map((s) =>
          s.strategyId.toLowerCase() === strategyId.toLowerCase()
            ? { ...s, buyPrice: buy, sellPrice: sell }
            : s,
        ),
      );
      setTab("strategies");
    } catch (error) {
      if (sentHash) settleTxByHash(sentHash, false, humanizeContractError(parseError(error)));
      setErrorText(humanizeContractError(parseError(error)));
      console.error(error);
    } finally {
      setBusy(false);
    }
  }

  async function deposit(strategyId: string, amountEth: string) {
    if (!contract) return;
    setBusy(true);
    setErrorText("");
    setStatus("");
    let sentHash = "";
    try {
      const value = ethers.parseEther(amountEth);
      const tx = await contract.deposit(strategyId, { value });
      sentHash = tx.hash;
      appendTxPending(tx.hash, `Deposit ${amountEth} ETH · ${shortId(strategyId)}`);
      const depReceipt = await tx.wait();
      settleTxByHash(tx.hash, true);
      const vd = parseVaultDeposited(depReceipt);
      if (vd) {
        patchTxLogByHash(tx.hash, {
          title: `deposit · ${ethers.formatEther(vd.amountWei)} ETH · ${shortId(vd.strategyId)}`,
          detail: `Contract: VaultDeposited — amount ${ethers.formatEther(vd.amountWei)} ETH`,
        });
        console.info("[StealthVault] deposit", {
          hash: tx.hash,
          strategyId: vd.strategyId,
          amountEth: ethers.formatEther(vd.amountWei),
        });
      }
      setStatus(`Deposited ${amountEth} ETH to ${shortId(strategyId)} · ${shortTxHash(tx.hash)}`);
      await refreshStrategies();
    } catch (error) {
      if (sentHash) settleTxByHash(sentHash, false, humanizeContractError(parseError(error)));
      setErrorText(humanizeContractError(parseError(error)));
      console.error(error);
    } finally {
      setBusy(false);
    }
  }

  /** Wallet sends executeStrategy only; keeper must call applyResult after decrypting event handles. */
  async function executeStrategyViaWallet(strategy: Strategy, price: number): Promise<void> {
    if (!contract) throw new Error("Wallet not connected.");

    const execTx = await contract.executeStrategy(strategy.strategyId, BigInt(price));
    appendTxPending(
      execTx.hash,
      `Execute strategy ${shortId(strategy.strategyId)} @ price ${price}`,
    );
    let execReceipt: ethers.TransactionReceipt | null;
    try {
      execReceipt = await execTx.wait();
      settleTxByHash(execTx.hash, true);
    } catch (e) {
      settleTxByHash(execTx.hash, false, humanizeContractError(parseError(e)));
      throw e;
    }
    if (!execReceipt) {
      throw new Error("Missing execute receipt after confirmation.");
    }
    const { nonce, oraclePrice } = parseLastStrategyEvaluated(execReceipt);
    if (nonce === 0n) {
      throw new Error(
        "No StrategyEvaluated log in receipt — check VITE_CONTRACT_ADDRESS and that this wallet targeted the registry.",
      );
    }

    patchTxLogByHash(execTx.hash, {
      title: `executeStrategy · ${shortId(strategy.strategyId)} · oracle ${oraclePrice}`,
      detail: `Contract: StrategyEvaluated · nonce=${nonce} · oraclePrice=${oraclePrice} · FHE lt/gt vs encrypted thresholds; ciphertext handles in log for decrypt.`,
    });
    console.info("[StealthVault] executeStrategy", {
      hash: execTx.hash,
      strategyId: strategy.strategyId,
      nonce: nonce.toString(),
      oraclePrice: oraclePrice.toString(),
    });

    setRecentActions((prev) =>
      [
        `Oracle ${price} → executeStrategy sent · ${shortId(strategy.strategyId)} · nonce ${nonce} (wait for keeper applyResult)`,
        ...prev,
      ].slice(0, 16),
    );
  }

  async function runExecuteStrategy(strategy: Strategy, price: number) {
    if (!contract) return;
    setBusy(true);
    setErrorText("");
    setStatus("");
    try {
      await executeStrategyViaWallet(strategy, price);
      setStatus(
        `Oracle ${price}: executeStrategy confirmed — watch keeper logs for decrypt + applyResult (BUY/SELL/HOLD).`,
      );
      await refreshStrategies();
    } catch (error) {
      setErrorText(humanizeContractError(parseError(error)));
      console.error(error);
    } finally {
      setBusy(false);
    }
  }

  async function executeAllStrategiesAtOracle() {
    if (!contract) {
      setErrorText("Connect wallet first.");
      return;
    }
    if (strategies.length === 0) {
      setErrorText("No strategies available.");
      return;
    }
    let price: number;
    try {
      price = parseOraclePriceForTx();
    } catch (e) {
      setErrorText(parseError(e));
      return;
    }
    setBusy(true);
    setErrorText("");
    setStatus("");
    try {
      for (const strategy of strategies) {
        await executeStrategyViaWallet(strategy, price);
        setStatus(`Oracle ${price}: executed batch through ${shortId(strategy.strategyId)} — keeper settles each nonce.`);
      }
      await refreshStrategies();
    } catch (error) {
      setErrorText(humanizeContractError(parseError(error)));
      console.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav className="mb-6 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-2 shadow-lg">
              <img src="/stealthvault-logo.svg" alt="StealthVault" className="w-full h-full" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-violet-300">StealthVault</h1>
              <p className="text-sm text-slate-400">Institutional-Grade Private Trading Platform</p>
            </div>
          </div>
          {isConnected && address ? (
            <button
              type="button"
              onClick={() => {
                disconnect();
                setStatus("Disconnected.");
              }}
              className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400"
            >
              {`${address.slice(0, 6)}...${address.slice(-4)}`} · Disconnect
            </button>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setConnectOpen((v) => !v)}
                className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400"
              >
                {connectPending ? "Connecting..." : "Connect Wallet"}
              </button>
              {connectOpen && (
                <div className="absolute right-0 z-20 mt-2 min-w-56 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
                  {connectors.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={connectPending}
                      onClick={() => void connectWallet(c.id)}
                      className="mb-1 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="mb-6 flex gap-2">
          {(["dashboard", "strategies", "create"] as const).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === name
                  ? "bg-violet-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {name === "dashboard"
                ? "Dashboard"
                : name === "strategies"
                  ? "Strategies"
                  : "Create Strategy"}
            </button>
          ))}
        </div>

        {missingAddr && (
          <div className="mb-4 rounded-xl border border-red-700 bg-red-950/50 p-3 text-sm text-red-300">
            Set <code>VITE_CONTRACT_ADDRESS</code> in <code>frontend/.env</code>.
          </div>
        )}
        {!missingAddr && (
          <div className="mb-6 rounded-xl border border-violet-600/35 bg-gradient-to-r from-violet-950/30 via-slate-900/50 to-slate-900/50 p-5 text-sm text-slate-300">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="font-semibold text-violet-200 text-lg">🔐 Private Strategy Execution</p>
                <p className="mt-2 text-slate-300">
                  Your trading parameters are <strong className="text-violet-300">encrypted on-chain</strong> using advanced cryptography. 
                  Execute strategies without revealing positions to competitors or MEV bots.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-slate-400">Contract:</span>
                  <a
                    href={explorerAddressUrl(CONTRACT_ADDRESS)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-violet-400 underline decoration-violet-500/40 underline-offset-2 hover:text-violet-300"
                  >
                    {`${CONTRACT_ADDRESS.slice(0, 8)}…${CONTRACT_ADDRESS.slice(-6)}`}
                  </a>
                  {registryBalanceWei != null && (
                    <span className="text-slate-400">
                      Balance: {ethers.formatEther(registryBalanceWei)} ETH
                    </span>
                  )}
                </div>
              </div>
              {registryBalanceWei != null && registryBalanceWei < ethers.parseEther("0.0001") && (
                <div className="rounded-lg bg-amber-900/30 border border-amber-600/40 px-3 py-2 text-xs text-amber-200">
                  ⚠️ Fund contract with ≥0.0001 ETH for keeper rewards
                </div>
              )}
            </div>
          </div>
        )}
        {status && (
          <div className="mb-4 rounded-xl border border-emerald-700 bg-emerald-950/40 p-3 text-sm text-emerald-300">
            {status}
          </div>
        )}
        {errorText && (
          <div className="mb-4 rounded-xl border border-red-700 bg-red-950/40 p-3 text-sm text-red-300">
            {errorText}
          </div>
        )}

        {txLog.length > 0 && (
          <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900/80 p-4 shadow-inner">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <h3 className="text-sm font-medium text-slate-200">Recent Transactions</h3>
                <span className="text-xs text-slate-500">({txLog.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setTxLog([])}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-700"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {txLog.slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg bg-slate-800/40 px-3 py-2 text-sm"
                >
                  <span
                    className={`shrink-0 w-2 h-2 rounded-full ${
                      entry.status === "confirmed"
                        ? "bg-emerald-400"
                        : entry.status === "pending"
                          ? "bg-amber-400"
                          : "bg-rose-400"
                    }`}
                  />
                  <span className="min-w-0 flex-1 text-slate-300 truncate">{entry.title}</span>
                  <a
                    href={explorerTxUrl(entry.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 font-mono text-xs text-violet-400 hover:text-violet-300"
                  >
                    {shortTxHash(entry.hash)}
                  </a>
                </div>
              ))}
              {txLog.length > 8 && (
                <p className="text-xs text-slate-500 text-center py-2">
                  ... and {txLog.length - 8} more
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-3 rounded-2xl border border-emerald-600/40 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-emerald-400 text-lg">📊</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Market Oracle</h2>
                  <p className="text-sm text-slate-400">Simulate market price movements</p>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-300">Current Price</span>
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={oraclePriceInput}
                    onChange={(e) => setOraclePriceInput(e.target.value)}
                    placeholder="e.g. 80, 120, 200"
                    className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-lg font-mono outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !contract || strategies.length === 0}
                  onClick={() => void executeAllStrategiesAtOracle()}
                  className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Executing..." : "🚀 Execute All Strategies"}
                </button>
              </div>
              {strategies.length === 0 && (
                <p className="mt-4 text-sm text-amber-400">
                  💡 Create your first private strategy to begin automated trading
                </p>
              )}
            </div>

            <div className="lg:col-span-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-6 shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <span className="text-violet-400 text-lg">🎯</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-200">Quick Start Guide</h3>
                  <p className="text-sm text-slate-400">Get started with private trading in minutes</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</div>
                    <div>
                      <p className="font-medium text-slate-300">Create Strategy</p>
                      <p className="text-sm text-slate-400">Set buy=100, sell=150 (encrypted on-chain)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</div>
                    <div>
                      <p className="font-medium text-slate-300">Fund Strategy</p>
                      <p className="text-sm text-slate-400">Deposit some ETH to see vault changes</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</div>
                    <div>
                      <p className="font-medium text-slate-300">Enable Automation</p>
                      <p className="text-sm text-slate-400">Start the execution service for automatic trading</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">4</div>
                    <div>
                      <p className="font-medium text-slate-300">Execute Strategies</p>
                      <p className="text-sm text-slate-400">Set market price and trigger automated execution</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">5</div>
                    <div>
                      <p className="font-medium text-slate-300">Monitor Performance</p>
                      <p className="text-sm text-slate-400">Track vault growth and strategy performance</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">6</div>
                    <div>
                      <p className="font-medium text-slate-300">Scale Operations</p>
                      <p className="text-sm text-slate-400">Deploy multiple strategies with different parameters</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💰</span>
                <p className="text-sm text-slate-400">Total Vault Value</p>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{totalVaultEth} ETH</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎯</span>
                <p className="text-sm text-slate-400">Active Strategies</p>
              </div>
              <p className="text-2xl font-bold text-violet-400">{strategies.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📊</span>
                <p className="text-sm text-slate-400">Current Oracle</p>
              </div>
              <p className="text-2xl font-bold text-emerald-300">{oraclePriceInput || "—"}</p>
            </div>

            <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400 text-lg">📈</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200">Activity Feed</h3>
                    <p className="text-sm text-slate-400">Recent strategy executions</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || refreshing || !contract || !address}
                  onClick={() => void refreshStrategies()}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-600 disabled:opacity-50"
                >
                  {refreshing ? "Refreshing..." : "🔄 Refresh"}
                </button>
              </div>
              <div className="space-y-3">
                {recentActions.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <span className="text-4xl mb-2 block">📭</span>
                    <p>No activity yet</p>
                    <p className="text-sm mt-1">Execute a strategy to see activity here</p>
                  </div>
                )}
                {recentActions.map((entry, i) => (
                  <div key={`${entry}-${i}`} className="rounded-lg bg-slate-800/60 border border-slate-700/50 px-4 py-3 text-sm text-slate-300">
                    <span className="text-slate-400 text-xs">{new Date().toLocaleTimeString()}</span>
                    <p className="mt-1">{entry}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === "strategies" && (
          <section className="grid gap-6 lg:grid-cols-2">
            {strategies.length === 0 && (
              <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-xl font-semibold text-slate-300 mb-2">No Active Strategies</h3>
                <p className="text-slate-400 mb-4">Deploy your first encrypted trading strategy</p>
                <button
                  type="button"
                  onClick={() => setTab("create")}
                  className="rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-500"
                >
                  Deploy Strategy
                </button>
              </div>
            )}
            {strategies.map((strategy) => {
              const vaultEth = Number(ethers.formatEther(strategy.vaultWei));
              const depositedEth = Number(ethers.formatEther(strategy.depositedWei));
              const profitPct =
                depositedEth > 0 ? ((vaultEth - depositedEth) / depositedEth) * 100 : 0;
              const known = hasKnownThresholds(strategy);
              return (
                <article
                  key={strategy.strategyId}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg transition hover:border-violet-500/60 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-violet-300">
                        🔐 {shortId(strategy.strategyId)}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 font-mono">{strategy.strategyId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Last Action</p>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                        strategy.lastAction === 'BUY' ? 'bg-emerald-900/50 text-emerald-300' :
                        strategy.lastAction === 'SELL' ? 'bg-rose-900/50 text-rose-300' :
                        strategy.lastAction === 'HOLD' ? 'bg-amber-900/50 text-amber-300' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {strategy.lastAction}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Buy Threshold</p>
                      <p className="font-mono text-lg font-bold text-emerald-400">
                        {known ? strategy.buyPrice : "🔒 Encrypted"}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Sell Threshold</p>
                      <p className="font-mono text-lg font-bold text-rose-400">
                        {known ? strategy.sellPrice : "🔒 Encrypted"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-slate-400">Vault Balance</p>
                      <p className="text-lg font-bold text-white">{vaultEth.toFixed(4)} ETH</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">P&L</p>
                      <p className={`text-lg font-bold ${
                        profitPct >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {profitPct >= 0 ? "+" : ""}{profitPct.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deposit(strategy.strategyId, "0.0004")}
                        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition hover:bg-violet-500 disabled:opacity-50"
                      >
                        💰 Deposit 0.0004 ETH
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void refreshStrategies()}
                        className="rounded-lg bg-slate-700 px-4 py-2 text-sm transition hover:bg-slate-600 disabled:opacity-50"
                      >
                        🔄 Refresh
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        try {
                          const p = parseOraclePriceForTx();
                          void runExecuteStrategy(strategy, p);
                        } catch (e) {
                          setErrorText(parseError(e));
                        }
                      }}
                      className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      🚀 Execute @ Oracle {oraclePriceInput || "—"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {tab === "create" && (
          <section className="mx-auto max-w-2xl">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-violet-400 text-2xl">🎯</span>
                </div>
                <h2 className="text-2xl font-bold text-violet-300 mb-2">Deploy Trading Strategy</h2>
                <p className="text-slate-400">
                  Configure encrypted parameters for automated execution
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-3">🔒 Privacy Technology</h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>Parameters encrypted using <strong className="text-slate-300">Fully Homomorphic Encryption</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>Execution network processes encrypted data without decryption</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>Automated execution protects against front-running and MEV</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">🟢 Buy Threshold</span>
                    <input
                      type="number"
                      value={buyInput}
                      onChange={(e) => setBuyInput(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-lg font-mono outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">Execute BUY when price drops below this</p>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">🔴 Sell Threshold</span>
                    <input
                      type="number"
                      value={sellInput}
                      onChange={(e) => setSellInput(e.target.value)}
                      placeholder="e.g. 150"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-lg font-mono outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">Execute SELL when price rises above this</p>
                  </label>
                </div>

                {buyInput && sellInput && (
                  <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
                    <h4 className="font-medium text-slate-300 mb-2">Execution Logic</h4>
                    <div className="text-sm text-slate-400 space-y-1">
                      <p>• Market &lt; {buyInput} → <span className="text-emerald-400 font-medium">ACCUMULATE</span></p>
                      <p>• Market &gt; {sellInput} → <span className="text-rose-400 font-medium">DISTRIBUTE</span></p>
                      <p>• {buyInput} ≤ Market ≤ {sellInput} → <span className="text-amber-400 font-medium">HOLD</span></p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={busy || !contract}
                  onClick={() => void createStrategy()}
                  className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 text-lg font-semibold text-white transition hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "🔄 Deploying Strategy..." : "🚀 Deploy Strategy"}
                </button>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

export default App;
