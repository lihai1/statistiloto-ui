# Statistiloto UI — Requirements

Derived from the actual codebase (`package.json`, `angular.json`,
`src/app/` source files, `Dockerfile`, `nginx.conf`).

---

## Functional Requirements

### Feature Pages

- **FR-1** **Home** (`/`) — landing page. Shows login/register CTAs for
  unauthenticated users. For authenticated users, shows action links to
  Generate, Lucky, Statistics, Analyze, Saved Numbers, and AI Assistant.
  Route: public (no auth guard).

- **FR-2** **Generate** (`/generate`, auth required) — generate lottery
  number combinations with configurable parameters: howMany, formType,
  willBe (preferred numbers), date range (via archive window), and strength
  mode. Results displayed via `NumberSetListComponent`. Each result set can
  be analyzed in a modal (`AnalyzeModalComponent`) or saved to a category
  (forms/lucky). Integrates with `AgentContextService` for agent-assisted
  generation context.

- **FR-3** **Statistics** (`/statistics`, auth required) — calculate
  frequent number pairs/groups over a date range with configurable group
  size. Results displayed as number sets with occurrence counts. Includes
  archive window for date filtering and analyze modal for detailed
  inspection of any pair.

- **FR-4** **Analyze** (`/analyze`, auth required) — evaluate user-selected
  numbers against historical winning draws. Uses `groupBySize` utility to
  group results by combination size (1–6). Displays frequency groups with
  `LotteryBallComponent` for visual number rendering. Includes archive
  window for date range selection and analyze modal for detailed breakdown.

- **FR-5** **Lucky** (`/lucky`, auth required) — generate lucky numbers
  with interactive number selection. User adds/removes numbers via
  `LotteryBallComponent` (click to remove). Selected numbers are
  front-loaded as willBe into the generation request. Results can be
  saved or analyzed via modal.

- **FR-6** **Saved Numbers** (`/saved`, auth required) — CRUD saved number
  sets per authenticated user. Groups saved sets by category (forms vs
  lucky) with count badges. Shows loading, error, and empty states. Each
  saved set can be analyzed via modal or deleted. Calls
  `GET /api/user/numbers`, `POST /api/user/numbers`, `DELETE /api/user/numbers/{id}`.

- **FR-7** **Assistant** (`/assistant`, auth required) — full-page AI
  agent chat. Uses `AgentChatComponent` with SSE streaming. "New Chat"
  button resets session ID. Full-height chat container
  (`calc(100vh - 140px)`). Displays HITL approval prompts when the agent
  requests a write operation.

- **FR-8** **Admin — LLM Config** (`/admin/llm-config`, auth + admin role)
  — manage LLM configurations at runtime. Edit the active config (provider
  select ollama/gemini/mock, model name, base URL, API key, request timeout)
  via `GET /api/agent/llm-config` and `PUT /api/agent/llm-config`. List, create,
  activate, delete, and smoke-test stored configurations via
  `GET/POST /api/agent/llm-configs`, `PUT /api/agent/llm-configs/{id}/activate`,
  `POST /api/agent/llm-configs/{id}/test`, `DELETE /api/agent/llm-configs/{id}`.
  Fetch available models per provider via `GET /api/agent/llm-models?provider=...`.
  Uses PrimeNG `p-select`, `p-inputtext`, `p-button`, `p-card`.

- **FR-9** **Admin — Scraper** (`/admin/scraper`, auth + admin role) —
  trigger the lottery scraper manually. Shows status indicator (idle /
  running with spinner). Trigger sends a chat message to the agent with
  `trigger_scraper` intent, which is HITL-gated. Uses PrimeNG `p-card`,
  `p-button`.

- **FR-10** **Admin — Audit Log** (`/admin/audit-log`, auth + admin role)
  — view agent audit log entries in a filterable PrimeNG `p-table`.
  Columns: userSub, tier, action, details, timestamp. Includes search
  filter input. Calls `GET /api/agent/audit-log`.

- **FR-11** **Admin — Token Usage** (`/admin/token-usage`, auth + admin
  role) — view token consumption metrics in a PrimeNG `p-table`.
  Columns: userSub, tier, provider, model, promptTokens, completionTokens,
  cost, timestamp. Calls `GET /api/agent/token-usage`.

- **FR-12** **Admin shell** (`/admin`, auth + admin role) — container
  component with child routes for all admin sub-pages. Default redirect
  to `/admin/llm-config`.

- **FR-12a** **Agent Sessions** (any authenticated user) — the assistant
  experience exposes session management: list the user's chat sessions, load
  a session's full message history, delete one session, or delete all
  sessions. Calls `GET /api/agent/sessions`,
  `GET /api/agent/sessions/{sessionId}`,
  `DELETE /api/agent/sessions/{sessionId}`, `DELETE /api/agent/sessions`.

- **FR-12b** **Admin — RAG Reindex** (auth + admin role) — trigger a rebuild
  of the agent's `docs` RAG corpus. Calls `POST /api/agent/reindex`. Exposed
  from the admin section (currently driven via the agent chat / admin tools).

### Authentication
- **FR-13** Users log in via Keycloak OIDC (authorization-code + PKCE).
- **FR-14** Route guards (`authGuard`) redirect unauthenticated users to
  Keycloak login. Public routes: `/` (home) and `**` (redirect to home).
  All other routes require authentication.
- **FR-15** JWT is attached to all API requests via `auth.interceptor.ts`.
- **FR-16** Silent SSO check via hidden iframe (`silent-check-sso.html`).
- **FR-17** Registration button on home page calls `auth.register()`
  (Keycloak registration page).

