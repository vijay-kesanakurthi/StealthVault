# 🔐 Private Strategy Vault (FHE-Powered DeFi)

> Execute trading strategies on-chain without revealing them.

---

## 🚀 Overview

Private Strategy Vault is a privacy-first DeFi protocol built using **Fully Homomorphic Encryption (FHE)** via Fhenix.

It allows users to:

- Submit **encrypted trading strategies**
- Execute them **without revealing logic**
- Protect against **MEV and copy trading**

---

## 🧠 Problem

In traditional DeFi:

- All trades are public
- Bots and whales exploit this via:
  - Front-running
  - Sandwich attacks
  - Copy trading

👉 Result: Retail traders lose their edge.

---

## 💡 Solution

We enable:

- **Encrypted strategy execution**
- **On-chain computation over encrypted data**
- **Private trading logic**

Only the **final result** is revealed — not the strategy.

---

## 🔐 Why FHE?

Using Fully Homomorphic Encryption:

- Data remains encrypted **during computation**
- Smart contracts operate on encrypted values

👉 This is **impossible on traditional EVM chains**

---

## 🧩 Features (MVP)

- 🔒 Encrypted strategy input (buy/sell conditions)
- ⚙️ On-chain evaluation (mock execution)
- 📊 Result output (profit/loss only)
- 👥 (Bonus) Private copy trading vault

---

## 🏗️ Architecture

### 1. Smart Contract

- Stores encrypted strategy
- Evaluates conditions
- Simulates trades

### 2. Frontend (React)

- Takes user input
- Encrypts using Cofhe SDK
- Displays results

### 3. Encryption Layer

- Client-side encryption/decryption

### 4. Price Source

- Mock price (MVP)
- Oracle (future)

---

## 🔄 Flow

1. User enters strategy
2. Values encrypted (client-side)
3. Encrypted data sent to contract
4. Contract evaluates conditions
5. Result returned

---

## 🧪 Example

- Buy if price < 100
- Sell if price > 150

👉 Strategy is encrypted
👉 Execution happens privately
👉 Output: “Trade executed, Profit: +X%”

---

## ⚙️ Tech Stack

- Solidity (Fhenix FHE library)
- Hardhat
- React
- Cofhe SDK
- Ethers.js / Wagmi (optional)

---

## 📦 Project Structure

```bash
private-strategy-vault/
│
├── contracts/        # Smart contracts
├── scripts/          # Deployment scripts
├── frontend/         # React app
├── test/             # Contract tests
├── docs/             # Additional documentation
└── README.md
```

---

## 🛠️ Setup Guide

### 1. Clone Repo

```bash
git clone https://github.com/your-username/private-strategy-vault.git
cd private-strategy-vault
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Setup Environment

Create `.env` file:

```env
PRIVATE_KEY=your_wallet_private_key
RPC_URL=your_rpc_url
```

---

### 4. Compile Contracts

```bash
npx hardhat compile
```

---

### 5. Run Local Node

```bash
npx hardhat node
```

---

### 6. Deploy Contracts

```bash
npx hardhat run scripts/deploy.js --network localhost
```

---

### 7. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 Encryption Flow (Important)

- Input values → encrypted via Cofhe SDK
- Encrypted values → sent to contract
- Contract computes → encrypted logic
- Output → decrypted (client-side if needed)

---

## 🎬 Demo Plan

1. Show normal trade → visible strategy ❌
2. Show vault:
   - encrypted input ✅
   - execution ✅
   - result only ✅

---

## 🚀 Roadmap

- Real DEX integration
- Oracle-based pricing
- Multi-user vaults
- AI-generated strategies
- Institutional-grade trading infra

---

## ⚠️ Limitations (MVP)

- Uses mock trading (no real swaps)
- Simplified strategy logic
- No gas optimization yet

---

## 🏆 Buildathon Goal

Demonstrate:

- Real use of encrypted computation
- Practical DeFi application
- Clear advantage over transparent systems

---

## 🤝 Contributing

PRs and ideas welcome. Focus areas:

- Strategy logic
- UI/UX improvements
- FHE optimizations

---

## 📜 License

MIT License

---

## 💬 Contact

For questions or collaboration:

- Open an issue
- Reach out on buildathon channels

---

## ⭐ Final Note

> “In DeFi, transparency is a feature — until it becomes a weakness.
> Private Strategy Vault restores the trader’s edge.”
