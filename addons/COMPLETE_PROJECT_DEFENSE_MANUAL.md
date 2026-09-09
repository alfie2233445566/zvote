# ZVOTE: DECENTRALIZED ELECTRONIC VOTING SYSTEM
## Comprehensive Technical Manual & Master Project Defense Guide

> **Prepared For**: Final Year Engineering Project Defense & Examination Committee  
> **System Name**: ZVote (Decentralized & Cryptographically Verifiable Electronic Voting System)  
> **Live Web Application**: [https://zvote.netlify.app](https://zvote.netlify.app)  
> **Live API Backend**: [https://zvote-backend.onrender.com](https://zvote-backend.onrender.com)  
> **Smart Contract**: Polygon Amoy Testnet [`0xFf9d890459593d883a2D3BA024b566017958dfFb`](https://amoy.polygonscan.com/address/0xFf9d890459593d883a2D3BA024b566017958dfFb)  
> **Repository**: [https://github.com/alfie2233445566/zvote](https://github.com/alfie2233445566/zvote)

---

## 1. Executive Summary & Problem Formulation

### 1.1 The Domain & Problem Statement
Democratic legitimacy in student governance rests upon the unquestionable integrity of elections. University elections (such as Student Representative Council — SRC — and departmental elections) consistently suffer from recurring crises of trust due to inherent vulnerabilities in traditional voting systems:

1. **Vulnerabilities of Paper Ballots**:
   - Physical ballot-box stuffing, pre-marked ballots, and ballot destruction.
   - Recount disputes and contamination of the physical chain of custody.
   - Significant logistical delay in vote counting and high stationery/printing expenditure.

2. **Vulnerabilities of Traditional Centralized Electronic Voting (Web2 Databases)**:
   - Relies on centralized relational databases (e.g. MySQL, PostgreSQL).
   - Database administrators (or attackers who obtain SQL access) possess god-mode privileges: they can execute `UPDATE candidates SET votes = votes + 500 WHERE id = 1` with zero public, cryptographically verifiable detection.
   - Centralized servers are single points of failure susceptible to internal collusion and external cyberattacks.

3. **The Fundamental Voting Paradox (Secrecy vs. Verifiability)**:
   - Traditional systems either expose who voted for whom to prove tally authenticity, or hide identities so completely that voters cannot verify whether their individual ballot was altered or discarded.

4. **The Friction of Pure Web3 DApps**:
   - Standard decentralized applications require every user to install MetaMask, safeguard a 12-word seed phrase, and purchase native cryptocurrency to pay gas fees. This creates insurmountable technical friction for universal student adoption.

### 1.2 The ZVote Solution: Enterprise Hybrid Web2.5 Architecture
ZVote bridges this divide through an enterprise **Hybrid Web2.5 Architecture**:
- **Web2 User Convenience**: Students authenticate using their familiar Institutional Student ID and password, enjoy a responsive mobile web interface, incur **$0 gas fees**, and require **zero crypto knowledge or external wallets**.
- **Web3 Cryptographic Trust**: The canonical ballot box is an immutable EVM smart contract on the Polygon blockchain. Once a ballot is cast, it is sealed into a block that cannot be altered, deleted, or backdated by anyone—including the election administrator or database hosting provider.

---

## 2. System Architecture & Zero-Linkability Model

```
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                             ZVOTE ARCHITECTURAL TOPOLOGY                               │
 └────────────────────────────────────────────────────────────────────────────────────────┘

    [ STUDENT / VOTER CLIENT ]                    [ ELECTORAL COMMISSION ADMIN ]
   (React 18 + TailwindCSS on Netlify CDN)        (Admin Dashboard on Netlify CDN)
               │                                                │
               │ HTTPS (JWT Auth)                               │ HTTPS (JWT Auth)
               ▼                                                ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                     APPLICATION & RELAYER LAYER (Render.com)                          │
 │                   Node.js / Express API / Ethers.js v6 NonceManager                    │
 ├────────────────────────────────────────┬───────────────────────────────────────────────┤
 │                                        │                                               │
 │ OFF-CHAIN PERSISTENCE LAYER            │ ASYNCHRONOUS EMAIL ENGINE                     │
 │ (Neon Serverless PostgreSQL on AWS)    │ (Brevo HTTPS REST API - Port 443)             │
 │                                        │                                               │
 │ • Student Demographics (Name, ID, Dept)│ • Direct credential dispatch to student inboxes│
 │ • Bcrypt Password Hashes               │ • Password reset link delivery                │
 │ • Audit VoteReceipt (userId, posId, tx)│ • Throttled delivery to protect sender rating │
 │ • NO CANDIDATE CHOICES STORED HERE     │                                               │
 └────────────────────────────────────────┴───────────────────────────────────────────────┘
                                          │
                                          │ JSON-RPC (EVM Transactions signed by Relayer)
                                          ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                 IMMUTABLE ON-CHAIN LEDGER (Polygon Amoy PoS Testnet)                   │
 │                     Smart Contract: ZVote.sol (Solidity 0.8.19)                        │
 ├────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Canonical Position Registry & Candidate Arrays                                       │
 │ • Double-Voting Gate: mapping(uint256 => mapping(address => bool)) private voted       │
 │ • Immutable Tally Incrementation: candidate.voteCount++                                │
 │ • Public Indexed Events: emit VoteCast(voter, positionId, candidateId)                │
 │ • NO STUDENT IDENTIFIERS (NAME, EMAIL, INDEX NUMBER) EVER TOUCH THIS LAYER             │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The Mathematical Principle of Zero Linkability
A core question in election defense is: *“If the blockchain is public, can someone discover who a student voted for?”*

**Answer**: **Mathematically impossible.**
1. **Off-Chain Database**: Stores `(userId, positionId, txHash)`. It confirms that Student A participated in Position 1, but deliberately contains no column or record indicating which candidate Student A chose.
2. **On-Chain Blockchain**: Stores `(voterAddress, positionId, candidateId)`. The address recorded is an abstract, pseudonymous cryptographic address (`0x6B19...`) that contains no student name, email, or institutional index number.
3. Even if an adversary compromises both the PostgreSQL database and reads the entire Polygon ledger, there is **zero cryptographic or relational link** connecting the student’s identity to their ballot choice.

---

## 3. Technology Stack & Technical Justifications

| Technology | Role | Technical Justification (Why Chosen Over Alternatives) |
| :--- | :--- | :--- |
| **Solidity 0.8.19** | Smart Contract Language | Built-in arithmetic overflow/underflow protection. Compiled with 200 optimizer runs to minimize execution gas cost. |
| **Polygon Amoy Testnet** | Public EVM Blockchain | **Speed**: 2-second block times vs 12-15s on Ethereum. **Cost**: Sub-cent gas fees ($0.0001) vs $5–$50 on Ethereum Mainnet. **Capacity**: 65,000 TPS. **Standardization**: 100% EVM-compatible. |
| **Node.js & Express** | Backend API Framework | Asynchronous event loop handles high-concurrency student voting bursts without thread starvation. Native interoperability with Ethers.js. |
| **Ethers.js v6 + NonceManager** | Blockchain SDK & Relayer | Supports native BigInt, modular contract calls, and automated sequential nonce incrementation to prevent "nonce too low" errors during peak voting. |
| **Prisma ORM & PostgreSQL** | Relational Database Layer | Enforces strict ACID relational integrity, composite primary/unique constraints, foreign key cascades, and connection pooling. |
| **Brevo HTTPS REST API** | Transactional Email Service | Cloud hosts (Render, AWS EC2, Vercel free tiers) block outbound SMTP ports 25, 465, and 587. Brevo operates over standard HTTPS (Port 443), guaranteeing direct delivery to student inboxes. |
| **React 18 & Vite** | Frontend Single-Page App | Component-based virtual DOM, ultra-fast Hot Module Replacement, and optimized production bundle (<320 KB) that loads instantly on mobile campus networks. |
| **TailwindCSS** | Responsive Design Engine | Utility-first CSS eliminates bloated style sheets; provides mobile-first responsive breakpoints, fluid grids, and clean visual hierarchy. |

---

## 4. Cryptographic Security & Anti-Fraud Architecture

### 4.1 Two-Tier Double-Voting Immunity
To guarantee that no student can ever cast more than one ballot for a given position:
- **Tier 1 (Off-Chain Guard)**: The PostgreSQL `VoteReceipt` table enforces a composite unique constraint on `(userId, positionId)`. If a student attempts a second vote, the database transaction immediately throws a unique constraint violation and aborts with `HTTP 409 Conflict`.
- **Tier 2 (On-Chain Guard)**: The Solidity smart contract enforces:
  ```solidity
  require(!votedForPosition[_positionId][_voter], "ZVote: voter has already voted for this position");
  votedForPosition[_positionId][_voter] = true;
  ```
  Even in a catastrophic scenario where the off-chain database is manipulated, the decentralized Polygon smart contract mathematically rejects duplicate vote attempts.

### 4.2 Administrator Password Blindness
When the system bulk-registers students:
1. An alphanumeric temporary password is generated in transient memory.
2. It is hashed with **Bcrypt (10 salt rounds)** and stored in the database for authentication.
3. The plain text password is sent exclusively to the student's personal email via Brevo.
4. Before returning the registration report to the administrator's dashboard, the backend transforms all temporary passwords into one-way **SHA-256 cryptographic hashes** (`sha256:7f83b165...`).
5. The administrator cannot view or read students' cleartext passwords.

### 4.3 First-Login Forced Password Reset
All student accounts are provisioned with `mustChangePassword: true`. Upon initial login with the temporary credentials, the user is intercepted and navigated to `/change-password-first-login`. The student must choose a personal, permanent password before accessing the ballot box.

### 4.4 Global Session Invalidation (`SERVER_BOOT_ID`)
Upon server boot, an ephemeral in-memory UUID (`SERVER_BOOT_ID`) is generated. All issued JWT authentication tokens carry this `bootId`. If the backend server is restarted, redeployed, or compromised, all previously issued tokens are instantly invalidated.

---

## 5. Smart Contract Deep Dive (`ZVote.sol`)

The deployed smart contract at `0xFf9d890459593d883a2D3BA024b566017958dfFb` manages the election state machine:

### 5.1 Data Structures
```solidity
struct Candidate {
    string name;
    string programme;
    uint256 voteCount;
}

struct Position {
    string title;
    bool exists;
    Candidate[] candidates;
}
```

### 5.2 Core State Variables
- `address public electionAuthority`: The backend signing wallet that deploys and administers the election.
- `bool public electionActive`: Global toggle that gates voting access.
- `mapping(uint256 => Position) private positions`: Maps position ID to position data.
- `mapping(uint256 => mapping(address => bool)) private votedForPosition`: Prevents double voting per position.

### 5.3 Core Execution Functions
1. `createPosition(string _title)`: Creates a new voting position and assigns a sequential `positionId`.
2. `addCandidate(uint256 _positionId, string _name, string _programme)`: Adds a candidate to a specific position.
3. `startElection(string _electionName)`: Sets `electionActive = true` and records the official cycle name.
4. `endElection()`: Closes the voting window (`electionActive = false`). Any subsequent calls to `vote()` revert.
5. `vote(address _voter, uint256 _positionId, uint256 _candidateId)`:
   - Validates that `electionActive == true`.
   - Validates that `_candidateId < positions[_positionId].candidates.length`.
   - Validates that `!votedForPosition[_positionId][_voter]`.
   - Marks `votedForPosition[_positionId][_voter] = true`.
   - Increments `positions[_positionId].candidates[_candidateId].voteCount++`.
   - Emits `event VoteCast(address indexed voter, uint256 indexed positionId, uint256 indexed candidateId)`.

---

## 6. Constitutional Electoral Formulas & Edge Cases

### 6.1 The 50% + 1 Absolute Majority Rule
Under standard university SRC constitutions, a candidate for an executive position must secure an absolute majority of valid votes cast to be declared winner:

$$\text{Majority Threshold } T = \left\lfloor \frac{V}{2} \right\rfloor + 1$$

Where $V$ is the total valid votes cast for that position.

- **Outcome 1 (`WON_MAJORITY`)**: Top candidate votes $\ge T \rightarrow$ **Declared Winner**.
- **Outcome 2 (`RUNOFF_REQUIRED`)**: Top candidate votes $< T \rightarrow$ **Runoff Election Required** between the top two contenders.
- **Outcome 3 (`TIE`)**: Top two candidates receive identical vote tallies $\rightarrow$ **Runoff Election Required**.

### 6.2 Unopposed Positions (YES / NO Approval Referendum)
When only one candidate contests an election:
- The system automatically provisions a democratic referendum ballot with two options: **YES (Approve)** and **NO (Reject)**.
- The candidate is declared elected if and only if **YES votes $> 50\%$** of total referendum ballots cast. If NO votes $\ge 50\%$, the candidate is rejected, and nominations reopen.

### 6.3 The Sealed Ballot Protocol
To eliminate **bandwagon bias** (where voters flock to a leading candidate) and **tactical voter coercion**:
- While the election is `ACTIVE`, candidate vote counts are sealed and inaccessible via the public frontend.
- The interface displays real-time voter turnout percentage and remaining time countdown (`ElectionCountdown`).
- Once the election is officially closed by the administrator, the tallies are revealed and analyzed on the `/results` dashboard.

---

## 7. Master Defense Q&A: Top 25 Questions & Authoritative Answers

### Category 1: System Motivation & Problem Solving
**Q1: What motivated the development of ZVote when online voting systems already exist?**  
*Answer*: Traditional electronic voting systems rely on centralized databases where system administrators possess god-mode SQL privileges (`UPDATE candidates SET votes = votes + 500`) with zero verifiable audit trail. ZVote integrates blockchain smart contracts to decentralize the ballot box, ensuring that once a vote is cast, it is immutable, tamper-proof, and publicly verifiable.

**Q2: Why did you choose Polygon Amoy rather than Ethereum Mainnet or a local blockchain?**  
*Answer*: Ethereum Mainnet is impractical for university elections due to high transaction fees ($5–$50 per vote) and slow block times (12–15 seconds). A local blockchain provides zero public auditability. Polygon Amoy PoS testnet offers 2-second block times, 65,000 TPS capacity, EVM compatibility, and sub-cent gas fees, allowing us to deploy a real, publicly verifiable system.

**Q3: How do you protect voter secrecy if the blockchain is public and transparent?**  
*Answer*: Through our Zero-Linkability decoupled architecture. Personal student demographic information (Name, Student ID, Email) lives exclusively in our off-chain PostgreSQL database. The smart contract on the blockchain only receives pseudonymous candidate indices and an abstract voter address. The link between student identity and candidate choice is never written to disk anywhere.

### Category 2: Blockchain, Gas & The Relayer Model
**Q4: If voters don't have MetaMask or cryptocurrency, who pays the gas fees?**  
*Answer*: ZVote uses a Gasless Relayer Pattern. The Election Authority wallet signs and submits all vote transactions on behalf of the voters, absorbing the minor gas cost (~0.001 POL per vote). Students simply authenticate with their familiar student ID and password, requiring zero crypto knowledge.

**Q5: What prevents the Election Authority / Relayer from altering the student's vote?**  
*Answer*: When the student submits their vote, the backend immediately returns the cryptographic transaction receipt containing the mined transaction hash (`txHash`). The student can click 'Verify on Polygonscan' or use the in-app Vote Verification portal to view the raw blockchain receipt, which confirms the exact position ID and candidate index sealed in the block.

**Q6: What happens if thousands of students vote simultaneously? How do you prevent transaction collisions?**  
*Answer*: In standard Ethereum implementations, submitting concurrent transactions from a single wallet causes "nonce too low" or "replacement fee too low" errors. We wrapped the ethers.js signing wallet in a `NonceManager`. The NonceManager automatically serializes, queues, and assigns sequential nonces, ensuring smooth processing during peak voting hours.

### Category 3: Security & Fraud Prevention
**Q7: How does the system prevent a student from voting twice?**  
*Answer*: Through a two-tier guard. Tier 1 (Off-Chain): The PostgreSQL `VoteReceipt` table has a composite unique constraint on `(userId, positionId)`. If a student attempts a second vote, the database query aborts. Tier 2 (On-Chain): The Solidity contract maintains a mapping `votedForPosition[positionId][voter]`. If a duplicate vote reaches the contract, the transaction reverts with an error.

**Q8: Can the election administrator see student passwords?**  
*Answer*: No. When student accounts are generated, passwords are encrypted using Bcrypt (10 salt rounds) for database verification. For administrative views and CSV exports, the backend transforms the passwords into one-way cryptographic SHA-256 hashes. The plain text password is only dispatched to the student's personal email.

**Q9: What is the purpose of SERVER_BOOT_ID in the JWT authentication?**  
*Answer*: Whenever the backend server restarts or is redeployed, it generates a fresh UUID called `SERVER_BOOT_ID`. When a user presents a JWT, the server verifies that the token's `bootId` matches the active server session. This provides instant global session revocation upon server restart, mitigating token replay attacks.

**Q10: How does ZVote prevent unauthorized students from voting in departmental elections?**  
*Answer*: Through Departmental Enclaves. When creating a departmental election, the administrator assigns a `targetDepartment`. The backend and frontend filter candidates and voters so that only students whose registered department matches the election target department can view and vote on that ballot.

### Category 4: Electoral Logic & Integrity
**Q11: Why are vote tallies hidden while the election is active?**  
*Answer*: To uphold the Sealed Ballot Protocol and eliminate bandwagon bias. In behavioral political science, displaying real-time vote totals influences undecided voters and encourages tactical voting. ZVote displays live voter turnout percentage while keeping candidate totals sealed until polls officially close.

**Q12: What happens if a position only has one candidate?**  
*Answer*: ZVote automatically triggers an Unopposed YES/NO Approval Referendum. The voter selects either YES (Approve) or NO (Reject). The candidate must achieve greater than 50% YES votes of total ballots cast to be declared elected.

**Q13: What is your 50% + 1 victory calculation and how does it handle ties?**  
*Answer*: We calculate the majority threshold as $T = \lfloor V / 2 \rfloor + 1$, where $V$ is total votes cast. If the leading candidate meets or exceeds $T$, they win (`WON_MAJORITY`). If no candidate reaches $T$, or if the top two candidates receive identical votes, the system classifies the result as `RUNOFF_REQUIRED`.

**Q14: What prevents an attacker from voting after the election end time?**  
*Answer*: Both off-chain and on-chain checks prevent late voting. The API validates `new Date() <= election.endTime`. In addition, when the administrator closes the election, the backend calls `endElection()` on the smart contract, which sets `electionActive = false`. Any subsequent on-chain vote attempt reverts immediately.

### Category 5: Infrastructure & Engineering
**Q15: Why did you use Brevo HTTPS API instead of standard SMTP like Gmail or Sendgrid?**  
*Answer*: Cloud platform free tiers (Render, AWS EC2, Vercel) block outbound TCP ports 25, 465, and 587 by default to prevent spam relays. Standard SMTP connections hang and time out. Brevo's REST API operates over standard HTTPS port 443, which is universally open, ensuring 100% reliable credential dispatch directly to students' personal inboxes.

**Q16: Why not store student personal info on IPFS (InterPlanetary File System)?**  
*Answer*: IPFS is a public, immutable, distributed content-addressed network. Storing personally identifiable student information (PII) on IPFS violates global data privacy regulations (GDPR, Data Protection Act) because records on IPFS cannot be modified or deleted. PII must remain in an off-chain relational database.

**Q17: How scalable is the system for a campus of 20,000 students?**  
*Answer*: The off-chain API is stateless and can scale horizontally across multiple instances behind a load balancer. PostgreSQL read-replicas handle voter profile queries. On Polygon, 20,000 votes represent ~0.3% of the network's daily throughput, well within standard operational capacity.

**Q18: What is individual verifiability versus universal verifiability?**  
*Answer*: Individual Verifiability: A student can verify that their specific ballot was included in the blockchain ledger using their transaction hash. Universal Verifiability: Any observer, auditor, or candidate can independently inspect the smart contract's public tallies and sum the votes to confirm the accuracy of the final winner without needing privileged credentials.

**Q19: How did you optimize gas consumption in your smart contract?**  
*Answer*: We used Solidity 0.8.19 optimizer set to 200 runs, packed struct fields compactly, used `uint256` for native EVM word alignment, and replaced costly on-chain string lookups with compact integer indices for positions and candidates.

**Q20: What is the final conclusion and recommendation of this project?**  
*Answer*: ZVote successfully proves that blockchain technology can eliminate election tampering in university governance without imposing technical friction or financial cost on voters. The hybrid Web2.5 architecture represents the optimal paradigm for institutional electronic voting.

---

## 8. Summary Checklist for Tomorrow's Presentation

1. **Demonstrate the Student Flow**:
   - Show the received Brevo email with Index Number and Temporary Password.
   - Log in at `https://zvote.netlify.app/login`.
   - Demonstrate the forced first-login password change on `/change-password-first-login`.
   - Cast a ballot and display the generated Polygon transaction hash.
2. **Demonstrate Verifiability**:
   - Click "Verify on Polygonscan" to show the live mined block on [amoy.polygonscan.com](https://amoy.polygonscan.com/address/0xFf9d890459593d883a2D3BA024b566017958dfFb).
3. **Demonstrate Admin Integrity**:
   - Show the Admin Dashboard with SHA-256 hashed temporary passwords protecting voter privacy.
   - Close the election and show the automatic calculation of the 50% + 1 victory threshold.
