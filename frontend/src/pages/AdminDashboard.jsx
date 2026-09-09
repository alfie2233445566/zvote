import { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import * as apiClient from "../api.js";
import { getImageUrl } from "../utils/imageUrl.js";

const TABS = ["Create Election", "Register Voters", "Participation", "Close Election", "Registered Students", "Admin Profile"];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState(TABS[0]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>

        <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-zvote-600 text-zvote-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Create Election" && <CreateElectionPanel />}
        {activeTab === "Register Voters" && <RegisterVotersPanel />}
        {activeTab === "Participation" && <ParticipationPanel />}
        {activeTab === "Close Election" && <CloseElectionPanel />}
        {activeTab === "Registered Students" && <RegisteredStudentsPanel />}
        {activeTab === "Admin Profile" && <AdminProfilePanel />}
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Create Election
// -----------------------------------------------------------------------------

function emptyCandidate() {
  return { name: "", studentId: "", programme: "", pictureUrl: "", bio: "" };
}

function emptyPosition() {
  return { title: "", candidates: [emptyCandidate()] };
}

function CreateElectionPanel() {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [scope, setScope] = useState("SCHOOL_WIDE");
  const [targetDepartment, setTargetDepartment] = useState("");
  const [positions, setPositions] = useState([emptyPosition()]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [studentsRes, deptRes] = await Promise.all([
        apiClient.getStudents({}),
        apiClient.getDepartments(),
      ]);
      setStudents(studentsRes.data.students || []);
      setDepartments(deptRes.data.departments || []);
    } catch (err) {
      console.error("Failed to load election creation data:", err);
    }
  }

  function updatePosition(index, field, value) {
    setPositions((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function updateCandidate(posIndex, candIndex, field, value) {
    setPositions((prev) =>
      prev.map((p, i) =>
        i !== posIndex
          ? p
          : {
              ...p,
              candidates: p.candidates.map((c, j) => (j === candIndex ? { ...c, [field]: value } : c)),
            },
      ),
    );
  }

  function addPosition() {
    setPositions((prev) => [...prev, emptyPosition()]);
  }

  function removePosition(index) {
    setPositions((prev) => prev.filter((_, i) => i !== index));
  }

  function addCandidate(posIndex) {
    setPositions((prev) =>
      prev.map((p, i) => (i === posIndex ? { ...p, candidates: [...p.candidates, emptyCandidate()] } : p)),
    );
  }

  function removeCandidate(posIndex, candIndex) {
    setPositions((prev) =>
      prev.map((p, i) =>
        i === posIndex ? { ...p, candidates: p.candidates.filter((_, j) => j !== candIndex) } : p,
      ),
    );
  }

  async function handleCandidateImageUpload(posIndex, candIndex, file) {
    if (!file) return;
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB restriction
    if (file.size > MAX_SIZE) {
      alert("Image size exceeds 2MB limit! Please choose a file smaller than 2MB.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      alert("Please select a valid image file (JPEG, PNG, WebP, or GIF).");
      return;
    }

    const uploadKey = `${posIndex}-${candIndex}`;
    setUploadingImage(uploadKey);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await apiClient.uploadImage(formData);
      if (res.data?.pictureUrl) {
        updateCandidate(posIndex, candIndex, "pictureUrl", res.data.pictureUrl);
      }
    } catch (err) {
      console.error("Candidate image upload failed:", err);
      alert(err.response?.data?.error || "Failed to upload candidate image.");
    } finally {
      setUploadingImage(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    // 1. Client-Side Candidate Exclusivity Validation
    const candidateMap = new Map();
    for (let pIdx = 0; pIdx < positions.length; pIdx++) {
      const p = positions[pIdx];
      for (let cIdx = 0; cIdx < p.candidates.length; cIdx++) {
        const c = p.candidates[cIdx];
        if (!c.studentId) continue;
        const sid = c.studentId.trim().toUpperCase();
        if (candidateMap.has(sid)) {
          const prior = candidateMap.get(sid);
          setMessage({
            type: "error",
            text: `Duplicate Candidate: Student ${c.studentId} (${c.name || "Candidate"}) is already running for "${prior}". A candidate cannot contest for more than one position in the same election.`,
          });
          setSubmitting(false);
          return;
        }
        candidateMap.set(sid, p.title || `Position ${pIdx + 1}`);
      }
    }

    try {
      await apiClient.createElection({
        title,
        startTime,
        endTime,
        positions,
        scope,
        targetDepartment: scope === "DEPARTMENT" ? targetDepartment : null,
      });
      setMessage({ type: "success", text: "Election created and activated on-chain. Voting is now open." });
      setTitle("");
      setStartTime("");
      setEndTime("");
      setScope("SCHOOL_WIDE");
      setTargetDepartment("");
      setPositions([emptyPosition()]);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || "Failed to create election." });
    } finally {
      setSubmitting(false);
    }
  }

  // Build a lookup map of all candidates already selected across all positions
  const candidateAssignmentMap = new Map(); // studentId -> position title
  positions.forEach((pos, pIdx) => {
    pos.candidates.forEach((c) => {
      if (c.studentId) {
        candidateAssignmentMap.set(c.studentId.toUpperCase(), {
          posIndex: pIdx,
          posTitle: pos.title || `Position ${pIdx + 1}`,
        });
      }
    });
  });

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <p className="text-sm text-slate-500">
        Creating an election deploys its positions and candidates on-chain and immediately opens voting.
        This may take a moment as each position/candidate is a separate blockchain transaction.
      </p>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Election Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
          placeholder="2026/2027 SRC Election"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Scope</label>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              if (e.target.value === "SCHOOL_WIDE") {
                setTargetDepartment("");
              }
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 bg-white"
          >
            <option value="SCHOOL_WIDE">School Wide (SRC General)</option>
            <option value="DEPARTMENT">Department-Level</option>
          </select>
        </div>
        {scope === "DEPARTMENT" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target Department</label>
            {departments.length > 0 ? (
              <select
                required
                value={targetDepartment}
                onChange={(e) => {
                  setTargetDepartment(e.target.value);
                  // Reset selected candidates to ensure department compliance
                  setPositions((prev) =>
                    prev.map((p) => ({
                      ...p,
                      candidates: p.candidates.map((c) => ({
                        ...c,
                        studentId: "",
                        name: "",
                        programme: "",
                      })),
                    })),
                  );
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 bg-white"
              >
                <option value="">Select Department...</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                value={targetDepartment}
                onChange={(e) => setTargetDepartment(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
                placeholder="e.g. Computer Science"
              />
            )}
            {departments.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Tip: Upload student CSV first to automatically populate department choices.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
          <input
            required
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
          <input
            required
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Positions &amp; Candidates</h3>
          <span className="text-xs text-slate-500">
            A student can only run for 1 position per election
          </span>
        </div>

        {positions.map((position, posIndex) => {
          const isUnopposed = position.candidates.length === 1;

          return (
            <div key={posIndex} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
              <div className="flex gap-2 items-center">
                <input
                  required
                  value={position.title}
                  onChange={(e) => updatePosition(posIndex, "title", e.target.value)}
                  placeholder="Position title (e.g. SRC President, Department President)"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
                />
                {positions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePosition(posIndex)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove position
                  </button>
                )}
              </div>

              {/* Single candidate Yes/No guidance banner */}
              {isUnopposed && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs text-amber-900 flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>
                    <strong>Unopposed Position (YES / NO Referendum):</strong> Because this position has 1 candidate, voters will vote <strong>YES (Approve)</strong> or <strong>NO (Reject)</strong>. The candidate must obtain <strong>50% + 1 YES votes</strong> to win.
                  </span>
                </div>
              )}

              <div className="space-y-3 pl-2 border-l-2 border-slate-100">
                {(() => {
                  const eligibleStudents =
                    scope === "DEPARTMENT" && targetDepartment.trim()
                      ? students.filter(
                          (s) =>
                            (s.department || "").trim().toLowerCase() === targetDepartment.trim().toLowerCase(),
                        )
                      : students;

                  return position.candidates.map((candidate, candIndex) => (
                    <div key={candIndex} className="border border-slate-150 rounded-md p-3 space-y-2 bg-slate-50/50">
                      <div className="flex gap-2 items-center">
                        <select
                          required
                          value={candidate.studentId}
                          onChange={(e) => {
                            const student = eligibleStudents.find((s) => s.studentId === e.target.value);
                            if (student) {
                              updateCandidate(posIndex, candIndex, "studentId", student.studentId);
                              updateCandidate(posIndex, candIndex, "name", student.fullName);
                              updateCandidate(posIndex, candIndex, "programme", student.program || "");
                            } else {
                              updateCandidate(posIndex, candIndex, "studentId", "");
                              updateCandidate(posIndex, candIndex, "name", "");
                              updateCandidate(posIndex, candIndex, "programme", "");
                            }
                          }}
                          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zvote-500 bg-white"
                        >
                          <option value="">
                            {scope === "DEPARTMENT" && !targetDepartment
                              ? "Please select a Target Department above first..."
                              : eligibleStudents.length === 0
                              ? `No students found in ${targetDepartment || "department"}`
                              : "Select Candidate (Student)..."}
                          </option>
                          {eligibleStudents.map((s) => {
                            const assignedInfo = candidateAssignmentMap.get(s.studentId.toUpperCase());
                            const isAssignedElsewhere = assignedInfo && assignedInfo.posIndex !== posIndex;

                            return (
                              <option
                                key={s.id}
                                value={s.studentId}
                                disabled={isAssignedElsewhere}
                              >
                                {s.fullName} ({s.studentId}) — {s.department || "No Dept"} ({s.program || "General"})
                                {isAssignedElsewhere ? ` [Already running for: ${assignedInfo.posTitle}]` : ""}
                              </option>
                            );
                          })}
                        </select>
                        {position.candidates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCandidate(posIndex, candIndex)}
                            className="text-xs text-red-600 hover:underline px-2"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex gap-2 items-center">
                            <input
                              required
                              type="text"
                              value={candidate.pictureUrl}
                              onChange={(e) => updateCandidate(posIndex, candIndex, "pictureUrl", e.target.value)}
                              placeholder="Candidate Picture URL"
                              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zvote-500 bg-white"
                            />
                            {candidate.pictureUrl && (
                              <img
                                src={getImageUrl(candidate.pictureUrl)}
                                alt="Preview"
                                className="w-8 h-8 rounded-full object-cover border border-slate-300 shadow-sm flex-shrink-0"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                              />
                            )}
                          </div>
                          <input
                            type="text"
                            value={candidate.bio}
                            onChange={(e) => updateCandidate(posIndex, candIndex, "bio", e.target.value)}
                            placeholder="Candidate Short Bio"
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zvote-500 bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-medium transition-colors">
                            <span>📁 Upload Image File (Max 2MB)</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleCandidateImageUpload(posIndex, candIndex, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                          {uploadingImage === `${posIndex}-${candIndex}` && (
                            <span className="text-zvote-600 font-medium animate-pulse">Uploading to server...</span>
                          )}
                          <span className="text-slate-400">JPEG, PNG, WebP up to 2MB (Saved to backend)</span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
                <button
                  type="button"
                  onClick={() => addCandidate(posIndex)}
                  className="text-xs font-medium text-zvote-700 hover:underline"
                >
                  + Add another candidate
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addPosition}
          className="text-sm font-medium text-zvote-700 border border-zvote-300 hover:bg-zvote-50 rounded-md px-3 py-1.5"
        >
          + Add another position
        </button>
      </div>

      {message && (
        <p
          className={`text-sm rounded-md px-3 py-2 ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-zvote-600 hover:bg-zvote-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-md transition-colors"
      >
        {submitting ? "Deploying to blockchain..." : "Create & Open Election"}
      </button>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Register Voters
// -----------------------------------------------------------------------------

function RegisterVotersPanel() {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [error, setError] = useState("");
  const [deleteStatus, setDeleteStatus] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    setSubmitting(true);
    setError("");
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.bulkRegister(formData);
      setBulkResult(data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to register voters.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm("Are you absolutely sure you want to delete all registered students/voters from the database? This action cannot be undone.")) {
      return;
    }
    try {
      const { data } = await apiClient.deleteAllVoters();
      setDeleteStatus({ type: "success", text: data.message });
      setBulkResult(null);
    } catch (err) {
      setDeleteStatus({ type: "error", text: err.response?.data?.error || "Failed to delete voters." });
    }
  }

  function downloadCredentialsCsv() {
    if (!bulkResult?.createdUsers || bulkResult.createdUsers.length === 0) return;

    const headers = ["Full Name", "Student ID", "Email", "Department", "Program", "Level", "Temporary Password"];
    const rows = bulkResult.createdUsers.map((u) => [
      `"${u.fullName.replace(/"/g, '""')}"`,
      `"${u.studentId}"`,
      `"${u.email}"`,
      `"${u.department || ""}"`,
      `"${u.program || ""}"`,
      `"${u.level || ""}"`,
      `"${u.temporaryPassword}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `zvote_registered_students_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function copyPassword(studentId, pwd) {
    navigator.clipboard.writeText(pwd);
    setCopiedId(studentId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Upload Voter Spreadsheet (.xlsx or .csv)
          </label>
          <input
            type="file"
            accept=".xlsx,.csv,.xls"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-zvote-50 file:text-zvote-700 hover:file:bg-zvote-100"
          />
          <p className="text-xs text-slate-500 mt-1">
            Spreadsheet must contain headers: <strong>fullName</strong>, <strong>indexNumber</strong>, <strong>email</strong>, <strong>program</strong>, <strong>department</strong>, <strong>level</strong>
          </p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

        {bulkResult && (
          <div className="space-y-4">
            <div className="text-sm bg-green-50 border border-green-200 rounded-md p-4 text-green-900 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-base">
                    ✓ Registered {bulkResult.created} student(s) successfully!
                  </p>
                  <p className="text-xs text-green-800 mt-0.5">
                    {bulkResult.emailStatus === "all_sent"
                      ? "Emails with temporary passwords have been dispatched to all students."
                      : bulkResult.emailStatus === "partially_sent"
                      ? `Sent ${bulkResult.emailsSent} out of ${bulkResult.created} emails.`
                      : bulkResult.emailStatus === "smtp_not_configured"
                      ? "SMTP email is not configured in .env. Student accounts are active with temporary passwords displayed below for testing."
                      : "Email delivery via SMTP failed. Student accounts are active with temporary passwords displayed below."}
                  </p>
                </div>
                {bulkResult.createdUsers?.length > 0 && (
                  <button
                    type="button"
                    onClick={downloadCredentialsCsv}
                    className="bg-green-700 hover:bg-green-800 text-white text-xs font-semibold py-1.5 px-3 rounded-md transition-colors shadow-sm"
                  >
                    📥 Download Credentials (CSV)
                  </button>
                )}
              </div>

              {bulkResult.rejected?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="font-semibold text-red-800 text-xs">Rejected rows ({bulkResult.rejected.length}):</p>
                  <ul className="mt-1 list-disc list-inside text-xs text-red-700 max-h-32 overflow-y-auto space-y-0.5">
                    {bulkResult.rejected.map((r, i) => (
                      <li key={i}>
                        Row {r.rowNumber} ({r.studentId}): {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Generated Accounts Credentials Table for Testing */}
            {bulkResult.createdUsers?.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Newly Created Accounts ({bulkResult.createdUsers.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Use these temporary credentials to log in and test voting
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Student ID</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Department</th>
                        <th className="px-3 py-2">Temp Password</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {bulkResult.createdUsers.map((u) => (
                        <tr key={u.studentId} className="hover:bg-slate-50 text-slate-700">
                          <td className="px-3 py-2 font-sans font-medium text-slate-900">{u.fullName}</td>
                          <td className="px-3 py-2">{u.studentId}</td>
                          <td className="px-3 py-2 font-sans">{u.email}</td>
                          <td className="px-3 py-2 font-sans">{u.department}</td>
                          <td className="px-3 py-2 bg-slate-50/80 font-bold text-zvote-700">{u.temporaryPassword}</td>
                          <td className="px-3 py-2 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => copyPassword(u.studentId, u.temporaryPassword)}
                              className="text-xs text-zvote-600 hover:text-zvote-800 font-medium"
                            >
                              {copiedId === u.studentId ? "✓ Copied" : "Copy"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-zvote-600 hover:bg-zvote-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-md transition-colors"
        >
          {submitting ? "Processing Spreadsheet & Creating Accounts..." : "Register Voters"}
        </button>
      </form>

      <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6 space-y-4">
        <div>
          <h3 className="text-red-900 font-semibold text-sm">Danger Zone</h3>
          <p className="text-xs text-red-700 mt-1">
            Clear all registered voter accounts from the database to enable uploading a clean custom spreadsheet.
          </p>
        </div>
        
        {deleteStatus && (
          <p
            className={`text-sm rounded-md px-3 py-2 ${
              deleteStatus.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-150 text-red-700 border border-red-200"
            }`}
          >
            {deleteStatus.text}
          </p>
        )}

        <button
          type="button"
          onClick={handleDeleteAll}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md transition-colors text-sm"
        >
          Delete All Registered Voters
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Participation
// -----------------------------------------------------------------------------

function ParticipationPanel() {
  const [stats, setStats] = useState(null);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats(selectedElectionId);
  }, [selectedElectionId]);

  async function loadStats(electionId) {
    setLoading(true);
    setError("");
    try {
      const params = electionId ? { electionId } : {};
      const { data } = await apiClient.getElectionStats(params);
      setStats(data);
      if (!selectedElectionId && data?.election?.id) {
        setSelectedElectionId(data.election.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || "No election data available to report on.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">Live Participation</h3>
          <p className="text-xs text-slate-500">Real-time voting turnout read from off-chain receipts and blockchain status.</p>
        </div>
        <div className="flex items-center gap-2">
          {stats?.allElections?.length > 1 && (
            <select
              value={selectedElectionId}
              onChange={(e) => setSelectedElectionId(e.target.value)}
              className="text-xs rounded-md border border-slate-300 px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-zvote-500"
            >
              {stats.allElections.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.title} ({el.scope}{el.targetDepartment ? ` - ${el.targetDepartment}` : ""})
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => loadStats(selectedElectionId)}
            className="text-xs font-semibold text-zvote-700 bg-zvote-50 hover:bg-zvote-100 border border-zvote-200 rounded-md px-3 py-1.5"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm">Loading participation statistics...</p>}
      {!loading && error && <p className="text-amber-700 bg-amber-50 rounded-md px-3 py-2 text-sm">{error}</p>}

      {!loading && stats && (
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <span className="bg-blue-100 text-blue-800 font-semibold px-2.5 py-0.5 rounded-full">
              {stats.election.scope}
            </span>
            {stats.election.scope === "DEPARTMENT" && stats.election.targetDepartment && (
              <span className="bg-purple-100 text-purple-800 font-semibold px-2.5 py-0.5 rounded-full">
                Department: {stats.election.targetDepartment}
              </span>
            )}
            <span className="text-slate-500">
              {stats.totalVoters} eligible voter(s) &middot;{" "}
              <strong className={stats.election.status === "ACTIVE" ? "text-green-600" : "text-slate-600"}>
                {stats.election.status === "ACTIVE" ? "Election Active" : "Election Closed"}
              </strong>
            </span>
          </div>

          <div className="space-y-3">
            {stats.positions.map((p) => (
              <div key={p.positionId} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-800">{p.title}</span>
                  <span className="text-slate-600 font-mono text-xs">
                    {p.votesCast} / {p.totalVoters} ({p.participationPercent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-zvote-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(p.participationPercent, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Close Election
// -----------------------------------------------------------------------------

function CloseElectionPanel() {
  const [activeElections, setActiveElections] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveElections();
  }, []);

  async function loadActiveElections() {
    setLoading(true);
    try {
      const { data } = await apiClient.getElections({ status: "ACTIVE" });
      setActiveElections(data.elections || []);
    } catch (err) {
      console.error("Failed to load active elections:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClose(electionId) {
    setSubmitting(true);
    setMessage(null);
    try {
      await apiClient.closeElection(electionId);
      setMessage({ type: "success", text: "Election closed on-chain. Results are now final." });
      setConfirmingId(null);
      loadActiveElections();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || "Failed to close election." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800 text-base">Active Elections</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Closing an election stops the smart contract from accepting further votes. This action is final.
        </p>
      </div>

      {message && (
        <p
          className={`text-sm rounded-md px-3 py-2 ${
            message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"
          }`}
        >
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading active elections...</p>
      ) : activeElections.length === 0 ? (
        <p className="text-slate-500 text-sm italic">There are no active elections currently.</p>
      ) : (
        <div className="space-y-4 divide-y divide-slate-100">
          {activeElections.map((election) => (
            <div key={election.id} className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">{election.title}</h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{election.contractAddress}</p>
                <div className="flex flex-wrap gap-2 items-center mt-1.5">
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    {election.scope}
                  </span>
                  {election.scope === "DEPARTMENT" && (
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                      {election.targetDepartment}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 font-mono">
                    🟢 {election.startTime ? new Date(election.startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "N/A"} &rarr; 🔴 {election.endTime ? new Date(election.endTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "N/A"}
                  </span>
                </div>
              </div>

              <div>
                {confirmingId !== election.id ? (
                  <button
                    onClick={() => setConfirmingId(election.id)}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 px-3 rounded-md text-xs transition-colors"
                  >
                    Close Election
                  </button>
                ) : (
                  <div className="flex gap-2 items-center bg-red-50 border border-red-200 rounded-md p-2">
                    <span className="text-xs font-semibold text-red-800">Confirm?</span>
                    <button
                      onClick={() => handleClose(election.id)}
                      disabled={submitting}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[11px] font-semibold py-1 px-2.5 rounded transition-colors"
                    >
                      {submitting ? "Closing..." : "Yes"}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="text-xs text-slate-500 hover:underline px-1"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Registered Students
// -----------------------------------------------------------------------------

function RegisteredStudentsPanel() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Filter states
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedProg, setSelectedProg] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadStudents();
  }, [selectedDept, selectedProg, selectedLevel, search]);

  async function loadFilters() {
    try {
      const [deptRes, progRes] = await Promise.all([
        apiClient.getDepartments(),
        apiClient.getPrograms(),
      ]);
      setDepartments(deptRes.data.departments || []);
      setPrograms(progRes.data.programs || []);
    } catch (err) {
      console.error("Failed to load filter options:", err);
    }
  }

  async function loadStudents() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (selectedDept) params.department = selectedDept;
      if (selectedProg) params.program = selectedProg;
      if (selectedLevel) params.level = selectedLevel;
      if (search) params.search = search;

      const { data } = await apiClient.getStudents(params);
      setStudents(data.students || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load students list.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">Registered Students Directory</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {students.length} student voter(s) registered in the system.
          </p>
        </div>
        <button
          onClick={loadStudents}
          className="text-xs font-semibold text-zvote-700 bg-zvote-50 hover:bg-zvote-100 px-3 py-1.5 rounded-md self-start sm:self-auto"
        >
          Refresh
        </button>
      </div>

      {/* Privacy Notice Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2">
        <span className="text-base leading-none">🔒</span>
        <div>
          <span className="font-semibold">Cryptographic Voter Privacy &amp; Secret Ballot: </span>
          Individual voting choices and participation statuses are decoupled from student identity profiles to preserve complete voter anonymity. Aggregated turnout counts and on-chain receipts are available in the <strong>Live Participation</strong> tab.
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or index..."
            className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 bg-white"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Program</label>
          <select
            value={selectedProg}
            onChange={(e) => setSelectedProg(e.target.value)}
            className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 bg-white"
          >
            <option value="">All Programs</option>
            {programs.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Level</label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 bg-white"
          >
            <option value="">All Levels</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="300">300</option>
            <option value="400">400</option>
          </select>
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm">Loading students list...</p>}
      {!loading && error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="p-3">Full Name</th>
                <th className="p-3">Index Number</th>
                <th className="p-3">Email</th>
                <th className="p-3">Department</th>
                <th className="p-3">Program</th>
                <th className="p-3">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">
                    No students registered matching criteria.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 text-slate-700">
                    <td className="p-3 font-medium text-slate-900">{student.fullName}</td>
                    <td className="p-3 font-mono">{student.studentId}</td>
                    <td className="p-3">{student.email}</td>
                    <td className="p-3">{student.department}</td>
                    <td className="p-3">{student.program}</td>
                    <td className="p-3">{student.level}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Admin Profile
// -----------------------------------------------------------------------------

function AdminProfilePanel() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setSubmittingProfile(true);
    setProfileMsg(null);
    try {
      const { data } = await apiClient.updateAdminProfile({ fullName, email });
      updateUser({ ...user, fullName: data.user.fullName, email: data.user.email });
      setProfileMsg({ type: "success", text: "Profile updated successfully." });
    } catch (err) {
      setProfileMsg({ type: "error", text: err.response?.data?.error || "Failed to update profile." });
    } finally {
      setSubmittingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "Password must be at least 8 characters long." });
      return;
    }

    setSubmittingPassword(true);
    setPasswordMsg(null);
    try {
      await apiClient.changePassword({ currentPassword, newPassword });
      setPasswordMsg({ type: "success", text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMsg({ type: "error", text: err.response?.data?.error || "Failed to change password." });
    } finally {
      setSubmittingPassword(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Edit Profile Form */}
      <form onSubmit={handleUpdateProfile} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h3 className="font-semibold text-slate-800 text-lg border-b border-slate-100 pb-3">Edit Profile Info</h3>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Student / Staff ID</label>
          <input
            disabled
            type="text"
            value={user?.studentId || ""}
            className="w-full rounded-md border border-slate-200 px-3 py-2 bg-slate-50 text-slate-500 font-mono text-sm cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
          <input
            required
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 text-sm"
          />
        </div>

        {profileMsg && (
          <p
            className={`text-sm rounded-md px-3 py-2 ${
              profileMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}
          >
            {profileMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submittingProfile}
          className="w-full bg-zvote-600 hover:bg-zvote-700 disabled:opacity-60 text-white font-semibold py-2 rounded-md transition-colors text-sm"
        >
          {submittingProfile ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* Change Password Form */}
      <form onSubmit={handleChangePassword} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h3 className="font-semibold text-slate-800 text-lg border-b border-slate-100 pb-3">Change Password</h3>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
          <input
            required
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 text-sm"
            placeholder="Enter current password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
          <div className="relative">
            <input
              required
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-zvote-500 text-sm"
              placeholder="Min 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700"
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" />
                  <path d="M15.171 13.576l1.414 1.414a1 1 0 00.707-.293l-1.414-1.414a.999.999 0 00-.707.293zM6.586 4.172A6 6 0 0110 4c4.418 0 8.268 2.943 9.542 7-.26.891-.646 1.73-1.138 2.464l-1.414-1.414A7.992 7.992 0 0010 12a8.002 8.002 0 00-3.414.686l-1.414-1.414a9.96 9.96 0 011.414-1.1z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
          <input
            required
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 text-sm"
            placeholder="Re-enter new password"
          />
        </div>

        {passwordMsg && (
          <p
            className={`text-sm rounded-md px-3 py-2 ${
              passwordMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}
          >
            {passwordMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submittingPassword}
          className="w-full bg-zvote-600 hover:bg-zvote-700 disabled:opacity-60 text-white font-semibold py-2 rounded-md transition-colors text-sm"
        >
          {submittingPassword ? "Changing..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
