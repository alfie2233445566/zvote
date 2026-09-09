import prisma from "../lib/prisma.js";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

/**
 * GET /api/vote/verify?txHash=0x...
 * Returns transaction details from the blockchain: contract, block, timestamp, confirmation status
 * Does NOT require authentication; anyone can verify a transaction hash
 */
export async function verifyTransaction(req, res) {
  const { txHash } = req.query;

  if (!txHash) {
    return res.status(400).json({ error: "txHash query parameter is required." });
  }

  try {
    // Fetch transaction details from the blockchain
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return res.status(404).json({ error: "Transaction not found on the blockchain." });
    }

    // Fetch receipt for confirmation status
    const receipt = await provider.getTransactionReceipt(txHash);

    // Get current block number for confirmation count
    const currentBlockNumber = await provider.getBlockNumber();
    const confirmations = receipt ? currentBlockNumber - receipt.blockNumber : 0;

    // Fetch block details for timestamp
    const block = receipt ? await provider.getBlock(receipt.blockNumber) : null;

    return res.json({
      txHash: tx.hash,
      from: tx.from,
      to: tx.to,
      contractAddress: tx.to, // Same as 'to' for contract calls
      blockNumber: receipt?.blockNumber || null,
      timestamp: block?.timestamp || null,
      confirmations,
      status: receipt?.status === 1 ? "success" : receipt?.status === 0 ? "failed" : "pending",
      gasUsed: receipt?.gasUsed?.toString() || null,
      gasPrice: tx.gasPrice?.toString() || null,
      polygonscanUrl: `https://amoy.polygonscan.com/tx/${tx.hash}`,
    });
  } catch (err) {
    console.error("verifyTransaction failed:", err);
    return res.status(500).json({ error: "Failed to fetch transaction details." });
  }
}

/**
 * GET /api/vote/my-votes
 * Returns the authenticated user's vote history: a list of their past vote transaction hashes
 * so they can verify their votes on-chain without having to remember the hashes.
 * Requires: Authentication (requireAuth middleware)
 */
export async function getMyVotes(req, res) {
  const { id: userId } = req.user;

  try {
    const voteReceipts = await prisma.voteReceipt.findMany({
      where: { userId },
      include: {
        position: {
          include: {
            election: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const votes = voteReceipts.map((receipt) => ({
      id: receipt.id,
      txHash: receipt.txHash,
      positionTitle: receipt.position.title,
      electionTitle: receipt.position.election.title,
      timestamp: receipt.createdAt,
      polygonscanUrl: `https://amoy.polygonscan.com/tx/${receipt.txHash}`,
    }));

    return res.json({ votes });
  } catch (err) {
    console.error("getMyVotes failed:", err);
    return res.status(500).json({ error: "Failed to fetch your votes." });
  }
}
