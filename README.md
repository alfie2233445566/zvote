# ZVote — Blockchain-Enabled Secure Voting System for SRC Elections

ZVote is a full-stack, blockchain-backed voting system built for university Student
Representative Council (SRC) elections. It follows a **Web2 UX, Web3 Trust** design:
voters log in with a familiar Student ID + password (no wallet, no MetaMask, no seed
phrase), while every vote is recorded immutably on-chain by the backend on their
behalf.

This implementation accompanies the accompanying final-year project report
(Chapters One–Three). See **"Notes on design decisions"** below for how a couple of
inconsistencies between the report chapters and the technical brief were resolved.

## Architecture

```
Voter/Admin Browser
        │  HTTPS
        ▼
React Frontend (Vite + Tailwind)          <- no blockchain or DB access, ever
        │  REST (axios + JWT)
        ▼
Node.js/Express Backend                    <- the only tier that touches secrets
   ├── PostgreSQL (Prisma ORM)             <- users, elections, positions,
   │                                          candidates, vote receipts
   └── ethers.js  ───────────────►  ZVote smart contract (Solidity)
                                     deployed on Polygon Amoy testnet
                                     (or a local Hardhat node)
```

**Separation of concerns:** PostgreSQL stores *who can vote* (and metadata about
elections/candidates). The blockchain stores *how they voted* — vote counts per
candidate, and a `hasVoted` flag per voter/position pair that makes double-voting
provably impossible, independent of the backend or database.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + axios + react-router-dom |
| Backend | Node.js (ESM) + Express + Prisma ORM + ethers.js v6 + JWT + bcrypt |
| Blockchain | Solidity ^0.8.19 + Hardhat 3.9.1 + `@nomicfoundation/hardhat-toolbox-mocha-ethers` |
| Database | PostgreSQL |
| Target network | Polygon Amoy testnet (chainId 80002), with a local Hardhat node for development/testing |

## Project structure

