import { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as apiClient from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("zvote_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    localStorage.removeItem("zvote_token");
    localStorage.removeItem("zvote_user");
    setUser(null);
  }, []);

  // Validate active session against server instance on app start / page refresh
  useEffect(() => {
    async function verifySession() {
      const token = localStorage.getItem("zvote_token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await apiClient.getMe();
        if (data?.user) {
          localStorage.setItem("zvote_user", JSON.stringify(data.user));
          setUser(data.user);
        }
      } catch (err) {
        // If server was restarted or token invalid, log out immediately
        signOut();
      } finally {
        setLoading(false);
      }
    }
    verifySession();
  }, [signOut]);

  const signIn = useCallback(async (studentId, password) => {
    const { data } = await apiClient.login(studentId, password);
    localStorage.setItem("zvote_token", data.token);
    localStorage.setItem("zvote_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const updateUser = useCallback((updatedUser) => {
    localStorage.setItem("zvote_user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Verifying session...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
