# ZVote: Blockchain-Enabled Electronic Voting System
## Comprehensive Technical & Project Defense Guide

---

# 1. Executive Summary & System Overview

### 1.1 What is ZVote?
**ZVote** is a secure, decentralized, blockchain-enabled electronic voting system engineered for university student elections (such as Student Representative Council — SRC — and departmental elections). It bridges the gap between Web2 user convenience (student ID logins, zero gas fees, institutional email dispatch) and Web3 cryptographic integrity (EVM smart contracts, immutable ledgers, zero-linkability voter privacy, and public verifiability).

### 1.2 The Core Problem ZVote Solves
Traditional paper-based elections and conventional centralized electronic voting systems (Web2 databases) suffer from severe vulnerabilities:
1. **Centralized Database Manipulation**: Database administrators can execute SQL queries (e.g., `UPDATE candidates SET votes = votes + 500`) with no public proof of tampering.
2. **Lack of Individual Verifiability**: Once a paper ballot is dropped into a box or submitted via a standard web form, the voter has zero cryptographic proof that their vote was counted accurately.
3. **The Secrecy vs. Transparency Paradox**: Traditional systems either expose who voted for whom to ensure counting accuracy, or hide identities so deeply that no one can verify the final tally.
4. **Bandwagon & Coercion Effects**: Real-time tally leaks influence undecided voters before polls close.

### 1.3 How ZVote Solves This
ZVote employs an enterprise **Hybrid Web2.5 Architecture**:
- **Off-Chain Relational Layer (PostgreSQL + Prisma)**: Manages student identity verification, department filtering, and double-voting prevention receipts. It **never stores which candidate a student chose**.
- **On-Chain Execution Layer (Polygon EVM Smart Contracts)**: Serves as the immutable, canonical ballot box. It records pseudonymous candidate increments (`voteCount++`) and marks `hasVoted[voterAddress] = true`. It **never receives the student's name, email, or index number**.

---

# 2. Step-by-Step Practical Workflow

```
 ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                           ELECTION LIFECYCLE                                           │
 └────────────────────────────────────────────────────────────────────────────────────────────────────────┘
    1. Admin Uploads Student CSV (Index Number, Name, Email, Dept)
       │
       ▼
    2. System Generates Deterministic Wallet Addresses & Hashes Temp Passwords
       │
       ▼
    3. Automated Email Dispatch sends Temporary Passwords to Students
       │
       ▼
    4. Admin Creates Election ──▶ Deploys Independent Smart Contract Instance to Polygon
       │
       ▼
    5. Student Logs In ──▶ Prompts Forced Password Change on First Login
       │
       ▼
    6. Student Casts Vote ──▶ Backend Relayer Submits Vote to Blockchain ($0 Gas for Student)
       │
       ▼
    7. Blockchain Returns Mined Transaction Hash (`txHash`) ──▶ Student Verifies on Polygonscan
       │
       ▼
    8. While Polls Open ──▶ Ballot Secrecy Active (Live Turnout Shown, Tallies Sealed)
       │
       ▼
    9. Admin Closes Polls ──▶ Tallies Revealed with 50% + 1 Constitutional Win Margin Evaluation
```

### Step 1: Voter Registration & Ingestion
The Electoral Commission uploads a `.csv` or `.xlsx` spreadsheet containing student demographic records (`fullName`, `indexNumber`, `email`, `department`, `program`, `level`).

### Step 2: Deterministic Wallet Generation & Email Dispatch
1. For each student, the backend generates a unique cryptographic Ethereum/Polygon wallet address using a high-entropy seed.
2. An alphanumeric temporary password is generated and hashed with **Bcrypt** (salt rounds = 10).
3. **Nodemailer** sends a branded HTML email containing the student's Index Number, Temporary Password, and direct login link to the student's registered email inbox.

### Step 3: Election Creation & Smart Contract Deployment
1. The admin configures the election title, start time, closing time, scope (`SCHOOL_WIDE` or `DEPARTMENT`), target department, and position roster.
2. The system dynamically deploys a separate EVM smart contract instance (`ZVote.sol`) on the blockchain.
3. **Candidate Exclusivity**: A candidate cannot run for more than one position in the same election.
4. **Unopposed Positions**: If a position has only 1 candidate, the system automatically configures an on-chain **YES / NO Approval Referendum**.

### Step 4: First Login & Authentication
1. The student logs in with their Index Number and Temporary Password.
2. If `mustChangePassword === true`, the system routes the student to `/change-password-first-login` to choose their own private permanent password.
3. The server issues a JSON Web Token (JWT) stamped with an in-memory `SERVER_BOOT_ID`.

### Step 5: Anonymous Ballot Casting
1. The student navigates to `/dashboard`.
2. The UI renders the live countdown timer (`ElectionCountdown`), the position roster, and candidate profiles.
3. When the student clicks **"Submit Vote"**:
   - The backend verifies eligibility and verifies off-chain double-voting status.
   - The backend relayer submits the transaction to the smart contract: `submitVote(contractAddress, voterWallet, positionId, candidateId)`.
   - The smart contract checks `require(!hasVoted)` on-chain, increments the candidate's tally, and permanently marks the voter wallet as spent.
   - The backend records an off-chain `VoteReceipt` containing `(userId, positionId, txHash)` without logging candidate choice.

