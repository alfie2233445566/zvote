import prisma from "../lib/prisma.js";
import * as blockchain from "../services/blockchain.js";

/**
 * POST /api/election/create (admin only)
 * Body: {
 *   title: string,
 *   startTime: ISO string,
 *   endTime: ISO string,
 *   scope: "SCHOOL_WIDE" | "DEPARTMENT" (optional, defaults to SCHOOL_WIDE),
 *   targetDepartment: string (required if scope is DEPARTMENT),
 *   positions: [{ title: string, candidates: [{ name, programme, bio? }] }]
 * }
 *
 * Creates the election, its positions, and its candidates both in Postgres and
 * on-chain (via the ZVote contract), then activates the election.
 * - SCHOOL_WIDE elections are visible to all voters
 * - DEPARTMENT elections are visible only to voters whose department matches targetDepartment
 */
export async function createElection(req, res) {
  const { title, startTime, endTime, positions, scope = "SCHOOL_WIDE", targetDepartment } = req.body;

  if (!title || !startTime || !endTime || !Array.isArray(positions) || positions.length === 0) {
    return res.status(400).json({
      error: "title, startTime, endTime, and at least one position are required.",
    });
  }

  // Validate scope and targetDepartment
  if (!["SCHOOL_WIDE", "DEPARTMENT"].includes(scope)) {
    return res.status(400).json({ error: "scope must be SCHOOL_WIDE or DEPARTMENT." });
  }

  if (scope === "DEPARTMENT" && (!targetDepartment || targetDepartment.trim() === "")) {
    return res.status(400).json({ error: "targetDepartment is required when scope is DEPARTMENT." });
  }

  const cleanedDepartment = targetDepartment ? targetDepartment.trim() : null;

  // 1. Title Uniqueness Validation (case-insensitive)
  const existingElection = await prisma.election.findFirst({
    where: { title: { equals: title.trim(), mode: "insensitive" } },
  });
  if (existingElection) {
    return res.status(400).json({
      error: `An election with the title "${title.trim()}" already exists. Every election must have a unique title.`,
    });
  }

  // 2. Candidate Exclusivity Validation: A candidate cannot run for multiple positions in the same election
  const candidatePositionMap = new Map(); // studentId -> position title
  for (const position of positions) {
    if (!Array.isArray(position.candidates)) continue;
    for (const candidate of position.candidates) {
      if (!candidate.studentId) continue;
      const sid = candidate.studentId.trim().toUpperCase();
      if (candidatePositionMap.has(sid)) {
        const previousPos = candidatePositionMap.get(sid);
        return res.status(400).json({
          error: `Duplicate Candidate: Student ${candidate.studentId} (${candidate.name || "Candidate"}) is already running for "${previousPos}". A student cannot contest for more than one position in the same election.`,
        });
      }
      candidatePositionMap.set(sid, position.title || "another position");
    }
  }

  let createdElectionId = null;

  try {
    const contractAddress = await blockchain.deployElectionContract();

    const election = await prisma.election.create({
      data: {
        title: title.trim(),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: "PENDING",
        contractAddress,
        scope,
        targetDepartment: scope === "DEPARTMENT" ? cleanedDepartment : null,
      },
    });
    createdElectionId = election.id;

    for (const position of positions) {
      if (!position.title || !Array.isArray(position.candidates) || position.candidates.length === 0) {
        continue;
      }

      const { positionId: onChainPositionId } = await blockchain.createPosition(contractAddress, position.title.trim());

      const dbPosition = await prisma.position.create({
        data: {
          title: position.title.trim(),
          onChainId: onChainPositionId,
          electionId: election.id,
        },
      });

      // If position has only 1 candidate, it is an unopposed YES/NO approval vote
      const isSingleCandidate = position.candidates.length === 1;

      for (const candidate of position.candidates) {
        const { name, programme, pictureUrl, studentId } = candidate;

        if (!studentId) {
          throw new Error("Each candidate must be chosen from the registered student list (missing student ID).");
        }

        const studentUser = await prisma.user.findUnique({
          where: { studentId: studentId.trim() },
        });

        if (!studentUser) {
          throw new Error(`Candidate ${name} (${studentId}) is not a registered student.`);
        }

        if (scope === "DEPARTMENT") {
          const studentDept = (studentUser.department || "").trim().toLowerCase();
          const targetDept = cleanedDepartment.toLowerCase();
          if (studentDept !== targetDept) {
            throw new Error(
              `Candidate ${name} (${studentId}) does not belong to the target department '${cleanedDepartment}' (student belongs to '${studentUser.department || "None"}').`,
            );
          }
        }

        // Add candidate to smart contract (Option YES for single candidate, or standard candidate)
        const candidateLabel = isSingleCandidate ? `${name || studentUser.fullName} (YES)` : (name || studentUser.fullName);
        const { candidateId: onChainCandidateId } = await blockchain.addCandidate(
          contractAddress,
          onChainPositionId,
          candidateLabel,
          programme || studentUser.program || "",
        );

        await prisma.candidate.create({
          data: {
            name: name || studentUser.fullName,
            programme: programme || studentUser.program || "",
            pictureUrl: pictureUrl || null,
            studentId: studentUser.studentId,
            onChainId: onChainCandidateId,
            positionId: dbPosition.id,
          },
        });
      }

      // If unopposed, register the "NO / REJECT" choice on-chain and in database
      if (isSingleCandidate) {
        const { candidateId: onChainNoId } = await blockchain.addCandidate(
          contractAddress,
          onChainPositionId,
          "NO / REJECT",
          "Vote against candidate",
        );

        await prisma.candidate.create({
          data: {
            name: "NO / REJECT",
            programme: "Vote Against",
            pictureUrl: null,
            studentId: null,
            onChainId: onChainNoId,
            positionId: dbPosition.id,
          },
        });
      }
    }

    await blockchain.startElection(contractAddress, title.trim());

    const activeElection = await prisma.election.update({
      where: { id: election.id },
      data: { status: "ACTIVE" },
      include: { positions: { include: { candidates: true } } },
    });

    return res.status(201).json({ election: activeElection });
  } catch (err) {
    if (createdElectionId) {
      // Rollback orphaned database records on failure
      await prisma.election.delete({ where: { id: createdElectionId } }).catch(() => {});
    }
    console.error("createElection failed:", err);
    return res.status(500).json({ error: "Failed to create election: " + err.message });
  }
}

