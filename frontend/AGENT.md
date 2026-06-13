# AGENT.md — Brainwave Frontend (Next.js + TypeScript)

> **For the next agent picking this up.** Read this start-to-finish before
> writing code. Every section answers "why is it this way?" so you don't
> have to re-derive the architecture from the file tree.

---

## 0. TL;DR

- This is the **new** Next.js 15 (App Router) + TypeScript rewrite of the
  Brainwave platform, sitting at [frontend/](.) of the monorepo.
- The original Vite + React + JavaScript app is preserved at
  [../frontend-old/](../frontend-old/) for reference during migration.
- Foundation is **done**: HTTP layer, repositories, services, stores,
  providers, route guards, auth flow, layouts, ~23 routes.
- Roughly **28 pages remain** to port from `frontend-old/src/pages/*.jsx`.
  Each port follows a fixed recipe — see §6.
- Build is currently green: `npm run typecheck && npm run lint && npm run build`
  all pass. Don't break this contract.

---

## 1. How to run

```bash
cd frontend
npm install            # only on first run
npm run dev            # localhost:3000
npm run build          # production build
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
```

Backend must be running at `NEXT_PUBLIC_API_URL` (default
`http://localhost:8000`). It's the same FastAPI backend the old frontend
talks to — **no backend changes are expected**.

`.env.local` is gitignored. `.env.example` documents the variables.

---

## 2. Tech stack (and why)

| Concern              | Choice                          | Notes |
|----------------------|---------------------------------|-------|
| Framework            | Next.js 15 (App Router)         | Routes are filesystem-based under `src/app/`. |
| Language             | TypeScript (strict)             | `tsconfig.json` enables `strict`. |
| Server state         | TanStack Query v5               | All API reads/writes go through query hooks. |
| Client state         | Zustand v5 (`persist`)          | Only for truly client-side state. **Do not put server data here.** |
| HTTP                 | axios via a shared `httpClient` | Single instance, single interceptor chain. |
| Forms                | React Hook Form + Zod           | Schemas live next to the feature in `*/schemas/`. |
| Styling              | Tailwind CSS v3                 | `darkMode: 'class'`. No CSS-in-JS. |
| Icons                | `lucide-react`                  | Tree-shaken. |
| Class merging        | `clsx` + `tailwind-merge`       | Exposed as `cn()` from `@utils/cn`. |

---

## 3. Architecture rules (read this twice)

Layers go **top → bottom only**. Never reach upward.

```
pages (src/app/*/page.tsx)
  └─ feature components (src/features/*/components/)
       └─ feature hooks    (src/features/*/hooks/)         ← useQuery / useMutation
            └─ services    (src/services/*Service.ts)      ← business shape, calls repos
                 └─ repositories (src/repositories/*Repository.ts)  ← only layer that knows axios
                      └─ core HTTP client (src/core/http/httpClient.ts)
```

### Hard rules

1. **Components never call axios directly.** They call feature hooks. Hooks
   call services. Services call repositories. Repositories call the shared
   `httpClient`.
2. **Repositories are the only place that knows URLs.** If you find yourself
   typing an HTTP path in a component or service, you're in the wrong file.
3. **TanStack Query owns server state.** Never duplicate fetched data into
   Zustand. The old `courseStore`/`assessmentStore`/`annotationStore`
   anti-pattern is what we're escaping.
4. **Zustand is for truly client state**: `userStore` (auth + profile cache),
   `themeStore` (preference), `notesStore` (local sticky notes). That's it.
5. **`tokenStorage` decouples HTTP from React.** The `httpClient` reads the
   token via a getter that `TokenBridge` registers at app bootstrap. Don't
   import `useUserStore` from any file under `core/` — it breaks SSR and
   creates a cycle.
6. **Auth via 401 = global logout.** The httpClient interceptor calls
   `tokenStorage.handleUnauthorized()` which clears `userStore` and
   redirects to `/login`. Match this behavior in any new flow.
7. **Imports use the `@` aliases** (see §4). No `../../../`.
8. **No `any` in repository/service signatures** unless the backend really
   returns an unknown shape — then use `unknown` and narrow at the call
   site. The exception is `Record<string, unknown>` for genuinely open
   backend payloads (admin reports, etc.).

