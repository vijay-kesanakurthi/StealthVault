import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  coinbaseWallet,
  injected,
  metaMask,
  walletConnect,
} from "wagmi/connectors";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

const connectors = [
  metaMask(),
  coinbaseWallet({ appName: "StealthVault" }),
  injected(),
  ...(projectId ? [walletConnect({ projectId })] : []),
];

export const config = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http(
      import.meta.env.VITE_SEPOLIA_RPC_URL ||
        "https://ethereum-sepolia.publicnode.com",
    ),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
