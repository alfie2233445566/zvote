import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import Results from "./pages/Results.jsx";
import VoteVerification from "./pages/VoteVerification.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import ChangePasswordFirstLogin from "./pages/ChangePasswordFirstLogin.jsx";
import StudentProfile from "./pages/StudentProfile.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <StudentProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/results"
        element={
          <ProtectedRoute>
            <Results />
          </ProtectedRoute>
        }
      />

      <Route path="/verify" element={<VoteVerification />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/change-password-first-login" element={<ChangePasswordFirstLogin />} />

      <Route
        path="/"
        element={
          <Navigate to={user ? (user.role === "ADMIN" ? "/admin" : "/dashboard") : "/login"} replace />
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
