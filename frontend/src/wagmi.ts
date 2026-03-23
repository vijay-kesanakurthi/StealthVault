import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { metaMask, walletConnect, injected } from "wagmi/connectors";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

export const config = createConfig({
  chains: [mainnet, sepolia],

  connectors: [
    // ✅ Explicit MetaMask (priority)
    metaMask(),

    // ✅ Fallback injected wallets (Brave, etc.)
    injected(),

    // ✅ WalletConnect (mobile + others)
    ...(projectId
      ? [
          walletConnect({
            projectId,
            metadata: {
              name: "StealthVault",
              description:
                "Private Strategy Vault — encrypted execution on Fhenix",
              url:
                typeof window !== "undefined"
                  ? window.location.origin
                  : "http://localhost:5173",
            },
            showQrModal: true,
          }),
        ]
      : []),
  ],

  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
