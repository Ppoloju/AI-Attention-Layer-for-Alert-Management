# SignalFlow — AI Attention Layer for Incident Alert Management

SignalFlow is an AI-powered attention layer for operational incident management. It ingests raw events from
multiple sources, correlates them into signals, scores each signal deterministically, and adds an AI triage
recommendation so responders know **what to look at first** and **what to do next**.

**Status:** v1.0.0 — feature complete (ingestion → correlation → scoring → AI triage → dashboard), 44 unit tests passing.

---

## Table of Contents

- [How it works](#how-it-works)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Core services](#core-services)
- [Not yet implemented](#not-yet-implemented)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## How it works

```
Event sources (Prometheus, GitHub, Slack, Jira, custom)
        │  POST /api/events
        ▼
Zod validation → Redis queue (Upstash REST or local Redis)
        │  dequeue
        ▼
Background worker
  1. persist the event            → events table
  2. correlate with recent events → signal groups  (same service, 5-minute window)
  3. score deterministically      → risk_score 0–100 + priority P0–P3
  4. AI triage (optional, Groq)   → hypothesis, confidence, evidence, next steps
        │
        ▼
PostgreSQL (Supabase or local Docker)
        │  GET /api/signals, /api/signals/[id], /api/stats, /api/health
        ▼
React dashboard — ranked signal cards, live search, status/priority filters,
slide-over review sheet with AI triage and the raw correlated event timeline
```

The deterministic risk score is always the source of truth for priority. AI triage is supplementary and is
skipped gracefully when no API key is configured or the provider is unavailable.

## Features

- **Event ingestion API** — validated with Zod (`POST /api/events`), acknowledged with `202` and processed asynchronously.
- **Correlation engine** — groups events for the same service inside a 5-minute window, using event-type compatibility
  and shared keywords. Two or more related events become one signal.
- **Deterministic risk scoring** — explainable 0–100 score from severity, event volume, event-type diversity, and burst rate.
  No randomness, no network calls.
- **AI triage (optional)** — Groq generates a root-cause hypothesis, confidence level, evidence list, and concrete next steps.
- **Reactive dashboard** — live search, All/Active/Resolved tabs, and P0–P3 priority chips, all client-side.
- **Slide-over review sheet** — inspect AI triage, evidence, next steps, and the raw event timeline without leaving the page.
- **Signal lifecycle** — mark signals resolved/reopened from the card or the drawer (`PATCH /api/signals/[id]`).
- **Visible offline fallback** — if Postgres is unreachable, fallback API responses identify demo data, the dashboard
  and signal detail page show a warning, and signal status changes are disabled.
- **Health endpoint** — reports provider selection and health for Redis, Postgres, Supabase, and the queue backlog.
- **Dual infrastructure** — local Docker (Postgres + Redis) or managed cloud (Supabase + Upstash), selected by env vars.
- **Unit tests** — 53 Vitest cases covering correlation, scoring, triage, and env detection.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16.3.3 (App Router, Turbopack), React 19.2.8 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4, `tw-animate-css` |
| Icons | lucide-react |
| Validation | Zod 4 (shared between API routes and worker) |
| Backend runtime | Node.js 18+ with `tsx` |
| Queue | Redis list (`events:queue`) — Upstash REST or ioredis |
| Database | PostgreSQL 14+ — Supabase or local Docker, accessed with `pg` |
| AI | Groq SDK (`openai/gpt-oss-120b` by default) |
| Auth (optional) | Supabase SSR (`@supabase/ssr`) |
| Testing | Vitest 4 |
| Linting | ESLint 9 + `eslint-config-next` |
| Tooling | npm workspaces, `concurrently`, Docker Compose |

## Architecture

```
┌──────────────────────────── Event sources ────────────────────────────┐
│            Prometheus · GitHub · Slack · Jira · custom HTTP            │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ POST /api/events (Zod validated)
                                ▼
┌──────────────────── Next.js route handlers (frontend) ────────────────┐
│  POST /api/events          GET /api/events                            │
│  GET  /api/signals         GET /api/signals/[id]   PATCH /api/signals/[id] │
│  GET  /api/stats           GET /api/health                            │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ enqueue
                                ▼
┌──────────────────── Redis queue — `events:queue` ─────────────────────┐
│                Upstash REST (production) or ioredis (local)            │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ dequeue (1s poll)
                                ▼
┌──────────────── Background worker — backend/queue/worker.ts ──────────┐
│  1. validate + INSERT the event                                        │
│  2. correlation engine → group recent events by service (5 min window) │
│  3. scoring engine     → risk_score + priority                          │
│  4. Groq triage        → hypothesis / evidence / next steps (optional)  │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ INSERT/UPDATE
                                ▼
┌──────── PostgreSQL / Supabase — events · signals · signal_events ─────┐
└───────────────────────────────┬───────────────────────────────────────┘
                                │ JSON
                                ▼
┌────────────────────── React dashboard (Next.js 16) ───────────────────┐
│  ranked signal cards · sidebar stats · filters · slide-over review      │
└───────────────────────────────────────────────────────────────────────┘
```

### Data model

| Table | Purpose |
|---|---|
| `events` | Immutable log of every ingested event (`source`, `event_type`, `service`, `severity`, `message`, `metadata` JSONB, `timestamp`). |
| `signals` | Correlated incidents with `risk_score`, `priority`, `status` (`open`/`resolved`), counts, time range, and AI triage columns. |
| `signal_events` | Junction table linking signals to their correlated events. |

The schema is created idempotently at worker startup by `initializeDatabase()` in `shared/lib/db.ts`.
Reference SQL lives in `database/migrations/001_initial_schema.sql` with sample data in `database/seed.sql`.

## Project structure

```
AI-Attention-Layer-for-Alert-Management/
├── frontend/                       Next.js 16 app (UI + API route handlers)
│   ├── app/
│   │   ├── page.tsx                Dashboard: sidebar stats, filters, signal grid, review drawer
│   │   ├── signals/[id]/page.tsx   Standalone signal detail page
│   │   ├── layout.tsx              Root layout (Geist fonts, metadata)
│   │   ├── globals.css             Tailwind 4 theme tokens
│   │   └── api/
│   │       ├── events/route.ts         POST / GET events
│   │       ├── signals/route.ts        GET ranked signals
│   │       ├── signals/[id]/route.ts   GET signal detail · PATCH status
│   │       ├── stats/route.ts          GET dashboard counters
│   │       ├── health/route.ts         GET system health
│   │       └── mock-store.ts           In-memory fallback dataset
│   ├── components/SignalAlertCard.tsx
│   ├── lib/queue.ts                Redis queue client (Upstash REST or ioredis)
│   ├── proxy.ts                    Supabase session refresh (Next 16 proxy convention)
│   └── utils/supabase/             Browser, server, and session-refresh clients
│
├── backend/                        Ingestion worker
│   ├── queue/worker.ts             Poll loop: persist → correlate → score → triage
│   ├── lib/ai.ts                   Groq API boundary (the only file that calls Groq)
│   ├── lib/redis.ts                Queue client wrapper
│   └── services/
│       ├── correlation.ts          Event grouping into signals
│       ├── scoring.ts              Deterministic risk score + priority
│       ├── triage.ts               Triage orchestration
│       └── __tests__/              Vitest suites
│
├── shared/                         Code imported by both workspaces
│   ├── lib/db.ts                   Postgres pool, schema init, queries
│   ├── lib/load-env.ts             Loads the monorepo root .env
│   ├── lib/providers.ts            Provider detection for /api/health
│   └── schemas/event.ts            Zod EventSchema + types
│
├── database/
│   ├── migrations/001_initial_schema.sql
│   └── seed.sql                    Sample events
│
├── docker-compose.yml              Local PostgreSQL 16 + Redis 7
├── .env.example                    Environment template
└── package.json                    npm workspaces root + orchestration scripts
```

## Quick start

### Prerequisites

- Node.js 18+ (Node 20+ recommended)
- Either Docker (for local Postgres + Redis) **or** Supabase + Upstash accounts
- Optional: a Groq API key for AI triage

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Everything except `DATABASE_URL`/`DB_*` and Redis is optional. For a fully local setup, start the bundled
containers — the defaults in `.env.example` already match `docker-compose.yml`:

```bash
npm run db:up
```

### 3. Run the application

```bash
npm run dev
```

This starts the Next.js dev server (http://localhost:3000) and the background worker together. To run them separately:

```bash
npm run frontend:dev      # terminal 1 — dashboard on :3000
npm run backend:worker    # terminal 2 — ingestion worker
```

### 4. Send a test event

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "source": "prometheus",
    "event_type": "alert",
    "service": "payment-api",
    "severity": "high",
    "message": "Error rate spike on checkout",
    "metadata": { "error_rate": "15.5%" },
    "timestamp": "2026-08-29T10:00:00Z"
  }'

curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "source": "github",
    "event_type": "deploy",
    "service": "payment-api",
    "severity": "critical",
    "message": "Deploy rollback triggered for checkout",
    "timestamp": "2026-08-29T10:01:00Z"
  }'
```

Two compatible events for the same service inside 5 minutes produce a correlated **signal** on the dashboard.

> No database running? `/api/signals`, `/api/signals/[id]`, and `/api/stats` fall back to a built-in demo dataset
> and include `"dataSource": "demo"` in their JSON responses. The dashboard labels the data as examples and disables
> status changes; the API rejects status updates with `503` until PostgreSQL is available.

## Configuration

All variables are read from the monorepo root `.env` (loaded by `shared/lib/load-env.ts` and by
`frontend/next.config.ts` for the Next.js server).

### Configure Supabase

Supabase Auth/API and the PostgreSQL database connection are separate settings:

1. In Supabase, open **Connect** and copy the project URL and publishable key into the root `.env`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

   Existing projects may use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead. Never put a secret or service-role key in a
   `NEXT_PUBLIC_*` variable.
2. To use Supabase as the app database, copy its PostgreSQL connection string from **Connect** into `DATABASE_URL`.
   Use the pooler connection string if your deployment host cannot connect to Supabase's direct database address.
   If `USE_LOCAL_DATABASE=true` is set, remove it or set it to `false` so it does not override `DATABASE_URL`.
3. Add the same variables to your deployment platform's environment settings for every environment you deploy, then
   redeploy so the Next.js build receives the public variables. Keep database passwords and Supabase secret keys in
   server-only variables; never commit `.env`.
4. Open `/api/health`. `services.supabase` checks the Supabase Data API; `services.database` checks PostgreSQL
   connectivity. `diagnostics.supabase` reports a safe HTTP status and next step for Supabase configuration errors.

The health check confirms API reachability, not that users can sign in. This project currently refreshes Supabase
session cookies, but does not yet include a sign-in UI or protect API routes with authorization checks.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | No* | Full Postgres connection string (Supabase or any hosted Postgres). Takes precedence over `DB_*`. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | No* | Local Docker Postgres connection (defaults match `docker-compose.yml`). |
| `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD` | No | Supabase connection parts used to build the URL when `DATABASE_URL` is unset. |
| `USE_LOCAL_DATABASE` / `USE_SUPABASE_DATABASE` | No | Force the database target (`true`). Ignored in production. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis (production queue). Takes precedence when both are set. |
| `REDIS_URL` | No | Local Redis connection (default `redis://localhost:6379`). |
| `USE_LOCAL_REDIS` | No | Set to `true` to use local Redis even when Upstash credentials are configured. |
| `POSTGRES_PORT` | No | Host port published by `docker-compose.yml` for Postgres (default `5432`). Override it when another project on the machine already holds 5432, and keep `DB_PORT` in sync. |
| `GROQ_API_KEY` | No | Enables AI triage. When absent, triage is skipped and everything else works. |
| `GROQ_MODEL` | No | Groq model id (default `openai/gpt-oss-120b`). Verify the account can reach it via `GET https://api.groq.com/openai/v1/models` — retired models return `model_not_found` at triage time. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No | Supabase auth/session support in the frontend. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Legacy public anon-key alias for Supabase auth. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL` | No | Server-side Supabase equivalents. Secret keys are used only for server health checks. |

\* A database is required for real data. Without one, the dashboard clearly labels its demo-data fallback.

### Provider selection

- **Database:** `USE_LOCAL_DATABASE=true` and `USE_SUPABASE_DATABASE=true` explicitly select a target.
  Otherwise, `DATABASE_URL` takes precedence, followed by a configured remote `SUPABASE_DB_HOST`; local
  `DB_*` settings select Docker Postgres during development.
- **Queue:** `USE_LOCAL_REDIS=true` selects local Redis; otherwise Upstash is used when both Upstash vars are set,
  falling back to local Redis via `REDIS_URL`.
- Existing process/deployment environment variables take precedence over values loaded from the root `.env` file.
- `GET /api/health` reports which providers were selected and whether each one is reachable.

## API reference

### `POST /api/events`

Validate an event and enqueue it for asynchronous processing.

```json
{
  "source": "prometheus",
  "event_type": "alert",
  "service": "payment-api",
  "severity": "high",
  "message": "Error rate spike on checkout",
  "metadata": { "error_rate": "15.5%" },
  "timestamp": "2026-08-29T10:00:00Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `source` | enum | `github` · `slack` · `jira` · `prometheus` · `custom` |
| `event_type` | string | Free-form, e.g. `alert`, `deploy`, `error`, `latency` |
| `service` | string | Used as the correlation key |
| `severity` | enum | `low` · `medium` · `high` · `critical` |
| `message` | string | Human-readable description |
| `metadata` | object | Optional, defaults to `{}` |
| `timestamp` | string | ISO-8601 datetime |

Responses: `202 { "message": "Event accepted", "event": { ... } }` · `400` with Zod issue details · `500` on failure.

### `GET /api/events?limit=50`

Returns `{ "events": [...] }`. `limit` must be between 1 and 1000.

### `GET /api/signals?limit=50`

Returns `{ "signals": [...] }` ordered by `risk_score DESC, created_at DESC`, including `priority`, `status`,
`event_count`, `max_severity`, and the AI triage summary fields. When the database is unreachable, the response
includes `"dataSource": "demo"` and a warning with the demo dataset.

### `GET /api/signals/[id]`

Returns `{ "signal": { ..., "events": [ ... ] } }` with the correlated events in timestamp order; `404` when unknown.
When the database is unreachable, includes `"dataSource": "demo"` and a warning.

### `PATCH /api/signals/[id]`

```json
{ "status": "resolved" }
```

Accepts `open` or `resolved`, returning the updated signal; `400` for any other value.
Returns `503` if PostgreSQL is unavailable and the change cannot be persisted.

### `GET /api/stats`

```json
{
  "totalEvents": 1284,
  "totalSignals": 37,
  "resolvedSignals": 12,
  "openSignals": 25,
  "noiseReduction": 97.1
}
```

`noiseReduction` is the percentage of raw events consolidated into signals: `(totalEvents - totalSignals) / totalEvents * 100`.

### `GET /api/health`

```json
{
  "status": "ok",
  "version": "1.0.0",
  "providers": { "database": "local", "redis": "upstash", "groq": "configured", "supabase": "configured" },
  "services": { "redis": "healthy", "database": "healthy", "supabase": "healthy" },
  "diagnostics": { "supabase": { "ok": true, "statusCode": 200, "message": "Supabase Data API is reachable." } },
  "queue": { "pending": 0 },
  "timestamp": "2026-08-29T10:00:00.000Z"
}
```

`status` is `ok` when every *configured* service is healthy, `degraded` otherwise. Supabase errors in
`diagnostics.supabase` distinguish missing configuration, rejected keys, incorrect project URLs, and network failures.

## Core services

### Correlation — `backend/services/correlation.ts`

Groups events by service, sorts them by timestamp, then greedily builds clusters where each event is either
type-compatible with an event already in the cluster (e.g. `error` ↔ `latency` ↔ `database_error`) or shares
keywords with it. Candidates must fall inside the 5-minute window from the cluster's first event, and a cluster
needs at least 2 events to become a signal. Signal ids look like `sig-payment-api-20260829100000-2`.

### Scoring — `backend/services/scoring.ts`

Pure and deterministic; every score is explainable by its factors:

| Factor | Contribution |
|---|---|
| Severity base | `critical` 75 · `high` 50 · `medium` 25 · `low` 5 |
| Event volume | `min(15, round(5 × log₂(count)))` — diminishing returns |
| Event-type diversity | `min(10, (distinctTypes − 1) × 3.5)` |
| Burst rate | `min(5, round(eventsPerMinute × 0.6))` |

The total is clamped to 0–100, then mapped to priority: **P0** ≥ 80, **P1** ≥ 60, **P2** ≥ 30, **P3** below 30.

### Triage — `backend/services/triage.ts` → `backend/lib/ai.ts`

`lib/ai.ts` is the only module that talks to Groq. It sends the signal summary plus a factual block of correlated
events and asks for strict JSON: `hypothesis`, `confidence` (`high`/`medium`/`low`), `evidence[]`, and `nextSteps[]`.
The response is validated before use. Missing API key, network failure, or malformed JSON all return `null`, and the
worker simply skips enrichment — the deterministic score is never blocked or replaced.

## Not yet implemented

The four capabilities below appear in the project's description but have no implementation in this repository.
None of them are partially built — treat each as absent rather than unfinished.

**Routing signals to the responsible team.** A signal carries no owner, assignee, or escalation target. There is no
`team`/`assignee` column, no routing rules, and no notification dispatch, so SignalFlow ends at "here is what needs
attention" — deciding who acts on it is left to the reader.

**External source integrations.** `POST /api/events` is the only ingress. There are no webhook receivers, so GitHub,
Slack, Jira, and Prometheus cannot call SignalFlow directly; you must write the caller that normalizes their payloads
into the event schema. The endpoint also performs no authentication or signature verification, so anyone who can reach
it can write events.

**Authentication and authorization.** `frontend/utils/supabase/` provides browser and server Supabase client helpers,
and `proxy.ts` refreshes session cookies on every request — but the result of `getUser()` is discarded, and no page or
API route checks a session or returns `401`/`403`. Every endpoint, including `PATCH /api/signals/[id]`, is open. Only
the session refresher is wired up; `utils/supabase/client.ts` and `server.ts` are unused.

**Operator feedback loop.** Resolving a signal (`PATCH /api/signals/[id]`) only flips a `status` string. No resolution
outcome, acknowledgement, or false-positive flag is recorded, and nothing is fed back into correlation, scoring, or
triage — so triage quality cannot improve from operator behavior over time.

## Scripts

All scripts run from the repository root:

| Command | Description |
|---|---|
| `npm run dev` | Next.js dev server + background worker (`concurrently`) |
| `npm run frontend:dev` | Next.js dev server only (http://localhost:3000) |
| `npm run backend:worker` | Background ingestion worker only |
| `npm run frontend:build` | Production build of the Next.js app |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint over the frontend |
| `npm test` | Run the backend Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:up` | Start local Postgres + Redis containers |
| `npm run db:down` | Stop and remove the containers |

## Testing

```bash
npm test
```

The backend suite runs with Vitest and covers:

| Suite | Focus |
|---|---|
| `correlation.test.ts` | Grouping rules, time-window boundaries, type compatibility, keyword extraction, signal ids |
| `scoring.test.ts` | Severity/volume/diversity/burst contributions, clamping, priority thresholds |
| `triage.test.ts` | Triage orchestration and graceful degradation without an API key |
| `supabase-env.test.ts` | Supabase provider detection from public vs. server env vars |

Current status: **44 tests passing across 4 files.** The frontend is verified with `npm run frontend:build`
(which type-checks the whole app) and `npm run lint`.

## Deployment

1. **Database** — provision Supabase (or any hosted Postgres) and set `DATABASE_URL`.
2. **Queue** — provision Upstash Redis and set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
3. **AI (optional)** — set `GROQ_API_KEY` and `GROQ_MODEL`.
4. **Frontend** — `npm run frontend:build` then `npm start`; deploy `frontend/` to Vercel, Cloudflare, or any Node host.
5. **Worker** — run `npm run backend:worker` as a long-lived process (container, VM, or scheduled runtime). The worker
   is stateless, so it can be scaled horizontally.

```bash
curl http://localhost:3000/api/health   # verify providers and connectivity
```

## Troubleshooting

**Database connection errors / dashboard shows demo data.** Check `DATABASE_URL` or the `DB_*` values, then make sure
the database is actually reachable. With Docker: `npm run db:up`. The dashboard intentionally falls back to the demo
dataset instead of failing, so this is easy to miss — check `/api/health`.

**Supabase reports `unhealthy`.** Check `/api/health` → `diagnostics.supabase`. Verify the URL is the project's
Supabase API URL (not the PostgreSQL hostname), the publishable/anon key belongs to that project, and the Data API is
enabled. If only `services.database` is unhealthy, configure the PostgreSQL connection string separately as
`DATABASE_URL` and make sure `USE_LOCAL_DATABASE` is not set to `true`.

**Worker exits right after start.** `initializeDatabase()` runs before the poll loop, so the worker stops if the
database is unreachable at boot. Fix the database connection and restart it.

**Redis connection errors.** Verify the Upstash URL/token pair, or that local Redis is running (`redis-cli ping`).
`POST /api/events` returns `500` if the queue cannot be reached.

**AI triage never appears.** Confirm `GROQ_API_KEY` is set and the account has quota. Triage is optional; signals
still get deterministic scores without it.

**No signals appear after posting events.** A signal needs at least 2 compatible events for the same service within
5 minutes, and the worker must be running.

**Port 3000 already in use.** Stop the other process, or run `cd frontend && npx next dev -p 3001`.

## Contributing

1. Fork the repository and create a feature branch.
2. Keep changes scoped, and run `npm test`, `npm run lint`, and `npm run frontend:build` before opening a PR.
3. Describe the problem being solved in the PR description.

Adding a new event source only requires posting the schema above to `POST /api/events` — validation, queueing,
correlation, scoring, persistence, and triage are handled for you.

## License

MIT — see [LICENSE](LICENSE). © 2026 Poloju Pravalika, Sairishita Manne.
