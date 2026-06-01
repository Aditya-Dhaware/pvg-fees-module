import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import { useNavigate } from "react-router-dom";

export default function AuthGate({ children, allowedRoles, checkUserId }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Helper to check if a given user object satisfies the gating conditions
  const checkUserAuthorization = (userObj) => {
    if (!userObj) return false;
    const userRole = String(userObj.role || "").toLowerCase();
    
    // 1. Role check
    if (allowedRoles && allowedRoles.length > 0) {
      const allowedRolesLower = allowedRoles.map(r => r.toLowerCase());
      if (!allowedRolesLower.includes(userRole)) {
        return false;
      }
    }

    // 2. User ID check
    if (userRole === "student" && checkUserId) {
      const expectedId = String(checkUserId).toLowerCase();
      const loggedId = String(userObj.id || "").toLowerCase();
      const loggedEmail = String(userObj.email || "").toLowerCase();
      if (loggedId !== expectedId && loggedEmail !== expectedId) {
        return false;
      }
    }
    
    return true;
  };

  // Initialize state based on whether context user is already loaded and valid
  const [authorized, setAuthorized] = useState(() => checkUserAuthorization(user));
  const [checking, setChecking] = useState(true);

  // Serialize allowedRoles to avoid infinite loops on array reference changes
  const allowedRolesStr = allowedRoles ? allowedRoles.join(",") : "";

  useEffect(() => {
    // 1. Immediate client-side routing redirect if user is already loaded in context
    if (user) {
      const userRole = String(user.role || "").toLowerCase();
      if (userRole === "student" && !checkUserAuthorization(user)) {
        console.log("DEBUG [AuthGate]: Student in context trying to access admin route. Redirecting to /user-portal...");
        navigate("/user-portal");
        return;
      }
    }

    let isMounted = true;

    const verifyUser = async () => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const authUrl = process.env.REACT_APP_AUTH_FRONTEND_URL || process.env.VITE_AUTH_URL || "";
      const currentUrl = encodeURIComponent(window.location.href);
      const redirectTarget = `${authUrl}/login?redirect=${currentUrl}`;

      if (!token) {
        console.log("DEBUG [AuthGate]: No token found in storage.");
        if (isMounted) {
          setAuthorized(false);
          setChecking(false);
        }
        if (authUrl) {
          console.log(`DEBUG [AuthGate]: Redirecting to external login: ${redirectTarget}`);
          window.location.replace(redirectTarget);
        }
        return;
      }

      try {
        console.log("DEBUG [AuthGate]: Fetching /auth/me to verify session...");
        const { data } = await api.get("/auth/me");
        
        if (!isMounted) return;

        console.log("DEBUG [AuthGate]: Fetch success. User data:", data);
        const isUserAuthorized = checkUserAuthorization(data);
        
        if (!isUserAuthorized) {
          console.warn(`DEBUG [AuthGate]: User with role "${data.role}" is not authorized for this page.`);
          const userRole = String(data.role || "").toLowerCase();
          if (userRole === "student") {
            console.log("DEBUG [AuthGate]: Fetched student is not authorized for admin route. Redirecting to /user-portal...");
            navigate("/user-portal");
            return;
          }
        }

        setAuthorized(isUserAuthorized);
      } catch (error) {
        if (!isMounted) return;
        
        console.error("DEBUG [AuthGate]: Session verification failed:", error);
        
        if (error.response && error.response.status === 401) {
          console.warn("DEBUG [AuthGate]: 401 Unauthorized from backend. Clearing tokens.");
          localStorage.removeItem("token");
          sessionStorage.removeItem("token");
          if (authUrl) {
            console.log(`DEBUG [AuthGate]: Redirecting to external login: ${redirectTarget}`);
            window.location.replace(redirectTarget);
            return;
          }
        }
        
        // If not a 401, check if we already have a valid user object from context
        // as a fallback to avoid locking users out on transient backend hiccups.
        setAuthorized(checkUserAuthorization(user));
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };

    verifyUser();

    return () => {
      isMounted = false;
    };
  }, [allowedRolesStr, checkUserId, user]);

  if (loading || (checking && !authorized)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-sm text-[#6B7280]">Verifying authentication...</div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] p-4 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-2">Access Denied</h2>
        <p className="text-gray-600 max-w-md">
          You do not have the required permissions to access this page. If you believe this is an error, please contact your administrator.
        </p>
      </div>
    );
  }

  return children;
}