### Soft conventions

- One repository per backend router domain. Name it `*Repository.ts`.
- One service per repository, same domain name. Name it `*Service.ts`.
- Query keys live in `src/constants/queryKeys.ts` as factory functions. Use
  them so cache invalidation is predictable.
- Routes live in `src/constants/routes.ts`. Use them in `<Link>` and
  `router.push()` instead of string literals.
- Forms: schema → resolver → `useForm<z.infer<typeof schema>>`. Don't
  validate manually with `useState`.

---

## 4. Folder map

```
src/
├── app/                     Next.js routes. Each */page.tsx is a route.
│
├── core/                    Framework-agnostic primitives. No React imports here.
│   ├── config/env.ts        Validated env access. The only place process.env is read.
│   ├── http/httpClient.ts   Shared axios instance + interceptors.
│   ├── auth/tokenStorage.ts Token getter registry (bridges Zustand into httpClient).
│   └── errors/ApiError.ts   Normalized error class (status, code, detail).
│
├── repositories/            Per-domain HTTP. The ONLY layer that knows URLs.
│   ├── BaseRepository.ts    get/post/patch/put/delete wrappers around httpClient.
│   └── *Repository.ts       Auth, Student, Test, Teacher, Admin, Head, Curriculum,
│                            Settings, Course, Assessment, Annotation, Notes.
│
├── services/                Per-domain business shape over repositories.
│
├── features/                Feature folders — self-contained.
│   ├── auth/
│   │   ├── components/      LoginForm, ForgotPasswordForm, RouteGuards, TokenValidator
│   │   ├── hooks/           useLogin, useAuthSession, useMaintenanceMode
│   │   └── schemas/         Zod schemas
│   ├── student/             StudentDashboard, useDashboard hooks
│   ├── teacher/             TeacherDashboard, TestManagement
│   ├── admin/               AdminDashboard, UserManagementTable
│   ├── head/                HeadDashboard
│   └── test/                TestCenter, TestSession, TestResult
│
├── shared/                  Curated cross-feature re-exports.
├── components/
│   ├── ui/                  Primitives: Button, Input, Card, Badge, Progress,
│   │                        ScrollArea, Textarea, Sheet
│   ├── common/              GlobalWatermark, PdfPreviewModal
│   ├── dashboard/           StickyNotesCard
│   └── feedback/            LoadingSpinner, ErrorState, PageLoadingFallback
│
├── layouts/                 DashboardLayout (role-based sidebar)
├── providers/               QueryProvider, ThemeProvider, ToastProvider, TokenBridge,
│                            AppProviders (composes all)
├── stores/                  Zustand: userStore, themeStore, notesStore
├── hooks/                   Cross-feature React hooks (currently empty placeholder)
├── queries/                 Currently empty — query hooks live inside features/.
├── types/                   api.ts, user.ts (shared TS types)
├── utils/                   cn, jwt, chatExport
├── constants/               routes, queryKeys, academic, lessons
├── assets/                  static (currently empty)
├── styles/                  globals.css (Tailwind layers)
└── tests/                   placeholder
```

### Path aliases (tsconfig.json `paths`)

`@/*`, `@app/*`, `@core/*`, `@features/*`, `@shared/*`, `@services/*`,
`@repositories/*`, `@hooks/*`, `@components/*`, `@layouts/*`, `@providers/*`,
`@stores/*`, `@queries/*`, `@types/*`, `@utils/*`, `@constants/*`,
`@assets/*`, `@styles/*`. Use these.

---

## 5. Critical flows

### 5.1 Auth + token lifecycle

1. **Login** — `LoginForm` calls `useLogin` (mutation) → `AuthService.login()`
   → `AuthRepository.login()`. On success, the hook calls
   `useUserStore.login(user, token)` and `router.replace(defaultRouteForRole(role))`.
2. **Token storage** — Token lives in `userStore.accessToken`, persisted to
   `localStorage` under `user-storage`.
