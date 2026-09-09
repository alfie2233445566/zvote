import "dotenv/config";
import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

// ZVote blockchain layer -- Hardhat 3 configuration.
//
// Networks:
//  - hardhatMainnet: in-process simulated chain, used by `npx hardhat test`.
//  - localhost: a persistent local JSON-RPC node started with `npx hardhat node`,
//    used for full end-to-end testing against the backend/frontend without spending
//    real (or testnet) funds.
//  - amoy: Polygon's public Amoy PoS testnet, used for the deployed testnet demo
//    referenced in the project brief (Chapter Three describes the target platform as
//    Polygon CDK; Amoy is used here in place of a self-hosted CDK chain purely for
//    testing purposes, since it is free, public, and requires no infrastructure to
//    stand up).
export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],

  solidity: {
    profiles: {
      default: {
        version: "0.8.19",
      },
      production: {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },

  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },

    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },

    amoy: {
      type: "http",
      chainType: "l1",
      url: process.env.AMOY_RPC_URL || "https://polygon-amoy.drpc.org",
      accounts: [
        process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66 && process.env.PRIVATE_KEY.startsWith("0x")
          ? process.env.PRIVATE_KEY
          : "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      ],
      chainId: 80002,
    },
  },
});
