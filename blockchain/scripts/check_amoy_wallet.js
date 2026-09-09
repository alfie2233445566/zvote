// Script to check the deployer/relayer wallet on Polygon Amoy testnet
import "dotenv/config";
import { ethers } from "ethers";

const RPC_URL = process.env.AMOY_RPC_URL || "https://polygon-amoy.drpc.org";
let privateKey = process.env.PRIVATE_KEY;

async function checkWallet() {
  console.log("==================================================");
  console.log("🔍 Polygon Amoy Testnet Wallet Diagnostics");
  console.log("==================================================");
  console.log(`RPC Endpoint: ${RPC_URL}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  try {
    const network = await provider.getNetwork();
    console.log(`Connected to Chain ID: ${network.chainId.toString()} (Expected: 80002)`);
    const latestBlock = await provider.getBlockNumber();
    console.log(`Latest Block: ${latestBlock}`);
  } catch (err) {
    console.error(`❌ Failed to connect to RPC endpoint: ${err.message}`);
    process.exit(1);
  }

  if (!privateKey || privateKey === "0xyourprivatekeyhere" || privateKey.length !== 66) {
    console.log("\n⚠️  No valid custom PRIVATE_KEY set in blockchain/.env.");
    console.log("Generating a fresh ephemeral wallet for demonstration / faucet funding:");
    const randomWallet = ethers.Wallet.createRandom();
    console.log(`   Address:     ${randomWallet.address}`);
    console.log(`   Private Key: ${randomWallet.privateKey}`);
    console.log("\n👉 You can copy this PRIVATE_KEY into blockchain/.env and backend/.env");
    privateKey = randomWallet.privateKey;
  }

  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`\nWallet Address: ${wallet.address}`);
    const balanceWei = await provider.getBalance(wallet.address);
    const balancePol = ethers.formatEther(balanceWei);
    console.log(`POL Balance:    ${balancePol} POL`);

    if (balanceWei > 0n) {
      console.log("\n✅ Wallet is funded! Ready to deploy to Polygon Amoy testnet.");
      console.log("Run: npx hardhat run scripts/deploy.js --network amoy");
    } else {
      console.log("\n⚠️  Balance is 0 POL. You need testnet POL for deployment gas fees.");
      console.log("Get free testnet POL in 30 seconds from any of these faucets:");
      console.log(`  1. Polygon Official Faucet: https://faucet.polygon.technology/`);
      console.log(`  2. Alchemy Amoy Faucet:     https://www.alchemy.com/faucets/polygon-amoy`);
      console.log(`  3. QuickNode Faucet:        https://faucet.quicknode.com/polygon/amoy`);
      console.log(`Paste your wallet address (${wallet.address}) into the faucet.`);
    }
  } catch (err) {
    console.error("Error reading wallet:", err.message);
  }
  console.log("==================================================\n");
}

checkWallet().catch(console.error);
