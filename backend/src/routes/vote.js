import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { castVote, voteStatus } from "../controllers/voteController.js";
import { verifyTransaction, getMyVotes } from "../controllers/voteVerificationController.js";

const router = Router();

// Vote casting
router.post("/cast", requireAuth, castVote);
router.get("/status", requireAuth, voteStatus);

// Vote verification
router.get("/verify", verifyTransaction); // No auth required -- anyone can verify a tx
router.get("/my-votes", requireAuth, getMyVotes); // Logged-in students see their own votes

export default router;
