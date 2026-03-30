import { parseAbi } from "viem";

/** Minimal ABI for StealthVault UI — paste full artifact ABI here if you prefer. */
export const strategyRegistryAbi = parseAbi([
  "event StrategyRegistered(bytes32 indexed strategyId, address indexed owner)",
  "event StrategyEvaluated(bytes32 indexed strategyId, uint256 nonce, uint256 oraclePrice, uint256 isBelowBuyCipher, uint256 isAboveSellCipher)",
  "event OutcomeApplied(bytes32 indexed strategyId, uint256 nonce, uint8 action, uint256 newVaultValue)",
  "event VaultDeposited(bytes32 indexed strategyId, address indexed user, uint256 amount)",
  "function registerStrategySimple(uint64 buyPlain, uint64 sellPlain) returns (bytes32 strategyId)",
  "function deposit(bytes32 strategyId) payable",
  "function executeStrategy(bytes32 strategyId, uint256 oraclePricePublic)",
  "function applyResult(bytes32 strategyId, uint256 nonce, uint8 action)",
  "function vaultValue(bytes32 strategyId) view returns (uint256)",
  "function getUserBalance(bytes32 strategyId, address user) view returns (uint256)",
  "function getStrategyCount(address owner_) view returns (uint256)",
  "function strategiesByOwner(address owner, uint256 index) view returns (bytes32)",
]);
