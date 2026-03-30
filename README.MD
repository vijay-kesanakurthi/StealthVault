# 🔐 StealthVault — Institutional-Grade Private Trading Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Fhenix](https://img.shields.io/badge/Built%20with-Fhenix%20FHE-blue)](https://fhenix.zone)
[![Hackathon Ready](https://img.shields.io/badge/Hackathon-Ready-green)](https://github.com)

> **Execute sophisticated trading strategies without revealing them to competitors or MEV bots.**

StealthVault leverages **Fully Homomorphic Encryption (FHE)** to enable private, automated trading execution on-chain. Your strategy parameters remain encrypted throughout the entire execution process.

---

## 🎯 **What It Does**

StealthVault is a privacy-preserving DeFi execution protocol that allows traders to:

- **Deploy encrypted trading strategies** with confidential buy/sell thresholds
- **Execute automated trades** without revealing strategy logic to the public
- **Protect against MEV attacks** and front-running bots
- **Scale institutional trading** with privacy-first infrastructure

### **Repository**: Available on GitHub with complete source code

---

## 🧠 **The Problem It Solves**

### Current DeFi Trading Issues:

- **📊 All strategies are public** — competitors can copy successful approaches
- **🤖 MEV bots exploit transparency** — front-running and sandwich attacks
- **💸 Retail traders lose edge** — whales and algorithms have unfair advantages
- **🏢 Institutions avoid DeFi** — lack of privacy for large-scale operations

### **Our Solution:**

StealthVault uses **Fully Homomorphic Encryption** to compute on encrypted data, enabling:

- ✅ **Private strategy execution** without revealing logic
- ✅ **On-chain verification** with cryptographic guarantees
- ✅ **MEV protection** through encrypted parameters
- ✅ **Institutional-grade privacy** for professional trading

---

## 🏗️ **How We Built It**

### **Architecture Overview**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Interface│    │  Smart Contract  │    │ Keeper Network  │
│                 │    │                  │    │                 │
│ • Strategy Input│───▶│ • FHE Storage    │───▶│ • Event Monitor │
│ • Encryption    │    │ • Private Compute│    │ • Decryption    │
│ • Monitoring    │    │ • Vault Management│    │ • Settlement    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **Core Components:**

1. **🔐 Strategy Registry Contract**

   - Stores encrypted trading parameters using FHE
   - Performs private comparisons on-chain
   - Manages strategy lifecycle and permissions

2. **⚡ Execution Service (Keeper Network)**

   - Monitors strategy evaluation events
   - Decrypts execution signals off-chain
   - Settles trades automatically

3. **💰 Vault Management System**

   - Handles user deposits and withdrawals
   - Tracks performance and P&L
   - Distributes execution rewards

4. **🎨 Professional Frontend**
   - Institutional-grade UI/UX
   - Real-time strategy monitoring
   - Comprehensive analytics dashboard

### **Tech Stack:**

- **Smart Contracts**: Solidity + Fhenix CoFHE Library
- **Frontend**: React + TypeScript + Tailwind CSS
- **Web3**: Wagmi + Ethers.js + WalletConnect
- **Encryption**: CofheJS SDK for client-side FHE operations
- **Testing**: Hardhat + CoFHE mocks for FHE testing

---

## 🚀 **Quick Start**

### **Prerequisites**

- Node.js v20+
- MetaMask or compatible wallet
- Sepolia testnet ETH

### **1. Clone & Install**

```bash
# Clone this repository
git clone <repository-url>
cd stealthvault
npm install
cd frontend && npm install && cd ..
```

### **2. Environment Setup**

```bash
cp .env.example .env
# Edit .env with your private key and RPC URLs
```

### **3. Deploy Contracts**

```bash
npm run compile
npm run deploy:sepolia
```

### **4. Start Application**

```bash
# Terminal 1: Start execution service
cd keeper && npm start

# Terminal 2: Start frontend
cd frontend && npm run dev
```

### **5. Fund Contract (for keeper rewards)**

```bash
npx hardhat run scripts/fund-rewards.js --network sepolia
```

**🌐 Access the app at [http://localhost:5173](http://localhost:5173)**

---

## 🎬 **Demo Walkthrough**

### **Step 1: Deploy Private Strategy**

- Set encrypted buy threshold (e.g., 100 USDC)
- Set encrypted sell threshold (e.g., 150 USDC)
- Strategy parameters are encrypted client-side before submission

### **Step 2: Fund Strategy**

- Deposit ETH into your strategy vault
- Funds are used for simulated trading execution
- Real P&L tracking based on market movements

### **Step 3: Automated Execution**

- Set market price via oracle input
- Strategy evaluates encrypted conditions
- Keeper network settles trades automatically

### **Step 4: Monitor Performance**

- View vault growth in real-time
- Track execution history
- Analyze strategy performance

---

## 🧪 **Technologies I Used**

### **Blockchain & Encryption:**

- **Fhenix Protocol**: FHE-enabled blockchain for private computation
- **CoFHE Library**: Solidity library for FHE operations
- **CofheJS SDK**: Client-side encryption/decryption

### **Smart Contract Development:**

- **Solidity 0.8.25**: Latest version with FHE support
- **Hardhat**: Development environment with FHE testing mocks
- **TypeChain**: Type-safe contract interactions

### **Frontend & UX:**

- **React 18**: Modern component architecture
- **TypeScript**: Type safety throughout the application
- **Tailwind CSS**: Professional styling system
- **Wagmi**: React hooks for Web3 interactions

### **Infrastructure:**

- **Keeper Network**: Node.js automation service
- **Event-driven Architecture**: Real-time strategy monitoring
- **Modular Design**: Extensible for future features

---

## 🎯 **Challenges I Ran Into**

### **1. FHE Access Control Lists (ACLs)**

- **Challenge**: Encrypted data needs proper permissions for different operations
- **Solution**: Implemented `allowThis()`, `allowGlobal()` for contract and keeper access
- **Learning**: FHE requires careful permission management unlike traditional smart contracts

### **2. Keeper Decryption Permissions**

- **Challenge**: Keepers couldn't decrypt strategy evaluation results
- **Solution**: Used `FHE.allowGlobal()` instead of `FHE.allowSender()` for universal access
- **Impact**: Enabled trustless, permissionless keeper network

### **3. Empty Vault Strategy Execution**

- **Challenge**: Strategies with zero deposits weren't rewarding keepers
- **Solution**: Modified reward logic to incentivize execution regardless of vault balance
- **Benefit**: Ensures strategy execution even during initial testing phase

### **4. FHE Testing & Debugging**

- **Challenge**: Debugging encrypted computations is inherently difficult
- **Solution**: Used CoFHE Hardhat plugin with mock FHE operations for testing
- **Approach**: Comprehensive test suite with plaintext assertions on encrypted operations

---

## 📈 **What We Learned**

### **Technical Insights:**

- **FHE is production-ready** for specific use cases like private comparisons
- **Event-driven architecture** works well for bridging on-chain FHE and off-chain actions
- **Client-side encryption** provides better UX than server-side alternatives
- **Modular design** is crucial for complex privacy-preserving protocols

### **Product Insights:**

- **Privacy has real value** in competitive trading environments
- **Professional UX matters** for institutional adoption
- **Automated execution** is essential for practical trading strategies
- **Clear value proposition** resonates with both retail and institutional users

### **Ecosystem Insights:**

- **Fhenix FHE capabilities** enable new categories of private DeFi applications
- **Hackathon constraints** force focus on core value proposition
- **Community feedback** shapes product direction and feature prioritization

---

## 🚀 **What's Next for StealthVault**

### **Immediate Roadmap (Next 3 months):**

- **🔗 Oracle Integration**: Chainlink price feeds for real market data
- **💱 DEX Integration**: Actual trading execution via Uniswap/1inch
- **📊 Advanced Strategies**: Multi-condition logic, stop-losses, take-profits
- **🏦 Institutional Features**: Multi-sig support, compliance tools

### **Medium-term Vision (6-12 months):**

- **🌐 Cross-chain Execution**: Deploy on multiple FHE-enabled chains
- **🤖 AI Strategy Generation**: ML-powered strategy optimization
- **👥 Social Trading**: Private copy-trading with encrypted performance
- **📈 Portfolio Management**: Multi-strategy vault management

### **Long-term Goals (1-2 years):**

- **🏢 Institutional Platform**: White-label solutions for trading firms
- **🌍 Global Expansion**: Support for traditional finance integration
- **🔬 Research Partnerships**: Collaborate on FHE trading research
- **📱 Mobile Application**: Native iOS/Android apps

---

## 📊 **Project Statistics**

- **📝 Smart Contract Lines**: 352 lines (StrategyRegistry.sol)
- **⚛️ Frontend Components**: 1,227 lines (React TypeScript)
- **🧪 Test Coverage**: 17 comprehensive test cases
- **🔧 Keeper Service**: 188 lines (automated execution)
- **📚 Documentation**: 5 comprehensive guides
- **⏱️ Development Time**: 2 weeks (hackathon sprint)

### **Development Setup:**

```bash
# Clone from your Git repository
git clone <repository-url>
cd stealthvault
npm install
npm run test  # Run full test suite
```

---

## 📜 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🌟 **Acknowledgments**

- **Fhenix Team**: For building the FHE infrastructure that makes this possible
- **CoFHE Contributors**: For the excellent developer tools and documentation
- **Hackathon Organizers**: For creating an environment that fosters innovation
- **Community**: For feedback, testing, and continuous improvement suggestions

---

<div align="center">

**⭐ If you found this project interesting, please give it a star! ⭐**

_"In DeFi, transparency is a feature — until it becomes a weakness.  
StealthVault restores the trader's edge through privacy-preserving execution."_

</div>
