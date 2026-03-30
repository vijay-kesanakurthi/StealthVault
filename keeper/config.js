const { ethers } = require("ethers");
require("dotenv").config();

const rpcUrl =
  process.env.RPC_URL ||
  process.env.SEPOLIA_RPC_URL ||
  "https://ethereum-sepolia.publicnode.com";
const pk = process.env.PRIVATE_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

if (!pk) {
  throw new Error("Set PRIVATE_KEY in keeper/.env (same funded wallet you use on Sepolia).");
}
if (!contractAddress) {
  throw new Error("Set CONTRACT_ADDRESS in keeper/.env to your deployed StrategyRegistry on Sepolia.");
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(pk, provider);

module.exports = { provider, wallet, contractAddress };
