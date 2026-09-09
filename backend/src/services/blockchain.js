import { ethers, NonceManager } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This is the ONLY file in the backend that touches the blockchain. Every other
// module (controllers, routes) goes through the functions exported here. This keeps
// the private key and the ethers.Contract instance in one well-audited place.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  RPC_URL,
  PRIVATE_KEY,
  CONTRACT_ADDRESS,
} = process.env;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.warn(
    "[blockchain.js] RPC_URL, PRIVATE_KEY, or CONTRACT_ADDRESS is not set. " +
      "Blockchain calls will fail until backend/.env is fully configured " +
      "(see backend/.env.example, and deploy the contract first with " +
      "blockchain/scripts/deploy.js).",
  );
}

// The ABI is loaded from the compiled Hardhat artifact so it always matches the
// deployed contract. If the artifact hasn't been generated yet (i.e. `npx hardhat
// compile` hasn't been run in blockchain/), fall back to a hand-written ABI covering
// Load ABI: prioritize bundled artifact in backend/src/contracts/ZVoteArtifact.json,
// then Hardhat compilation artifact, then FALLBACK_ABI.
function loadAbi() {
  const bundledPath = path.join(__dirname, "../contracts/ZVoteArtifact.json");
  const hardhatPath = path.join(__dirname, "../../../blockchain/artifacts/contracts/ZVote.sol/ZVote.json");

  for (const artifactPath of [bundledPath, hardhatPath]) {
    try {
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
        if (artifact.abi) return artifact.abi;
      }
    } catch {
      // Continue to next path
    }
  }

  return FALLBACK_ABI;
}

function loadBytecode() {
  const bundledPath = path.join(__dirname, "../contracts/ZVoteArtifact.json");
  const hardhatPath = path.join(__dirname, "../../../blockchain/artifacts/contracts/ZVote.sol/ZVote.json");

  for (const artifactPath of [bundledPath, hardhatPath]) {
    try {
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
        if (artifact.bytecode && artifact.bytecode !== "0x") {
          return artifact.bytecode;
        }
      }
    } catch {
      // Continue to next path
    }
  }

  throw new Error(
    "Smart contract bytecode not found. Please ensure backend/src/contracts/ZVoteArtifact.json exists.",
  );
}

const FALLBACK_ABI = [
  "function createPosition(string _title) returns (uint256)",
  "function addCandidate(uint256 _positionId, string _name, string _programme) returns (uint256)",
  "function startElection(string _electionName)",
  "function endElection()",
  "function vote(address _voter, uint256 _positionId, uint256 _candidateId)",
  "function getResults(uint256 _positionId) view returns (string[] names, string[] programmes, uint256[] voteCounts)",
  "function hasVoted(address _voter, uint256 _positionId) view returns (bool)",
  "function getCandidateCount(uint256 _positionId) view returns (uint256)",
  "function getPositionTitle(uint256 _positionId) view returns (string)",
  "function electionActive() view returns (bool)",
  "function electionName() view returns (string)",
  "event PositionCreated(uint256 indexed positionId, string title)",
  "event CandidateAdded(uint256 indexed positionId, uint256 indexed candidateId, string name, string programme)",
  "event ElectionStarted(string electionName)",
  "event ElectionEnded(string electionName)",
  "event VoteCast(address indexed voter, uint256 indexed positionId, uint256 indexed candidateId)",
];

