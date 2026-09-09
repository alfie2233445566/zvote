import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.connect();

describe("ZVote", function () {
  async function deployZVoteFixture() {
    const [authority, voter1, voter2, outsider] = await ethers.getSigners();

    const ZVote = await ethers.getContractFactory("ZVote");
    const zVote = await ZVote.deploy();
    await zVote.waitForDeployment();

    return { zVote, authority, voter1, voter2, outsider };
  }

  async function deployWithPresidentPositionFixture() {
    const base = await deployZVoteFixture();
    const { zVote } = base;

    await zVote.createPosition("SRC President");
    await zVote.addCandidate(0, "Ama Mensah", "BSc. Computer Engineering");
    await zVote.addCandidate(0, "Kojo Boateng", "BSc. Information Technology");
    await zVote.startElection("2026/2027 SRC Election");

    return base;
  }

  describe("Deployment", function () {
    it("sets the deployer as the election authority", async function () {
      const { zVote, authority } = await networkHelpers.loadFixture(deployZVoteFixture);
      expect(await zVote.electionAuthority()).to.equal(authority.address);
    });

    it("starts with no active election", async function () {
      const { zVote } = await networkHelpers.loadFixture(deployZVoteFixture);
      expect(await zVote.electionActive()).to.equal(false);
    });
  });

  describe("Position and candidate management", function () {
    it("allows the election authority to create a position", async function () {
      const { zVote } = await networkHelpers.loadFixture(deployZVoteFixture);
      await expect(zVote.createPosition("SRC President"))
        .to.emit(zVote, "PositionCreated")
        .withArgs(0n, "SRC President");
      expect(await zVote.positionCount()).to.equal(1n);
    });

    it("rejects position creation from a non-authority address", async function () {
      const { zVote, outsider } = await networkHelpers.loadFixture(deployZVoteFixture);
      await expect(
        zVote.connect(outsider).createPosition("SRC President"),
      ).to.be.revertedWith("ZVote: caller is not the election authority");
    });

    it("allows the election authority to add candidates to a position", async function () {
      const { zVote } = await networkHelpers.loadFixture(deployZVoteFixture);
      await zVote.createPosition("SRC President");

      await expect(zVote.addCandidate(0, "Ama Mensah", "BSc. Computer Engineering"))
        .to.emit(zVote, "CandidateAdded")
        .withArgs(0n, 0n, "Ama Mensah", "BSc. Computer Engineering");

      expect(await zVote.getCandidateCount(0)).to.equal(1n);
    });

    it("reverts when adding a candidate to a non-existent position", async function () {
      const { zVote } = await networkHelpers.loadFixture(deployZVoteFixture);
      await expect(
        zVote.addCandidate(99, "Ama Mensah", "BSc. Computer Engineering"),
      ).to.be.revertedWith("ZVote: position does not exist");
    });
  });

  describe("Election lifecycle", function () {
    it("starts and ends an election", async function () {
      const { zVote } = await networkHelpers.loadFixture(deployZVoteFixture);

      await expect(zVote.startElection("Test Election"))
        .to.emit(zVote, "ElectionStarted")
        .withArgs("Test Election");
      expect(await zVote.electionActive()).to.equal(true);

      await expect(zVote.endElection()).to.emit(zVote, "ElectionEnded").withArgs("Test Election");
      expect(await zVote.electionActive()).to.equal(false);
    });

    it("cannot be started twice in a row", async function () {
      const { zVote } = await networkHelpers.loadFixture(deployZVoteFixture);
      await zVote.startElection("Test Election");
      await expect(zVote.startElection("Test Election")).to.be.revertedWith(
        "ZVote: election already active",
      );
    });
  });

  describe("Voting & Double-Voting Protection (Thesis Chapter 4 Test Cases)", function () {
    it("TC-01: accepts a valid first vote and increments the tally", async function () {
      const { zVote, voter1 } = await networkHelpers.loadFixture(deployWithPresidentPositionFixture);

      await expect(zVote.vote(voter1.address, 0, 1))
        .to.emit(zVote, "VoteCast")
        .withArgs(voter1.address, 0n, 1n);

      const [names, programmes, voteCounts] = await zVote.getResults(0);
      expect(names).to.deep.equal(["Ama Mensah", "Kojo Boateng"]);
      expect(programmes).to.deep.equal(["BSc. Computer Engineering", "BSc. Information Technology"]);
      expect(voteCounts.map((v) => v.toString())).to.deep.equal(["0", "1"]);
    });

    it("TC-02: rejects a second vote from the same wallet for the same position (sequential)", async function () {
      const { zVote, voter1 } = await networkHelpers.loadFixture(deployWithPresidentPositionFixture);
      await zVote.vote(voter1.address, 0, 0);
      await expect(zVote.vote(voter1.address, 0, 1)).to.be.revertedWith(
        "ZVote: voter has already voted for this position",
      );
    });

    it("TC-03: rejects a vote submitted by anyone other than the election authority / relayer", async function () {
      const { zVote, voter1, outsider } = await networkHelpers.loadFixture(
        deployWithPresidentPositionFixture,
      );
      await expect(
        zVote.connect(outsider).vote(voter1.address, 0, 0),
      ).to.be.revertedWith("ZVote: caller is not the election authority");
    });

    it("TC-04: rejects votes after the poll is closed or when election is not active", async function () {
      const { zVote, voter1 } = await networkHelpers.loadFixture(deployWithPresidentPositionFixture);
      await zVote.endElection();
      await expect(zVote.vote(voter1.address, 0, 0)).to.be.revertedWith(
        "ZVote: election is not active",
      );
    });

    it("TC-05: tallies votes and verifies majority determination", async function () {
      const { zVote, voter1, voter2 } = await networkHelpers.loadFixture(deployWithPresidentPositionFixture);
      await zVote.vote(voter1.address, 0, 0);
      await zVote.vote(voter2.address, 0, 0);

      const [, , voteCounts] = await zVote.getResults(0);
      const cand0Votes = Number(voteCounts[0]);
      const cand1Votes = Number(voteCounts[1]);
      const totalVotes = cand0Votes + cand1Votes;

      expect(totalVotes).to.equal(2);
      expect(cand0Votes).to.equal(2);
      expect(cand0Votes / totalVotes).to.be.greaterThan(0.5); // > 50% majority
    });

    it("TC-06: detects an exact tie scenario requiring runoff evaluation", async function () {
      const { zVote, voter1, voter2 } = await networkHelpers.loadFixture(deployWithPresidentPositionFixture);
      await zVote.vote(voter1.address, 0, 0);
      await zVote.vote(voter2.address, 0, 1);

      const [, , voteCounts] = await zVote.getResults(0);
      expect(voteCounts[0]).to.equal(voteCounts[1]); // Exact tie
    });

    it("TC-07: rejects a concurrent double-vote race condition attempt", async function () {
      const { zVote, voter1 } = await networkHelpers.loadFixture(deployWithPresidentPositionFixture);

      const [r1, r2] = await Promise.allSettled([
        zVote.vote(voter1.address, 0, 0),
        zVote.vote(voter1.address, 0, 1),
      ]);

      const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled");
      const rejected = [r1, r2].filter((r) => r.status === "rejected");

      expect(fulfilled.length).to.equal(1);
      expect(rejected.length).to.equal(1);
      expect(rejected[0].reason.message).to.include("ZVote: voter has already voted for this position");
    });

    it("TC-08: permits the same wallet to vote across different positions", async function () {
      const { zVote, voter1 } = await networkHelpers.loadFixture(deployWithPresidentPositionFixture);
      await zVote.createPosition("General Secretary");
      await zVote.addCandidate(1, "Kwame Nkrumah", "BSc. Law");

      await expect(zVote.vote(voter1.address, 0, 0)).to.emit(zVote, "VoteCast");
      await expect(zVote.vote(voter1.address, 1, 0)).to.emit(zVote, "VoteCast");

      expect(await zVote.hasVoted(voter1.address, 0)).to.equal(true);
      expect(await zVote.hasVoted(voter1.address, 1)).to.equal(true);
    });

    it("TC-09: rejects votes for an invalid candidate id", async function () {
      const { zVote, voter1 } = await networkHelpers.loadFixture(deployWithPresidentPositionFixture);
      await expect(zVote.vote(voter1.address, 0, 99)).to.be.revertedWith(
        "ZVote: invalid candidate id",
      );
    });
  });
});
