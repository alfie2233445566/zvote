// Deploys the ZVote contract to whichever network is passed via --network.
//
// Usage:
//   npx hardhat run scripts/deploy.js --network localhost
//   npx hardhat run scripts/deploy.js --network amoy
//
// After deployment, copy the printed contract address into backend/.env as
// CONTRACT_ADDRESS so the backend service knows which contract to talk to.

import { network } from "hardhat";

async function main() {
  const { ethers, networkName } = await network.connect();

  console.log(`\nDeploying ZVote to network: ${networkName}...`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer / election authority address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} (native token)`);

  const ZVote = await ethers.getContractFactory("ZVote");
  const zVote = await ZVote.deploy();

  console.log("Waiting for deployment transaction to be mined...");
  await zVote.waitForDeployment();

  const address = await zVote.getAddress();
  console.log(`\n✅ ZVote deployed at: ${address}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Copy this address into backend/.env as CONTRACT_ADDRESS=${address}`);
  console.log(`  2. Restart the backend so it picks up the new contract address.`);
  console.log(`  3. Use the admin dashboard (or a seed script) to create positions and candidates.\n`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