```
zvote/
├── frontend/     React SPA — login, ballot, results, admin dashboard
├── backend/      Express REST API — auth, election, vote, admin routes
├── blockchain/   Hardhat 3 project — ZVote.sol, tests, deploy scripts
└── README.md     you are here
```

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+ running locally (or a connection string to a hosted instance)
- A funded Polygon Amoy testnet wallet, **only if** deploying to Amoy (get test POL
  from the [Polygon faucet](https://faucet.polygon.technology/)). Not required for
  local-only development.

## Setup — from a clean checkout

### 1. Install dependencies in each workspace

```bash
cd blockchain && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

Copy each `.env.example` to `.env` and fill in real values:

```bash
cp blockchain/.env.example blockchain/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

- `blockchain/.env` — only needed if deploying to Amoy (`PRIVATE_KEY`, `AMOY_RPC_URL`).
- `backend/.env` — `DATABASE_URL`, `JWT_SECRET`, `PRIVATE_KEY` (election authority
  wallet — for local dev this can be one of the funded accounts printed by
  `npx hardhat node`), `CONTRACT_ADDRESS` (filled in after deployment, step 4),
  `RPC_URL` (`http://127.0.0.1:8545` for local, the Amoy RPC URL for testnet).
- `frontend/.env` — `VITE_API_URL` (defaults to `http://localhost:5000`).

### 3. Set up the database

```bash
cd backend
npx prisma migrate dev --name init
npm run seed        # creates a default admin account (see console output)
```

### 4. Compile and deploy the smart contract

**Option A — local Hardhat node (recommended for development/testing):**

```bash
cd blockchain
npx hardhat compile
npx hardhat node                 # keep this running in its own terminal
```

In a second terminal:

```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

Copy one of the private keys printed by `npx hardhat node` into `backend/.env` as
`PRIVATE_KEY` (this becomes the election authority wallet), and copy the deployed
contract address into `backend/.env` as `CONTRACT_ADDRESS`.

**Option B — Polygon Amoy testnet:**

```bash
cd blockchain
npx hardhat compile
npx hardhat run scripts/deploy.js --network amoy
```

Copy the printed contract address into `backend/.env` as `CONTRACT_ADDRESS`, and
make sure `backend/.env`'s `PRIVATE_KEY` and `RPC_URL` match the Amoy wallet/RPC used
for deployment.

### 5. Run the test suite (optional but recommended)

```bash
cd blockchain
npx hardhat test
```

### 6. Start the backend and frontend

```bash
cd backend && npm run dev      # http://localhost:5000
cd frontend && npm run dev     # http://localhost:5173
```

### 7. Log in

- **Admin:** the seed script prints a default admin Student ID/password
  (`ADMIN001` / see console output). Use the Admin Dashboard to create an election
  (this deploys positions/candidates on-chain and opens voting) and to register
  voters in bulk.
- **Voter:** once registered by an admin, a voter logs in with the Student ID and
  password the admin assigned them, and votes from the Ballot page.

## API reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Accepts `{ studentId, password }`, returns a JWT |
| `/api/election/create` | POST | Admin only. Creates an election with positions/candidates, deploys them on-chain |
| `/api/election/candidates` | GET | Returns positions/candidates for the active election |
| `/api/election/results` | GET | Returns the vote tally, read live from the smart contract |
| `/api/vote/cast` | POST | Accepts `{ positionId, candidateId }`, submits the vote on-chain |
| `/api/vote/status` | GET | Returns which positions the current voter has already voted for |
| `/api/admin/register-voters` | POST | Admin only. Bulk-registers voters |
| `/api/admin/election-stats` | GET | Admin only. Participation count/percentage per position |
| `/api/admin/election-close` | POST | Admin only. Closes the election on-chain |

## Notes on design decisions

This build reconciles a couple of intentional differences between the project's
written chapters and the technical build brief supplied alongside them:

- **Database — PostgreSQL/Prisma instead of MongoDB.** Chapter Three describes
  MongoDB as the off-chain store. This implementation uses PostgreSQL with the
  Prisma ORM instead, per the technical brief. Election data is inherently
  relational (an election has positions, a position has candidates, a user has vote
  receipts), and Postgres enforces those relationships with real foreign-key
  constraints rather than leaving referential integrity to application code. The
  responsibilities described in Chapter Three, Sections 3.2.4 and 3.3.3 (what data
  lives off-chain and why) are preserved exactly — only the storage engine changed.
- **Blockchain network — Polygon Amoy instead of a self-hosted Polygon CDK chain.**
  Chapter Three names Polygon CDK as the target platform for a production-grade
  deployment. Standing up a CDK sovereign chain requires dedicated infrastructure
  (a sequencer, a data-availability layer, etc.) that is out of scope for testing a
  final-year prototype. Polygon Amoy — Polygon's public PoS testnet — is used here
  for testing and demonstration purposes instead, exactly as the technical brief
  requests, while remaining fully EVM-compatible with the same Solidity contract
  that would eventually be deployed to a CDK chain.
- **Smart contract — positions with per-position candidates**, matching the
  technical brief's contract spec (`createPosition`, `addCandidate`,
  `startElection`, `endElection`, `vote`, `getResults`, `hasVoted`) rather than
  Chapter Three's simpler single-list-of-candidates design. This is a strict
  superset: a single-position election (e.g. just "SRC President") works exactly
  like the simpler design, while also supporting the multi-position ballots
  (President, VP, Secretary, etc.) that a real SRC election needs.

## Known limitations (honestly scoped, matching Chapter Three §3.7)

- Votes are submitted by a single backend-held wallet, not by voters directly —
  voters must trust the institution running the backend, which is an acceptable
  trade-off for a university-scale election.
- Vote choices are stored as plain candidate indices on-chain; there is no
  ballot-secrecy cryptography (e.g. zero-knowledge proofs). Vote *counts* are
  public and auditable, but so is the order transactions were submitted in.
- The backend and PostgreSQL instance are each a single point of failure in this
  prototype; production use would need redundancy (load balancing, DB replication).
- Amoy is a public testnet, not Ethereum mainnet or a production CDK chain — its
  immutability guarantees are real, but its validator set/security budget differ
  from a production network.
