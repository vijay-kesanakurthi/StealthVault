# StealthVault — Boilerplate Setup

Quick start for the Private Strategy Vault (FHE-powered DeFi) stack.

## Prerequisites

- **Node.js** v20+
- **npm** (or pnpm)

## 1. Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

## 2. Environment

```bash
cp .env.example .env
# Edit .env and set PRIVATE_KEY (and RPC URLs if needed).
```

## 3. Compile contracts

```bash
npm run compile
```

## 4. Run tests

```bash
npm run test
```

## 5. Local node (optional)

In one terminal:

```bash
npm run node
```

In another:

```bash
npm run deploy
```

## 6. Frontend

```bash
npm run frontend
```

Then open [http://localhost:5173](http://localhost:5173). Use **Connect wallet** to connect (e.g. MetaMask). For local Hardhat node, add network `http://127.0.0.1:8545` with chain ID `31337` in your wallet.

## Project layout

| Path         | Purpose                          |
|-------------|-----------------------------------|
| `contracts/` | Solidity (StrategyRegistry, etc.) |
| `scripts/`   | Deploy scripts                    |
| `test/`      | Hardhat tests                     |
| `frontend/`  | React + TypeScript + Wagmi        |
| `docs/`      | Extra docs                        |

## Next steps

- Integrate **CoFHE** (FHE types and operations) into contracts when ready.
- Add **Execution Engine** and **Vault** contracts per `ARCHITECTURE.MD`.
- Use **@cofhe/sdk** (or cofhejs) in the frontend for encrypted strategy input.
