import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Wraps a page and redirects to /login if there's no authenticated user.
 * If adminOnly is set, also redirects non-admins to the student dashboard.
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
