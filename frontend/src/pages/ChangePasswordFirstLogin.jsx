import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import * as apiClient from "../api.js";

export default function ChangePasswordFirstLogin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters long." });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await apiClient.changePassword({ currentPassword, newPassword });
      setMessage({ type: "success", text: "Password changed successfully. Redirecting to ballot page..." });
      
      // Update local storage user flag
      const storedUser = JSON.parse(localStorage.getItem("zvote_user") || "{}");
      storedUser.mustChangePassword = false;
      localStorage.setItem("zvote_user", JSON.stringify(storedUser));
      
      setTimeout(() => {
        navigate(user?.role === "ADMIN" ? "/admin" : "/dashboard");
      }, 2000);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || "Failed to update password." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zvote-900 to-zvote-700 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Change Password</h1>
          <p className="text-sm text-slate-500 mt-1">This is your first login. You must change your temporary password to continue.</p>
        </div>

        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 mb-1">
            Current Temporary Password
          </label>
          <input
            id="currentPassword"
            type="password"
            required
            autoFocus
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 text-sm"
            placeholder="Enter temporary password"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1">
            New Password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              required
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
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zvote-500 text-sm"
            placeholder="Re-enter new password"
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
          className="w-full bg-zvote-600 hover:bg-zvote-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-md transition-colors text-sm"
        >
          {loading ? "Saving..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
