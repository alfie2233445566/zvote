import { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import ElectionCountdown from "../components/ElectionCountdown.jsx";
import * as apiClient from "../api.js";
import { getImageUrl } from "../utils/imageUrl.js";

export default function Results() {
  const [data, setData] = useState(null);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load(selectedElectionId);
  }, [selectedElectionId]);

  async function load(electionId) {
    setLoading(true);
    setError("");
    try {
      const params = electionId ? { electionId } : {};
      const { data } = await apiClient.getResults(params);
      setData(data);
      if (!selectedElectionId && data?.election?.id) {
        setSelectedElectionId(data.election.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Results are not available yet.");
    } finally {
      setLoading(false);
    }
  }

  // Color palette for chart bars
  const CHART_COLORS = [
    "#2563eb", // Blue
    "#7c3aed", // Purple
    "#059669", // Emerald
    "#d97706", // Amber
    "#dc2626", // Red
    "#0891b2", // Cyan
    "#4f46e5", // Indigo
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header with Election Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-zvote-900">
                {data ? data.election.title : "Election Results & Turnout"}
              </h1>
              {data?.election?.scope && (
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {data.election.scope}
                  {data.election.targetDepartment ? ` — ${data.election.targetDepartment}` : ""}
                </span>
              )}
              {data && (
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    data.isClosed ? "bg-slate-800 text-white" : "bg-green-100 text-green-800"
                  }`}
                >
                  {data.isClosed ? "Election Closed (Official Results)" : "● Election Active (Live Turnout)"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              On-chain ballot records stored on Polygon Amoy &middot; Contract:{" "}
              <span className="font-mono">{data?.election?.contractAddress || "Deploying..."}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            {data?.allElections?.length > 1 && (
              <select
                value={selectedElectionId}
                onChange={(e) => setSelectedElectionId(e.target.value)}
                className="text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-zvote-500 shadow-sm"
              >
                {data.allElections.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.title} ({el.scope}{el.targetDepartment ? ` - ${el.targetDepartment}` : ""})
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => load(selectedElectionId)}
              className="text-xs font-semibold text-zvote-700 bg-white hover:bg-zvote-50 border border-zvote-300 px-3.5 py-2 rounded-md shadow-sm transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading && <p className="text-slate-500 text-sm">Loading election statistics...</p>}
        {!loading && error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">{error}</div>
        )}

        {!loading && data && (
          <>
            {/* Election Timing Schedule & Live Countdown */}
            {data.election && (
              <ElectionCountdown
                startTime={data.election.startTime}
                endTime={data.election.endTime}
                isClosed={data.isClosed}
              />
            )}

            {/* Real-time Turnout KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Eligible Voters</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data.totalVoters}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {data.election.scope === "DEPARTMENT" ? `${data.election.targetDepartment} students` : "All registered students"}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ballots Cast</p>
                <p className="text-2xl font-bold text-zvote-700 mt-1">{data.totalVotesCast}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {data.participatingVoters} voter(s) participated
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Turnout Rate</p>
                  <span className="text-xs font-bold text-zvote-600">{data.turnoutPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3">
                  <div
                    className="bg-zvote-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(data.turnoutPercent, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {data.isClosed ? "Final voter turnout" : "Live participation rate"}
                </p>
              </div>
            </div>

            {/* If Election is Active: Ballot Secrecy Notice */}
            {!data.isClosed && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-blue-900 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛡️</span>
                  <h3 className="font-bold text-sm">Ballot Secrecy in Effect</h3>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  To protect democratic fairness and eliminate bandwagon bias or voter coercion, individual candidate vote tallies are sealed while voting is in progress. Real-time turnout metrics are tracked above. Complete on-chain results and 50% + 1 victory breakdowns will be published once the election is officially closed.
                </p>
              </div>
            )}

            {/* Positions List / Results */}
            <div className="space-y-6">
              {data.positions.map((position) => {
                return (
                  <div
                    key={position.id}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">{position.title}</h2>
                        {data.isClosed && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Total Votes Cast: <strong>{position.totalVotes}</strong> &middot; Majority Threshold (50% + 1):{" "}
                            <strong>{position.majorityThreshold} vote(s)</strong>
                          </p>
                        )}
                      </div>

                      {/* Win Margin Outcome Badge (when closed) */}
                      {data.isClosed && (
                        <div>
                          {position.outcome === "WON_MAJORITY" && (
                            <span className="bg-green-100 text-green-900 border border-green-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                              <span>🏆</span> Winner Declared (50%+1 Met)
                            </span>
                          )}
                          {position.outcome === "RUNOFF_REQUIRED" && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                              <span>⚖️</span> Runoff Required (&lt;50%+1)
                            </span>
                          )}
                          {position.outcome === "REJECTED" && (
                            <span className="bg-red-100 text-red-900 border border-red-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                              <span>❌</span> Candidate Rejected (&lt;50%+1 Yes)
                            </span>
                          )}
                          {position.outcome === "TIE" && (
                            <span className="bg-purple-100 text-purple-900 border border-purple-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                              <span>🤝</span> Tie (Runoff Required)
                            </span>
                          )}
                          {position.outcome === "NO_VOTES" && (
                            <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full">
                              No Votes Cast
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Outcome Detail Explanatory Box (when closed) */}
                    {data.isClosed && (
                      <div
                        className={`rounded-lg p-3.5 text-xs ${
                          position.outcome === "WON_MAJORITY"
                            ? "bg-green-50/80 border border-green-200 text-green-900"
                            : position.outcome === "REJECTED"
                            ? "bg-red-50/80 border border-red-200 text-red-900"
                            : position.outcome === "RUNOFF_REQUIRED"
                            ? "bg-amber-50/80 border border-amber-200 text-amber-900"
                            : position.outcome === "TIE"
                            ? "bg-purple-50/80 border border-purple-200 text-purple-900"
                            : "bg-slate-50 border border-slate-200 text-slate-700"
                        }`}
                      >
                        <p className="font-semibold">{position.statusText}</p>
                        {position.outcome === "RUNOFF_REQUIRED" && (
                          <p className="text-[11px] mt-1 opacity-90">
                            Under the 50% + 1 constitution rule, an elected candidate must secure more than half of all valid votes cast ({position.majorityThreshold} votes). A runoff election between the top candidates is required to determine the winner.
                          </p>
                        )}
                        {position.outcome === "REJECTED" && (
                          <p className="text-[11px] mt-1 opacity-90">
                            The unopposed candidate failed to secure the required 50% + 1 YES majority threshold ({position.majorityThreshold} votes needed). The candidate is not confirmed.
                          </p>
                        )}
                      </div>
                    )}

                    {/* If Active: Show neutral candidate cards without vote counts */}
                    {!data.isClosed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {position.candidates.map((candidate) => (
                          <div
                            key={candidate.id}
                            className="border border-slate-200 rounded-lg p-4 flex items-center gap-3.5 bg-slate-50/50"
                          >
                            {candidate.pictureUrl ? (
                              <img
                                src={getImageUrl(candidate.pictureUrl)}
                                alt={candidate.name}
                                className="w-12 h-12 rounded-full object-cover border border-slate-200 flex-shrink-0"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
                                {candidate.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-slate-800 text-sm truncate">{candidate.name}</h4>
                              <p className="text-xs text-slate-500 truncate">{candidate.programme || "Candidate"}</p>
                              {candidate.bio && (
                                <p className="text-[11px] text-slate-400 italic mt-0.5 line-clamp-1">{candidate.bio}</p>
                              )}
                            </div>
                            <span className="text-[10px] bg-slate-200/80 text-slate-700 font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                              🔒 Ballot Sealed
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* If Closed: Render Interactive Results & SVG Charts */}
                    {data.isClosed && (
                      <div className="space-y-6">
                        {/* CSS / SVG Visual Distribution Bar Chart */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            Vote Distribution Chart
                          </h4>
                          <div className="space-y-3.5">
                            {position.candidates.map((candidate, idx) => {
                              const barColor = CHART_COLORS[idx % CHART_COLORS.length];
                              const isWinner = position.winner?.id === candidate.id;

                              return (
                                <div key={candidate.id} className="space-y-1.5">
                                  <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: barColor }}
                                      />
                                      <span className={`font-semibold ${isWinner ? "text-green-900" : "text-slate-800"}`}>
                                        {candidate.name}
                                        {isWinner && " 🏆 (Winner)"}
                                      </span>
                                    </div>
                                    <span className="font-mono text-slate-600">
                                      <strong>{candidate.voteCount}</strong> vote(s) &middot; {candidate.pct}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-3.5 relative overflow-hidden border border-slate-200/60">
                                    {/* 50% majority threshold indicator mark */}
                                    <div
                                      className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 opacity-70"
                                      style={{ left: "50%" }}
                                      title="50% Majority Threshold"
                                    />
                                    <div
                                      className="h-full rounded-full transition-all duration-700"
                                      style={{
                                        width: `${candidate.pct}%`,
                                        backgroundColor: barColor,
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 pt-1 font-mono">
                            <span>0%</span>
                            <span className="text-red-500 font-semibold">| 50% Majority Line</span>
                            <span>100%</span>
                          </div>
                        </div>

                        {/* Detailed Candidate Cards Table */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2.5">Candidate</th>
                                <th className="px-3 py-2.5">Program</th>
                                <th className="px-3 py-2.5 text-right">Votes</th>
                                <th className="px-3 py-2.5 text-right">Share</th>
                                <th className="px-3 py-2.5 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {position.candidates.map((candidate, idx) => {
                                const isWinner = position.winner?.id === candidate.id;
                                return (
                                  <tr
                                    key={candidate.id}
                                    className={`hover:bg-slate-50/80 ${isWinner ? "bg-green-50/40" : ""}`}
                                  >
                                    <td className="px-3 py-2.5 flex items-center gap-2">
                                      {candidate.pictureUrl ? (
                                        <img
                                          src={getImageUrl(candidate.pictureUrl)}
                                          alt={candidate.name}
                                          className="w-7 h-7 rounded-full object-cover border border-slate-200 flex-shrink-0"
                                          onError={(e) => {
                                            e.target.style.display = "none";
                                          }}
                                        />
                                      ) : (
                                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                                          {candidate.name.charAt(0)}
                                        </div>
                                      )}
                                      <span className="font-semibold text-slate-900">{candidate.name}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-600">{candidate.programme || "N/A"}</td>
                                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                                      {candidate.voteCount}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                                      {candidate.pct}%
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                      {isWinner ? (
                                        <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                          Elected
                                        </span>
                                      ) : idx === 0 && position.outcome === "RUNOFF_REQUIRED" ? (
                                        <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                          Runoff Contender
                                        </span>
                                      ) : idx === 1 && position.outcome === "RUNOFF_REQUIRED" ? (
                                        <span className="bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                          Runoff Contender
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 text-[10px]">&mdash;</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
