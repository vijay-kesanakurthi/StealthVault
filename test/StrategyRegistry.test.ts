import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { StrategyRegistry__factory, type StrategyRegistry } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const DEMO_BUY = 100n;
const DEMO_SELL = 150n;

async function registerStrategyAndGetId(reg: StrategyRegistry, signer: HardhatEthersSigner): Promise<string> {
  const tx = await reg.connect(signer).registerStrategySimple(DEMO_BUY, DEMO_SELL);
  const receipt = await tx.wait();
  expect(receipt).to.not.be.null;
  for (const log of receipt!.logs) {
    try {
      const parsed = reg.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "StrategyRegistered") {
        return parsed.args.strategyId as string;
      }
    } catch {
      /* skip */
    }
  }
  throw new Error("StrategyRegistered not found");
}

async function executeAndGetNonce(reg: StrategyRegistry, strategyId: string, oraclePrice: bigint, signer: HardhatEthersSigner) {
  const tx = await reg.connect(signer).executeStrategy(strategyId, oraclePrice);
  const receipt = await tx.wait();
  expect(receipt).to.not.be.null;
  for (const log of receipt!.logs) {
    try {
      const p = reg.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (p.name === "StrategyEvaluated") {
        return p.args.nonce as bigint;
      }
    } catch {
      /* skip */
    }
  }
  throw new Error("StrategyEvaluated not found");
}

