import { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import * as apiClient from "../api.js";

export default function VoteVerification() {
  const { user } = useAuth();
  const [txHash, setTxHash] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [myVotes, setMyVotes] = useState([]);
  const [loadingVotes, setLoadingVotes] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMyVotes();
    }
  }, [user]);

  async function fetchMyVotes() {
    setLoadingVotes(true);
    try {
      const { data } = await apiClient.getMyVotes();
      setMyVotes(data.votes || []);
    } catch (err) {
      console.error("Failed to load personal votes:", err);
    } finally {
      setLoadingVotes(false);
    }
  }

  async function handleSearch(e) {
    if (e) e.preventDefault();
    if (!txHash.trim()) return;

    setLoading(true);
    setError("");
    setSearchResult(null);

    try {
      const { data } = await apiClient.verifyTransaction(txHash.trim());
      setSearchResult(data);
    } catch (err) {
      setError(err.response?.data?.error || "Transaction not found or error fetching details.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectTx(hash) {
    setTxHash(hash);
    // Trigger search immediately after updating state
    setTimeout(() => {
      const searchButton = document.getElementById("search-submit-btn");
      if (searchButton) searchButton.click();
    }, 50);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h1 className="text-2xl font-bold text-slate-900">Audit &amp; Vote Verification</h1>
            <p className="text-slate-500 text-sm">
              ZVote is backed by the Polygon blockchain. Every vote cast produces a cryptographic receipt. 
              Enter a transaction hash below to verify its status and block details live from the chain.
            </p>

            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                required
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Enter transaction hash (0x...)"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zvote-500 font-mono"
              />
              <button
                id="search-submit-btn"
                type="submit"
                disabled={loading}
                className="bg-zvote-600 hover:bg-zvote-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-md transition-colors"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </form>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          </div>

          {searchResult && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h2 className="font-semibold text-slate-800 text-lg">Blockchain Transaction Details</h2>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${
                    searchResult.status === "success"
                      ? "bg-green-100 text-green-800"
                      : searchResult.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {searchResult.status}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-y-3 text-sm">
                <div>
                  <span className="block text-slate-500 font-medium">Transaction Hash</span>
                  <span className="font-mono break-all text-slate-800">{searchResult.txHash}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-slate-500 font-medium">Contract Address</span>
                    <span className="font-mono break-all text-slate-800">{searchResult.contractAddress}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-medium">From (Authority Wallet)</span>
                    <span className="font-mono break-all text-slate-800">{searchResult.from}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <span className="block text-slate-500 font-medium">Block Number</span>
                    <span className="text-slate-800">{searchResult.blockNumber || "Pending"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-medium">Block Confirmations</span>
                    <span className="text-slate-800 font-semibold">{searchResult.confirmations}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-medium">Timestamp</span>
                    <span className="text-slate-800">
                      {searchResult.timestamp
                        ? new Date(searchResult.timestamp * 1000).toLocaleString()
                        : "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                <a
                  href={searchResult.polygonscanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-sm font-semibold text-zvote-600 hover:text-zvote-800 hover:underline"
                >
                  View on Polygonscan Amoy Explorer
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Your Vote Receipts</h3>
            {!user ? (
              <p className="text-slate-500 text-xs">
                Log in to see a list of your past vote transaction hashes here.
              </p>
            ) : loadingVotes ? (
              <p className="text-slate-500 text-xs">Loading past votes...</p>
            ) : myVotes.length === 0 ? (
              <p className="text-slate-500 text-xs">You haven't cast any votes yet in this system.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {myVotes.map((vote) => (
                  <button
                    key={vote.id}
                    onClick={() => handleSelectTx(vote.txHash)}
                    className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-zvote-300 hover:bg-zvote-50 transition-all space-y-1 block focus:outline-none"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-slate-700 truncate block max-w-[140px]">
                        {vote.positionTitle}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(vote.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 truncate block">
                      {vote.txHash}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
