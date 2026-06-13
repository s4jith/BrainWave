/**
 * Lightweight JWT helpers. We never verify signatures client-side —
 * verification happens on the API. We only peek at `exp` to drive UX
 * (force-logout on local expiry, schedule a logout timer).
 */

interface JwtPayload {
  exp?: number;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    if (typeof window === "undefined") {
      return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    }
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

export function getJwtExpiryMs(token: string | null | undefined): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return null;
  return Number(payload.exp) * 1000;
}

export function isJwtExpired(token: string | null | undefined): boolean {
  const expiryMs = getJwtExpiryMs(token);
  if (expiryMs == null) return false;
  return Date.now() >= expiryMs;
}
