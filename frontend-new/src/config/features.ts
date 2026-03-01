/**
 * ─────────────────────────────────────────────────────────────────
 * FEATURE FLAGS & PLATFORM CONFIG
 * ─────────────────────────────────────────────────────────────────
 * All environment-driven toggles live here.
 * Set values in .env.local — never hard-code secrets.
 *
 * Quick guide:
 *   NEXT_PUBLIC_ENROLLMENT_ENABLED=true   → students can self-register
 *   NEXT_PUBLIC_AI_CHAT_ENABLED=true      → AI chatbot tab is visible
 *   NEXT_PUBLIC_BOOK_TO_BOT_ENABLED=true  → Book-to-Bot reader is visible
 *   NEXT_PUBLIC_API_URL=https://api.example.com  → backend base URL
 * ─────────────────────────────────────────────────────────────────
 */

// ── API ───────────────────────────────────────────────────────────
export const API_BASE_URL: string =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Auth & Registration ───────────────────────────────────────────

/** Allow new users to self-register via the /signup page */
export const ENROLLMENT_ENABLED: boolean =
    process.env.NEXT_PUBLIC_ENROLLMENT_ENABLED === 'true';

/** Show "Forgot password" link on login page */
export const FORGOT_PASSWORD_ENABLED: boolean =
    process.env.NEXT_PUBLIC_FORGOT_PASSWORD_ENABLED !== 'false'; // default ON

// ── Student Features ──────────────────────────────────────────────

/** Show AI Study Assistant chat tab in student navigation */
export const AI_CHAT_ENABLED: boolean =
    process.env.NEXT_PUBLIC_AI_CHAT_ENABLED !== 'false'; // default ON

/** Show Book-to-Bot (PDF reader + AI) in student navigation */
export const BOOK_TO_BOT_ENABLED: boolean =
    process.env.NEXT_PUBLIC_BOOK_TO_BOT_ENABLED !== 'false'; // default ON

/** Show Smart Notes page in student navigation */
export const SMART_NOTES_ENABLED: boolean =
    process.env.NEXT_PUBLIC_SMART_NOTES_ENABLED !== 'false'; // default ON

/** Show Report Card page in student navigation */
export const REPORT_CARD_ENABLED: boolean =
    process.env.NEXT_PUBLIC_REPORT_CARD_ENABLED !== 'false'; // default ON

/** Show Student Queries page */
export const QUERIES_ENABLED: boolean =
    process.env.NEXT_PUBLIC_QUERIES_ENABLED !== 'false'; // default ON

/** Show Student Suggestions page */
export const SUGGESTIONS_ENABLED: boolean =
    process.env.NEXT_PUBLIC_SUGGESTIONS_ENABLED !== 'false'; // default ON

// ── Teacher Features ──────────────────────────────────────────────

/** Allow teachers to manage question papers */
export const QUESTION_PAPERS_ENABLED: boolean =
    process.env.NEXT_PUBLIC_QUESTION_PAPERS_ENABLED !== 'false'; // default ON

/** Show gradebook for teachers */
export const GRADEBOOK_ENABLED: boolean =
    process.env.NEXT_PUBLIC_GRADEBOOK_ENABLED !== 'false'; // default ON

// ── Platform ──────────────────────────────────────────────────────

/** Show in-app support ticket system */
export const SUPPORT_ENABLED: boolean =
    process.env.NEXT_PUBLIC_SUPPORT_ENABLED !== 'false'; // default ON

/** Show notifications bell */
export const NOTIFICATIONS_ENABLED: boolean =
    process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED !== 'false'; // default ON

// ── Combined export for convenience ──────────────────────────────
export const featureFlags = {
    enrollmentEnabled: ENROLLMENT_ENABLED,
    forgotPasswordEnabled: FORGOT_PASSWORD_ENABLED,
    aiChatEnabled: AI_CHAT_ENABLED,
    bookToBotEnabled: BOOK_TO_BOT_ENABLED,
    smartNotesEnabled: SMART_NOTES_ENABLED,
    reportCardEnabled: REPORT_CARD_ENABLED,
    queriesEnabled: QUERIES_ENABLED,
    suggestionsEnabled: SUGGESTIONS_ENABLED,
    questionPapersEnabled: QUESTION_PAPERS_ENABLED,
    gradebookEnabled: GRADEBOOK_ENABLED,
    supportEnabled: SUPPORT_ENABLED,
    notificationsEnabled: NOTIFICATIONS_ENABLED,
} as const;

export type FeatureFlags = typeof featureFlags;
