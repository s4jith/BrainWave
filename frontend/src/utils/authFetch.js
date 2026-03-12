/**
 * Authenticated fetch wrapper.
 * Auto-injects JWT Bearer token from the user store into every request.
 * Import this instead of using raw fetch() for any /api/ calls.
 */
import useUserStore from "../stores/userStore";

export default function authFetch(url, options = {}) {
  const token = useUserStore.getState().accessToken;
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}
