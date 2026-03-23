import { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { address, isConnected } = useAccount();
  const { connect, isPending, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  // ✅ Connected state
  if (isConnected && address) {
    return (
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => disconnect()}
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  // ✅ Remove duplicates (important)
  const uniqueConnectors = connectors.reduce((acc: any[], current) => {
    const exists = acc.find((c) => c.id === current.id);
    if (!exists) acc.push(current);
    return acc;
  }, []);

  // ✅ Sort: MetaMask first
  const sortedConnectors = uniqueConnectors.sort((a, b) => {
    if (a.name.toLowerCase().includes("meta")) return -1;
    if (b.name.toLowerCase().includes("meta")) return 1;
    return 0;
  });

  return (
    <div className="connect-wrap" ref={menuRef}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={isPending}
        onClick={() => setOpen((o) => !o)}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>

      {open && (
        <div className="connect-menu">
          {sortedConnectors.map((connector) => (
            <button
              key={connector.id}
              type="button"
              className="connect-option"
              onClick={() => {
                connect({ connector });
                setOpen(false);
              }}
              disabled={isPending}
            >
              {getWalletIcon(connector.name)} {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ✅ Simple icon mapper (clean UX)
function getWalletIcon(name: string) {
  const n = name.toLowerCase();

  if (n.includes("meta")) return "🦊";
  if (n.includes("walletconnect")) return "◎";
  if (n.includes("coinbase")) return "🔵";

  return "👛";
}