/**
 * GET /api/election/candidates
 * Returns the positions and candidates for the targeted or active election that the
 * logged-in student is eligible to vote in.
 */
export async function getCandidates(req, res) {
  const { department, role } = req.user || {};
  const { electionId } = req.query;

  let electionWhere;
  if (electionId) {
    electionWhere = { id: electionId };
  } else if (role === "ADMIN") {
    electionWhere = { status: "ACTIVE" };
  } else {
    electionWhere = {
      status: "ACTIVE",
      OR: [
        { scope: "SCHOOL_WIDE" },
        ...(department
          ? [{ scope: "DEPARTMENT", targetDepartment: { equals: department, mode: "insensitive" } }]
          : []),
      ],
    };
  }

  const election = await prisma.election.findFirst({
    where: electionWhere,
    orderBy: { createdAt: "desc" },
    include: {
      positions: {
        include: { candidates: true },
      },
    },
  });

  if (!election) {
    return res.status(404).json({ error: "No active election found for your account." });
  }

  return res.json({ election });
}

/**
 * GET /api/election/results
 * Reads results for the specified (or most recent) election.
 * - When ACTIVE: preserves ballot secrecy by withholding individual candidate vote tallies
 *   while returning real-time voter turnout and eligible voter statistics.
 * - When CLOSED: reads full on-chain vote tallies, calculates 50% + 1 win margins,
 *   identifies winners, ties, or runoff requirements, and returns full outcome data.
 */
