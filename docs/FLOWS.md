# Statistiloto UI — Flow Documentation

Mermaid diagrams for the main user flows from the UI perspective.

---

## 1. User Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Angular PWA
    participant KC as Keycloak (via Traefik)
    participant BFF as Java BFF

    U->>UI: Open app (any route)
    UI->>UI: Route guard (auth.guard.ts)
    alt Not authenticated
        UI->>KC: Redirect to Keycloak login (PKCE challenge)
        KC->>U: Show login page
        U->>KC: Submit credentials
        KC-->>UI: Redirect with auth code
        UI->>KC: Exchange code for tokens (PKCE verifier)
        KC-->>UI: access_token + refresh_token
        UI->>UI: Store tokens, update auth state
    end
    UI->>UI: Render requested page

    Note over UI: On subsequent loads: silent-check-sso.html iframe checks SSO

    UI->>BFF: GET /api/me (Bearer token via auth.interceptor.ts)
    BFF-->>UI: User profile { sub, email, roles }
    UI->>UI: Set user context, show/hide admin features
```

---

## 2. Page Navigation Flow

```mermaid
flowchart TD
    START[User navigates to route] --> GUARD{auth.guard.ts}
    GUARD -->|Not authenticated| LOGIN[Redirect to Keycloak login]
    GUARD -->|Authenticated| ADMIN{Admin route?}
    LOGIN --> KC[Keycloak OIDC + PKCE]
    KC --> GUARD
    ADMIN -->|Yes| ROLE{Has ADMIN role?}
    ADMIN -->|No| PAGE[Render feature page]
    ROLE -->|Yes| PAGE
    ROLE -->|No| DENY[403 / redirect to home]
    PAGE --> API[Call ApiService / AgentService]
    API --> INTERCEPTOR[auth.interceptor.ts adds Bearer token]
    INTERCEPTOR --> BFF[HTTP to /api/* via Traefik]
    BFF --> RESPONSE[Render response in page]
    RESPONSE --> ERR{Error?}
    ERR -->|401| LOGIN
    ERR -->|429| TOAST_RATE[Show rate limit toast]
    ERR -->|Other| TOAST_ERR[Show error toast]
    ERR -->|Success| DONE[Display results]
```

---

## 3. Generate Form Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Generate Component
    participant API as ApiService
    participant BFF as Java BFF (via Traefik)
    participant GO as Go Lottery Service

    U->>UI: Enter parameters (howMany, formType, willBe, date range, strength)
    U->>UI: Click "Generate"
    UI->>API: POST /api/generate/form { howMany, formType, willBe, from, to, strength }
    API->>BFF: HTTP POST with Bearer JWT
    BFF->>BFF: Validate JWT (OAuth2 Resource Server)
    BFF->>GO: gRPC GenerateForm(request)
    GO->>GO: LoadArchive from DB → LotteryArray → GenerateNewCombinations
    GO-->>BFF: GenerateFormResponse { forms: [...] }
    BFF-->>API: JSON { forms: [[1,5,12,23,34,41], ...] }
    API-->>UI: Response
    UI->>UI: Render NumberSet components with LotteryBall
    U->>UI: Optionally save → POST /api/user/numbers
```

---

## 4. Agent Chat Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Assistant / AgentChat Component
    participant AGENT as AgentService
    participant BFF as Java BFF (SSE proxy)
    participant A as Agent Service

    U->>UI: Type message, click send
    UI->>AGENT: POST /api/agent/chat { session_id, message }
    AGENT->>BFF: HTTP POST (SSE accept: text/event-stream)
    BFF->>A: Proxy to agent /chat (JWT propagated)
    A-->>BFF: SSE stream: { type: "token", content: "..." }
    BFF-->>AGENT: SSE passthrough
    AGENT-->>UI: SSE event
    UI->>UI: Append token to chat display

    alt HITL approval needed
        A-->>BFF: SSE: { type: "hitl", tool: "save_numbers", args: {...} }
        BFF-->>AGENT: SSE passthrough
        AGENT-->>UI: Show approval dialog
        U->>UI: Approve / reject
        UI->>AGENT: POST /api/agent/approve { session_id, approved: true }
        AGENT->>BFF: HTTP POST
        BFF->>A: Proxy to agent /approve
        A-->>BFF: SSE: { type: "tool_result", ... }
        BFF-->>AGENT: SSE passthrough
        AGENT-->>UI: Display result
    end

    A-->>BFF: SSE: { type: "done" }
    BFF-->>AGENT: Stream complete
    AGENT-->>UI: Close stream
```

---

## 5. Admin Operations Flow

```mermaid
flowchart TD
    ADMIN[Admin user logged in] --> MENU{Admin menu}

    MENU -->|LLM Config| LLM_PAGE[LLM Config Component]
    LLM_PAGE --> LLM_GET[GET /api/agent/llm-config]
    LLM_GET --> LLM_SHOW[Display current config]
    LLM_SHOW --> LLM_EDIT[Admin edits provider/model/url]
    LLM_EDIT --> LLM_PUT[PUT /api/agent/llm-config]
    LLM_PUT --> LLM_RELOAD[Agent hot-reloads LLM]
    LLM_RELOAD --> LLM_DONE[Show success toast]

    MENU -->|Scraper| SCRAPE_PAGE[Scraper Component]
    SCRAPE_PAGE --> SCRAPE_TRIGGER["Click 'Trigger Scraper'"]
    SCRAPE_TRIGGER --> AGENT_CHAT[POST /api/agent/chat: trigger_scraper]
    AGENT_CHAT --> HITL{HITL approval}
    HITL -->|Approve| SCRAPE_RUN[Agent calls Go gRPC trigger_scraper]
    HITL -->|Reject| SCRAPE_CANCEL[Cancelled]
    SCRAPE_RUN --> SCRAPE_DONE[Show result]

    MENU -->|Audit Log| AUDIT_PAGE[Audit Log Component]
    AUDIT_PAGE --> AUDIT_GET[GET /api/agent/audit-log]
    AUDIT_GET --> AUDIT_SHOW[Display log entries table]

    MENU -->|Token Usage| TOKEN_PAGE[Token Usage Component]
    TOKEN_PAGE --> TOKEN_GET[GET /api/agent/token-usage]
    TOKEN_GET --> TOKEN_SHOW[Display token consumption charts]
```