describe("StrategyRegistry", function () {
  let registry: StrategyRegistry;
  let owner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    registry = await new StrategyRegistry__factory(owner).deploy();
  });

  describe("resolveAction", function () {
    it("below buy → BUY", async function () {
      expect(await registry.resolveAction(true, false)).to.equal(1);
    });
    it("above sell → SELL", async function () {
      expect(await registry.resolveAction(false, true)).to.equal(2);
    });
    it("otherwise → HOLD", async function () {
      expect(await registry.resolveAction(false, false)).to.equal(0);
    });
  });

  it("registers and exposes FHE handles", async function () {
    const strategyId = await registerStrategyAndGetId(registry, owner);
    const [buyH, sellH, strOwner, active, paused] = await registry.getStrategy(strategyId);
    expect(strOwner).to.equal(owner.address);
    expect(active).to.be.true;
    expect(paused).to.be.false;
    expect(buyH).to.not.equal(0n);
    expect(sellH).to.not.equal(0n);
  });

  it("receive() emits FundingReceived", async function () {
    const v = ethers.parseEther("0.01");
    await expect(owner.sendTransaction({ to: await registry.getAddress(), value: v }))
      .to.emit(registry, "FundingReceived")
      .withArgs(owner.address, v);
  });

  it("fundKeeperRewards() funds contract and emits event", async function () {
    const v = ethers.parseEther("0.05");
    await expect(registry.connect(other).fundKeeperRewards({ value: v }))
      .to.emit(registry, "FundingReceived")
      .withArgs(other.address, v);
  });

  it("pauseStrategy blocks deposit and execute; unpause restores", async function () {
    const strategyId = await registerStrategyAndGetId(registry, owner);
    await expect(registry.connect(owner).pauseStrategy(strategyId)).to.emit(registry, "StrategyPaused");
    await expect(registry.connect(other).deposit(strategyId, { value: 1n })).to.be.revertedWithCustomError(
      registry,
      "StrategyIsPaused"
    );
    await expect(registry.executeStrategy(strategyId, 100n)).to.be.revertedWithCustomError(registry, "StrategyIsPaused");
    await registry.connect(owner).unpauseStrategy(strategyId);
    await expect(registry.connect(other).deposit(strategyId, { value: ethers.parseEther("1") })).to.emit(
      registry,
      "VaultDeposited"
    );
  });

  describe("execution nonce + applyResult", function () {
    it("reverts StaleExecution when nonce does not match head", async function () {
      const strategyId = await registerStrategyAndGetId(registry, owner);
      await registry.connect(owner).deposit(strategyId, { value: ethers.parseEther("1") });
      await executeAndGetNonce(registry, strategyId, 90n, owner);
      expect(await registry.executionNonce(strategyId)).to.equal(1n);
      await executeAndGetNonce(registry, strategyId, 95n, owner);
      expect(await registry.executionNonce(strategyId)).to.equal(2n);
      await expect(registry.connect(other).applyResult(strategyId, 1n, 1)).to.be.revertedWithCustomError(
        registry,
        "StaleExecution"
      );
    });

    it("settles latest nonce and rejects duplicate settle (AlreadySettled)", async function () {
      const strategyId = await registerStrategyAndGetId(registry, owner);
      await registry.connect(owner).deposit(strategyId, { value: ethers.parseEther("1") });
      const nonce = await executeAndGetNonce(registry, strategyId, 90n, owner);
      await registry.connect(other).applyResult(strategyId, nonce, 1);
      await expect(registry.connect(other).applyResult(strategyId, nonce, 1)).to.be.revertedWithCustomError(
        registry,
        "AlreadySettled"
      );
    });

    it("permissionless keeper applies with correct nonce", async function () {
      const strategyId = await registerStrategyAndGetId(registry, owner);
      await registry.connect(owner).deposit(strategyId, { value: ethers.parseEther("1") });
      const nonce = await executeAndGetNonce(registry, strategyId, 90n, owner);
      await expect(registry.connect(other).applyResult(strategyId, nonce, 1)).to.emit(registry, "OutcomeApplied");
    });

    it("pays keeper for BUY/SELL actions even with zero vault (incentivizes execution)", async function () {
      const strategyId = await registerStrategyAndGetId(registry, owner);
      // No deposit - vault stays at 0
      await owner.sendTransaction({ to: await registry.getAddress(), value: ethers.parseEther("0.1") });
      const nonce = await executeAndGetNonce(registry, strategyId, 90n, owner);
      const before = await ethers.provider.getBalance(other.address);
      const tx = await registry.connect(other).applyResult(strategyId, nonce, 1);
      const receipt = await tx.wait();
      const fee = receipt!.fee;
      const after = await ethers.provider.getBalance(other.address);
      const reward = await registry.KEEPER_REWARD_WEI();
      expect(after - before + fee).to.equal(reward);
    });

    it("pays keeper only when nav>0 and action is BUY (legacy test - now pays regardless)", async function () {
      const strategyId = await registerStrategyAndGetId(registry, owner);
      await registry.connect(owner).deposit(strategyId, { value: ethers.parseEther("1") });
      await owner.sendTransaction({ to: await registry.getAddress(), value: ethers.parseEther("0.1") });
      const nonce = await executeAndGetNonce(registry, strategyId, 90n, owner);
      const before = await ethers.provider.getBalance(other.address);
      const tx = await registry.connect(other).applyResult(strategyId, nonce, 1);
      const receipt = await tx.wait();
      const fee = receipt!.fee;
      const after = await ethers.provider.getBalance(other.address);
      const reward = await registry.KEEPER_REWARD_WEI();
      expect(after - before + fee).to.equal(reward);
    });

    it("no keeper reward on HOLD (regardless of vault balance)", async function () {
      const strategyId = await registerStrategyAndGetId(registry, owner);
      await registry.connect(owner).deposit(strategyId, { value: ethers.parseEther("1") });
      await owner.sendTransaction({ to: await registry.getAddress(), value: ethers.parseEther("0.1") });
      const nonce = await executeAndGetNonce(registry, strategyId, 90n, owner);
      const tx = await registry.connect(other).applyResult(strategyId, nonce, 0);
      const receipt = await tx.wait();
      let keeperPaid = false;
      for (const log of receipt!.logs) {
        try {
          const p = registry.interface.parseLog({ topics: [...log.topics], data: log.data });
          if (p.name === "KeeperRewardPaid") keeperPaid = true;
        } catch {
          /* skip */
        }
      }
      expect(keeperPaid).to.be.false;
    });
  });

  describe("Vault", function () {
    it("deposit and withdraw", async function () {
      const strategyId = await registerStrategyAndGetId(registry, owner);
      const oneEth = ethers.parseEther("1");
      await registry.connect(other).deposit(strategyId, { value: oneEth });
      await registry.connect(other).withdraw(strategyId, ethers.parseEther("0.5"));
      expect(await registry.getUserBalance(strategyId, other.address)).to.equal(ethers.parseEther("0.5"));
    });
  });

  describe("FHE comparison (mock plaintext)", function () {
    it("oracle 90 < buy 100 → isBelowBuy true; not above sell 150", async function () {
      const strategyId = await registerStrategyAndGetId(registry, owner);
      const tx = await registry.executeStrategy(strategyId, 90n);
      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;
      let below = 0n;
      let above = 0n;
      for (const log of receipt!.logs) {
        try {
          const p = registry.interface.parseLog({ topics: [...log.topics], data: log.data });
          if (p?.name === "StrategyEvaluated") {
            below = p.args.isBelowBuyCipher as bigint;
            above = p.args.isAboveSellCipher as bigint;
            break;
          }
        } catch {
          /* skip */
        }
      }
      expect(below).to.not.equal(0n);
      expect(above).to.not.equal(0n);
      await hre.cofhe.mocks.expectPlaintext(below, 1n);
      await hre.cofhe.mocks.expectPlaintext(above, 0n);
    });

    it("oracle 160 > sell 150 → isAboveSell true", async function () {
      const strategyId = await registerStrategyAndGetId(registry, owner);
      const tx = await registry.executeStrategy(strategyId, 160n);
      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;
      let below = 0n;
      let above = 0n;
      for (const log of receipt!.logs) {
        try {
          const p = registry.interface.parseLog({ topics: [...log.topics], data: log.data });
          if (p?.name === "StrategyEvaluated") {
            below = p.args.isBelowBuyCipher as bigint;
            above = p.args.isAboveSellCipher as bigint;
            break;
          }
        } catch {
          /* skip */
        }
      }
      await hre.cofhe.mocks.expectPlaintext(below, 0n);
      await hre.cofhe.mocks.expectPlaintext(above, 1n);
    });
  });

  describe("End-to-end", function () {
    it("deposit → execute → apply BUY → NAV up; totalDeposits unchanged", async function () {
      const strategyId = await registerStrategyAndGetId(registry, owner);
      const oneEth = ethers.parseEther("1");
      await registry.connect(owner).deposit(strategyId, { value: oneEth });
      const nonce = await executeAndGetNonce(registry, strategyId, 90n, other);
      const expectedNav = (oneEth * 110n) / 100n;
      await expect(registry.connect(other).applyResult(strategyId, nonce, 1))
        .to.emit(registry, "OutcomeApplied")
        .withArgs(strategyId, nonce, 1, expectedNav);
      expect(await registry.vaultValue(strategyId)).to.equal(expectedNav);
      expect(await registry.totalDeposits(strategyId)).to.equal(oneEth);
    });
  });
});
