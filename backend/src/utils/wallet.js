import { Wallet } from "ethers";

/**
 * Generates a fresh Ethereum-style address to represent a voter on-chain.
 *
 * Voters never hold a wallet or sign a transaction themselves (see Project Prompt:
 * "No MetaMask required for voters"). Their address exists purely so the smart
 * contract's hasVoted(address, positionId) mapping has a stable, unique key per voter.
 * We therefore only need a valid, collision-resistant address -- the corresponding
 * private key is never stored or used, since the election authority wallet (held by
 * the backend) is what actually signs every on-chain transaction.
 *
 * @returns {string} A checksummed Ethereum address.
 */
export function generateVoterAddress() {
  const wallet = Wallet.createRandom();
  return wallet.address;
}
