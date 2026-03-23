# 🏗️ StealthVault Protocol — Architecture

---

## 🎯 Vision

StealthVault is a **privacy-preserving execution protocol** that enables on-chain strategy execution using encrypted data.

Unlike traditional DeFi systems, strategy logic is never exposed — only outcomes are visible.

---

## 🧠 Core Idea

> Separate **data visibility** from **execution correctness**

- Execution → On-chain (verifiable)
- Strategy → Encrypted (private)

---

## 🧩 Protocol Components

---

### 1. 🔐 Strategy Registry

Stores encrypted strategies submitted by users.

#### Responsibilities:

- Register encrypted logic
- Assign unique strategy IDs
- Map strategies to owners

#### Key Properties:

- Immutable storage
- Encrypted inputs only

---

### 2. ⚙️ Execution Engine (FHE Core)

Evaluates strategies using encrypted computation.

#### Responsibilities:

- Read encrypted strategy
- Evaluate conditions (e.g., price < X)
- Trigger execution signals

#### Key Properties:

- No decryption
- Deterministic execution

---

### 3. 🏦 Vault Layer

Manages funds tied to strategies.

#### Types:

- Single-user vault
- Multi-user vault (future)

#### Responsibilities:

- Accept deposits
- Link strategy
- Handle execution outcomes

---

### 4. 👥 Liquidity Pool Layer (Future)

Enables shared participation in strategies.

#### Responsibilities:

- Pool funds from multiple users
- Execute shared encrypted strategy

---

### 5. 📊 Result Layer

Exposes execution outcomes.

#### Visible Data:

- Profit / Loss
- Execution status

#### Hidden Data:

- Strategy logic
- Conditions

---

## 🔄 System Flow

```
User → Encrypt Strategy → Strategy Registry
     → Create Vault → Deposit Funds
     → Execution Engine Evaluates
     → Vault Executes
     → Result Returned
```

---

## 🔐 Privacy Model

| Component            | Visibility |
| -------------------- | ---------- |
| Strategy Logic       | Encrypted  |
| Execution Conditions | Encrypted  |
| Vault Balances       | Public     |
| Execution Results    | Public     |

---

## ⚙️ Tech Stack

### Smart Contracts

- Solidity (Fhenix-enabled EVM)
- Hardhat

### Encryption

- Cofhe SDK
- Fully Homomorphic Encryption (FHE)

### Frontend

- React + TypeScript

### Web3

- Ethers.js / Wagmi

---

## 🧠 Design Principles

- Privacy-first execution
- Minimal on-chain exposure
- Modular extensibility
- Protocol-first architecture

---

## 🚀 Future Extensions

- Oracle integration (real price feeds)
- Cross-chain execution
- AI-generated strategies
- Institutional vaults

---

## ⚠️ Constraints

- FHE computation overhead
- Limited debugging visibility
- MVP uses simulated execution

---

## 🏆 Success Criteria

- Strategy remains encrypted end-to-end
- Execution works correctly
- Vault flow is functional
- Demo clearly shows privacy advantage

---

> “Execution is transparent. Strategy is invisible.”
