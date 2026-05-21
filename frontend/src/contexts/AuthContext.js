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
      // Clean up URL to prevent token from being shared/bookmarked
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    
    try {
      console.log("DEBUG: Checking token:", token ? "Token exists" : "No token");
      
      // Robust decoding of the JWT payload (handles URL-safe base64)
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) throw new Error("Invalid token format");
      
      const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload);
      console.log("DEBUG: Token payload decoded:", payload);
      
      const role = String(payload.role || "").toLowerCase();
      
      if (role === 'student') {
        console.log("DEBUG: Identified as Student");
        setUser({
          email: payload.email,
          name: payload.full_name || payload.username,
          role: 'student',
          id: payload.user_id
        });
        setLoading(false);
        return;
      }

      console.log("DEBUG: Identified as Admin, verifying with backend...");
      const { data } = await api.get("/auth/me");
      console.log("DEBUG: Backend verification success:", data);
      setUser({ ...data, role: 'admin' });
    } catch (error) {
      console.error("DEBUG: Auth check failed:", error);
      localStorage.removeItem("token");
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
