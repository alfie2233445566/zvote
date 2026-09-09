import axios from "axios";

// Base URL of the backend API. Configured via .env (VITE_API_URL), so it's easy to
// switch between a local dev server and a deployed production server.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

// Attach the JWT (if present) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("zvote_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token is invalid/expired, force the user back to the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("zvote_token");
      localStorage.removeItem("zvote_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// --- Auth ---
export const login = (studentId, password) => api.post("/auth/login", { studentId, password });
export const getMe = () => api.get("/auth/me");

// --- Elections ---
export const getElections = (params) => api.get("/election/list", { params });
export const getCandidates = (params) => api.get("/election/candidates", { params });
export const getResults = (params) => api.get("/election/results", { params });
export const createElection = (payload) => api.post("/election/create", payload);

// --- Voting ---
export const castVote = (positionId, candidateId) => api.post("/vote/cast", { positionId, candidateId });
export const getVoteStatus = (params) => api.get("/vote/status", { params });

// --- Admin ---
export const registerVoters = (voters) => api.post("/admin/register-voters", { voters });
export const bulkRegister = (formData) => api.post("/admin/bulk-register", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
export const uploadImage = (formData) => api.post("/admin/upload-image", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
export const getElectionStats = (params) => api.get("/admin/election-stats", { params });
export const closeElection = (electionId) => api.post("/admin/election-close", { electionId });
export const getStudents = (params) => api.get("/admin/students", { params });
export const getDepartments = () => api.get("/admin/departments");
export const getPrograms = () => api.get("/admin/programs");
export const updateAdminProfile = (payload) => api.put("/admin/profile", payload);
export const deleteAllVoters = () => api.delete("/admin/voters");

// --- Verification ---
export const verifyTransaction = (txHash) => api.get(`/vote/verify?txHash=${txHash}`);
export const getMyVotes = () => api.get("/vote/my-votes");

// --- Password Reset ---
export const requestPasswordReset = (email) => api.post("/auth/request-password-reset", { email });
export const resetPassword = (payload) => api.post("/auth/reset-password", payload);
export const changePassword = (payload) => api.post("/auth/change-password", payload);

export default api;