export async function getResults(req, res) {
  const { electionId } = req.query;

  const election = electionId
    ? await prisma.election.findUnique({
        where: { id: electionId },
        include: {
          positions: {
            include: { candidates: true },
          },
        },
      })
    : await prisma.election.findFirst({
        orderBy: { createdAt: "desc" },
        include: {
          positions: {
            include: { candidates: true },
          },
        },
      });

  if (!election) {
    return res.status(404).json({ error: "No election found." });
  }

  const allElections = await prisma.election.findMany({
    where: {
      status: { not: "PENDING" },
      positions: { some: {} },
    },
    select: {
      id: true,
      title: true,
      status: true,
      scope: true,
      targetDepartment: true,
      startTime: true,
      endTime: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  try {
    // Determine eligible voter population
    const voterWhere = { role: "VOTER" };
    if (election.scope === "DEPARTMENT" && election.targetDepartment) {
      voterWhere.department = { equals: election.targetDepartment.trim(), mode: "insensitive" };
    }
    const totalVoters = await prisma.user.count({ where: voterWhere });

    // Calculate unique votes cast (receipts) for this election
    const positionIds = election.positions.map((p) => p.id);
    const receiptsCount = await prisma.voteReceipt.count({
      where: { positionId: { in: positionIds } },
    });
    
    // Approximate total unique voters who participated (distinct users with receipts in this election)
    const distinctVotersCount = (
      await prisma.voteReceipt.findMany({
        where: { positionId: { in: positionIds } },
        distinct: ["userId"],
        select: { userId: true },
      })
    ).length;

    const turnoutPercent = totalVoters === 0 ? 0 : Number(((distinctVotersCount / totalVoters) * 100).toFixed(1));
    const isClosed = election.status === "CLOSED";

    // If election is NOT closed, enforce ballot secrecy (do not leak candidate vote counts)
    if (!isClosed) {
      const positionsHidden = election.positions.map((position) => ({
        id: position.id,
        title: position.title,
        candidates: position.candidates.map((c) => ({
          id: c.id,
          name: c.name,
          programme: c.programme,
          pictureUrl: c.pictureUrl,
          bio: c.bio,
        })),
      }));

      return res.json({
        election: {
          id: election.id,
          title: election.title,
          status: election.status,
          scope: election.scope,
          targetDepartment: election.targetDepartment,
          contractAddress: election.contractAddress,
          startTime: election.startTime,
          endTime: election.endTime,
          createdAt: election.createdAt,
        },
        isClosed: false,
        totalVoters,
        totalVotesCast: receiptsCount,
        participatingVoters: distinctVotersCount,
        turnoutPercent,
        positions: positionsHidden,
        allElections,
      });
    }

    // When election is CLOSED, read on-chain tallies and compute 50% + 1 margin
    const positionsWithResults = await Promise.all(
      election.positions.map(async (position) => {
        const onChainResults = await blockchain.getResults(election.contractAddress, position.onChainId);

        // Check if position is a single-candidate YES / NO approval referendum
        const isYesNo = position.candidates.some((c) => c.name === "NO / REJECT");

        if (isYesNo) {
          const yesCandidate = position.candidates.find((c) => c.name !== "NO / REJECT") || position.candidates[0];
          const noCandidate = position.candidates.find((c) => c.name === "NO / REJECT");

          const yesVotes = onChainResults[yesCandidate.onChainId]?.voteCount || 0;
          const noVotes = onChainResults[noCandidate?.onChainId]?.voteCount || 0;
          const totalVotes = yesVotes + noVotes;
          const majorityThreshold = totalVotes > 0 ? Math.floor(totalVotes / 2) + 1 : 1;
          const yesPct = totalVotes === 0 ? 0 : Number(((yesVotes / totalVotes) * 100).toFixed(1));
          const noPct = totalVotes === 0 ? 0 : Number(((noVotes / totalVotes) * 100).toFixed(1));

          let outcome = "NO_VOTES";
          let statusText = "No votes cast";
          let winner = null;

          if (totalVotes > 0) {
            if (yesVotes >= majorityThreshold) {
              outcome = "WON_MAJORITY";
              winner = { ...yesCandidate, voteCount: yesVotes, pct: yesPct };
              statusText = `Candidate Confirmed: ${yesCandidate.name} secured 50% + 1 YES votes (${yesVotes}/${totalVotes} YES votes, ${yesPct}%)`;
            } else {
              outcome = "REJECTED";
              statusText = `Candidate Rejected: ${yesCandidate.name} failed to reach 50% + 1 YES votes (${yesVotes}/${totalVotes} YES votes, ${yesPct}% vs ${noVotes} NO votes — ${majorityThreshold} needed)`;
            }
          }

          return {
            id: position.id,
            title: position.title,
            isYesNo: true,
            totalVotes,
            majorityThreshold,
            outcome,
            statusText,
            winner,
            candidates: [
              {
                id: yesCandidate.id,
                name: `${yesCandidate.name} (YES)`,
                programme: yesCandidate.programme,
                pictureUrl: yesCandidate.pictureUrl,
                bio: yesCandidate.bio,
                voteCount: yesVotes,
                pct: yesPct,
                hasMajority: yesVotes >= majorityThreshold,
              },
              {
                id: noCandidate?.id || "no-option",
                name: "NO / REJECT",
                programme: "Vote Against",
                pictureUrl: null,
                bio: "Vote against confirmation",
                voteCount: noVotes,
                pct: noPct,
                hasMajority: noVotes >= majorityThreshold,
              },
            ],
          };
        }

        const candidatesWithVotes = position.candidates.map((candidate) => {
          const onChain = onChainResults[candidate.onChainId];
          const voteCount = onChain ? onChain.voteCount : 0;
          return {
            id: candidate.id,
            name: candidate.name,
            programme: candidate.programme,
            pictureUrl: candidate.pictureUrl,
            bio: candidate.bio,
            voteCount,
          };
        });

        const totalVotes = candidatesWithVotes.reduce((sum, c) => sum + c.voteCount, 0);
        // Majority threshold: 50% + 1 vote of valid votes cast
        const majorityThreshold = totalVotes > 0 ? Math.floor(totalVotes / 2) + 1 : 1;

        const sortedCandidates = candidatesWithVotes
          .map((c) => {
            const pct = totalVotes === 0 ? 0 : Number(((c.voteCount / totalVotes) * 100).toFixed(1));
            const hasMajority = totalVotes > 0 && c.voteCount >= majorityThreshold;
            return {
              ...c,
              pct,
              hasMajority,
            };
          })
          .sort((a, b) => b.voteCount - a.voteCount);

        let outcome = "NO_VOTES";
        let statusText = "No votes cast";
        let winner = null;
        let leadingCandidate = null;

        if (totalVotes > 0) {
          const topVote = sortedCandidates[0].voteCount;
          const topCandidates = sortedCandidates.filter((c) => c.voteCount === topVote);

          if (topCandidates.length > 1) {
            outcome = "TIE";
            statusText = `Tie for 1st place (${topVote} votes each) — Runoff Required`;
          } else if (sortedCandidates[0].voteCount >= majorityThreshold) {
            outcome = "WON_MAJORITY";
            winner = sortedCandidates[0];
            statusText = `Winner Declared: ${winner.name} met the 50% + 1 majority rule (${winner.voteCount}/${totalVotes} votes, ${winner.pct}%)`;
          } else {
            outcome = "RUNOFF_REQUIRED";
            leadingCandidate = sortedCandidates[0];
            statusText = `Leading: ${leadingCandidate.name} (${leadingCandidate.voteCount} votes, ${leadingCandidate.pct}%), but failed 50% + 1 threshold (${majorityThreshold} needed) — Runoff Required`;
          }
        }

        return {
          id: position.id,
          title: position.title,
          isYesNo: false,
          totalVotes,
          majorityThreshold,
          outcome,
          statusText,
          winner,
          leadingCandidate,
          candidates: sortedCandidates,
        };
      }),
    );

    return res.json({
      election: {
        id: election.id,
        title: election.title,
        status: election.status,
        scope: election.scope,
        targetDepartment: election.targetDepartment,
        contractAddress: election.contractAddress,
        startTime: election.startTime,
        endTime: election.endTime,
        createdAt: election.createdAt,
      },
      isClosed: true,
      totalVoters,
      totalVotesCast: receiptsCount,
      participatingVoters: distinctVotersCount,
      turnoutPercent,
      positions: positionsWithResults,
      allElections,
    });
  } catch (err) {
    console.error("getResults failed:", err);
    return res.status(500).json({ error: "Failed to read results from the blockchain." });
  }
}

/**
 * GET /api/election/list
 * Returns a list of all elections, scoped by department for students.
 */
export async function getElections(req, res) {
  const { status } = req.query;
  const { department, role } = req.user || {};

  try {
    const where = {
      status: status || { not: "PENDING" },
      positions: { some: {} },
    };

    if (role === "VOTER") {
      where.OR = [
        { scope: "SCHOOL_WIDE" },
        ...(department
          ? [{ scope: "DEPARTMENT", targetDepartment: { equals: department, mode: "insensitive" } }]
          : []),
      ];
    }

    const elections = await prisma.election.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return res.json({ elections });
  } catch (err) {
    console.error("getElections failed:", err);
    return res.status(500).json({ error: "Failed to fetch elections." });
  }
}
