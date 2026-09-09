import { useState } from "react";
import { Link } from "react-router-dom";
import * as apiClient from "../api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await apiClient.requestPasswordReset(email.trim());
      setMessage({ type: "success", text: data.message || "Reset link sent to your email." });
      setEmail("");
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || "Failed to send reset request." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zvote-900 to-zvote-700 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
          <p className="text-sm text-slate-500 mt-1">Enter your registered email address and we'll send you a password reset link.</p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
            placeholder="e.g. student@school.edu"
          />
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
          disabled={loading}
          className="w-full bg-zvote-600 hover:bg-zvote-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-md transition-colors"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <div className="text-center">
          <Link to="/login" className="text-sm text-zvote-600 hover:text-zvote-700 hover:underline">
            Back to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}
