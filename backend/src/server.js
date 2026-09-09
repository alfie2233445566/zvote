import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRoutes from "./routes/auth.js";
import electionRoutes from "./routes/election.js";
import voteRoutes from "./routes/vote.js";
import adminRoutes from "./routes/admin.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "zvote-backend", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/election", electionRoutes);
app.use("/api/vote", voteRoutes);
app.use("/api/admin", adminRoutes);

// Centralised error handler -- catches anything thrown by an async route handler
// that wasn't already caught locally, so the process never crashes on a single
// bad request.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`ZVote backend listening on http://localhost:${PORT}`);
});
