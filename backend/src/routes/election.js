import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import { createElection, getCandidates, getResults, getElections } from "../controllers/electionController.js";

const router = Router();

router.post("/create", requireAuth, requireAdmin, createElection);
router.get("/list", requireAuth, getElections);
router.get("/candidates", requireAuth, getCandidates);
router.get("/results", requireAuth, getResults);

export default router;
