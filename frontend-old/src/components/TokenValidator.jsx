import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";

/**
 * TokenValidator — validates the JWT token on mount.
 * If the token is expired or the /api/auth/me check returns 401/403,
 * the user is force-logged out.
 */
export default function TokenValidator({ children }) {
  const { isAuthenticated, accessToken, logout } = useUserStore();
  const [validated, setValidated] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL;

  const forceLogout = React.useCallback(() => {
    logout();
    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }, [logout]);

  const getTokenExpiryMs = React.useCallback((token) => {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    try {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(window.atob(padded));
      if (!payload?.exp) return null;
      return Number(payload.exp) * 1000;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setValidated(false);

    if (!isAuthenticated || !accessToken) {
      setValidated(true);
      return;
    }

    const expiryMs = getTokenExpiryMs(accessToken);
    if (expiryMs && Date.now() >= expiryMs) {
      forceLogout();
      setValidated(true);
      return;
    }

    let expiryTimer = null;
    if (expiryMs && expiryMs > Date.now()) {
      expiryTimer = window.setTimeout(() => {
        forceLogout();
      }, expiryMs - Date.now());
    }

    // Verify the token is still valid by calling /api/auth/me
    const validateToken = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        // Treat explicit auth/session failures as invalid login state.
        if (res.status === 401 || res.status === 403) {
          forceLogout();
        }
      } catch {
        // Network error — don't logout, let offline usage continue
      } finally {
        setValidated(true);
      }
    };
    validateToken();

    return () => {
      if (expiryTimer) {
        window.clearTimeout(expiryTimer);
      }
    };
  }, [isAuthenticated, accessToken, API_URL, forceLogout, getTokenExpiryMs]);

  if (!validated) return null; // Show nothing until token is validated

  return children;
}