function sanitizeEnv(val) {
  if (!val) return "";
  return String(val).trim().replace(/^["']|["']$/g, "").trim();
}

const cleanRpcUrl = sanitizeEnv(process.env.RPC_URL || process.env.AMOY_RPC_URL) || "https://polygon-amoy.drpc.org";
let cleanPrivateKey = sanitizeEnv(process.env.PRIVATE_KEY);
if (cleanPrivateKey && !cleanPrivateKey.startsWith("0x") && cleanPrivateKey.length === 64) {
  cleanPrivateKey = "0x" + cleanPrivateKey;
}
const cleanContractAddress = sanitizeEnv(process.env.CONTRACT_ADDRESS);

export const provider = new ethers.JsonRpcProvider(cleanRpcUrl);

function createSigningWallet() {
  if (cleanPrivateKey && cleanPrivateKey.startsWith("0x") && cleanPrivateKey.length === 66) {
    const w = new ethers.Wallet(cleanPrivateKey, provider);
    console.log(`[blockchain.js] Election Authority wallet loaded: ${w.address}`);
    return w;
  }
  console.warn(
    `[blockchain.js] WARNING: Valid 66-character PRIVATE_KEY not found in environment (got length ${cleanPrivateKey ? cleanPrivateKey.length : 0}). Generating fallback random wallet.`
  );
  return ethers.Wallet.createRandom().connect(provider);
}

export const electionAuthorityWallet = createSigningWallet();

// Wrap with NonceManager to handle nonce management automatically across sequential
// and parallel transactions. This prevents "nonce too low" errors when multiple
// transactions are sent from the same wallet in quick succession.
const managedSigner = new NonceManager(electionAuthorityWallet);

export async function getBlockchainStatus() {
  const address = electionAuthorityWallet.address;
  let balance = "0.0";
  try {
    const bal = await provider.getBalance(address);
    balance = ethers.formatEther(bal);
  } catch (err) {
    balance = "Error: " + err.message;
  }
  return {
    walletAddress: address,
    balance: `${balance} POL`,
    contractAddress: cleanContractAddress || "NOT_SET",
    rpcUrl: cleanRpcUrl,
    hasValidPrivateKey: !!(cleanPrivateKey && cleanPrivateKey.startsWith("0x") && cleanPrivateKey.length === 66),
  };
}

/**
 * Deploys a new instance of the ZVote smart contract or returns pre-configured address.
 * @returns {Promise<string>} The address of the deployed contract.
 */
export async function deployElectionContract() {
  const currentContract = sanitizeEnv(process.env.CONTRACT_ADDRESS) || cleanContractAddress;
  if (
    currentContract &&
    currentContract.startsWith("0x") &&
    currentContract.length === 42 &&
    currentContract !== "0xdeployedContractAddressHere"
  ) {
    console.log(`[blockchain.js] Using pre-configured CONTRACT_ADDRESS: ${currentContract}`);
    return currentContract;
  }

  try {
    const abi = loadAbi();
    const bytecode = loadBytecode();
    const factory = new ethers.ContractFactory(abi, bytecode, managedSigner);
    const zVote = await factory.deploy();
    await zVote.waitForDeployment();
    return await zVote.getAddress();
  } catch (err) {
    throw err;
  }
}

/**
 * Creates a new voting position on-chain.
 * @param {string} contractAddress
 * @param {string} title
 * @returns {Promise<{ positionId: number, txHash: string }>}
 */
export async function createPosition(contractAddress, title) {
  const contract = new ethers.Contract(contractAddress, loadAbi(), managedSigner);
  const tx = await contract.createPosition(title);
  const receipt = await tx.wait();
  const positionId = await readPositionIdFromReceipt(contract, receipt);
  return { positionId, txHash: receipt.hash };
}

/**
 * Adds a candidate to a position on-chain.
 * @param {string} contractAddress
 * @param {number} positionId
 * @param {string} name
 * @param {string} programme
 * @returns {Promise<{ candidateId: number, txHash: string }>}
 */
export async function addCandidate(contractAddress, positionId, name, programme) {
  const contract = new ethers.Contract(contractAddress, loadAbi(), managedSigner);
  const tx = await contract.addCandidate(positionId, name, programme);
  const receipt = await tx.wait();
  const candidateId = await contract.getCandidateCount(positionId).then((n) => Number(n) - 1);
  return { candidateId, txHash: receipt.hash };
}

/** Opens the election for voting. */
export async function startElection(contractAddress, electionName) {
  const contract = new ethers.Contract(contractAddress, loadAbi(), managedSigner);
  const tx = await contract.startElection(electionName);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

/** Closes the election. */
export async function endElection(contractAddress) {
  const contract = new ethers.Contract(contractAddress, loadAbi(), managedSigner);
  const tx = await contract.endElection();
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

/**
 * Submits a vote on behalf of a voter. This is the core function described in the
 * project brief's VOTE FLOW section.
 * @param {string} contractAddress
 * @param {string} voterAddress
 * @param {number} positionId
 * @param {number} candidateId
 * @returns {Promise<{ txHash: string }>}
 */
export async function submitVote(contractAddress, voterAddress, positionId, candidateId) {
  const contract = new ethers.Contract(contractAddress, loadAbi(), managedSigner);
  const tx = await contract.vote(voterAddress, positionId, candidateId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

/**
 * Reads the tallied results for a position directly from the chain.
 * @param {string} contractAddress
 * @param {number} positionId
 */
export async function getResults(contractAddress, positionId) {
  const contract = new ethers.Contract(contractAddress, loadAbi(), provider);
  const [names, programmes, voteCounts] = await contract.getResults(positionId);
  return names.map((name, i) => ({
    name,
    programme: programmes[i],
    voteCount: Number(voteCounts[i]),
  }));
}

/** Reads whether a given voter address has already voted for a given position. */
export async function hasVoted(contractAddress, voterAddress, positionId) {
  const contract = new ethers.Contract(contractAddress, loadAbi(), provider);
  return contract.hasVoted(voterAddress, positionId);
}

/** Reads whether the election is currently active on-chain. */
export async function isElectionActive(contractAddress) {
  const target = contractAddress || CONTRACT_ADDRESS;
  if (!target || !target.startsWith("0x")) return false;
  try {
    const contract = new ethers.Contract(target, loadAbi(), provider);
    return await contract.electionActive();
  } catch (err) {
    console.error("isElectionActive error:", err.message);
    return false;
  }
}

/** Returns the deployed contract address the backend is configured to use. */
export function getContractAddress() {
  return CONTRACT_ADDRESS;
}

// -- Internal helpers -------------------------------------------------------------

async function readPositionIdFromReceipt(contract, receipt) {
  const iface = contract.interface;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "PositionCreated") {
        return Number(parsed.args.positionId);
      }
    } catch {
      // log wasn't emitted by this contract's ABI; ignore and keep scanning
    }
  }
  // Fallback: positionCount was incremented by exactly one, so the new position's id
  // is positionCount - 1.
  const count = await contract.positionCount();
  return Number(count) - 1;
}
