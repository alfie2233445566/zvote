import prisma from "../lib/prisma.js";
import * as blockchain from "../services/blockchain.js";

/**
 * POST /api/vote/cast
 * Body: { positionId: string (db id), candidateId: string (db id) }
 *
 * Implements the VOTE FLOW from the project brief, in order:
 *   1. JWT already verified by requireAuth middleware (identifies the voter).
 *   2. Confirm the voter is eligible (implicit: any authenticated User row is a
 *      registered voter -- see admin voter-registration flow).
 *   3. Check Postgres: has this voter already voted for this position?
 *   4. If not, call blockchain.submitVote(...) to record the vote on-chain.
 *   5. If the transaction succeeds, write a VoteReceipt row (hasVoted=true equivalent)
 *      and return the transaction hash to the frontend.
 */
export async function castVote(req, res) {
  const { positionId, candidateId } = req.body;
  const { id: userId, walletAddress } = req.user;

  if (!positionId || candidateId === undefined || candidateId === null) {
    return res.status(400).json({ error: "positionId and candidateId are required." });
  }

  try {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { candidates: true, election: true },
    });

    if (!position) {
      return res.status(404).json({ error: "Position not found." });
    }

    if (position.election.status !== "ACTIVE") {
      return res.status(400).json({ error: "This election is not currently active." });
    }

    const now = new Date();
    if (position.election.startTime && now < new Date(position.election.startTime)) {
      return res.status(400).json({ error: "Voting has not started yet for this election." });
    }

    if (position.election.endTime && now > new Date(position.election.endTime)) {
      return res.status(400).json({ error: "Voting for this election has closed (closing time has passed)." });
    }

    const candidate = position.candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found for this position." });
    }

    // Step 3: DB-level double-vote check (fast path).
    const existingReceipt = await prisma.voteReceipt.findUnique({
      where: { userId_positionId: { userId, positionId } },
    });
    if (existingReceipt) {
      return res.status(409).json({
        error: "You have already voted for this position.",
        txHash: existingReceipt.txHash,
      });
    }

    // Belt-and-braces: also check on-chain, since the contract is the ultimate
    // source of truth for double-voting even if the database were ever out of sync.
    const alreadyVotedOnChain = await blockchain.hasVoted(position.election.contractAddress, walletAddress, position.onChainId);
    if (alreadyVotedOnChain) {
      return res.status(409).json({ error: "You have already voted for this position." });
    }

    // Step 4: submit the vote to the blockchain.
    const { txHash } = await blockchain.submitVote(position.election.contractAddress, walletAddress, position.onChainId, candidate.onChainId);

    // Step 5: record the receipt in Postgres.
    const receipt = await prisma.voteReceipt.create({
      data: { userId, positionId, txHash },
    });

    return res.status(201).json({
      message: "Vote recorded successfully.",
      txHash: receipt.txHash,
    });
  } catch (err) {
    console.error("castVote failed:", err);

    // Prisma unique constraint violation -- a race condition where two requests for
    // the same vote arrived concurrently. Treat it the same as "already voted".
    if (err.code === "P2002") {
      return res.status(409).json({ error: "You have already voted for this position." });
    }

    return res.status(500).json({ error: "Failed to submit vote to the blockchain." });
  }
}

/**
 * GET /api/vote/status
 * Returns which positions (in the specified election, or all active elections) the
 * current voter has already voted for.
 */
export async function voteStatus(req, res) {
  const { id: userId } = req.user;
  const { electionId } = req.query;

  let electionPositions = [];

  if (electionId) {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: { positions: true },
    });
    if (election) {
      electionPositions = election.positions;
    }
  } else {
    const activeElections = await prisma.election.findMany({
      where: { status: "ACTIVE" },
      include: { positions: true },
    });
    electionPositions = activeElections.flatMap((e) => e.positions);
  }

  if (electionPositions.length === 0) {
    return res.json({ votedPositionIds: [], receipts: [] });
  }

  const receipts = await prisma.voteReceipt.findMany({
    where: {
      userId,
      positionId: { in: electionPositions.map((p) => p.id) },
    },
    select: { positionId: true, txHash: true },
  });

  return res.json({ votedPositionIds: receipts.map((r) => r.positionId), receipts });
}