### Step 6: Real-Time Verifiability
The student receives a transaction hash (`txHash`). They can immediately visit `/verify` or Polygonscan to independently verify that their ballot was included in a block.

### Step 7: Sealed Ballot Secrecy & 50% + 1 Victory Evaluation
1. **While Active**: Candidate vote numbers are sealed to prevent bandwagon bias. Real-time turnout is displayed.
2. **When Closed**:
   - Total valid votes $V$ are tallied.
   - Majority Threshold is computed: $T = \lfloor \frac{V}{2} \rfloor + 1$.
   - **`WON_MAJORITY`**: Top candidate $\ge T \rightarrow$ **Declared Winner**.
   - **`RUNOFF_REQUIRED`**: Top candidate $< T \rightarrow$ **Runoff Election Required**.
   - **`TIE`**: Equal top votes $\rightarrow$ **Runoff Required**.

---

# 3. Technical Glossary for Project Defense

| Term | Practical Definition | Role in ZVote |
| :--- | :--- | :--- |
| **Blockchain** | A decentralized, append-only distributed ledger where data is stored in cryptographically linked blocks across independent nodes. | Provides the immutable storage layer for vote tallies. |
| **Smart Contract** | Self-executing code deployed to the blockchain that runs autonomously according to predefined rules without human intervention. | `ZVote.sol` acts as the tamper-proof digital ballot box. |
| **EVM (Ethereum Virtual Machine)** | The decentralized runtime environment that executes smart contract bytecode across all Ethereum and Polygon nodes. | Executes `submitVote()`, `startElection()`, and `closeElection()`. |
| **Keccak-256 / SHA-256** | One-way cryptographic hash functions that convert any input into a unique 256-bit signature. | Used for transaction hashes, block validation, and password reset tokens. |
| **Transaction Hash (`txHash`)** | A unique 64-character hexadecimal string generated whenever a transaction is mined into a block. | Serves as the voter's verifiable cryptographic receipt. |
| **Nonce** | A sequential number assigned to each transaction sent from a wallet to prevent replay attacks. | Guarantees ordered execution of relayed vote transactions. |
| **Gas Fees & Relayer** | Network computational fees required to process transactions on Ethereum/Polygon. | ZVote uses a backend **Relayer Pattern** to sponsor all gas fees so students pay $0. |
| **JWT (JSON Web Token)** | A cryptographically signed token containing session claims transmitted in the `Authorization: Bearer <token>` header. | Authenticates student requests to the REST API. |
| **Server Boot Session ID** | An ephemeral in-memory identifier generated on server startup and embedded in JWTs. | Automatically invalidates all user sessions when the server restarts. |
| **Decoupled Identity Model** | The architectural separation between student demographic data and blockchain ballot tallies. | Guarantees 100% voter anonymity while preserving individual auditability. |
| **50% + 1 Win Margin Rule** | An electoral rule requiring the winning candidate to secure an absolute majority ($\ge 50\% + 1$) of valid votes cast. | Prevents minority candidates from winning split-vote races and detects ties/runoffs. |
| **Polygon Amoy Testnet** | The official Ethereum Layer-2 proof-of-stake testnet for Polygon PoS. | The blockchain network where ZVote smart contracts are deployed and tested. |
| **Polygon CDK (Chain Development Kit)** | A modular framework for launching sovereign, dedicated ZK or PoS Layer-2 appchains. | Enables universities to host their own dedicated, zero-gas campus voting blockchain. |

---

# 4. Exhaustive Codebase & File-by-File Breakdown

