import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "cofhe-hardhat-plugin";
import "hardhat-gas-reporter";
import * as dotenv from "dotenv";

dotenv.config();

/** 32-byte hex private key (64 chars or 0x + 64 chars) */
function isValidPrivateKey(value: string | undefined): value is string {
  if (!value) return false;
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  return hex.length === 64 && /^[0-9a-fA-F]+$/.test(hex);
}

const privateKey = process.env.PRIVATE_KEY;
const accounts = isValidPrivateKey(privateKey) ? [privateKey] : undefined;

/** Same mnemonic as `hardhat node` so deploy --network localhost works without .env */
const LOCALHOST_MNEMONIC =
  "test test test test test test test test test test test junk";

const config: HardhatUserConfig = {
  solidity: {
    // 0.8.25: required by @fhenixprotocol/cofhe-contracts (>=0.8.25 <0.9.0)
    version: "0.8.25",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      accounts: accounts ?? { mnemonic: LOCALHOST_MNEMONIC, count: 20 },
    },
    "eth-sepolia": {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia.publicnode.com",
      accounts: accounts ?? [],
      chainId: 11155111,
    },
    "arb-sepolia": {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: accounts ?? [],
      chainId: 421614,
    },
  },
  etherscan: {
    apiKey: {
      "eth-sepolia": process.env.ETHERSCAN_API_KEY || "",
      "arb-sepolia": process.env.ARBISCAN_API_KEY || "",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
};

export default config;
