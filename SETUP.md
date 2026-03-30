# 🚀 StealthVault — Quick Setup Guide

> **Get StealthVault running locally in under 5 minutes**

[![Setup Guide](https://img.shields.io/badge/Setup-Quick%20Start-green)](https://github.com)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-blue)](https://nodejs.org)

---

## 📋 **Prerequisites**

- **Node.js** v20+ ([Download](https://nodejs.org))
- **npm** or **pnpm** package manager
- **MetaMask** or compatible Web3 wallet
- **Sepolia testnet ETH** ([Faucet](https://sepoliafaucet.com))

---

## ⚡ **Quick Start (5 minutes)**

### **1. Clone & Install**
```bash
git clone <repository-url>
cd stealthvault

# Install root dependencies
npm install

# Install frontend dependencies  
cd frontend && npm install && cd ..

# Install keeper dependencies
cd keeper && npm install && cd ..
```

### **2. Environment Setup**
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your settings
nano .env  # or use your preferred editor
```

**Required Environment Variables:**
```env
# Wallet private key (for contract deployment)
PRIVATE_KEY=your_private_key_here

# RPC URLs (optional - defaults provided)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-key
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Etherscan API keys (optional - for verification)
ETHERSCAN_API_KEY=your_etherscan_key
ARBISCAN_API_KEY=your_arbiscan_key
```

### **3. Compile & Test**
```bash
# Compile smart contracts
npm run compile

# Run comprehensive test suite
npm run test
```

Expected output:
```
✓ 17 passing tests
✓ FHE operations working correctly
✓ Keeper reward system functional
```

### **4. Deploy Contracts**

**Option A: Use Pre-deployed Contracts (Recommended for Demo)**
- Contracts already deployed on Sepolia testnet
- Skip to step 5 for immediate demo

**Option B: Deploy Your Own Contracts**
```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia

# Or deploy locally (requires local node)
npm run node     # Terminal 1
npm run deploy   # Terminal 2
```

### **5. Start Application**

**Terminal 1: Keeper Service**
```bash
cd keeper
npm start
```
Expected output:
```
🔧 StealthVault Execution Service
📍 Contract: 0x1234...
👤 Executor: 0xabcd...
🔍 Monitoring for strategy executions...
```

**Terminal 2: Frontend Application**
```bash
cd frontend  
npm run dev
```
Expected output:
```
Local:   http://localhost:5173/
Network: http://192.168.1.100:5173/
```

### **6. Fund Contract (For Keeper Rewards)**
```bash
# Fund contract with ETH for keeper rewards
npx hardhat run scripts/fund-rewards.js --network sepolia
```

---

## 🌐 **Access Application**

1. **Open Browser**: Navigate to [http://localhost:5173](http://localhost:5173)
2. **Connect Wallet**: Click "Connect Wallet" and select MetaMask
3. **Switch Network**: Ensure you're on Sepolia testnet
4. **Get Test ETH**: Use [Sepolia Faucet](https://sepoliafaucet.com) if needed

---

## 📁 **Project Structure**

```
stealthvault/
├── contracts/              # Smart contracts
│   ├── StrategyRegistry.sol # Main FHE trading contract
│   └── interfaces/          # Contract interfaces
├── scripts/                 # Deployment scripts
│   ├── deploy.ts           # Main deployment script
│   └── fund-rewards.js     # Fund keeper rewards
├── test/                   # Comprehensive test suite
│   └── StrategyRegistry.test.ts
├── frontend/               # React application
│   ├── src/
│   │   ├── App.tsx         # Main application component
│   │   ├── abi/            # Contract ABIs
│   │   └── config.ts       # Configuration
│   └── public/             # Static assets
├── keeper/                 # Keeper service
│   ├── index.js           # Main keeper logic
│   ├── config.js          # Keeper configuration
│   └── fhe.js             # FHE operations
├── docs/                   # Documentation
│   ├── README.md          # Main documentation
│   ├── ARCHITECTURE.MD    # Technical architecture
│   ├── HACKATHON.md       # Hackathon submission guide
│   └── DEMO.md            # Live demo instructions
└── .env.example           # Environment template
```

---

## 🧪 **Testing & Validation**

### **Run Full Test Suite**
```bash
npm run test
```

**Test Coverage:**
- ✅ Strategy registration and encryption
- ✅ FHE comparison operations  
- ✅ Keeper network settlement
- ✅ Vault deposit/withdrawal
- ✅ Reward distribution
- ✅ Edge cases and error handling

### **Manual Testing Checklist**
- [ ] Deploy strategy with encrypted parameters
- [ ] Deposit ETH into strategy vault
- [ ] Execute strategy with different oracle prices
- [ ] Verify keeper processes results automatically
- [ ] Check vault value updates correctly
- [ ] Confirm activity feed shows execution history

---

## 🔧 **Development Commands**

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile Solidity contracts |
| `npm run test` | Run comprehensive test suite |
| `npm run test:gas` | Run tests with gas reporting |
| `npm run node` | Start local Hardhat node |
| `npm run deploy` | Deploy to localhost |
| `npm run deploy:sepolia` | Deploy to Sepolia testnet |
| `npm run frontend` | Start frontend development server |
| `npm run build` | Build frontend for production |
| `npm run clean` | Clean build artifacts |

---

## 🐛 **Troubleshooting**

### **Common Issues**

**Issue**: `npm install` fails  
**Solution**: Ensure Node.js v20+ is installed, clear npm cache with `npm cache clean --force`

**Issue**: Contract deployment fails  
**Solution**: Check PRIVATE_KEY in .env, ensure wallet has Sepolia ETH

**Issue**: Frontend won't connect to wallet  
**Solution**: Ensure MetaMask is installed and Sepolia testnet is added

**Issue**: Keeper service not responding  
**Solution**: Check keeper terminal for errors, ensure contract is deployed and funded

**Issue**: Strategy execution fails  
**Solution**: Verify contract has sufficient balance for keeper rewards

### **Getting Help**

- **📖 Documentation**: Check [README.md](README.md) and [ARCHITECTURE.MD](ARCHITECTURE.MD)
- **🐛 Issues**: Contact via repository or direct communication
- **💬 Discussions**: Available through repository access

---

## 🚀 **Next Steps**

### **For Developers**
1. **Explore Code**: Review smart contracts and frontend implementation
2. **Run Tests**: Understand FHE operations through test cases
3. **Customize**: Modify strategy logic or add new features
4. **Contribute**: Submit PRs for improvements

### **For Demo/Evaluation**
1. **Follow Demo Guide**: See [DEMO.md](DEMO.md) for step-by-step walkthrough
2. **Test Scenarios**: Try different oracle prices and strategy parameters
3. **Monitor Logs**: Watch keeper service process encrypted results
4. **Evaluate Privacy**: Verify strategy parameters remain encrypted

### **For Production**
1. **Security Audit**: Comprehensive security review before mainnet
2. **Gas Optimization**: Optimize FHE operations for cost efficiency
3. **Oracle Integration**: Connect to Chainlink or other price feeds
4. **DEX Integration**: Add real trading execution via Uniswap/1inch

---

<div align="center">

## ✅ **Setup Complete!**

**Your StealthVault instance is now running.**

**Next**: Follow the [Demo Guide](DEMO.md) for a complete walkthrough.

*Questions? Check our [Documentation](README.md) or contact via repository*

</div>
