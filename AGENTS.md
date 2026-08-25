# ui (Angular 20 PWA)

Angular 20 PWA. PrimeNG 20 + keycloak-js 25. Standalone components only, signals for
state, OnPush everywhere. Talks only to Java BFF via `/api` (Traefik routes it). Never
calls Go or Python services directly. Hebrew-first, RTL by default.

## Build / test

```bash
npm install -- --legacy-peer-deps   # REQUIRED: PrimeNG peer deps need this flag
npm start                           # ng serve
npm run build                       # ng build (prod swaps environment.prod.ts)
npm test                            # ng test (Karma + Jasmine)
npm run e2e                         # npx playwright test (needs full stack running)
```

Do NOT run `npm install` without `--legacy-peer-deps` — it will fail.

## Stack

- Angular 20.0.0, TypeScript 5.8, Node 22+.
- PrimeNG 20.4 + @primeuix/themes (Aura preset) + PrimeIcons 8.
- keycloak-js 25 (OIDC authorization-code + PKCE, silent SSO via iframe).
- @angular/service-worker 20 (PWA, prod-only).
- RxJS 7.8 (only for HttpClient observables; state is signals).
- No NgRx, no Angular Material, no external i18n lib.

## Structure (`src/app/`)

- `core/` — infra services: auth, api, interceptors, i18n, theme, service-worker.
  - `auth/auth.service.ts` — Keycloak wrapper; signals `isAuthenticated`, `username`, `isAdmin`.
  - `auth/auth.guard.ts` — `authGuard` (CanActivateFn), redirects to Keycloak login.
  - `api/api.service.ts` — lottery endpoints (generate, statistics, analyze, saved, profile).
  - `api/agent.service.ts` — agent chat/approve, LLM config (active GET/PUT + stored configs CRUD/test/activate), llm-models, token-usage, audit-log, scraper, sessions CRUD, reindex.
  - `interceptors/auth.interceptor.ts` — attaches Bearer token, refreshes with 30s skew.
  - `interceptors/error.interceptor.ts` — logs 401/429.
  - `i18n/`, `theme/`, `sw-register.ts`.
- `features/` — page components (one folder per route): home, generate, lucky, statistics,
  analyze, saved-numbers, assistant, admin.
  - `features/admin/` has child routes: llm-config, token-usage, audit-log, scraper.
- `shared/` — components, models, pipes, services, utilities.

## Routing (`src/app/app.routes.ts`)

All routes use `loadComponent()` (lazy standalone). Guarded by `authGuard`.

| Path | Auth | Notes |
|------|------|-------|
| `/` | no | home |
| `/generate` `/lucky` `/statistics` `/analyze` `/saved` `/assistant` | USER | |
| `/admin` + children (`/admin/llm-config`, `/admin/token-usage`, `/admin/audit-log`, `/admin/scraper`) | ADMIN | |

## State

Signals only (`signal()`, `computed()`). No NgRx. Services hold state in private signals
and expose readonly computed. Components use signals for local state. RxJS only for HTTP.

## HTTP / API

- Base URL: `environment.apiBaseUrl` = `/api` (relative — Traefik routes to Java BFF).
- Interceptors registered in `app.config.ts`: auth (Bearer + refresh), error (log 401/429).
- `ApiService` — lottery computation + saved numbers + profile.
- `AgentService` — agent chat, admin endpoints.
- `ArchiveWindowService` — persists date range across generate/statistics/analyze pages.
- `AgentContextService` — `ask()` opens assistant widget with pre-filled message from any feature.

## Auth (Keycloak)

- `keycloak-js` 25, PKCE S256, `onLoad: 'check-sso'`, silent SSO via `src/silent-check-sso.html`.
- Config from `AUTH_CONFIG` token (sourced from environment).
- Admin role detection: checks `realm_access.roles` for 'ADMIN'/'admin' OR `groups` for '/admins'.
- `silent-check-sso.html` MUST be served at root (nginx.conf handles this).

## Environments

- `src/environments/environment.ts` (dev): `apiBaseUrl: '/api'`, keycloak url `http://localhost/auth`.
- `src/environments/environment.prod.ts`: `apiBaseUrl: '/api'`, keycloak url `/auth` (relative).
- File swap configured in `angular.json` (production build).
- Realm: `statistiloto`, clientId: `statistiloto-ui`.

## Conventions

- Standalone components only — `angular.json` schematics enforce `standalone: true` + `OnPush`.
- Component prefix `app-`, selectors kebab-case (`app-home`), classes PascalCase.
- Inline templates + inline `styles: []` (no separate .scss/.css per component).
- Global styles in `src/styles.scss` with CSS custom properties; dark mode via `.app-dark` on `<html>`.
- Functional guards (`CanActivateFn`) and interceptors (`HttpInterceptorFn`).
- `provideAppInitializer` for startup logic; `withComponentInputBinding()` for router inputs.
- Co-located `.spec.ts` files.

## PWA

- `@angular/service-worker`, registered only in production (`sw-register.ts`).
- `src/manifest.webmanifest` — name "Statistiloto", display standalone, default lang Hebrew (RTL).
- No `ngsw-config.json` — uses default SW config.
- nginx.conf: `try_files $uri $uri/ /index.html` (SPA fallback); `ngsw-worker.js` served with `Cache-Control: no-cache`.

## Gotchas

- `npm install` MUST use `--legacy-peer-deps` (PrimeNG). Without it, install fails.
- Service worker only registers in production builds — `ng serve` won't have SW.
- All API calls go through Traefik `/api` → Java BFF. UI never reaches Go or Python directly.
- Keycloak URL differs by env: dev `http://localhost/auth` (absolute), prod `/auth` (relative).
- `silent-check-sso.html` must be at web root — nginx.conf serves it; don't move it.
- Playwright E2E runs against `http://localhost` (full stack via Traefik), NOT `ng serve`.
- `index.html` sets `lang="he" dir="rtl"`; `LanguageService` toggles direction dynamically.
- Dockerfile: node:22-alpine build → nginx:1.27 serve.
