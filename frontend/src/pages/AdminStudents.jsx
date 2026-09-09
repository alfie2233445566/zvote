import { useState, useEffect } from "react";
import api from "../api.js";

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [elections, setElections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");

  useEffect(() => {
    fetchStudents();
    fetchDepartments();
    fetchPrograms();
  }, [search, selectedDepartment, selectedProgram, selectedLevel]);

  async function fetchStudents() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedDepartment) params.append("department", selectedDepartment);
      if (selectedProgram) params.append("program", selectedProgram);
      if (selectedLevel) params.append("level", selectedLevel);

      const response = await api.get(`/admin/students?${params.toString()}`);
      setStudents(response.data.students);
      setElections(response.data.elections);
    } catch (err) {
      setError("Failed to load students.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDepartments() {
    try {
      const response = await api.get("/admin/departments");
      setDepartments(response.data.departments);
    } catch (err) {
      console.error("Failed to load departments:", err);
    }
  }

  async function fetchPrograms() {
    try {
      const response = await api.get("/admin/programs");
      setPrograms(response.data.programs);
    } catch (err) {
      console.error("Failed to load programs:", err);
    }
  }

  const levels = ["100", "200", "300", "400", "500"];

  return (
    <div className="min-h-screen bg-zvote-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-md p-8">
          <h1 className="text-3xl font-bold text-zvote-900 mb-2">Registered Students</h1>
          <p className="text-slate-600 mb-6">Manage and view all registered student accounts and their voting status.</p>

          {/* Filters */}
          <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by name or index number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
                >
                  <option value="">All departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Program</label>
                <select
                  value={selectedProgram}
                  onChange={(e) => setSelectedProgram(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
                >
                  <option value="">All programs</option>
                  {programs.map((prog) => (
                    <option key={prog} value={prog}>
                      {prog}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Level</label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
                >
                  <option value="">All levels</option>
                  {levels.map((level) => (
                    <option key={level} value={level}>
                      Level {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>}

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-slate-600">Loading...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600">No students found.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Full Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Index Number</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Department</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Program</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Level</th>
                    {elections.length > 0 && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Voting Status</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900 font-medium">{student.fullName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 font-mono">{student.studentId}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{student.email}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{student.department}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{student.program}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{student.level}</td>
                      {elections.length > 0 && (
                        <td className="px-4 py-3 text-sm">
                          <div className="space-y-1">
                            {elections.map((election) => {
                              const status = student.electionStatus[election.id];
                              const voted = status?.hasVoted;
                              return (
                                <div key={election.id} className="flex items-center gap-2">
                                  {voted ? (
                                    <>
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </span>
                                      <span className="text-xs text-green-700">
                                        {status.positionsVoted}/{status.totalPositions}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100">
                                        <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                      </span>
                                      <span className="text-xs text-slate-500">Not voted</span>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 text-sm text-slate-600">
            Showing {students.length} student{students.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