3. **HTTP injection** — `TokenBridge` (mounted in `AppProviders`) registers
   a getter with `tokenStorage`. `httpClient`'s request interceptor reads
   it and sets `Authorization: Bearer <token>`.
4. **Validation** — `TokenValidator` (mounted in the root layout) runs
   `useAuthSession` on mount: checks JWT `exp` locally, schedules a logout
   timer at expiry, and pings `/api/auth/me` to verify server-side.
5. **401 logout** — Any 401 response triggers `tokenStorage.handleUnauthorized()`
   → clears `userStore`, redirects to `/login`. This is global and automatic.

### 5.2 Route guards (`features/auth/components/RouteGuards.tsx`)

- `<ProtectedRoute allowedRoles={["student"]}>` — requires auth; bounces
  wrong-role users to their own default dashboard via
  `AuthService.defaultRouteForRole()`.
- `<PublicRoute>` — bounces authenticated users away from `/login`.
- `<StaffRoute>` — sugar for `["admin", "teacher", "head"]`.
- Maintenance mode: `<ProtectedRoute>` checks `useMaintenanceMode()` and
  renders a maintenance block for non-admins.

Every new page should wrap its content in the appropriate guard and the
`<DashboardLayout>`. See any existing page for the pattern.

### 5.3 Adding a query/mutation

```ts
// 1. constants/queryKeys.ts — add a factory
export const queryKeys = {
  // ...
  myFeature: {
    list: () => ["myFeature", "list"] as const,
    detail: (id: string) => ["myFeature", "detail", id] as const,
  },
};

// 2. features/myFeature/hooks/useMyFeature.ts
export function useMyFeatureList() {
  return useQuery({
    queryKey: queryKeys.myFeature.list(),
    queryFn: () => MyFeatureService.list(),
  });
}
```

Don't pass raw arrays to `queryKey` — go through the factory so renames
stay safe.

---

## 6. Recipe: porting a page from frontend-old → frontend

Follow this in order. It's the same recipe for every remaining page.

1. **Read the old page**: `frontend-old/src/pages/SomePage.jsx`. Note which
   `services/api.js` methods it calls and which Zustand stores it reads.
2. **Check if the repository method exists**. If yes, great. If not, add it
   to the matching `repositories/*Repository.ts`. Each repo method is one
   typed endpoint.
3. **Surface it via the service**: add a `bind`-style passthrough in the
   matching `services/*Service.ts`.
4. **Add a query key factory** in `constants/queryKeys.ts` if you'll cache
   the read.
5. **Write the feature hook**: `features/<area>/hooks/useThing.ts`. Use
   `useQuery` for reads, `useMutation` for writes. Invalidate related keys
   in `onSuccess`.
6. **Write the feature component**: `features/<area>/components/Thing.tsx`.
   Use `LoadingSpinner` + `ErrorState` for loading/error UI. Use the
   `ui/` primitives. Use `cn()` for class merges.
7. **Create the route**: `src/app/<slug>/page.tsx`. Wrap in the right guard
   and `DashboardLayout`. Mark `"use client"` if the component uses hooks.
8. **Add the route constant** to `constants/routes.ts`.
9. **Add the nav item** to `layouts/DashboardLayout.tsx` if it belongs in
   the sidebar.
10. **Verify**: `npm run typecheck && npm run lint && npm run build`. The
    build is green today; keep it green.

If a `useSearchParams()` is needed in a page, wrap the consumer in
`<Suspense>` (see `test-session/page.tsx` for the pattern Next 15 requires).

---

## 7. What's done vs. what's left

### Done (foundation)

- HTTP client, ApiError, tokenStorage, env config
- 12 repositories + 12 services covering ~all backend domains
- TanStack Query provider with sensible retry rules (no retry on 401/403/404)
- Zustand stores: `userStore`, `themeStore`, `notesStore`
- Providers: `AppProviders` composes `TokenBridge → QueryProvider → ThemeProvider → ToastProvider`
- Route guards: `ProtectedRoute`, `PublicRoute`, `StaffRoute`, plus
  `TokenValidator` mounted in root layout
