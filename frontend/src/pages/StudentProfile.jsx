import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import * as apiClient from "../api.js";

export default function StudentProfile() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const [resetEmailMsg, setResetEmailMsg] = useState(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);

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
      setPasswordMsg({ type: "success", text: "Password changed successfully! Keep your new password safe." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMsg({ type: "error", text: err.response?.data?.error || "Failed to change password." });
    } finally {
      setSubmittingPassword(false);
    }
  }

  async function handleSendResetEmail() {
    if (!user?.email) {
      setResetEmailMsg({ type: "error", text: "No email associated with this account." });
      return;
    }

    setSendingReset(true);
    setResetEmailMsg(null);
    try {
      const { data } = await apiClient.requestPasswordReset(user.email);
      setResetEmailMsg({ type: "success", text: data.message || "Password reset link sent to your registered email address." });
    } catch (err) {
      setResetEmailMsg({ type: "error", text: err.response?.data?.error || "Failed to send reset link." });
    } finally {
      setSendingReset(false);
    }
  }

  function copyWalletAddress() {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to={user?.role === "ADMIN" ? "/admin" : "/dashboard"}
            className="text-sm font-medium text-zvote-700 hover:underline flex items-center gap-1"
          >
            &larr; Back to {user?.role === "ADMIN" ? "Admin Dashboard" : "Voting Ballot"}
          </Link>
          <span className="text-xs text-slate-500 font-mono">
            ID: {user?.studentId}
          </span>
        </div>

        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-zvote-900 text-white flex items-center justify-center font-bold text-2xl shadow-inner flex-shrink-0">
            {user?.fullName?.charAt(0) || "U"}
          </div>
          <div className="space-y-1 text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{user?.fullName}</h1>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {user?.role === "ADMIN" ? "Administrator" : "Student Voter"}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-mono">{user?.studentId} &middot; {user?.email}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2 text-xs">
              {user?.department && (
                <span className="bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-md border border-slate-200">
                  Dept: <strong>{user.department}</strong>
                </span>
              )}
              {user?.program && (
                <span className="bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-md border border-slate-200">
                  Program: <strong>{user.program}</strong>
                </span>
              )}
              {user?.level && (
                <span className="bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-md border border-slate-200">
                  Level: <strong>{user.level}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Security & Password Change */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-800 text-base">Change Password</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update your account password. Must be at least 8 characters.
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Current Password</label>
                <input
                  required
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
                <input
                  required
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500"
                />
              </div>

              {passwordMsg && (
                <p
                  className={`text-xs rounded-md px-3 py-2 ${
                    passwordMsg.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-600 border border-red-200"
                  }`}
                >
                  {passwordMsg.text}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingPassword}
                className="w-full bg-zvote-600 hover:bg-zvote-700 disabled:opacity-60 text-white font-semibold py-2 rounded-md text-xs transition-colors"
              >
                {submittingPassword ? "Updating Password..." : "Change Password"}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-2">Forgot your current password?</p>
              <button
                type="button"
                onClick={handleSendResetEmail}
                disabled={sendingReset}
                className="w-full text-xs font-medium text-zvote-700 bg-zvote-50 hover:bg-zvote-100 border border-zvote-200 py-1.5 px-3 rounded-md transition-colors"
              >
                {sendingReset ? "Sending Reset Email..." : "Email Me a Password Reset Link"}
              </button>
              {resetEmailMsg && (
                <p
                  className={`text-xs rounded-md px-3 py-2 mt-2 ${
                    resetEmailMsg.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-600 border border-red-200"
                  }`}
                >
                  {resetEmailMsg.text}
                </p>
              )}
            </div>
          </div>

          {/* Blockchain & Account Identity */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-800 text-base">Blockchain Identity</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your cryptographic on-chain identity for submitting immutable votes.
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Assigned Wallet Address:</span>
                  {user?.walletAddress && (
                    <button
                      type="button"
                      onClick={copyWalletAddress}
                      className="text-zvote-600 hover:text-zvote-800 font-medium"
                    >
                      {copiedWallet ? "✓ Copied" : "Copy"}
                    </button>
                  )}
                </div>
                <p className="text-[11px] font-mono break-all text-slate-600 bg-white p-2 rounded border border-slate-200">
                  {user?.walletAddress || "Assigned on next vote transaction"}
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <span>🛡️</span> Zero-Knowledge Voter Privacy
                </p>
                <p className="text-emerald-800 leading-relaxed text-[11px]">
                  Your student index number is never stored on the blockchain alongside your ballot. Only the cryptographic hash of your vote is recorded on Polygon Amoy.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Link
                to="/verify"
                className="w-full block text-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-md transition-colors"
              >
                Verify Past Votes On-Chain &rarr;
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
