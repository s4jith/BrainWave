/**
 * Authenticated fetch wrapper.
 * Auto-injects JWT Bearer token from the user store into every request.
 * On 401 responses, automatically logs the user out and redirects to login.
 * Import this instead of using raw fetch() for any /api/ calls.
 */
import useUserStore from "../stores/userStore";

export default async function authFetch(url, options = {}) {
  const token = useUserStore.getState().accessToken;
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });

  // If the server says unauthorized, the token is invalid/expired — force logout
  if (response.status === 401) {
    const { logout, isAuthenticated } = useUserStore.getState();
    if (isAuthenticated) {
      logout();
      window.location.href = "/login";
    }
  }

  return response;
}
