import React, { createContext, useContext, useState, useEffect } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Check URL for token (from external auth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    
    if (urlToken) {
      localStorage.setItem("token", urlToken);
      sessionStorage.setItem("token", urlToken);
      // Clean up URL to prevent token from being shared/bookmarked
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    
    try {
      console.log("DEBUG: Verifying session with backend...");
      const { data } = await api.get("/auth/me");
      console.log("DEBUG: Backend session verification success:", data);
      setUser(data);
    } catch (error) {
      console.error("DEBUG: Session verification failed:", error);
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      setUser(null);
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    const authUrl = process.env.REACT_APP_AUTH_FRONTEND_URL;
    
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    
    if (authUrl) {
      // Redirect immediately. We DON'T call setUser(null) here 
      // so the current dashboard stays visible until the browser navigates away.
      window.location.replace(authUrl);
    } else {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