```
ZVote/
├── backend/                  # Node.js + Express REST API & Off-Chain Database
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema (PostgreSQL tables & relationships)
│   │   ├── seed.js           # Database seeder (creates default admin account)
│   │   └── migrations/       # SQL migration history
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── adminController.js         # Voter bulk registration, stats, and admin actions
│   │   │   ├── adminStudentsController.js # Anonymized registered student registry
│   │   │   ├── authController.js          # Login, session verification (/me), password resets
│   │   │   ├── electionController.js      # Election creation, 50%+1 results, time windows
│   │   │   └── voteController.js          # Vote submission, double-vote checks, timing checks
│   │   ├── middleware/
│   │   │   └── authMiddleware.js          # JWT verification & Server Boot Session check
│   │   ├── routes/
│   │   │   ├── admin.js      # Admin endpoints (/api/admin/*)
│   │   │   ├── auth.js       # Auth endpoints (/api/auth/*)
│   │   │   ├── election.js   # Election endpoints (/api/election/*)
│   │   │   └── vote.js       # Voting endpoints (/api/vote/*)
│   │   ├── services/
│   │   │   ├── blockchain.js   # Ethers.js integration with ZVote.sol smart contract
│   │   │   └── emailService.js # Nodemailer email dispatch for passwords and reset links
│   │   ├── utils/
│   │   │   └── wallet.js       # Deterministic voter wallet address generator
│   │   ├── lib/
│   │   │   └── prisma.js       # Global Prisma database client singleton
│   │   └── server.js           # Express app initialization, CORS, and port listening
│   └── package.json
│
├── frontend/                 # React.js + Vite Single Page Application (SPA)
│   ├── public/
│   │   └── _redirects        # Netlify SPA routing rules (prevents 404 on refresh)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ElectionCard.jsx       # Interactive position voting ballot (Standard & Yes/No)
│   │   │   ├── ElectionCountdown.jsx  # Real-time countdown clock & 1-minute warning banner
│   │   │   ├── Navbar.jsx             # Top navigation bar with live user badge & profile link
│   │   │   ├── ProtectedRoute.jsx     # Route guard enforcing authentication and admin roles
│   │   │   └── VoteButton.jsx         # Candidate selection radio button component
│   │   ├── pages/
│   │   │   ├── AdminDashboard.jsx     # Admin control panel (Create, Close, Register, Turnout)
│   │   │   ├── ChangePasswordFirstLogin.jsx # Forced password change on first student login
│   │   │   ├── ForgotPassword.jsx     # Password reset request page
│   │   │   ├── Login.jsx              # Student & Admin unified login interface
│   │   │   ├── ResetPassword.jsx      # Password reset submission page (token verified)
│   │   │   ├── Results.jsx            # Sealed active turnout & closed 50%+1 outcome charts
│   │   │   ├── StudentDashboard.jsx   # Student voting dashboard & election selector
│   │   │   ├── StudentProfile.jsx     # Student profile details, wallet ID & password change
│   │   │   └── VoteVerification.jsx   # Independent Polygon transaction hash lookup
│   │   ├── context/
│   │   │   └── AuthContext.jsx        # Global React auth state & startup session validation
│   │   ├── api.js                     # Axios HTTP client with JWT interceptors & auto-logout
│   │   ├── App.jsx                    # React Router route registry
│   │   ├── main.jsx                   # React DOM entry point
│   │   └── index.css                  # Global Tailwind CSS styles and custom utility classes
│   └── package.json
│
└── blockchain/               # Hardhat Ethereum Development Environment
    ├── contracts/
    │   └── ZVote.sol         # Core Solidity Smart Contract (Ballot state machine)
    ├── scripts/
    │   └── deploy.js         # Deployment script for local node and Polygon Amoy
    ├── hardhat.config.cjs    # Hardhat configuration (Solidity compiler, RPC networks, keys)
    └── package.json
```

---

# 5. Production Deployment Guide

## 5.1 Deploying Smart Contracts to Polygon Amoy Testnet

### Step 1: Obtain Testnet POL (MATIC)
Get testnet tokens for your relayer deployer wallet from the official Polygon faucet:
`https://faucet.polygon.technology/`

### Step 2: Configure `blockchain/hardhat.config.cjs`
Ensure your `hardhat.config.cjs` includes the Polygon Amoy network:
```javascript
module.exports = {
  solidity: "0.8.20",
  networks: {
    amoy: {
      url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 80002,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY,
    },
  },
};
```

### Step 3: Deploy & Verify Contract
Run the deployment script to Polygon Amoy:
```bash
npx hardhat run scripts/deploy.js --network amoy
```
Verify the contract bytecode on Polygonscan:
```bash
npx hardhat verify --network amoy <DEPLOYED_CONTRACT_ADDRESS>
```

---

## 5.2 Deploying Frontend to Netlify

### Step 1: Configure `_redirects`
The `frontend/public/_redirects` file is already in place:
```text
/*    /index.html   200
```
This tells Netlify's CDN to route all direct page requests (like `/dashboard`, `/admin`, `/profile`) to `index.html` so React Router can handle them without 404 errors.

### Step 2: Connect Repository & Build Settings
In your Netlify Dashboard:
1. Click **Add new site** $\rightarrow$ **Import an existing project** (from GitHub/GitLab).
2. Set **Base directory**: `frontend`
3. Set **Build command**: `npm run build`
4. Set **Publish directory**: `dist`
5. Set **Environment Variable**:
   - `VITE_API_URL`: URL of your deployed backend API (e.g. `https://zvote-api.onrender.com`).

---

## 5.3 Deploying Backend to Render / Railway / VPS

1. Connect your backend repository to **Render** or **Railway**.
2. Provision a managed **PostgreSQL** database service and copy the `DATABASE_URL`.
3. Set the Environment Variables:
   - `DATABASE_URL`: `postgresql://username:password@host:5432/zvote?schema=public`
   - `JWT_SECRET`: High-entropy 64-character secret key.
   - `PRIVATE_KEY`: Private key of the deployer/relayer wallet funded with testnet POL.
   - `RPC_URL`: `https://rpc-amoy.polygon.technology` (or Alchemy/Infura Amoy RPC).
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: SMTP credentials.
   - `FRONTEND_URL`: Your Netlify URL (e.g. `https://zvote.netlify.app`).
4. Set **Build Command**: `npx prisma generate && npx prisma migrate deploy`
5. Set **Start Command**: `node src/server.js`
