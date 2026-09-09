import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    setMobileMenuOpen(false);
    navigate("/login");
  }

  function closeMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <nav className="bg-zvote-900 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" onClick={closeMenu} className="font-bold text-lg tracking-tight flex items-center gap-1">
          <span>Z</span>
          <span className="text-zvote-300">Vote</span>
          <span className="text-[10px] bg-zvote-800 text-zvote-300 px-1.5 py-0.5 rounded border border-zvote-700 ml-1">Amoy</span>
        </Link>

        {user && (
          <>
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              {user.role === "ADMIN" ? (
                <Link to="/admin" className="hover:text-zvote-300 transition-colors">
                  Admin Dashboard
                </Link>
              ) : (
                <Link to="/dashboard" className="hover:text-zvote-300 transition-colors">
                  Ballot
                </Link>
              )}
              <Link to="/results" className="hover:text-zvote-300 transition-colors">
                Results
              </Link>
              <Link to="/verify" className="hover:text-zvote-300 transition-colors">
                Verify Vote
              </Link>
              <Link
                to="/profile"
                className="hover:text-zvote-300 flex items-center gap-1.5 bg-zvote-800/80 hover:bg-zvote-800 px-2.5 py-1 rounded-md border border-zvote-700 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Profile</span>
              </Link>
              <span className="text-zvote-200 text-xs font-mono bg-zvote-800 px-2 py-1 rounded">
                {user.studentId}
              </span>
              <button
                onClick={handleSignOut}
                className="bg-zvote-700 hover:bg-zvote-600 px-3 py-1.5 rounded-md font-medium text-xs transition-colors"
              >
                Sign out
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <div className="md:hidden flex items-center gap-2">
              <span className="text-zvote-200 text-xs font-mono bg-zvote-800 px-2 py-1 rounded">
                {user.studentId}
              </span>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-zvote-800 focus:outline-none"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile Drawer */}
      {user && mobileMenuOpen && (
        <div className="md:hidden bg-zvote-950 border-t border-zvote-800 px-4 py-3 space-y-2 text-sm">
          {user.role === "ADMIN" ? (
            <Link
              to="/admin"
              onClick={closeMenu}
              className="block py-2 px-3 rounded-md hover:bg-zvote-800 text-white font-medium"
            >
              Admin Dashboard
            </Link>
          ) : (
            <Link
              to="/dashboard"
              onClick={closeMenu}
              className="block py-2 px-3 rounded-md hover:bg-zvote-800 text-white font-medium"
            >
              Ballot
            </Link>
          )}
          <Link
            to="/results"
            onClick={closeMenu}
            className="block py-2 px-3 rounded-md hover:bg-zvote-800 text-slate-300 hover:text-white"
          >
            Election Results
          </Link>
          <Link
            to="/verify"
            onClick={closeMenu}
            className="block py-2 px-3 rounded-md hover:bg-zvote-800 text-slate-300 hover:text-white"
          >
            Verify Vote on Blockchain
          </Link>
          <Link
            to="/profile"
            onClick={closeMenu}
            className="block py-2 px-3 rounded-md hover:bg-zvote-800 text-slate-300 hover:text-white"
          >
            My Profile
          </Link>
          <div className="pt-2 border-t border-zvote-800">
            <button
              onClick={handleSignOut}
              className="w-full text-left py-2 px-3 rounded-md bg-red-900/40 hover:bg-red-900/60 text-red-200 font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
