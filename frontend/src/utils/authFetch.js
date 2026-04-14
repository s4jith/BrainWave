/**
 * Authenticated fetch wrapper.
 * Auto-injects JWT Bearer token from the user store into every request.
 * On 401 responses, automatically logs the user out and redirects to login.
 * Import this instead of using raw fetch() for any /api/ calls.
 */
import useUserStore from "../stores/userStore";

let isForceLoggingOut = false;

function normalizeRequestUrl(url) {
  if (typeof url !== "string") return url;
  // Keep protocol intact (https://), but collapse duplicate slashes in the remaining path.
  return url.replace(/([^:]\/)\/+/g, "$1");
}

function forceLogoutToLogin() {
  if (isForceLoggingOut) return;
  isForceLoggingOut = true;

  const { logout } = useUserStore.getState();
  logout();

  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.replace("/login");
  }

  setTimeout(() => {
    isForceLoggingOut = false;
  }, 500);
}

export default async function authFetch(url, options = {}) {
  const token = useUserStore.getState().accessToken;
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(normalizeRequestUrl(url), { ...options, headers });

  // Force logout only when unauthenticated. 403 can be valid for permission checks.
  if (response.status === 401) {
    forceLogoutToLogin();
  }

  return response;
}
