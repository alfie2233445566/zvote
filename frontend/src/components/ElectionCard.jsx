import { useState } from "react";
import VoteButton from "./VoteButton.jsx";
import * as apiClient from "../api.js";
import { getImageUrl } from "../utils/imageUrl.js";

// Polygon Amoy block explorer, used for the "Verify on Polygonscan" link.
const AMOY_EXPLORER_TX_URL = "https://amoy.polygonscan.com/tx/";

/**
 * Renders a single position (e.g. "SRC President") with its candidates as
 * selectable options, a submit button, and -- once voted -- a confirmation with a
 * link to verify the transaction on Polygonscan.
 */
export default function ElectionCard({ position, alreadyVoted, existingTxHash, isClosed, onVoted }) {
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState(existingTxHash || null);

  const hasVoted = alreadyVoted || Boolean(txHash);

  async function handleSubmit() {
    if (!selectedCandidateId || isClosed) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await apiClient.castVote(position.id, selectedCandidateId);
      setTxHash(data.txHash);
      onVoted?.(position.id, data.txHash);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit your vote. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Check if position is an unopposed YES / NO referendum
  const isYesNo = position.candidates.some((c) => c.name === "NO / REJECT");
  const yesCandidate = position.candidates.find((c) => c.name !== "NO / REJECT") || position.candidates[0];
  const noCandidate = position.candidates.find((c) => c.name === "NO / REJECT");

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zvote-900">{position.title}</h2>
          {isYesNo && (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-block mt-1">
              Unopposed Candidate — YES / NO Approval Vote
            </span>
          )}
        </div>
      </div>

      {hasVoted ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <p className="text-green-800 font-medium">✓ Your vote for this position has been recorded on-chain.</p>
          {txHash && (
            <a
              href={`${AMOY_EXPLORER_TX_URL}${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-zvote-700 underline hover:text-zvote-900"
            >
              Verify on Polygonscan &rarr;
            </a>
          )}
        </div>
      ) : isYesNo ? (
        // Unopposed Candidate: YES / NO Referendum Layout
        <div className="space-y-4">
          {/* Candidate Profile Card */}
          <div className="border border-slate-200 rounded-lg p-4 flex items-center gap-4 bg-slate-50">
            {yesCandidate.pictureUrl ? (
              <img
                src={getImageUrl(yesCandidate.pictureUrl)}
                alt={yesCandidate.name}
                className="w-14 h-14 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-zvote-100 text-zvote-800 flex items-center justify-center font-bold text-lg flex-shrink-0 border border-zvote-200">
                {yesCandidate.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-base truncate">{yesCandidate.name}</h3>
              <p className="text-xs text-slate-600 truncate">{yesCandidate.programme || "Candidate"}</p>
              {yesCandidate.bio && <p className="text-xs text-slate-500 italic mt-0.5">{yesCandidate.bio}</p>}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Do you approve <strong>{yesCandidate.name}</strong> for <strong>{position.title}</strong>? Candidate must receive <strong>50% + 1 YES votes</strong> to be elected.
          </p>

          {/* YES / NO Selection Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setSelectedCandidateId(yesCandidate.id)}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                selectedCandidateId === yesCandidate.id
                  ? "border-green-600 bg-green-50/80 text-green-900 shadow-sm ring-2 ring-green-500/20"
                  : "border-slate-200 hover:border-green-400 bg-white text-slate-700"
              }`}
            >
              <div className="text-2xl mb-1">👍</div>
              <div className="font-bold text-sm">YES</div>
              <div className="text-[11px] opacity-80">Vote in Favor</div>
            </button>

            {noCandidate && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => setSelectedCandidateId(noCandidate.id)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  selectedCandidateId === noCandidate.id
                    ? "border-red-600 bg-red-50/80 text-red-900 shadow-sm ring-2 ring-red-500/20"
                    : "border-slate-200 hover:border-red-400 bg-white text-slate-700"
                }`}
              >
                <div className="text-2xl mb-1">👎</div>
                <div className="font-bold text-sm">NO</div>
                <div className="text-[11px] opacity-80">Reject Candidate</div>
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          {isClosed && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 font-medium">
              🔒 Voting for this election is now closed. Submissions are no longer accepted.
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedCandidateId || submitting || isClosed}
            className="w-full bg-zvote-600 hover:bg-zvote-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-md transition-colors"
          >
            {isClosed
              ? "Election Closed"
              : submitting
              ? "Submitting vote to blockchain..."
              : "Confirm & Submit Choice"}
          </button>
        </div>
      ) : (
        // Standard Multi-Candidate Position Ballot
        <>
          <div className="space-y-2">
            {position.candidates.map((candidate) => (
              <VoteButton
                key={candidate.id}
                selected={selectedCandidateId === candidate.id}
                disabled={submitting || isClosed}
                onClick={() => !isClosed && setSelectedCandidateId(candidate.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {candidate.pictureUrl ? (
                      <img
                        src={getImageUrl(candidate.pictureUrl)}
                        alt={candidate.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 font-semibold text-sm">
                        {candidate.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-slate-900">{candidate.name}</p>
                      <p className="text-sm text-slate-500">{candidate.programme}</p>
                      {candidate.bio && <p className="text-xs text-slate-400 mt-0.5">{candidate.bio}</p>}
                    </div>
                  </div>
                  <span
                    className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                      selectedCandidateId === candidate.id ? "border-zvote-600 bg-zvote-600" : "border-slate-300"
                    }`}
                  />
                </div>
              </VoteButton>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          {isClosed && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 font-medium">
              🔒 Voting for this election is now closed. Submissions are no longer accepted.
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedCandidateId || submitting || isClosed}
            className="w-full bg-zvote-600 hover:bg-zvote-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-md transition-colors"
          >
            {isClosed
              ? "Election Closed"
              : submitting
              ? "Submitting vote to the blockchain..."
              : "Submit Vote"}
          </button>
        </>
      )}
    </div>
  );
}