- `DashboardLayout` with role-based sidebar nav for all four roles
- Auth flow: Login (RHF + Zod), ForgotPassword (3-step OTP), token validation
- 23 pages live (see §8)
- UI primitives ported, common components ported, dashboard `StickyNotesCard` ported
- Constants: `academic.ts`, `lessons.ts`, `routes.ts`, `queryKeys.ts`
- Utils: `cn`, `jwt`, `chatExport`

### Empty scaffolding (intentional — placeholders for future work)

- `src/features/assessment/` — assessment work is currently in
  `features/test/`. Move it here if the assessment surface grows.
- `src/features/*/api/` and `src/features/*/types/` subdirectories — empty
  by design. Use them if a feature's types or api wrappers grow large.
- `src/hooks/`, `src/queries/`, `src/assets/`, `src/tests/` — empty.

### Not migrated (~28 pages remaining)

| Old page (`frontend-old/src/pages/*.jsx`) | Suggested new route | Notes |
|---|---|---|
| `BookToBot.jsx` | `/book-to-bot` | Needs `ChatbotPanel` port (535 lines). Wire to `AnnotationService` + chat streaming. |
| `Notes.jsx` (full UI) | `/notes` | Placeholder exists. Wire to `NotesService`. |
| `AssessmentBuilder.jsx` | `/assessment-builder` | Use `AssessmentService` (already in place). |
| `AssessmentTaker.jsx` | `/assessments/[id]` | |
| `CourseBuilder.jsx` | `/course-builder` | Use `CourseService`. |
| `CreateTest.jsx` | `/create-test` | Wire to `TestService`. |
| `TestManagement.jsx` | `/test-management` | Already partially covered by `/teacher-tests`. |
| `QuestionBank.jsx` | `/question-bank` | |
| `QuestionPapers.jsx` | `/question-papers` | |
| `BookManagementHierarchical.jsx` | `/book-management` | Needs new `BookRepository`. |
| `CurriculumManagement.jsx` | `/curriculum-management` | `CurriculumService` exists. |
| `SubjectsManagement.jsx` | `/subjects-management` | |
| `GroupManagement.jsx` | `/group-management` | |
| `HeadManagement.jsx` | `/head-management` | |
| `CareerQuestions.jsx`, `CareerTest.jsx`, `CareerResult.jsx` | `/career-*` | Needs new `CareerRepository`. |
| `Gradebook.jsx` | `/gradebook/[courseId]` | Dynamic route. |
| `StudentDashboard.jsx` (separate UI) | `/student-dashboard` | The simple `/dashboard` already exists. |
| `StudentGroups.jsx`, `StudentQueries.jsx` | `/my-groups`, `/my-queries` | |
| `Settings.jsx`, `TeacherSettings.jsx` | `/about-you`, `/teacher-settings` | |
| `StaffTests.jsx` | `/staff-tests` | |
| `Suggestions.jsx`, `AdminSuggestions.jsx` | `/suggestions`, `/admin-suggestions` | Needs new `SuggestionsRepository`. |
| `SupportTickets.jsx` | `/support-tickets` | Needs new `SupportRepository`. |
| `MaintenancePage.jsx` | `/maintenance` (or inline) | Already partially handled by `MaintenanceBlock` in `RouteGuards`. |
| `TeacherPlaceholder.jsx` | `/teacher` | Marketing landing. |
| `onboarding/` (folder) | `/onboarding/*` | Multi-step student onboarding. |

When porting career, support, suggestions, books — add the missing
repositories first. The pattern is `BookRepository → BookService → query
hooks → components → page`.

---

## 8. Active routes (`src/app/`)

```
/                     LandingPage
/login                PublicRoute → LoginForm
/forgot-password      ForgotPasswordForm (3-step OTP)
/dashboard            student → StudentDashboard + StickyNotesCard
/test                 student → TestCenter
/test-session         student → TestSessionView (Suspense for searchParams)
/test-result          student → TestResultView (Suspense for searchParams)
/notes                student → placeholder
/report-card          student → analytics dump
/teacher-dashboard    teacher
/teacher-tests        staff   → TestManagement
/teacher-groups       teacher
/teacher-queries      teacher/admin
/teacher-reports      teacher
/admin-dashboard      admin
/admin-reports        admin
/admin-settings       admin → placeholder
/student-management   admin → UserManagementTable role=student
/teacher-management   admin → UserManagementTable role=teacher
/head-dashboard       head
/head-groups          head
/head-tests           head
/head-reports         head
```

