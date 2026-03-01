/**
 * Central runtime config
 * Set NEXT_PUBLIC_API_URL in .env.local to point to your backend.
 * All other feature toggles live in src/config/features.ts
 */

export const env = {
    /** FastAPI backend base URL – set via NEXT_PUBLIC_API_URL */
    API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
    /** Display name for the app */
    APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'THE BRAINWAVE',
    /** Frontend origin */
    APP_URL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
} as const;
