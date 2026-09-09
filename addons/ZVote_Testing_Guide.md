# ZVote Testing and Evaluation Guide

## A practical test plan for Chapter Four (Analysis, Testing and Discussion)

This guide maps every test back to the five objectives stated in Section 1.3 of the thesis, so that each result you produce has a direct home in Chapter Four. It gives you the actual tools, installation commands and example test code needed to generate real evidence rather than descriptive claims.

---

## 1. How the Test Plan Maps to Your Objectives

| Chapter One Objective | Test Category | Section Below |
|---|---|---|
| Design a blockchain architecture using smart contracts to enforce election rules and automate tallying | Smart contract unit and integration testing | 3 |
| Develop a web voting interface allowing secure casting and inclusion verification | Functional and end-to-end testing | 8 |
| Implement an admin dashboard for election setup, registration and monitoring | Functional and end-to-end testing | 8 |
| Deploy smart contracts on a test network and integrate with the frontend | Deployment and integration testing | 4, 9 |
| Provide a security audit report identifying vulnerabilities | Security testing (contract, API, auth) | 5 |
| (Implicit, from Section 1.4) Justify blockchain over a centralised alternative | Comparative case-building experiments | 6 |

Chapter Four should therefore be structured around six results sections: (1) smart contract correctness, (2) double-voting and tamper resistance, (3) immutability and verifiability, (4) security audit findings, (5) the comparative case against traditional e-voting, and (6) performance and usability. Sections 2 through 10 below give you the tools and commands for each.

---

## 2. Test Environment Setup

You need two environments: a local Hardhat network for fast, repeatable, gas-free testing, and the deployed Polygon Amoy testnet for real-world verifiability tests (block explorer lookups, real gas costs, real latency).

```bash
# from the blockchain/ directory
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox-mocha-ethers
npm install --save-dev solidity-coverage hardhat-gas-reporter
npm install --save-dev @openzeppelin/contracts

# start a local node in one terminal (persists state, lets you attach a console)
npx hardhat node

# in a second terminal, run the full test suite against it
npx hardhat test --network localhost

# run the same suite against Polygon Amoy for real-network confirmation timing
npx hardhat test --network amoy
```

`hardhat.config.cjs` should define both networks so you can switch with `--network`:

```javascript
module.exports = {
  solidity: "0.8.19",
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    amoy: {
      url: process.env.AMOY_RPC_URL,
      accounts: [process.env.RELAYER_PRIVATE_KEY],
      chainId: 80002,
    },
  },
};
```

For the backend and frontend you will additionally need:

```bash
npm install --save-dev jest supertest              # backend unit and API tests
npm install --save-dev @testing-library/react vitest  # frontend component tests
npm install --save-dev cypress                     # end-to-end browser tests
```

---

## 3. Smart Contract Unit and Integration Testing

Use Mocha and Chai through Hardhat. Write tests in `blockchain/test/ZVote.test.js`. Structure each test around a single required property so you can present a results table with one row per test case.

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZVote election lifecycle", function () {
  let zvote, admin, relayer, voter1, voter2;

  beforeEach(async function () {
    [admin, relayer, voter1, voter2] = await ethers.getSigners();
    const ZVote = await ethers.getContractFactory("ZVote");
    zvote = await ZVote.deploy(admin.address, relayer.address);
    await zvote.addPosition("President");
    await zvote.addCandidate(0, voter1.address);
    await zvote.addCandidate(0, voter2.address);
  });

  it("TC-01: accepts a valid first vote and increments the tally", async function () {
    await zvote.connect(relayer).submitVote(0, 0, voter1.address);
    expect(await zvote.getTallyForTesting(0, 0)).to.equal(1);
  });

  it("TC-02: rejects a second vote from the same wallet for the same position", async function () {
    await zvote.connect(relayer).submitVote(0, 0, voter1.address);
    await expect(
      zvote.connect(relayer).submitVote(0, 1, voter1.address)
    ).to.be.revertedWith("already voted");
  });

  it("TC-03: rejects a vote submitted by anyone other than the relayer", async function () {
    await expect(
      zvote.connect(voter2).submitVote(0, 0, voter1.address)
    ).to.be.revertedWith("caller is not the relayer");
  });

  it("TC-04: rejects votes after the poll is closed", async function () {
    await zvote.connect(admin).closePoll();
    await expect(
      zvote.connect(relayer).submitVote(0, 0, voter1.address)
    ).to.be.revertedWith("voting closed");
  });

  it("TC-05: applies the 50 percent plus 1 rule correctly", async function () {
    await zvote.connect(relayer).submitVote(0, 0, voter1.address);
    await zvote.connect(admin).closePoll();
    const result = await zvote.declareResult(0);
    expect(result).to.equal(1); // WON_MAJORITY
  });

  it("TC-06: declares a runoff on a tie", async function () {
    // two voters split evenly between two candidates, then assert RUNOFF_REQUIRED
  });
});
```

Run it with gas and coverage reporting so you have quantitative figures to cite in Chapter Four:

```bash
REPORT_GAS=true npx hardhat test
npx hardhat coverage
```

`hardhat coverage` produces `coverage/index.html` with a line-by-line and branch coverage percentage. Report the overall percentage and screenshot the summary table; a coverage figure above roughly 90 percent for `submitVote`, `closePoll` and `declareResult` is a strong, citable result for a final year project.

---

## 4. Deployment and Integration Testing

This validates Objective 4 (deployment and frontend integration). Deploy to Amoy and verify the deployed bytecode matches your compiled artefact, then run an integration test that exercises the full stack.

```bash
npx hardhat run scripts/deploy.js --network amoy
npx hardhat verify --network amoy <deployed_address> <admin_address> <relayer_address>
```

`hardhat verify` publishes the source on Polygonscan and confirms the deployed bytecode is not a modified or malicious substitute, which is itself a piece of evidence you can cite for transparency in Chapter Four.

For full-stack integration, use Supertest against a running backend instance pointed at the Amoy deployment:

```javascript
// backend/test/vote.integration.test.js
const request = require("supertest");
const app = require("../src/server");

