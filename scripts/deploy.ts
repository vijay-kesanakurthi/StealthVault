import hre, { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const StrategyRegistry = await ethers.getContractFactory("StrategyRegistry");
  const registry = await StrategyRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("StrategyRegistry deployed to:", address);

  if (hre.network.name === "eth-sepolia") {
    console.log(
      "Keeper: in keeper/.env set CONTRACT_ADDRESS above, RPC_URL or SEPOLIA_RPC_URL to Sepolia, PRIVATE_KEY to a funded key, FHE_ENV=TESTNET.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
