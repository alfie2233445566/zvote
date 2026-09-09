import { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import ElectionCard from "../components/ElectionCard.jsx";
import ElectionCountdown from "../components/ElectionCountdown.jsx";
import * as apiClient from "../api.js";

export default function StudentDashboard() {
  const [activeElections, setActiveElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState(null);
  const [election, setElection] = useState(null);
  const [votedMap, setVotedMap] = useState({}); // positionId -> txHash
  const [loading, setLoading] = useState(true);
  const [loadingBallot, setLoadingBallot] = useState(false);
  const [error, setError] = useState("");
  const [isElectionExpired, setIsElectionExpired] = useState(false);

  useEffect(() => {
    loadActiveElections();
  }, []);

  async function loadActiveElections() {
    setLoading(true);
    setError("");
    try {
      const { data } = await apiClient.getElections({ status: "ACTIVE" });
      setActiveElections(data.elections || []);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load active elections.");
    } finally {
      setLoading(false);
    }
  }

  async function selectElection(electionId) {
    setSelectedElectionId(electionId);
    setLoadingBallot(true);
    setError("");
    setIsElectionExpired(false);
    try {
      const [candidatesRes, statusRes] = await Promise.all([
        apiClient.getCandidates({ electionId }),
        apiClient.getVoteStatus({ electionId }),
      ]);

      const el = candidatesRes.data.election;
      setElection(el);
      if (el?.endTime && Date.now() >= new Date(el.endTime).getTime()) {
        setIsElectionExpired(true);
      }

      const map = {};
      for (const receipt of statusRes.data.receipts || []) {
        map[receipt.positionId] = receipt.txHash;
      }
      setVotedMap(map);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load the ballot.");
    } finally {
      setLoadingBallot(false);
    }
  }

  function handleVoted(positionId, txHash) {
    setVotedMap((prev) => ({ ...prev, [positionId]: txHash }));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {loading && <p className="text-slate-500">Loading active elections...</p>}

        {!loading && !selectedElectionId && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-zvote-900">Active Elections</h1>
              <p className="text-sm text-slate-500 mt-1">
                Select an election below to view the election window, countdown clock, and cast your vote.
              </p>
            </div>

            {error && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">{error}</div>
            )}

            {activeElections.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <p className="text-slate-500 italic">No active elections currently match your profile/department.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {activeElections.map((el) => {
                  const isExpired = el.endTime && Date.now() >= new Date(el.endTime).getTime();
                  return (
                    <button
                      key={el.id}
                      onClick={() => selectElection(el.id)}
                      className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 text-left hover:border-zvote-500 hover:ring-1 hover:ring-zvote-500 transition duration-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group w-full"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-800 group-hover:text-zvote-700 text-base">
                            {el.title}
                          </h3>
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            {el.scope}
                          </span>
                          {el.scope === "DEPARTMENT" && (
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                              {el.targetDepartment}
                            </span>
                          )}
                          {isExpired && (
                            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Closing time passed
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 font-mono">
                          <span>🟢 Start: {el.startTime ? new Date(el.startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "N/A"}</span>
                          <span>🔴 Closes: {el.endTime ? new Date(el.endTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "N/A"}</span>
                        </div>
                      </div>

                      <span className="text-zvote-600 font-medium text-sm group-hover:translate-x-1 transition-transform flex-shrink-0">
                        Open Ballot &rarr;
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedElectionId && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  setSelectedElectionId(null);
                  setElection(null);
                  loadActiveElections();
                }}
                className="text-sm font-medium text-zvote-700 hover:underline flex items-center gap-1"
              >
                &larr; Back to Elections list
              </button>
            </div>

            {loadingBallot ? (
              <p className="text-slate-500">Loading ballot...</p>
            ) : (
              <>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-zvote-900">
                      {election ? election.title : "Cast Your Vote"}
                    </h1>
                    {election?.scope && (
                      <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {election.scope}
                        {election.targetDepartment ? ` — ${election.targetDepartment}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Select one candidate per position. Each vote is submitted directly to the blockchain and
                    cannot be changed once confirmed.
                  </p>
                </div>

                {/* Real-time Countdown Timer & Timing Banner */}
                {election && (
                  <ElectionCountdown
                    startTime={election.startTime}
                    endTime={election.endTime}
                    isClosed={isElectionExpired}
                    onExpired={() => setIsElectionExpired(true)}
                  />
                )}

                {error && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">{error}</div>
                )}

                {election &&
                  election.positions.map((position) => (
                    <ElectionCard
                      key={position.id}
                      position={position}
                      alreadyVoted={Boolean(votedMap[position.id])}
                      existingTxHash={votedMap[position.id]}
                      isClosed={isElectionExpired}
                      onVoted={handleVoted}
                    />
                  ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
