import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loginUser, logoutUser } from "../api/index";

const AuthContext = createContext(null);

const ROLE_HOME = {
  Candidate:   "/candidate/dashboard",
  TeamMember:  "/employee/dashboard",
  TeamLeader:  "/employee/dashboard",
  HRManager:   "/hr/dashboard",
  Admin:       "/admin/dashboard",
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate session from localStorage on app load
  useEffect(() => {
    const stored = localStorage.getItem("user");
    const access = localStorage.getItem("access");
    if (stored && access) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginUser({ email, password });

    if (data.detail) throw new Error(data.detail); // surface Django error messages

    const { access, refresh, role, full_name, employee_id } = data;
    const userData = { email, role, full_name, employee_id };

    localStorage.setItem("access",  access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("user",    JSON.stringify(userData));

    setUser(userData);
    return ROLE_HOME[role] ?? "/login";
  }, []);

  const logout = useCallback(async () => {
    try {
      const refresh = localStorage.getItem("refresh");
      if (refresh) await logoutUser(refresh);
    } catch {
      // blacklist call failed — clear locally anyway
    } finally {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, ROLE_HOME }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}