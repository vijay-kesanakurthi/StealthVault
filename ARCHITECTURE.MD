# 🏗️ StealthVault Protocol — Architecture (Final)

---

## 🎯 Vision

StealthVault is a privacy-preserving DeFi execution protocol where:

- Strategy logic is encrypted
- Execution is on-chain and verifiable
- Outcomes are public but trustless

"Execution is transparent. Strategy is invisible."

---

## 🧠 Core Idea

Separate:

- What you know (strategy) → private
- What the chain does (execution) → public

Using Fully Homomorphic Encryption (FHE):

- Contracts compute on encrypted data
- No decryption happens on-chain

---

## 🧩 Protocol Components

---

### 1. Strategy Registry (On-Chain)

Stores encrypted strategy thresholds.

**Responsibilities:**

- Accept encrypted inputs (`InEuint64`)
- Store FHE values (`euint64`)
- Manage lifecycle (activate / pause / deactivate)

**Key Properties:**

- Strategy is never visible
- Only owner has original logic
- Uses FHE permissions

---

### 2. Execution Engine (FHE Layer)

Performs encrypted computation.

**Flow:**

- Oracle price (public) → encrypted on-chain
- Compare with encrypted thresholds:
  - price < buy
  - price > sell

**Output:**

- Emits ciphertext handles (`ebool`)
- No plaintext decision revealed

**Key Properties:**

- Fully on-chain
- Deterministic
- Privacy-preserving

---

### 3. Keeper Network (Off-Chain Bridge)

Bridges encrypted computation to real action.

**Responsibilities:**

- Listen to `StrategyEvaluated` event
- Decrypt results using CofheJS
- Decide action:
  - BUY / SELL / HOLD
- Call `applyResult`

**Why needed:**
Smart contracts cannot decrypt FHE data

---

### 4. Vault Layer (On-Chain Capital)

Manages user funds per strategy.

**Responsibilities:**

- Accept deposits
- Track balances:
  - totalDeposits
  - userDeposits
- Maintain NAV (`vaultValue`)

**Execution Logic:**

- BUY → +10%
- SELL → +5%
- HOLD → no change

**Key Properties:**

- Funds are real (ETH)
- Strategy impact is simulated (MVP)

---

### 5. Execution State Control (Nonce System)

Prevents race conditions and replay attacks.

**Mechanism:**

- `executionNonce` increments on each execution
- `applyResult` must match latest nonce
- `lastSettledNonce` prevents reuse

**Guarantees:**

- One execution → one settlement
- No double execution
- No stale updates

---

### 6. Incentive Layer (Keepers)

Encourages decentralized execution.

**Mechanism:**

- Keeper calls `applyResult`
- Receives reward (0.0001 ETH) if:
  - Valid execution
  - Non-HOLD action
  - Contract funded

---

## 🔄 System Flow

User
→ Encrypts strategy (buy/sell thresholds)
→ Calls registerStrategy()
User
→ Deposits ETH into vault
Anyone (Executor)
→ Calls executeStrategy(price)
Contract
→ Performs FHE comparison
→ Emits encrypted result
Keeper (Off-chain)
→ Listens to event
→ Decrypts result
→ Determines action
Keeper
→ Calls applyResult()
Contract
→ Updates vault NAV
→ Rewards keeper

---

## 🔐 Privacy Model

| Component            | Visibility |
| -------------------- | ---------- |
| Strategy Logic       | Encrypted  |
| Execution Conditions | Encrypted  |
| Oracle Price         | Public     |
| Vault Balances       | Public     |
| Execution Result     | Public     |
| Decision Logic       | Hidden     |

---

## ⚙️ Tech Stack

**Smart Contracts**

- Solidity (0.8.25)
- Fhenix CoFHE

**Encryption**

- Cofhe SDK
- FHE (euint64, ebool)

**Frontend**

- React + TypeScript

**Web3**

- Wagmi
- WalletConnect / Injected wallets

**Off-chain**

- Keeper bot (Node.js + CofheJS)

---

## 🧠 Design Principles

- Privacy-first execution
- Deterministic logic
- Permissionless participation
- Modular architecture
- Trustless system

---

## 🚀 Future Extensions

- Real oracle integration (Chainlink)
- Multi-user pooled vaults
- AI-generated strategies
- Cross-chain execution
- Real trading instead of simulated NAV

---

## ⚠️ Current Limitations

- FHE computation overhead
- Requires off-chain keeper
- Vault returns are simulated
- Hard to debug encrypted flows
