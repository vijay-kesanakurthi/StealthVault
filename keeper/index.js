const { ethers } = require("ethers");
const { provider, wallet, contractAddress } = require("./config.js");

/** @param {import("ethers").Contract} c */
function parseAllContractLogs(c, receipt) {
  const out = { OutcomeApplied: null, KeeperRewardPaid: null };
  for (const log of receipt.logs) {
    let parsed;
    try {
      parsed = c.interface.parseLog(log);
    } catch {
      continue;
    }
    if (parsed.name === "OutcomeApplied") out.OutcomeApplied = parsed;
    if (parsed.name === "KeeperRewardPaid") out.KeeperRewardPaid = parsed;
  }
  return out;
}
const abi = require("./abi.json");
const { initFHE, getFHE } = require("./fhe.js");

const contract = new ethers.Contract(contractAddress, abi, wallet);

const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 12_000);

async function handleStrategyEvaluated(
  strategyId,
  nonce,
  oraclePrice,
  isBelowBuyCipher,
  isAboveSellCipher,
) {
  console.log(`\n📊 Strategy Execution Triggered`);
  console.log(`   Strategy: ${strategyId}`);
  console.log(`   Market Price: ${oraclePrice.toString()}`);
  console.log(`   Execution #${nonce.toString()}`);

  try {
    let buyCtHandle = 0n;
    let sellCtHandle = 0n;
    try {
      const st = await contract.getStrategy(strategyId);
      buyCtHandle = BigInt(st[0]);
      sellCtHandle = BigInt(st[1]);
      console.log(`🔐 Encrypted Parameters:`);
      console.log(`   Buy Threshold: ${buyCtHandle !== 0n ? 'Encrypted ✓' : 'ERROR: Missing'}`);
      console.log(`   Sell Threshold: ${sellCtHandle !== 0n ? 'Encrypted ✓' : 'ERROR: Missing'}`);
    } catch (e) {
      const m = e?.shortMessage || e?.message || String(e);
      console.warn("⚠️  Strategy retrieval failed:", m);
    }

    console.log(`🔓 Processing encrypted comparison results...`);
    const fhe = getFHE();
    const isBelowBuy = await fhe.decryptBool(isBelowBuyCipher);
    const isAboveSell = await fhe.decryptBool(isAboveSellCipher);
    
    console.log(`   Below Buy Threshold: ${isBelowBuy ? '✓' : '✗'}`);
    console.log(`   Above Sell Threshold: ${isAboveSell ? '✓' : '✗'}`);

    let action;
    let actionLabel;
    if (isBelowBuy) {
      action = 1;
      actionLabel = "ACCUMULATE";
    } else if (isAboveSell) {
      action = 2;
      actionLabel = "DISTRIBUTE";
    } else {
      action = 0;
      actionLabel = "HOLD";
    }

    const actionEmoji = actionLabel === 'ACCUMULATE' ? '📈' : actionLabel === 'DISTRIBUTE' ? '📉' : '⏸️';
    console.log(`${actionEmoji} Strategy Decision: ${actionLabel}`);

    const [vaultBefore, execNonceOnChain, settledBefore, rewardWei, contractBal] =
      await Promise.all([
        contract.vaultValue(strategyId),
        contract.executionNonce(strategyId),
        contract.lastSettledNonce(strategyId),
        contract.KEEPER_REWARD_WEI(),
        provider.getBalance(contractAddress),
      ]);

    const nonHold = action !== 0;
    const hasNav = vaultBefore > 0n;
    const canPayReward = contractBal >= rewardWei;
    const wouldPayKeeper = nonHold && canPayReward;  // Updated: no longer requires vault balance

    console.log(`💰 Execution Reward Analysis:`);
    console.log(`   Vault Value: ${ethers.formatEther(vaultBefore)} ETH`);
    console.log(`   Execution Count: ${execNonceOnChain.toString()}`);
    console.log(`   Last Settled: ${settledBefore.toString()}`);
    console.log(`   Reward Amount: ${ethers.formatEther(rewardWei)} ETH`);
    console.log(`   Contract Balance: ${ethers.formatEther(contractBal)} ETH`);
    
    const rewardStatus = wouldPayKeeper ? '✅ Eligible' : '❌ Not Eligible';
    console.log(`   Reward Status: ${rewardStatus}`);

    console.log(`🚀 Executing strategy settlement...`);
    const tx = await contract.applyResult(strategyId, nonce, action);
    console.log(`   Transaction: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Settlement confirmed in block ${receipt.blockNumber}`);

    const parsedLogs = parseAllContractLogs(contract, receipt);
    const oa = parsedLogs.OutcomeApplied;
    if (oa) {
      const a = Number(oa.args.action);
      const labels = ["HOLD", "ACCUMULATE", "DISTRIBUTE"];
      const confirmed = labels[a] ?? `UNKNOWN(${a})`;
      const vaultEth = ethers.formatEther(oa.args.newVaultValue);
      const actionEmoji = confirmed === 'ACCUMULATE' ? '📈' : confirmed === 'DISTRIBUTE' ? '📉' : '⏸️';
      console.log(`${actionEmoji} Strategy Executed: ${confirmed} (Execution #${oa.args.nonce.toString()})`);
      console.log(`   New Vault Value: ${vaultEth} ETH`);
    }

    const kr = parsedLogs.KeeperRewardPaid;
    if (kr) {
      console.log(`💎 Execution Reward: ${ethers.formatEther(kr.args.amount)} ETH`);
    }

    const vaultAfter = await contract.vaultValue(strategyId);
    const settledAfter = await contract.lastSettledNonce(strategyId);
    console.log(`📊 Updated Strategy State:`);
    console.log(`   Vault Value: ${ethers.formatEther(vaultAfter)} ETH`);
    console.log(`   Last Settled: #${settledAfter.toString()}`);
  } catch (err) {
    const msg = err?.shortMessage || err?.message || String(err);
    console.error('❌ Strategy execution failed:', msg);
    console.error('   Full error:', err);
  }
  
  console.log('━'.repeat(60));
}

async function start() {
  await initFHE();

  console.log("Keeper started (log polling — avoids HTTP RPC “filter not found”)...");
  console.log("Using wallet:", wallet.address);
  console.log("Contract:", contractAddress);
  console.log("Poll interval ms:", POLL_MS);

  const filter = contract.filters.StrategyEvaluated();
  let lastScanned = await provider.getBlockNumber();

  setInterval(async () => {
    try {
      const head = await provider.getBlockNumber();
      const from = lastScanned + 1;
      if (from > head) return;

      const logs = await contract.queryFilter(filter, from, head);
      lastScanned = head;

      for (const log of logs) {
        let parsed;
        try {
          parsed = contract.interface.parseLog(log);
        } catch {
          continue;
        }
        if (parsed.name !== "StrategyEvaluated") continue;
        const { strategyId, nonce, oraclePrice, isBelowBuyCipher, isAboveSellCipher } = parsed.args;
        await handleStrategyEvaluated(
          strategyId,
          nonce,
          oraclePrice,
          isBelowBuyCipher,
          isAboveSellCipher,
        );
      }
    } catch (err) {
      const msg = err?.shortMessage || err?.message || String(err);
      console.error("⚠️  Monitoring error:", msg);
    }
  }, POLL_MS);
}

start().catch((err) => {
  const msg = err?.shortMessage || err?.message || String(err);
  console.error("❌ Fatal execution service error:", msg);
  process.exitCode = 1;
});
