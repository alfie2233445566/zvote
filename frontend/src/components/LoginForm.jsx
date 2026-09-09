import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginForm() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await signIn(studentId.trim(), password);
      
      // If user must change password on first login, redirect to forced password change page
      if (user.mustChangePassword) {
        navigate("/change-password-first-login");
        return;
      }

      // Otherwise redirect based on role
      navigate(user.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zvote-900">Welcome to ZVote</h1>
        <p className="text-sm text-slate-500 mt-1">Sign in with your Student/Staff ID to continue.</p>
      </div>

      <div>
        <label htmlFor="studentId" className="block text-sm font-medium text-slate-700 mb-1">
          Student / Staff ID
        </label>
        <input
          id="studentId"
          type="text"
          required
          autoFocus
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
          placeholder="e.g. UEB1103322"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-zvote-500"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" />
                <path d="M15.171 13.576l1.414 1.414a1 1 0 00.707-.293l-1.414-1.414a.999.999 0 00-.707.293zM6.586 4.172A6 6 0 0110 4c4.418 0 8.268 2.943 9.542 7-.26.891-.646 1.73-1.138 2.464l-1.414-1.414A7.992 7.992 0 0010 12a8.002 8.002 0 00-3.414.686l-1.414-1.414a9.96 9.96 0 011.414-1.1z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-zvote-600 hover:bg-zvote-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-md transition-colors"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <div className="text-center">
        <Link to="/forgot-password" className="text-sm text-zvote-600 hover:text-zvote-700 hover:underline">
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}