describe("POST /api/vote integration", function () {
  it("IT-01: casting a vote returns a minable transaction hash", async function () {
    const res = await request(app)
      .post("/api/vote")
      .set("Authorization", `Bearer ${testStudentJWT}`)
      .send({ positionId: 0, candidateId: 0 });
    expect(res.status).to.equal(200);
    expect(res.body.txHash).to.match(/^0x[a-fA-F0-9]{64}$/);
  });
});
```

```bash
npx jest test/vote.integration.test.js --runInBand
```

---

## 5. Security Testing

This section produces the security audit report required by Objective 5. Run each tool and report its findings as a table of issue, severity, location and remediation, which is exactly the format Chapter Four should use.

### 5.1 Smart contract static analysis, Slither

```bash
pip install slither-analyzer --break-system-packages
slither blockchain/contracts/ZVote.sol
```

Slither flags re-entrancy, unchecked external calls, incorrect visibility and other issues from the categories in the OWASP smart contract top ten. Include its summary table directly in Chapter Four and note which findings are false positives with justification.

### 5.2 Symbolic execution, Mythril

```bash
pip install mythril --break-system-packages
myth analyze blockchain/contracts/ZVote.sol --solv 0.8.19
```

Mythril attempts to find inputs that violate invariants such as integer overflow or unauthorized state changes; it is a good complement to Slither's pattern-based analysis because it explores execution paths rather than syntax.

### 5.3 Property-based fuzzing, Echidna

```bash
# install via docker, simplest path
docker pull trailofbits/eth-security-toolbox
docker run -it -v $PWD:/src trailofbits/eth-security-toolbox
# inside the container
cd /src/blockchain
echidna contracts/ZVoteFuzz.sol --contract ZVoteFuzz --config echidna.yaml
```

Write a small fuzzing harness that asserts the invariant you most care about, double voting:

```solidity
// contracts/ZVoteFuzz.sol
contract ZVoteFuzz is ZVote {
    function echidna_no_double_vote() public view returns (bool) {
        // returns false if the fuzzer manages to find a sequence of calls
        // that lets a single wallet be counted twice
        return totalVotesCast <= totalUniqueVoters;
    }
}
```

Echidna will run thousands of randomised call sequences trying to break this invariant. A clean run after a stated number of test runs (for example 50,000) is strong, quantifiable evidence for the double-voting resistance claim in Chapter Four.

### 5.4 Dependency and API security

```bash
npm audit --production
npx snyk test
```

```bash
# OWASP ZAP baseline scan against the running backend
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:5000 -r zap-report.html
```

Report the ZAP alert counts by risk level (high, medium, low, informational) as a table.

### 5.5 Authentication and session security

Write targeted Jest tests for the properties you claim in Section 3.8 of Chapter Three:

```javascript
describe("JWT session security", function () {
  it("ST-01: rejects a token signed with an incorrect secret", async function () {
    const forged = jwt.sign({ sub: "UEB1103322" }, "wrong-secret");
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${forged}`);
    expect(res.status).to.equal(401);
  });

  it("ST-02: rejects a token issued before the last server restart", async function () {
    // sign a token with an old SERVER_BOOT_ID and confirm 401
  });

  it("ST-03: rejects a plaintext password comparison shortcut", async function () {
    // confirm bcrypt.compare is used, not a direct string equality
  });
});
```

```bash
# manual brute-force resistance check
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"indexNumber":"UEB1103322","password":"wrongpass"}'
done
```

Report whether rate limiting or account lockout engages after a defined threshold, and if not, list it as a finding with a recommended fix (for example `express-rate-limit`).

---

## 6. The Comparative Case, Blockchain vs a Traditional Centralised System

This is the section that actually produces evidence for your research problem in Section 1.4, rather than repeating the literature review's argument. The idea is to run the same three experiments against both ZVote's on-chain layer and a minimal centralised control system, and report the measured difference.

### 6.1 Build the control system

You do not need a second full application. A twenty-line Express and SQLite script that stores `candidate_id, vote_count` in a table and exposes a single `POST /vote` route that runs `UPDATE candidates SET votes = votes + 1 WHERE id = ?` is a faithful, minimal stand-in for the traditional systems discussed in Section 2.2.2.1. Call it `control-system/` in your repository.

### 6.2 Experiment 1, Insider Tamper Detection

Give a test "administrator" direct database or contract access and ask them to alter one candidate's tally by 50 votes without authorisation.

```bash
# against the traditional control system: this succeeds silently
sqlite3 control.db "UPDATE candidates SET votes = votes + 50 WHERE id = 1;"

# against ZVote: attempt the equivalent through the contract ABI
npx hardhat console --network localhost
> const zvote = await ethers.getContractAt("ZVote", "<address>")
> await zvote.connect(attacker).submitVote(0, 0, attacker.address)
# Error: caller is not the relayer  (reverted)
```

Report: did the tamper attempt succeed, and was it detectable after the fact without prior knowledge of the change? For the SQL case, without a separate audit log the answer is no on both counts. For ZVote, the transaction reverts outright, and even a successful relayer-submitted vote is permanently visible as an event log that anyone can independently recount, which is your Experiment 2.

### 6.3 Experiment 2, Independent Tally Verification

Write a standalone script that recomputes the tally purely from public blockchain data, without touching your backend or database, and compare it against the number your API reports.

```javascript
// scripts/independent_tally.js
const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
const contract = new ethers.Contract(address, abi, provider);

const filter = contract.filters.VoteCast();
const events = await contract.queryFilter(filter, 0, "latest");
const tally = {};
events.forEach(e => {
  const c = e.args.candidateId.toString();
  tally[c] = (tally[c] || 0) + 1;
});
console.log(tally);
```

```bash
node scripts/independent_tally.js
```

Run this from a machine that has never interacted with your backend, and show that its output matches the results page exactly. This is the strongest single piece of evidence you can put in Chapter Four for the "public verifiability" claim, because a traditional system's equivalent script would simply be `SELECT * FROM candidates`, which trusts the same database the administrator can silently edit.

### 6.4 Experiment 3, Cost Comparison

```bash
# estimate what the same submitVote call would cost on Ethereum mainnet gas prices
npx hardhat run scripts/estimate_gas.js --network mainnet-fork

# record actual cost on Polygon Amoy
npx hardhat run scripts/estimate_gas.js --network amoy
```

```javascript
// scripts/estimate_gas.js
const gasEstimate = await zvote.submitVote.estimateGas(0, 0, voter.address);
const gasPrice = await ethers.provider.getFeeData();
console.log("gas used:", gasEstimate.toString());
console.log("cost:", ethers.formatEther(gasEstimate * gasPrice.gasPrice), "native token");
```

Report gas used per vote, converted to United States dollars at a stated date using the native token price, alongside the zero cost to the student in ZVote's relayer-sponsored model, and a rough infrastructure cost estimate for a traditional system (server hosting, database backups, a paid audit).

### 6.5 Experiment 4, Availability Under Load

See Section 9 below for the load testing tool. Run the identical concurrent-user script against both the ZVote relayer endpoint and the control system's `/vote` endpoint, and compare successful request rate and latency at increasing concurrency.

### 6.6 Reporting Template

Present the four experiments as a single comparison table in Chapter Four:

| Property Tested | Traditional Control System | ZVote |
|---|---|---|
| Unauthorised tally change | Succeeds silently | Reverted, or later independently detectable |
| Independent third-party verification | Not possible without database access | Fully reproducible from public chain data |
| Marginal cost per vote | Infrastructure and audit cost | $0 to the voter, quantified relayer gas cost |
| Behaviour under concurrent load | (your measured numbers) | (your measured numbers) |

---

## 7. Double-Voting Specific Test Matrix

Because this is explicitly called out in your research problem, dedicate a focused subsection with a matrix broader than the single Hardhat unit test in Section 3:

| Test | Method | Tool |
|---|---|---|
| Same wallet, same position, sequential | Call `submitVote` twice in sequence | Hardhat/Mocha |
| Same wallet, same position, concurrent (race condition) | Fire two `submitVote` calls with `Promise.all` before the first is mined | Hardhat, custom script |
| Same wallet, different position | Confirm this succeeds, since one vote per position is allowed | Hardhat/Mocha |
| Replayed signed transaction | Capture a signed transaction and rebroadcast it | ethers.js raw transaction replay script |
| Two devices, same student credentials, simultaneous login | Log in from two browsers, attempt to vote from both | Cypress, manual |
| Backend bypass, direct contract call with a non-relayer key | Attempt `submitVote` from an arbitrary wallet | Hardhat console |

```javascript
// concurrent race-condition test
it("TC-07: rejects a concurrent double vote attempt", async function () {
  const [r1, r2] = await Promise.allSettled([
    zvote.connect(relayer).submitVote(0, 0, voter1.address),
    zvote.connect(relayer).submitVote(0, 1, voter1.address),
  ]);
  const rejected = [r1, r2].filter(r => r.status === "rejected");
  expect(rejected.length).to.equal(1);
});
```

Report the outcome of every row as pass or fail with the exact revert reason string, since `require(!hasVoted)` reverting on-chain is a stronger guarantee than an off-chain check alone, and this table is the evidence for that claim.

---

## 8. Functional and End-to-End Testing

This satisfies Objectives 2 and 3, the voting interface and the admin dashboard.

```bash
npx cypress open      # interactive, for developing test scenarios
npx cypress run       # headless, for CI and for capturing pass/fail counts to report
```

Scenarios to script in `cypress/e2e/`:

- Admin uploads a CSV roster and confirms students receive wallet addresses (`admin_registration.cy.js`)
- Student first login forces a password change (`first_login.cy.js`)
- Student casts a vote and sees a transaction hash and a working `/verify` link (`cast_vote.cy.js`)
- Student attempts to vote a second time and is blocked at the UI level as well as the contract level (`double_vote_ui.cy.js`)
- Admin closes a poll and results are revealed only after closing (`sealed_results.cy.js`)

For pure API testing without a browser, use Postman collections exported and run headlessly:

```bash
npm install -g newman
newman run ZVote_API_Tests.postman_collection.json --environment amoy.postman_environment.json
```

Report the Newman summary (requests run, assertions passed and failed, average response time) directly as a results table.

---

## 9. Performance and Load Testing

```bash
npm install -g k6
```

```javascript
// loadtest/vote_load.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 200 },
    { duration: "30s", target: 0 },
  ],
};

export default function () {
  const res = http.post("http://localhost:5000/api/vote",
    JSON.stringify({ positionId: 0, candidateId: 0 }),
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${__ENV.TOKEN}` } });
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}
```

```bash
k6 run --env TOKEN=$TEST_JWT loadtest/vote_load.js
```

Report k6's built-in summary: requests per second, 95th percentile latency, and error rate at each concurrency stage. Plot concurrency against latency as a line chart in Chapter Four, this is exactly the kind of quantitative figure examiners look for.

---

## 10. Usability Testing

To support the usability discussion in Section 2.1.6 and Section 2.3.4, run a small user study.

1. Recruit 10 to 15 student participants, a sample size standard for usability studies and sufficient to surface most usability issues.
2. Give each participant the same task script: log in, change password, cast one vote, verify the vote on the `/verify` page.
3. Record task completion time and success/failure per step.
4. Administer the System Usability Scale immediately afterwards, a standard 10-item, 5-point Likert questionnaire.

```
SUS score = ((sum of odd-item scores minus 5) + (25 minus sum of even-item scores)) * 2.5
```

Report the mean SUS score against the published benchmark (a score above 68 is considered above average) and the mean task completion time, both as simple tables or a bar chart in Chapter Four.

---

## 11. Suggested Chapter Four Structure

Based on all of the above, a clean Chapter Four outline is:

1. Introduction
2. Test Environment and Methodology (Section 2 above, briefly)
3. Smart Contract Correctness Results (Section 3, table of TC-01 through TC-06, coverage percentage)
4. Double-Voting and Tamper Resistance Results (Section 7, the double-voting matrix)
5. Immutability and Verifiability Results (Section 6.3, the independent tally script output)
6. Security Audit Results (Section 5, Slither/Mythril/Echidna/ZAP findings tables)
7. Comparative Analysis, Blockchain vs Traditional (Section 6.6, the comparison table)
8. Performance and Load Test Results (Section 9, the k6 latency chart)
9. Usability Evaluation Results (Section 10, SUS score)
10. Discussion, tying results back to the research problem in Section 1.4
11. Summary of Findings

Every test case ID referenced in this guide (TC-xx, IT-xx, ST-xx) is designed so you can drop it straight into a results table with columns for Test ID, Description, Expected Outcome, Actual Outcome and Pass/Fail, which is the format examiners expect for empirical thesis chapters.
