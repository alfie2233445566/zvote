import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate("/login");
  }

  return (
    <nav className="bg-zvote-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg tracking-tight">
          Z<span className="text-zvote-300">Vote</span>
        </Link>

        {user && (
          <div className="flex items-center gap-4 text-sm">
            {user.role === "ADMIN" ? (
              <Link to="/admin" className="hover:text-zvote-300">
                Admin Dashboard
              </Link>
            ) : (
              <Link to="/dashboard" className="hover:text-zvote-300">
                Ballot
              </Link>
            )}
            <Link to="/results" className="hover:text-zvote-300">
              Results
            </Link>
            <Link to="/verify" className="hover:text-zvote-300">
              Verify Vote
            </Link>
            <Link to="/profile" className="hover:text-zvote-300 flex items-center gap-1.5 bg-zvote-800/80 hover:bg-zvote-800 px-2.5 py-1 rounded-md border border-zvote-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Profile</span>
            </Link>
            <span className="text-zvote-200 hidden md:inline text-xs font-mono">
              {user.studentId}
            </span>
            <button
              onClick={handleSignOut}
              className="bg-zvote-700 hover:bg-zvote-600 px-3 py-1.5 rounded-md font-medium text-xs"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