### Internationalization
- **FR-18** Hebrew as primary language with RTL support.
- **FR-19** `LanguageService` for runtime language switching.
- **FR-20** `TranslatePipe` (`| translate`) used in all templates for i18n
  strings (e.g., `generate.title`, `stats.subtitle`, `admin.llmConfig`).

### PWA
- **FR-21** Installable PWA with service worker (`manifest.webmanifest`).
- **FR-22** Offline shell — cached static assets served when offline.

---

## UI/UX Requirements

- **UX-1** Standalone components (no NgModules), OnPush change detection,
  Angular signals for reactive state.
- **UX-2** PrimeNG 20 component library + PrimeIcons
  (`p-card`, `p-button`, `p-select`, `p-inputtext`, `p-table`).
- **UX-3** SCSS styling with CSS variables for theming.
- **UX-4** Theme service for light/dark mode.
- **UX-5** Responsive layout (mobile + desktop).
- **UX-6** Toast notifications (`ToastService` + `ToastOverlayComponent`)
  for errors and success messages.
- **UX-7** Side menu navigation (`SideMenuComponent`).

### Shared Components

- **UX-8** `LotteryBallComponent` — visual number ball with variant
  (regular/strong) and size (sm/md/lg) props; clickable for removal in
  Lucky page.
- **UX-9** `NumberSetComponent` — displays a single number set (regular
  numbers + optional strong number) using `LotteryBallComponent`.
- **UX-10** `NumberSetListComponent` — displays a list of number sets with
  action buttons (analyze, save, delete). Used by Generate, Statistics,
  Lucky, and Saved Numbers pages.
- **UX-11** `AnalyzeModalComponent` — reusable modal showing detailed
  analysis of any number set against historical draws. Used by Generate,
  Statistics, Analyze, Lucky, and Saved Numbers pages.
- **UX-12** `ArchiveWindowComponent` — reusable date range selector for
  filtering historical draws. Used by Generate, Statistics, and Analyze
  pages. Backed by `ArchiveWindowService` for shared state.
- **UX-13** `AgentChatComponent` — full chat interface with SSE streaming,
  message history, and HITL approval dialog. Used by Assistant page and
  embedded in `AgentWidgetComponent`.
- **UX-14** `AgentWidgetComponent` — floating agent panel that can be
  opened on any page (not just `/assistant`). Wraps `AgentChatComponent`.
  Toggled via `AgentContextService`.

---

## Auth Requirements

- **AUTH-1** `keycloak-js` SDK for OIDC authorization-code + PKCE flow.
- **AUTH-2** `AUTH_CONFIG` injection token provides Keycloak config at runtime.
- **AUTH-3** `AuthService` manages login, logout, token refresh, and user info.
- **AUTH-4** `auth.guard.ts` protects routes — redirects to login if not authenticated.
- **AUTH-5** `auth.interceptor.ts` attaches `Authorization: Bearer <token>` to all `/api/*` requests.
- **AUTH-6** `error.interceptor.ts` handles 401 (redirect to login) and 429 (rate limit message).
- **AUTH-7** Client ID: `statistiloto-ui` (public client, PKCE — no client secret).

---

## API Integration Requirements

- **API-1** The UI talks ONLY to the Java BFF at `/api/*` through Traefik.
- **API-2** The UI NEVER calls the Go lottery service directly.
- **API-3** `ApiService` wraps `HttpClient` for all lottery endpoints
  (`/api/generate/form`, `/api/generate/statistics`, `/api/generate/analyze`).
- **API-4** `AgentService` handles SSE streaming for `/api/agent/chat` and
  POST for `/api/agent/approve`. It also wraps the admin/telemetry surface:
  LLM config (`GET/PUT /api/agent/llm-config`), stored LLM configs
  (`GET/POST /api/agent/llm-configs`, `PUT .../{id}/activate`,
  `POST .../{id}/test`, `DELETE .../{id}`), model listing
  (`GET /api/agent/llm-models`), token usage (`GET /api/agent/token-usage`),
  audit log (`GET /api/agent/audit-log`), RAG reindex (`POST /api/agent/reindex`),
  health (`GET /api/agent/health`), and chat session CRUD
  (`GET/DELETE /api/agent/sessions`, `GET/DELETE /api/agent/sessions/{id}`).
- **API-5** `AgentContextService` manages agent session state and chat history,
  and exposes `ask()` to open the assistant widget with a pre-filled message
  from any feature page.
- **API-6** All API base URLs are relative (`/api`) — Traefik routes to the BFF.

---

## Testing Requirements

- **TEST-1** Unit tests with Karma + Jasmine (co-located `.spec.ts` files).
- **TEST-2** E2E tests with Playwright (`e2e/full-flow.spec.ts`,
  `e2e/admin-agent.spec.ts`).
- **TEST-3** E2E tests run against the full stack via Traefik (base URL:
  `http://localhost`).
- **TEST-4** Test environment supports auto-creating test users via Keycloak
  admin API.
- **TEST-5** `npm test` runs unit tests; `npx playwright test` runs E2E.

---

## Non-Functional Requirements

- **NFR-1** Angular 20 with signals for reactive state.
- **NFR-2** Multi-stage Docker build (node:22 build → nginx:1.27 serve).
- **NFR-3** Nginx SPA fallback, security headers, gzip, immutable caching.
- **NFR-4** Environment-specific config (`environment.ts` / `environment.prod.ts`).
- **NFR-5** `--legacy-peer-deps` for npm install (PrimeNG peer dep compatibility).
