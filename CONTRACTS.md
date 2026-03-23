# Hardhat & Solidity Setup — StealthVault

Quick reference for the contract development workflow.

---

## Prerequisites

- **Node.js** v20+
- **npm** (or pnpm)

---

## Install

From project root:

```bash
npm install
```

---

## Commands

| Command | Description |
|--------|--------------|
| `npm run compile` | Compile Solidity → `artifacts/` + TypeChain → `typechain-types/` |
| `npm run test` | Run tests on Hardhat network |
| `npm run test:gas` | Run tests with gas report (set `REPORT_GAS=true`) |
| `npm run node` | Start local JSON-RPC node (default accounts, port 8545) |
| `npm run deploy` | Deploy to localhost (run node first) |
| `npm run deploy:sepolia` | Deploy to Ethereum Sepolia |
| `npm run deploy:arb-sepolia` | Deploy to Arbitrum Sepolia |
| `npm run clean` | Remove `artifacts/`, `cache/`, `typechain-types/` |

---

## Environment

```bash
cp .env.example .env
# Edit .env: set PRIVATE_KEY for testnet deploys.
# For local only, you can leave it unset; Hardhat uses the default mnemonic.
```

- **localhost**: If `PRIVATE_KEY` is not set, the config uses the same mnemonic as `hardhat node`, so deploy works without `.env`.
- **Sepolia / Arb Sepolia**: Set `PRIVATE_KEY` (and optional `*_RPC_URL`, `*SCAN_API_KEY`).

---

## Project layout

```
contracts/           # Solidity sources
  StrategyRegistry.sol
scripts/
  deploy.ts          # Deploy StrategyRegistry
test/
  StrategyRegistry.test.ts
hardhat.config.ts
typechain-types/     # Generated after compile (TypeScript types)
```

---

## Solidity config

- **Version**: 0.8.25 (required for `@fhenixprotocol/cofhe-contracts`)  
- **Pragma**: `^0.8.25` in `StrategyRegistry.sol`  
- **EVM**: Cancun  
- **Optimizer**: enabled, 200 runs  

Networks: `hardhat` (default), `localhost`, `eth-sepolia`, `arb-sepolia`.  

**CoFHE**: `cofhe-hardhat-plugin` is enabled in `hardhat.config.ts` so `StrategyRegistry` (FHE) can run tests against mocks. Production: Fhenix / CoFHE testnets per [CoFHE docs](https://cofhe-docs.fhenix.zone/).

**Execution flow**: `executeStrategy` bumps `executionNonce` and emits `StrategyEvaluated(..., nonce, ...)`. Keepers decrypt off-chain, then call `applyResult(strategyId, nonce, action)` — must match head nonce; `lastSettledNonce` prevents double-settle.

---

## Local run (compile + test + deploy)

```bash
npm run compile
npm run test
npm run node          # Terminal 1
npm run deploy        # Terminal 2 (deploys to localhost)
```

---

## Next steps (protocol)

- Add **Execution Engine** (e.g. evaluate encrypted conditions via CoFHE).
- Add **Vault** (deposits, strategy link, execution outcomes).
- Integrate **@fhenixprotocol/cofhe-contracts** in new contracts when moving to FHE.
