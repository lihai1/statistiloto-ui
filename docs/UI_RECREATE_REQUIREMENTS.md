# Statistiloto UI — Recreation Requirements Specification

> **Purpose:** A complete, implementation-agnostic specification of the
> Statistiloto lottery analysis web application UI. It describes **what** the
> application does — every user flow, screen, interaction, behavior, and API
> contract — without prescribing **how** to implement it. An AI or developer
> can use this to recreate the UI using any frontend technology stack.
>
> The application is a **Progressive Web App (PWA)**: installable, works
> offline (cached shell), and served as static files behind a reverse proxy.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture Context](#2-architecture-context)
3. [API Contracts](#3-api-contracts)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Internationalization & Direction](#5-internationalization--direction)
6. [Theming](#6-theming)
7. [PWA Requirements](#7-pwa-requirements)
8. [App Shell & Navigation](#8-app-shell--navigation)
9. [Screens & Functional Requirements](#9-screens--functional-requirements)
10. [Shared UI Building Blocks](#10-shared-ui-building-blocks)
11. [User Flows (Step-by-Step)](#11-user-flows-step-by-step)
12. [Responsive & Layout Requirements](#12-responsive--layout-requirements)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Edge Cases & Gotchas](#14-edge-cases--gotchas)

---

## 1. Product Overview

**Statistiloto** is a Hebrew-first, RTL-by-default web application for Israeli
lottery analysis and number generation. It lets users:

- Generate lottery forms (systematic combinations that have never historically
  won)
- Manage personal "lucky numbers" (up to 8)
- View historical statistics (most frequent number groups)
- Analyze arbitrary number sets against historical draws (frequency by group
  size 1–6, with recursive sub-group analysis)
- Save and organize generated forms, group statistics, and lucky numbers
- Chat with an AI assistant (with human-in-the-loop approval for
  data-changing actions)
- Administer the system (LLM config, token usage, audit log, scraper control)

The lottery number range is **1–37**. A "strong" number is a special
highlighted number (the last number in a form).

---

## 2. Architecture Context

The UI is one service in a larger system:

```
Browser → Reverse Proxy → (UI static files, /api/* Java BFF, /auth/* auth, /agent/* agent)
Java BFF → gRPC → Go lottery service
Agent → gRPC → Go, HTTP → LLM, HTTP → Java BFF
```

**Hard constraints:**
- The UI talks **only** to the Java BFF via the relative path `/api/*`. The
  reverse proxy routes it.
- The UI **never** calls the Go lottery service or the Python agent directly.
  All agent endpoints are proxied by the BFF under `/api/agent/*`.
- All API base URLs are relative (`/api`).

---

## 3. API Contracts

All requests carry `Authorization: Bearer <JWT>` (see §4). Responses are JSON.

### 3.1 Lottery & Saved Numbers (`/api`)

| Operation | Method | Path | Request Body | Response |
|---|---|---|---|---|
| Generate forms | POST | `/api/generate/form` | `GenerateFormRequest` | `LotteryResultResponse` |
| Get statistics | POST | `/api/generate/statistics` | `StatisticsRequest` | `LotteryResultResponse` |
| Analyze numbers | POST | `/api/generate/analyze` | `AnalyzeRequest` | `LotteryResultResponse` |
| List saved numbers | GET | `/api/user/numbers` | — | `SavedNumbersResponse[]` |
| Save numbers | POST | `/api/user/numbers` | `SaveNumbersRequest` | `SavedNumbersResponse` |
| Delete saved numbers | DELETE | `/api/user/numbers/{id}` | — | `void` |
| Get current user profile | GET | `/api/me` | — | `UserProfileResponse` |

### 3.2 Agent & Admin (`/api/agent`)

| Operation | Method | Path | Request Body | Response |
|---|---|---|---|---|
| Send chat message | POST | `/api/agent/chat` | `AgentChatRequest` | `AgentChatResponse` |
| Approve/reject proposed action | POST | `/api/agent/approve` | `AgentApproveRequest` | `AgentChatResponse` |
| Get LLM config | GET | `/api/agent/llm-config` | — | `LlmConfig` |
| Update LLM config | PUT | `/api/agent/llm-config` | `LlmConfigUpdate` | `LlmConfigUpdateResponse` |
| Agent health | GET | `/api/agent/health` | — | `{ status: string }` |
| Token usage report | GET | `/api/agent/token-usage` | — | `{ rows: TokenUsageRow[] }` |
| Audit log | GET | `/api/agent/audit-log?limit={n}` | — | `{ rows: AuditLogRow[] }` |

### 3.3 Data Shapes

```ts
// ── Lottery ──
interface GenerateFormRequest {
  howMany: number;
  formType?: number;        // 6–12
  willBe?: number[];        // preferred/lucky numbers to include
  from?: string;            // YYYY-MM-DD archive start
  to?: string;              // YYYY-MM-DD archive end
  strength?: 'strong' | 'weak';
}

interface StatisticsRequest {
  howMany: number;
  formType?: number;        // group size 1–6
  from?: string;
  to?: string;
  strength?: 'strong' | 'weak';
}

interface AnalyzeRequest {
  form: number[];
  from?: string;
  to?: string;
}

interface PairResponse { numbers: number[]; count: number; }
interface FrequencyEntryResponse { numbers: number[]; count: number; }
interface FrequencyGroupResponse {
  size: number;             // 1–6
  combos: number;           // total possible combinations C(37, size)
  entries: FrequencyEntryResponse[];
}
interface LotteryResultResponse {
  forms?: number[][];              // generate result
  pairs?: PairResponse[];          // statistics result
  frequencyGroups?: FrequencyGroupResponse[];  // analyze result
}

// ── Saved numbers ──
type NumbersCategory = 'lucky' | 'user-generated' | 'group-calculated';

interface SaveNumbersRequest {
  category: NumbersCategory;
  numbers: number[];
  willBe?: number[];
  dateFrom?: string;
  dateTo?: string;
}
interface SavedNumbersResponse {
  id: number;
  category: NumbersCategory;
  numbers: number[];
  willBe?: number[];
  dateFrom?: string;
  dateTo?: string;
  createdAt: string;       // ISO timestamp
}

interface UserProfileResponse {
  sub: string;
  email: string;
  displayName: string;
  roles: string[];
}

// ── Agent ──
interface AgentChatRequest { sessionId: string; message: string; intent?: string; }
interface AgentApproveRequest { sessionId: string; approved: boolean; edited?: string; }
interface AgentChatResponse {
  response?: string;
  thread_id?: string;
  paused?: boolean;        // true → HITL approval required
}

interface LlmConfig {
  provider: string;
  model: string;
  base_url?: string;
  api_key?: string;
  request_timeout_seconds?: number;
}
interface LlmConfigUpdate {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  requestTimeoutSeconds?: number;
}
interface LlmConfigUpdateResponse {
  provider: string; model: string; status: string; note: string;
}

interface TokenUsageRow {
  user_sub: string; tier: string; provider: string; model: string;
  prompt_tokens: number; completion_tokens: number; cost_usd: number; calls: number;
}
interface AuditLogRow {
  user_sub: string; tier: string; action: string; details: any; ts: number; // unix seconds
}
```

### 3.4 Important Response Semantics

- **Generate forms:** Each form is an array of numbers. If the array is
  longer than `formType`, the **last element is the "strong" number** and
  must be displayed distinctly (separated from the regular numbers).
- **Analyze frequency groups:** The response contains one
  `FrequencyGroupResponse` per group size (1–6). The UI must always render
  tabs for sizes 1–6 even if some are missing (show empty state).
- **Agent chat `paused: true`:** The agent is requesting approval for a
  data-changing action. The UI must show an approval dialog (approve/reject)
  and call `/api/agent/approve` with the user's decision.

---

## 4. Authentication & Authorization

### 4.1 Authentication mechanism

- **OIDC authorization-code flow with PKCE (S256)** via an external identity
  provider (Keycloak).
- **Silent SSO check** on app load: a hidden iframe checks if the user has an
  existing SSO session without a full redirect. A dedicated static HTML page
  at the web root (`silent-check-sso.html`) posts the redirect URL back to the
  app origin via `postMessage`.
- Realm: `statistiloto`. Client ID: `statistiloto-ui` (public client, PKCE —
  no client secret).
- **Config differs by environment:** dev uses an absolute auth URL
  (`http://localhost/auth`), prod uses a relative URL (`/auth`).

### 4.2 Token handling

- The access token (JWT) is attached as `Authorization: Bearer <token>` to
  **all** `/api/*` requests.
- The token is refreshed proactively when it will expire within 30 seconds.
- On 401 responses: log a warning (token may be expired). On 429: log a
  warning (rate limited). The interceptor does **not** redirect or show
  toasts — error display is the responsibility of the calling screen.

### 4.3 Authorization

- **Authentication** is enforced client-side via route guards: unauthenticated
  users hitting a protected route are redirected to the auth provider login.
- **Admin authorization** is enforced by the **BFF** (returns 403 for
  non-admin users on `/api/agent/*` admin endpoints). The UI additionally
  hides admin navigation when the user is not an admin, but does not block
  navigation — a non-admin navigating to an admin URL sees the screen render
  with empty/default data because the API calls fail silently.
- Admin role detection: the user is an admin if their token's realm roles
  include `ADMIN`/`admin`, OR their groups include `/admins`.

### 4.4 Auth actions available to the UI

- **Login:** redirect to auth provider login, return to current URL.
- **Register:** redirect to auth provider registration, return to current URL.
- **Logout:** clear local auth state, redirect to auth provider logout, return
  to app root.

### 4.5 Reactive auth state

The UI must expose reactive auth state to the shell:
- `isAuthenticated: boolean`
- `username: string | null` (from token's `preferred_username`)
- `isAdmin: boolean`

### 4.6 Test users

- `admin@statistiloto.local` / `admin-password-change-me` — USER, ADMIN
- `user@statistiloto.local` / `user-password-change-me` — USER (free tier)
- `paid@statistiloto.local` / `paid-password-change-me` — USER, PAID tier

---

## 5. Internationalization & Direction

### 5.1 Languages

- **Two languages: Hebrew (`he`) and English (`en`).**
- **Hebrew is the default.**
- Toggling language switches:
  - All UI text (via a translation dictionary keyed by dot-path strings, e.g.
    `generate.title`, `admin.llmConfig.provider`).
  - Document direction: Hebrew → `rtl`, English → `ltr`.
  - Document `lang` attribute.
- The toggle button displays the **opposite** language's code ("EN" when in
  Hebrew, "עב" when in English).
- Translations support `{name}` interpolation (e.g.
  `analyze.frequencyOf` → "Frequency of {n} numbers").

### 5.2 RTL/LTR awareness

- The entire layout must flip correctly for RTL: sidebar position, margins,
  message alignment in chat, floating widget position, drawer slide
  direction.
- The `dir` attribute on `<html>` is the source of truth for direction.

### 5.3 Translation key groups

The dictionary covers: app shell/title, navigation, auth, language toggle,
menu sections, agent/assistant, admin (llm-config, token-usage, audit-log,
scraper), home, generate, lucky, statistics, analyze, saved numbers, archive
window, and common strings (error, loading, close, etc.). Approximately 180
keys in each language.

---

## 6. Theming

### 6.1 Light/dark mode

- **Two modes: light and dark.** Light is the default unless the user's OS
  preference is dark.
- Toggle button in the header (sun icon in dark mode, moon icon in light).
- Preference persists in `localStorage` (key `statistiloto-theme`).
- Dark mode is applied by adding a class (e.g. `.app-dark`) to the `<html>`
  element, which swaps CSS custom properties.

### 6.2 Design tokens (CSS custom properties)

| Token | Light | Dark |
|---|---|---|
| `--primary` | `#1976d2` | `#64b5f6` |
| `--primary-dark` | `#1565c0` | `#42a5f5` |
| `--bg` | `#fafafa` | `#121212` |
| `--card-bg` | `#ffffff` | `#1e1e1e` |
| `--text` | `#212121` | `#e0e0e0` |
| `--text-secondary` | `#757575` | `#9e9e9e` |
| `--border` | `#e0e0e0` | `#333333` |
| `--danger` | `#d32f2f` | `#ef5350` |
| `--success` | `#388e3c` | `#66bb6a` |
| `--ball-regular` | `#e53935` (red) | `#ef5350` |
| `--ball-strong` | `#1976d2` (blue) | `#64b5f6` |
| `--ball-muted` | `#eceff1` | `#2c2c2c` |
| `--sidebar-width` | `240px` | `240px` |

### 6.3 Visual language

- Lottery numbers are rendered as **circular balls**: red for regular, blue
  for "strong", light/muted for unselected pick grids.
- Cards: white (light) / dark (dark) background, 8px radius, subtle shadow,
  20px padding.
- Buttons: primary (filled blue), secondary (outlined blue), danger (red),
  success (green).
- Tier badges in admin tables: free (gray), paid (orange), admin (blue).

---

## 7. PWA Requirements

- **Installable:** web manifest with name "Statistiloto", short name
  "Statistiloto", description "Israeli lottery analysis and number
  generation", `display: standalone`, `lang: he`, `dir: rtl`, theme color
  `#1976d2`, background color `#ffffff`, icons at 192px and 512px.
- **Service worker:** registered only in production builds. Registration
  strategy: register when the app becomes stable (with a 30s timeout). The
  service worker file (`ngsw-worker.js`) must be served with
  `Cache-Control: no-cache`. Default SW caching config (no custom config
  file).
- **Offline shell:** static assets cached; SPA fallback for all routes.
- **`ng serve` (dev) does NOT register the service worker.**

### 7.1 Static file serving (nginx)

- SPA fallback: `try_files $uri $uri/ /index.html`.
- `ngsw-worker.js`: `Cache-Control: no-cache`.
- Static assets (css, js, png, jpg, gif, svg, ico, woff/woff2): `expires 1y`,
  `Cache-Control: public, immutable`.
- Security headers: `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`.
- Gzip for css, js, json, svg.

### 7.2 `index.html`

- `<html lang="he" dir="rtl">` (set statically; toggled dynamically at
  runtime).
- `<title>Statistiloto</title>`.
- Viewport meta: `width=device-width, initial-scale=1`.
- Favicon, manifest link, theme-color meta (`#1976d2`).

---

## 8. App Shell & Navigation

### 8.1 Layout

```
┌─────────────────────────────────────────────────┐
│ Sidebar │  Header [hamburger] [spacer] [theme][lang] │
│ (nav)   │─────────────────────────────────────────│
│         │  Main content (<router-outlet>)            │
│         │                                            │
│ Footer  │                                            │
│ (auth)  │                                            │
└─────────┴─────────────────────────────────────────┘
                                  │
                  Bottom tab bar (mobile only)
                  + Floating AI widget (if authed)
                  + Toast overlay (always)
```

### 8.2 Sidebar

- **Desktop (>768px):** Fixed sidebar, 240px wide, visible by default.
  Contains:
  - Brand title linking to home.
  - Navigation links grouped into sections:
    - **Navigation:** Home, Generate, Lucky, Statistics, Analyze, Saved
    - **AI:** Assistant
    - **Admin** (only if user is admin): LLM Config, Token Usage, Audit Log,
      Scraper
  - Footer: if authenticated → username + logout; if not → login + register
    buttons.
  - A hamburger toggle in the header collapses/expands the sidebar.
- **Mobile (≤768px):** Sidebar hidden by default. Hamburger opens it as an
  overlay with a semi-transparent scrim behind it. Clicking the scrim closes
  the sidebar.

### 8.3 Header

- Hamburger menu toggle (mobile only; hidden on desktop).
- Spacer.
- Theme toggle button (sun/moon icon).
- Language toggle button (shows opposite language code).

### 8.4 Bottom tab bar (mobile only)

Five tabs, hidden on desktop:
1. Home
2. Generate
3. Assistant
4. Statistics
5. **Admin** (if user is admin) **OR Saved** (if not admin)

### 8.5 Floating AI widget

- Visible only when authenticated.
- **Closed state:** floating action button (FAB) at bottom-right (bottom-left
  in RTL), 56px circular, chat icon.
- **Open state:** panel (~380px wide, ~520px tall on desktop; full-width
  bottom sheet on mobile) with header (title + close button) and embedded
  chat. Scrim behind panel (click to close).
- Can be opened contextually from feature pages with a pre-filled message
  (see §10.4 and §11).

### 8.6 Toast & loading overlay

- Always present.
- **Loading overlay:** centered dark box with spinner + "Computing" text.
- **Toasts:** top-center, stacked, auto-dismissing. Types: info (blue, 3s),
  error (red, 5s), success (green, 3s). Click to dismiss.

### 8.7 Routes

| Path | Auth | Screen |
|---|---|---|
| `/` | none | Home |
| `/generate` | USER | Generate |
| `/lucky` | USER | Lucky Numbers |
| `/statistics` | USER | Statistics |
| `/analyze` | USER | Analyze |
| `/saved` | USER | Saved Numbers |
| `/assistant` | USER | Assistant |
| `/admin` | ADMIN | Admin shell (redirects to `/admin/llm-config`) |
| `/admin/llm-config` | ADMIN | LLM Config |
| `/admin/token-usage` | ADMIN | Token Usage |
| `/admin/audit-log` | ADMIN | Audit Log |
| `/admin/scraper` | ADMIN | Scraper Control |
| `**` | — | redirect to `/` |

- All protected routes redirect unauthenticated users to auth provider login.
- The Analyze route accepts a `?form=1,2,3` query param that pre-fills
  numbers and auto-runs analysis.
- Routes are lazy-loaded (code-split per screen).

---

## 9. Screens & Functional Requirements

### 9.1 Home (`/`)

**Public (no auth).**

- Centered hero card with app title and subtitle ("Israeli lottery analysis
  and number generation based on historical patterns").
- **Unauthenticated:** two buttons — "Get Started" (login) and "Register".
- **Authenticated:** six action links — Generate, Lucky, Statistics, Analyze,
  Saved, Assistant (the Assistant link is highlighted as an AI CTA with a
  chat icon).

### 9.2 Generate (`/generate`)

**Auth required.**

**Inputs:**
- **Form type:** select 6–12. Option `6` is labeled "Regular"; others show
  the number.
- **How many:** numeric input, 1–20, default 10.
- **Strength:** select strong/weak, default strong.
- **Archive date range:** shared date-range picker (from/to, see §10.5).
  Defaults: from `2004-02-12`, to today.
- **Lucky number picker (conditional):** if the user has saved lucky number
  sets, show a card picker with a "No lucky numbers" option and one card per
  saved set (showing mini-balls of the numbers). Selecting a set includes
  those numbers as `willBe` in the request. The first set is auto-selected on
  load.

**Action:** "Generate" button → POST `/api/generate/form`.

**Results:**
- Loading indicator while computing.
- On success: list of generated forms, each rendered as a row of lottery
  balls. **If a form array is longer than `formType`, the last number is the
  "strong" number and is displayed distinctly.**
- Each form has actions:
  - **Analyze:** opens the analyze modal with the form's numbers.
  - **Save:** POST `/api/user/numbers` with category `user-generated`, the
    numbers, and the current archive date range. Shows success/error toast.
- **"Ask AI about these forms"** button: opens the AI widget with a
  pre-filled contextual message mentioning the count of generated forms.
- On error: error toast.

### 9.3 Lucky Numbers (`/lucky`)

**Auth required.**

**Number picker:**
- A grid of balls 1–37 (excluding already-selected numbers, shown as muted).
- Click a ball to add it (selected numbers are kept sorted ascending).
- Selected numbers shown above as strong balls; click a selected ball to
  remove it.
- **Limit: maximum 8 lucky numbers.** Attempting to add a 9th shows an info
  toast "Cannot add more than 8 lucky numbers" and rejects the add.

**Save:** "Save" button (disabled when no numbers selected) → POST
`/api/user/numbers` with category `lucky`. On success: success toast, clear
selection, reload saved list.

**Saved list:** Below the picker, shows saved lucky number sets with actions:
- **Analyze:** opens analyze modal.
- **Delete:** DELETE `/api/user/numbers/{id}`, removes from list.

### 9.4 Statistics (`/statistics`)

**Auth required.**

**Inputs:**
- **Group size:** select 1–6, default 2.
- **How many groups:** numeric input, 1–50, default 10.
- **Strength:** select strong/weak, default strong.
- **Archive date range:** shared picker (§10.5).

**Action:** "Calculate" button → POST `/api/generate/statistics` (with
`formType` = group size).

**Results:**
- List of frequent number groups, each rendered as balls with a `×count`
  badge showing occurrence count.
- Each group has an **Analyze** action (opens modal).
- **"Ask AI about these statistics"** button.

### 9.5 Analyze (`/analyze`)

**Auth required.**

**Number picker:**
- Same ball grid as Lucky (1–37), but **no limit** on selection count.
- Selected numbers shown as strong balls (click to remove).
- **Clear selection** button.
- **Query param support:** `?form=1,2,3` pre-fills numbers and auto-runs
  analysis.

**Action:** "Analyze" button (disabled when no numbers) → POST
`/api/generate/analyze`.

**Results — frequency by group size:**
- **Tabs for sizes 1–6** (always rendered, even if empty). Tab 1 is
  auto-selected and expanded on results.
- Each tab shows a **group title** with a localized ratio, e.g. "Frequency of
  2 numbers: 0.123" (ratio = total occurrences / possible combinations
  C(37,size), to 3 decimal places).
- Group title is clickable to expand/collapse.
- Expanded tab shows a list of frequency entries (number combinations with
  counts). Each entry has:
  - **Analyze:** opens the analyze modal with the entry's numbers (recursion).
  - **Save:** POST `/api/user/numbers` with category `group-calculated`.
- **"Ask AI about this analysis"** button.

### 9.6 Saved Numbers (`/saved`)

**Auth required.**

- Loads all saved numbers on init (GET `/api/user/numbers`).
- Groups by category into three sections, each with a header and count badge:
  1. **Generated Forms** (`user-generated`)
  2. **Group Statistics** (`group-calculated`)
  3. **Lucky Numbers** (`lucky`)
- **Empty state:** "No saved numbers yet. Generate a form and save it!"
- **Loading** and **error** states.
- Each saved item shows:
  - The numbers as balls (with `willBe` rendered as strong).
  - Expandable metadata: archive from/to dates, created date.
  - **Analyze:** opens analyze modal inline (no navigation).
  - **Delete:** DELETE `/api/user/numbers/{id}`, removes from the
    appropriate list.

### 9.7 Assistant (`/assistant`)

**Auth required.**

- Full-height chat page.
- Header with title and **"New Chat"** button (generates a new session ID,
  clears all messages, resets state).
- Embedded chat component (§10.4).
- Empty state with welcome message before first message.

### 9.8 Admin Shell (`/admin`)

**Auth required + admin role (enforced by BFF).**

- Container with title "System Administration" and child route outlet.
- Default redirect to `/admin/llm-config`.

### 9.9 Admin — LLM Config (`/admin/llm-config`)

**Auth + admin.**

- Card with form:
  - **Provider:** select (Ollama, Gemini).
  - **Model:** text input (default `llama3.1:8b`).
  - **Base URL:** text input (placeholder `http://ollama:11434`).
  - **API Key:** text input (placeholder "Leave empty for Ollama",
    autocomplete off).
  - **Request Timeout (seconds):** number input (10–3600, placeholder 300).
- On load: GET `/api/agent/llm-config` and populate the form (silently ignore
  errors — config may not exist yet).
- **Save** button: PUT `/api/agent/llm-config`. Shows saving state. On
  success: success toast + status note (from response `note` or `status`).
  On error: error toast.

### 9.10 Admin — Token Usage (`/admin/token-usage`)

**Auth + admin.**

- **Three summary cards:** Total Tokens (sum of prompt + completion), Total
  Cost (`$X.XXXX`), Entries count.
- **Refresh** button.
- **Table** with columns: User, Tier (badge), Model, Prompt Tokens,
  Completion Tokens, Cost (`$X.XXXX`).
- On load: GET `/api/agent/token-usage`. Maps snake_case fields to display.
- Empty state: "No data yet".

### 9.11 Admin — Audit Log (`/admin/audit-log`)

**Auth + admin.**

- **Toolbar:** search input (filters by user, action, or details —
  case-insensitive) + refresh button.
- **Table** (paginated, 20 rows/page) with columns: User, Tier (badge),
  Action, Details (truncated with ellipsis), Timestamp.
- On load: GET `/api/agent/audit-log?limit=50`. Maps `ts` (unix seconds) to
  localized timestamp; `details` (any) to JSON string if not already a
  string.
- Empty state: "No entries yet".

### 9.12 Admin — Scraper (`/admin/scraper`)

**Auth + admin.**

- **Status indicator:** "Idle" (green check) or "Running..." (spinner).
- **Trigger button** (warning style, disabled when already triggered).
- **Trigger flow:**
  1. Click "Trigger Scraper" → POST `/api/agent/chat` with message "Trigger
     the lottery scraper to fetch new draw data" and `intent: 'admin_ops'`.
  2. If response `paused === true`: show **HITL approval card** (warning
     styled) with Approve/Reject buttons.
  3. Otherwise: show result message.
- **Approve/Reject:** POST `/api/agent/approve` with the decision. On
  success: show result message ("Scraper approved and executed" or "Scraper
  trigger rejected"). Reset triggered state.

---

## 10. Shared UI Building Blocks

These are reusable components used across multiple screens. The implementing
AI may build them however it likes, but the **behavior** must match.

### 10.1 Lottery Ball

- Renders a single number as a circular ball.
- **Variants:** `regular` (red), `strong` (blue, highlighted), `muted`
  (light, for pick grids).
- **Sizes:** small (28px), medium (36px), large (44px).
- Clickable (used for add/remove in pickers).

### 10.2 Number Set

- Renders an array of numbers as a row of balls.
- Regular numbers use the `regular` variant; "strong" numbers use the
  `strong` variant.
- Strong numbers can be provided explicitly or inferred as the last number
  (configurable).

### 10.3 Number Set List

A reusable list of number sets with per-item actions. Used by Generate,
Statistics, Lucky, Saved, and inside the Analyze modal.

**Per-item features:**
- Renders the number set as balls.
- If the item has a `count`, shows a `×count` badge.
- **Expandable metadata:** archive from/to dates, created date (formatted).
- **Action buttons** (configurable per usage): Analyze (green), Save (blue),
  Delete (red).
- **Swipe-to-reveal actions** on touch devices (horizontal swipe >50px
  reveals action buttons).
- **Infinite scroll / pagination:** loads 10 items initially; when the user
  scrolls near the bottom, loads 10 more. Shows a "Loading more..." spinner
  during load.

**Configurable flags:** `showAnalyze`, `showSave`, `showDelete` (booleans).

**Events emitted:** `analyze(item)`, `save(item)`, `delete(item)`.

### 10.4 Agent Chat

Full chat interface used by the Assistant page and embedded in the AI widget.

**Features:**
- **Message list** with auto-scroll to bottom on new messages.
- User messages align to one side; assistant messages to the other (flips
  with RTL).
- **Empty state:** welcome icon + message.
- **Loading state:** spinner + "Thinking...".
- **Input:** text field + send button. Enter key sends. Disabled while
  loading or when input is empty.
- **Send:** POST `/api/agent/chat` with `{ sessionId, message, intent? }`.
  - If `paused === true`: add an assistant message marked as paused and
    render a **HITL approval card** below it with Approve/Reject buttons.
  - Otherwise: add assistant message with `response` (or "No response
    received" if empty).
- **HITL approval:** Approve/Reject → POST `/api/agent/approve` with
  `{ sessionId, approved }`. Replace the paused message with
  approved/rejected text. If approved and a response exists, append a new
  assistant message.
- **Session ID:** generated client-side as `session-{timestamp}-{random}`.
  Changing the session ID clears all messages and resets state (used by
  "New Chat").
- **`prefill(message, autoSend?)`:** sets the input text; optionally
  auto-sends. Used for contextual triggers from feature pages.

### 10.5 Archive Window

- Two date inputs (from/to), shared across Generate, Statistics, and Analyze
  via a shared service.
- Defaults: from `2004-02-12`, to today.
- Changing the range on one screen persists to the others (shared state).

### 10.6 Analyze Modal

A modal dialog for analyzing any number set against historical draws. Used
by Generate, Statistics, Lucky, Analyze, and Saved screens.

**Behavior:**
- Scrim (click to close) + card (click does not close).
- Displays the form being analyzed at the top (large balls).
- On open (when numbers are provided): automatically POST
  `/api/generate/analyze`.
- Shows frequency tabs (1–6), expand/collapse groups, nested number set list
  with Analyze and Save actions.
- **Recursion:** analyzing a subgroup re-runs analysis in the same modal
  with the subgroup's numbers (replaces the form, re-calls the API).
- **Save subgroup:** POST `/api/user/numbers` with category
  `group-calculated`.
- Close via ✕ button or clicking scrim.

### 10.7 Toast & Loading Service

- `showLoading()` / `hideLoading()` — controls the global loading overlay.
- `info(message, 3000ms)` / `error(message, 5000ms)` /
  `success(message, 3000ms)` — shows auto-dismissing toasts.
- `dismiss(id)` — manually dismiss a toast.

### 10.8 AI Context Service

A shared service for contextual AI triggers across feature pages:
- `ask(message)` — opens the AI widget with a pre-filled message.
- `consume()` — clears the pending message (called by the widget after
  prefilling).

Feature pages (Generate, Statistics, Analyze) call `ask()` with a contextual
message when the user clicks "Ask AI".

---

## 11. User Flows (Step-by-Step)

### Flow 1: First Visit (Unauthenticated)

1. User opens the app → `index.html` loads with `lang="he" dir="rtl"`.
2. App initializes: theme applied from saved preference (or OS preference);
   silent SSO check runs via iframe → not authenticated.
3. Home screen renders: title, subtitle, "Get Started" + "Register" buttons.
4. Sidebar shows login + register in footer. Admin section hidden. Bottom
   tabs hidden (desktop) or visible (mobile) without admin tab.

### Flow 2: Registration

1. Click "Register" → redirect to auth provider registration page.
2. Fill first name, last name, email, password, confirm password.
3. Submit → auth provider creates user, redirects back with auth code.
4. App exchanges code for tokens (PKCE), sets authenticated state.
5. Sidebar footer shows username + logout. Home shows action links.

### Flow 3: Login (Returning User)

1. Navigate to a protected route (e.g. `/generate`).
2. Route guard: not authenticated → redirect to auth provider login.
3. Enter credentials → redirect back with auth code.
4. Tokens exchanged, authenticated state set, route renders.

### Flow 4: Generate Lottery Forms

1. Navigate to `/generate`.
2. Archive date range shows (default 2004-02-12 → today).
3. Saved lucky numbers load; if any exist, lucky picker cards appear (first
   auto-selected).
4. Select form type (6–12), how many (1–20), strength (strong/weak).
   Optionally pick a lucky set.
5. Click "Generate" → POST `/api/generate/form`.
6. Loading overlay. On success: forms render as ball rows.
7. Per form: **Save** (persists as `user-generated`), **Analyze** (opens
   modal), or **Ask AI** (opens widget with contextual message).

### Flow 5: Pick & Save Lucky Numbers

1. Navigate to `/lucky`.
2. Pick grid shows 1–37 (excluding selected). Click to add (sorted). Click
   selected ball to remove.
3. Max 8. 9th click → info toast, rejected.
4. "Save" → POST `/api/user/numbers` (category `lucky`) → success toast,
   clear, reload saved list.
5. Saved list below: analyze or delete each set.

### Flow 6: View Statistics

1. Navigate to `/statistics`.
2. Select group size (1–6), how many (1–50), strength.
3. "Calculate" → POST `/api/generate/statistics`.
4. Results: number groups with `×count` badges.
5. Analyze any group or ask AI.

### Flow 7: Analyze Numbers

1. Navigate to `/analyze` (or arrive via `?form=1,2,3` which auto-fills and
   auto-analyzes).
2. Pick numbers from grid (no limit). Clear button resets.
3. "Analyze" → POST `/api/generate/analyze`.
4. Frequency tabs 1–6. Tab 1 auto-selected/expanded.
5. Each tab: group title with ratio (click to expand/collapse). Expanded:
   frequency entries with Analyze (recursion via modal) and Save
   (`group-calculated`) actions.
6. "Ask AI" sends contextual message.

### Flow 8: Analyze Modal (Recursion)

1. From any screen, click "Analyze" on a number set.
2. Modal opens (scrim + card). Displays the form at top. Auto-calls
   `/api/generate/analyze`.
3. Frequency tabs 1–6, expand/collapse, nested entries.
4. Analyze a subgroup → re-runs analysis in the same modal (recursion).
5. Save a subgroup → `group-calculated`.
6. Close via ✕ or scrim click.

### Flow 9: Manage Saved Numbers

1. Navigate to `/saved`.
2. Loads all saved numbers, grouped: Generated Forms, Group Statistics,
   Lucky Numbers (each with count badge).
3. Empty state if none.
4. Per item: expand metadata, analyze (modal), delete (API + local removal).

### Flow 10: AI Assistant (Full Page)

1. Navigate to `/assistant`.
2. Full-height chat. Empty state welcome message.
3. Type + send → POST `/api/agent/chat`.
4. User message appears; "Thinking..." spinner; assistant response appears.
5. If `paused`: HITL approval card → approve/reject → POST
   `/api/agent/approve`.
6. "New Chat" → new session ID, clear messages.

### Flow 11: AI Widget (Any Page)

1. On any authenticated page, FAB appears bottom-right (bottom-left in RTL).
2. Click FAB → panel opens (desktop: 380×520; mobile: full-width bottom
   sheet).
3. Same chat interface as full assistant.
4. **Contextual trigger:** from Generate/Statistics/Analyze, "Ask AI" calls
   the context service → widget opens with pre-filled message.
5. Close via ✕ or scrim.

### Flow 12: Admin — Configure LLM

1. Admin logs in. Sidebar shows Admin section.
2. Navigate to `/admin/llm-config`.
3. Form loads current config (GET `/api/agent/llm-config`).
4. Edit provider, model, base URL, API key, timeout.
5. "Save" → PUT `/api/agent/llm-config` → success toast + status note.

### Flow 13: Admin — View Token Usage

1. Navigate to `/admin/token-usage`.
2. Summary cards: total tokens, total cost, entry count.
3. Table of per-user token consumption.
4. "Refresh" reloads.

### Flow 14: Admin — View Audit Log

1. Navigate to `/admin/audit-log`.
2. Table of last 50 entries (paginated 20/page).
3. Search filters by user/action/details.
4. "Refresh" reloads.

### Flow 15: Admin — Trigger Scraper (HITL)

1. Navigate to `/admin/scraper`. Status: "Idle".
2. "Trigger Scraper" → POST `/api/agent/chat` (intent `admin_ops`).
3. If `paused`: approval card → Approve/Reject → POST `/api/agent/approve`.
4. Result message: "Scraper approved and executed" or "Scraper trigger
   rejected".

### Flow 16: Language Toggle

1. Click language toggle in header.
2. Language switches (he↔en). Document direction flips (rtl↔ltr). All text
   updates. Layout mirrors.

### Flow 17: Theme Toggle

1. Click theme toggle in header.
2. Mode switches (light↔dark). `.app-dark` class toggled on `<html>`. CSS
   custom properties swap. Preference saved to localStorage.

---

## 12. Responsive & Layout Requirements

- **Desktop (>768px):** Fixed sidebar visible by default. Bottom tabs
  hidden. Hamburger hidden. Content has left margin (right in RTL) equal to
  sidebar width; collapses to 0 when sidebar is collapsed.
- **Mobile (≤768px):** Sidebar hidden by default (overlay when opened).
  Bottom tabs visible. Hamburger visible. Content full-width. AI widget
  becomes full-width bottom sheet. Content has bottom padding to
  accommodate the tab bar (and safe-area inset).
- **Breakpoint:** 768px.
- All interactive elements must be touch-friendly.
- The layout must correctly mirror for RTL (sidebar side, margins, chat
  message alignment, FAB position, drawer slide direction).

---

## 13. Non-Functional Requirements

- **State management:** reactive — the UI must reactively update when auth
  state, language, theme, or data changes. No manual change detection
  triggers should be needed.
- **Code-splitting:** each screen is lazy-loaded (separate bundle).
- **Performance:** production build with output hashing, asset caching,
  gzip.
- **Accessibility:** buttons have aria-labels where icon-only (menu toggle,
  theme toggle, widget close). Form inputs have associated labels.
- **Security:** JWT never logged. Security headers set by the web server
  (X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- **Offline:** PWA shell cached; service worker registered in production
  only.
- **Build:** the production build swaps environment config (dev → prod) for
  API base URL and auth URL.

---

## 14. Edge Cases & Gotchas

1. **Generate: strong number splitting** — the backend appends the strong
   number as the last element of the form array. If `numbers.length >
   formType`, the UI must split the last number out and render it as the
   strong variant.
2. **Analyze frequency tabs always 1–6** — even if the API returns fewer
   groups, the UI must render all six tabs (empty tabs show "No results").
3. **Analyze `?form=` query param** — comma-separated numbers pre-fill and
   auto-run analysis.
4. **Analyze modal recursion** — analyzing a subgroup re-runs analysis in
   the same modal (does not open a nested modal).
5. **Lucky number limit** — hard cap at 8; 9th add is rejected with an info
   toast.
6. **Archive window is shared** — changing the date range on Generate
   persists to Statistics and Analyze. Default from `2004-02-12`.
7. **Admin authorization is BFF-enforced** — the UI only checks
   authentication for admin routes. A non-admin navigating to `/admin/*`
   sees the screen render but API calls return 403 (silently ignored →
   default/empty data).
8. **Agent `paused` state** — must render a HITL approval card and call
   `/api/agent/approve` (not re-send the chat).
9. **Agent session ID** — generated client-side; "New Chat" generates a new
   one and clears messages.
10. **Scraper trigger uses the agent chat endpoint** (not a dedicated scraper
    API) with `intent: 'admin_ops'`. The agent's HITL flow gates execution.
11. **Error interceptor only logs** — it does not redirect on 401 or show
    toasts. Screens handle their own error display (toasts).
12. **Token refresh** — refresh proactively when the token expires within 30
    seconds, before attaching to requests.
13. **Silent SSO** — requires a static HTML page at the web root that
    posts the redirect URL back to the app origin. Must not be moved.
14. **`pure: false` translate pipe (or equivalent)** — translations must
    update reactively when the language changes, even though the translation
    key string doesn't change. If using a pipe-based approach, it must be
    impure or otherwise re-evaluate on language signal change.
15. **AI widget prefill timing** — when the widget is opened via a
    contextual trigger, the chat input may not be rendered yet on the same
    cycle. The prefill must be deferred (e.g. microtask) until the panel is
    rendered.
16. **Number set list infinite scroll** — the scroll observer must be set
    up after the sentinel element is rendered (deferred), and recreated when
    the items input changes.
17. **LLM config form population** — the form is populated from an API call
    on init; since this mutates a plain object (not a reactive signal), the
    UI must ensure re-rendering after population (manual change detection
    mark if using OnPush-style optimization).
18. **Token usage / audit log field mapping** — API returns snake_case
    (`user_sub`, `prompt_tokens`, `cost_usd`, `ts`); the UI maps to
    display-friendly formats. `ts` is Unix seconds → multiply by 1000 for
    date conversion.
19. **Bottom tab swap for admin** — the 5th mobile tab shows "Admin" for
    admin users, "Saved" for regular users.
20. **Keycloak URL differs by environment** — dev: absolute
    (`http://localhost/auth`), prod: relative (`/auth`).

---

*End of specification. This document describes what the UI must do; the
choice of framework, libraries, and implementation approach is left to the
implementing AI.*