Build output: 26 prerendered routes (the above + `_not-found` and route
groups). All static-prerenderable; client interactivity hydrates on load.

---

## 9. Backend contract

The FastAPI backend lives at `../backend/`. Endpoints used by this app are
documented in `../API_ENDPOINTS.md` (kept in sync by the backend team).

Conventions:

- Auth: `POST /api/auth/login` returns `{ success, access_token, user }`.
  The login response shape is mirrored exactly in `types/user.ts`. If the
  backend changes it, update `LoginResponse` and `normalizeUser` in
  `services/AuthService.ts` in lockstep.
- Errors: backend usually returns `{ detail: "..." }` on non-2xx. The
  httpClient interceptor reads `detail`, `error`, or `message` (in that
  order) and stuffs it into `ApiError.detail`. Components should read
  `error.message` (the human string) or branch on `error.status`.
- Some endpoints return `{ success: false, error: "..." }` with a 200
  status. The `AuthService.login` flow handles this explicitly. If you
  hit another endpoint that does this, handle it in the service, not the
  hook.
- Streaming: `/api/chat/student/stream` uses SSE. Not yet implemented in
  the new app — the BookToBot port will need a streaming helper. The
  legacy implementation in `frontend-old/src/services/api.js` (search
  `studentChatStream`) is the reference.

---

## 10. Things that will bite you

1. **Next 15 + `useSearchParams`** must be wrapped in `<Suspense>` in any
   page that uses it. See `app/test-session/page.tsx`.
2. **`createJSONStorage` and SSR.** Zustand `persist` middleware tries to
   read `localStorage` on the server. Every store here returns a no-op
   storage when `typeof window === "undefined"`. Copy that pattern for any
   new persisted store.
3. **`"use client"` directive.** Every component that uses hooks (`useState`,
   `useEffect`, query hooks, store hooks) needs `"use client"` at the top
   of the file, or the file it lives in needs it. Pages that compose
   client components should themselves be client components.
4. **The eslint `no-img-element` rule.** We use `<img>` for user-supplied
   logos (`GlobalWatermark`). Disable per-line with
   `// eslint-disable-next-line @next/next/no-img-element` rather than
   silencing the rule globally.
5. **Don't import from `services/api.js`** — that file is in `frontend-old/`.
   Anything you need from it must be re-implemented in a repository.
6. **Don't reach into `frontend-old/` at runtime.** Treat it as
   read-only reference. It won't be built as part of this app.
7. **The `BaseRepository` constructors are `protected`** — the concrete
   repos export a singleton (`export const AuthRepository = new AuthRepositoryImpl()`).
   Follow this. Don't instantiate repositories in components.

---

## 11. When something doesn't fit

If a backend endpoint genuinely doesn't fit the repository/service split —
e.g., it's a one-off WebSocket subscription, an SSE stream, or an upload
that needs progress events — put it in `src/core/transports/` (new folder)
and document why. Don't shoehorn it through `BaseRepository`.

If a feature is shared across roles (analytics widgets, search), put it in
`src/components/` or a new top-level `src/features/shared-<thing>/`. Don't
duplicate.

---

## 12. Final checklist before you ship a PR

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] New routes wrapped in the correct guard + `DashboardLayout`
- [ ] New query keys go through `queryKeys.*` factories
- [ ] No `any` in service/repository signatures unless backend truly
      returns unknown shape
- [ ] No direct axios usage outside `core/http/httpClient.ts`
- [ ] No `process.env.*` reads outside `core/config/env.ts`
- [ ] No `localStorage` reads outside Zustand `persist` config
- [ ] Imports use `@` aliases, not `../../`

---

_Last updated: 2026-06-13 — covers the foundation work + 23 routes._
_Old app preserved at [../frontend-old/](../frontend-old/)._
