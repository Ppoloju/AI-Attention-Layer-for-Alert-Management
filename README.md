# SignalFlow — AI Attention Layer for Incident Alert Management

SignalFlow is an intelligent, AI-powered attention layer for operational incident management. It automatically ingests events from multiple sources, correlates them into actionable signals, scores risk deterministically, and provides AI-powered triage recommendations using Groq AI.

**Stable Release: v1.0.0**  
**Status:** Production-ready with Docker and Supabase support

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Development](#development)

---

## Tech Stack

### Frontend
| Component | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.3.3 |
| UI Library | React | 19.2.8 |
| Styling | Tailwind CSS | 4.0+ |
| Language | TypeScript | 5.0+ |
| Linting | ESLint | 9.0+ |

### Backend & API
| Component | Technology | Version |
|---|---|---|
| API Server | Next.js App Router | 16.3.3 |
| Runtime | Node.js | 18+ |
| Database | PostgreSQL | 14+ |
| ORM | pg (node-postgres) | 8.23.0 |
| Validation | Zod | 4.5.2 |

### Data & Messaging
| Component | Technology | Version | Environment |
|---|---|---|---|
| Message Queue | Redis | Latest | Local (Docker) or Upstash (Production) |
| Task Queue | Custom Redis Queue | - | Both |
| Database | PostgreSQL | 14+ | Local (Docker) or Supabase (Production) |

### AI & ML
| Component | Technology | Model |
|---|---|---|
| AI Triage Engine | Groq API | llama-3.1-8b-instant |
| Inference | Groq Cloud | REST API |

### Authentication
| Component | Technology | Status |
|---|---|---|
| Auth Provider | Supabase | Ready (optional) |
| Session Management | Supabase SSR | @supabase/ssr (0.12.5+) |

### Testing & Quality
| Component | Technology | Version |
|---|---|---|
| Unit Testing | Vitest | 4.1.11+ |
| Test Coverage | Services: correlation, scoring, triage | - |
| Code Quality | ESLint | 9.0+ |

### DevOps & Deployment
| Component | Technology | Purpose |
|---|---|---|
| Containerization | Docker | Local development & deployment |
| Orchestration | Docker Compose | Multi-container orchestration |
| Build Tool | npm/workspace | Monorepo management |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Event Sources                               │
│         (GitHub, Prometheus, Slack, Custom HTTP, etc.)          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    POST /api/events
                     (Validation)
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend API                          │
│                    (Route Handlers)                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ GET  /api/signals       - Fetch ranked signals           │   │
│  │ GET  /api/signals/[id]  - Get signal with events         │   │
│  │ POST /api/events        - Enqueue new events             │   │
│  │ GET  /api/health        - System health check            │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    Enqueue (JSON)
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Redis Message Queue                             │
│           (Upstash REST in prod, local Docker)                   │
│               ↓ Stores pending events ↓                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                  Dequeue (Node.js Worker)
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│             Background Worker (Node.js + tsx)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Correlation Engine                                    │   │
│  │    - Groups events by service                            │   │
│  │    - Detects patterns within time window (5 min)         │   │
│  │                                                          │   │
│  │ 2. Scoring Engine                                        │   │
│  │    - Calculates risk_score (0-100)                       │   │
│  │    - Determines priority (P0-P3)                         │   │
│  │    - Based on severity & event frequency                 │   │
│  │                                                          │   │
│  │ 3. AI Triage (Optional - Groq API)                       │   │
│  │    - Hypothesis generation                              │   │
│  │    - Evidence extraction                                │   │
│  │    - Next steps recommendation                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
            INSERT/UPDATE Signals + Events
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│          PostgreSQL Database (Supabase or Docker)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Tables:                                                  │   │
│  │ • events - Raw events (source, severity, message, etc)   │   │
│  │ • signals - Correlated signals (priority, risk_score)    │   │
│  │ • signal_events - Junction table (N-to-M relationship)   │   │
│  │                                                          │   │
│  │ Indexes: service, severity, created_at, risk_score      │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                 GET /api/signals (List)
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│              React Dashboard (Next.js Frontend)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • Signals list (ranked by risk_score)                    │   │
│  │ • Real-time stats (P0/P1 count, queue pending)           │   │
│  │ • Signal detail view with AI triage recommendations      │   │
│  │ • Event timeline visualization                           │   │
│  │ • System health indicator                                │   │
│  │ • Dark mode support                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Features

✅ **Intelligent Event Correlation** - Automatically groups related events into signals  
✅ **Risk Scoring** - Deterministic scoring based on severity and frequency  
✅ **AI-Powered Triage** - Groq API integration for automatic analysis  
✅ **Real-time Dashboard** - Beautiful React UI with dark mode support  
✅ **Flexible Infrastructure** - Works with local Docker or Supabase + Upstash  
✅ **Background Worker** - Scalable event processing pipeline  
✅ **RESTful API** - Easy integration with existing tools  
✅ **Comprehensive Testing** - Unit tests for all service logic  
✅ **Health Monitoring** - System status endpoint with provider info  

## Quick Start

### Prerequisites

- **Node.js** 18+ (get from [nodejs.org](https://nodejs.org))
- **.env file** at the project root (copy from `.env.example`)
- **Docker & Docker Compose** (optional, for local database/Redis) OR  
- **Supabase account** + **Upstash Redis** account (for production)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your credentials:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `GROQ_API_KEY` | Groq API key for AI triage (optional) |

For **local development** without cloud services, leave `DATABASE_URL` and Upstash vars empty and use Docker:

```bash
npm run db:up
```

### 3. Run the application

```bash
npm run dev
```

This starts both the Next.js frontend (port 3000) and the background worker.

Or run them separately:

```bash
npm run frontend:dev    # Terminal 1
npm run backend:worker  # Terminal 2
```

Open **http://localhost:3000** for the dashboard.

### 4. Send test events

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"source":"prometheus","event_type":"alert","service":"payment-api","severity":"high","timestamp":"2026-08-29T10:00:00Z","message":"Error rate spike"}'

curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"source":"github","event_type":"deploy","service":"payment-api","severity":"critical","timestamp":"2026-08-29T10:01:00Z","message":"Deploy rollback triggered"}'
```

Two events for the same service within 5 minutes create a correlated **signal** visible on the dashboard.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/events` | Validate and enqueue an event (202 Accepted) |
| `GET` | `/api/events` | List persisted events |
| `GET` | `/api/signals` | List correlated signals (ranked by risk) |
| `GET` | `/api/signals/[id]` | Get signal details with correlated events |
| `GET` | `/api/health` | System health check with provider status |

## Configuration

### Environment Variables - Complete Reference

```bash
# ════ DATABASE ════════════════════════════════════════════════
# Option 1: Supabase URL (recommended for production)
DATABASE_URL=postgresql://postgres:PASSWORD@db.REGION.supabase.co:5432/postgres

# Option 2: Local Docker PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=signalflow
DB_USER=signalflow
DB_PASSWORD=signalflow_password

# ════ REDIS QUEUE ═════════════════════════════════════════════
# Option 1: Upstash Redis (recommended for production)
UPSTASH_REDIS_REST_URL=https://YOUR-ENDPOINT.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN

# Option 2: Local Docker Redis
REDIS_URL=redis://localhost:6379

# ════ SUPABASE AUTH (OPTIONAL) ════════════════════════════════
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...

# ════ GROQ AI (OPTIONAL) ══════════════════════════════════════
# Triage is skipped when not configured
GROQ_API_KEY=gsk_YOUR_KEY_HERE
GROQ_MODEL=llama-3.1-8b-instant
```

### Connection Modes

#### Local Development (Docker)
```bash
# Start PostgreSQL and Redis
npm run db:up

# Worker will use: localhost:5432 (PostgreSQL), localhost:6379 (Redis)
```

#### Production (Supabase + Upstash)
```bash
# Fill in DATABASE_URL (Supabase)
# Fill in UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
# 
# No Docker needed - cloud-hosted managed services
```

## Running the Application

### Development Mode

**Start everything:**
```bash
npm run dev
```
- Frontend: http://localhost:3000
- Backend Worker: Processing events in background

**Individual processes:**
```bash
npm run frontend:dev      # Terminal 1 - Next.js dev server
npm run backend:worker    # Terminal 2 - Event processing worker
```

### Production Build

```bash
npm run frontend:build    # Build Next.js
npm start                 # Run production server
```

### Database & Queue Management

```bash
npm run db:up            # Start Docker containers (Postgres + Redis)
npm run db:down          # Stop containers
```

## API Reference

### Events API

#### POST /api/events
**Enqueue a new event** (accepted to Redis, processed asynchronously)

Request body (JSON):
```json
{
  "source": "prometheus",          // Event source (e.g., prometheus, github, slack)
  "event_type": "alert",           // Type of event
  "service": "payment-api",        // Service affected
  "severity": "high",              // critical | high | medium | low
  "message": "Error rate exceeded threshold",
  "metadata": {                    // Optional context
    "error_rate": "15.5%",
    "duration_seconds": 300
  },
  "timestamp": "2026-08-29T10:00:00Z"
}
```

Response (202 Accepted):
```json
{
  "message": "Event accepted",
  "event": { /* echo of accepted event */ }
}
```

#### GET /api/events
**List recent events**

Query params:
- `limit` (1-1000, default 50)

Response:
```json
{
  "events": [
    {
      "id": 1,
      "source": "prometheus",
      "event_type": "alert",
      "service": "payment-api",
      "severity": "high",
      "message": "Error rate spike",
      "metadata": { "error_rate": "15.5%" },
      "timestamp": "2026-08-29T10:00:00Z",
      "created_at": "2026-08-29T10:00:01Z"
    }
  ]
}
```

### Signals API

#### GET /api/signals
**List correlated signals** (ranked by risk_score DESC)

Query params:
- `limit` (1-1000, default 50)

Response:
```json
{
  "signals": [
    {
      "id": "signal_payment-api_20260829_1000",
      "service": "payment-api",
      "title": "Payment API Errors",
      "max_severity": "critical",
      "risk_score": 92,
      "priority": "P0",
      "representative_message": "Multiple error events detected",
      "event_count": 5,
      "start_time": "2026-08-29T10:00:00Z",
      "end_time": "2026-08-29T10:05:00Z",
      "created_at": "2026-08-29T10:01:00Z"
    }
  ]
}
```

#### GET /api/signals/[id]
**Get signal details with correlated events**

Response:
```json
{
  "signal": {
    "id": "signal_payment-api_20260829_1000",
    "service": "payment-api",
    "title": "Payment API Errors",
    "max_severity": "critical",
    "risk_score": 92,
    "priority": "P0",
    "event_count": 5,
    "ai_hypothesis": "Database connection pool exhaustion causing cascading failures",
    "ai_confidence": "high",
    "ai_evidence": [
      "Connection pool at capacity",
      "Increasing error rates correlate with connection timeout"
    ],
    "ai_next_steps": [
      "Scale database read replicas",
      "Increase connection pool size"
    ],
    "events": [
      {
        "id": 1,
        "source": "prometheus",
        "event_type": "alert",
        "service": "payment-api",
        "severity": "critical",
        "message": "Connection pool exhausted",
        "metadata": { "pool_size": 100, "active": 100 },
        "timestamp": "2026-08-29T10:00:00Z"
      }
    ]
  }
}
```

#### GET /api/health
**System health check**

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "providers": {
    "database": "supabase",
    "redis": "upstash",
    "groq": "configured",
    "supabase": "configured"
  },
  "services": {
    "redis": "healthy",
    "database": "healthy",
    "supabase": "healthy"
  },
  "queue": {
    "pending": 0
  },
  "timestamp": "2026-08-29T10:00:00Z"
}
```

## Development

### Project Structure

```
AI-Attention-Layer-for-Alert-Management/
├── frontend/                    # Next.js React UI
│   ├── app/
│   │   ├── page.tsx            # Dashboard (signals list)
│   │   ├── signals/[id]/page.tsx # Signal detail view
│   │   └── api/                # Route handlers
│   │       ├── events/route.ts # Event enqueue endpoint
│   │       ├── signals/route.ts
│   │       └── health/route.ts
│   └── lib/queue.ts            # Redis queue client
│
├── backend/                     # Node.js worker
│   ├── lib/
│   │   ├── ai.ts              # Groq AI integration
│   │   └── redis.ts           # Redis client
│   ├── queue/
│   │   └── worker.ts          # Event processing loop
│   ├── services/              # Business logic
│   │   ├── correlation.ts     # Signal correlation
│   │   ├── scoring.ts         # Risk scoring
│   │   └── triage.ts          # AI triage
│   └── __tests__/             # Unit tests (Vitest)
│
├── shared/                      # Monorepo shared code
│   ├── lib/
│   │   ├── db.ts              # PostgreSQL queries
│   │   ├── load-env.ts        # Env var loader
│   │   └── providers.ts       # Provider detection
│   └── schemas/
│       └── event.ts           # Zod event validation
│
├── database/
│   ├── migrations/            # SQL schema versions
│   └── seed.sql              # Sample data
│
├── docker-compose.yml         # Local dev containers
├── .env.example               # Environment template
└── README.md                  # This file
```

### Running Tests

```bash
npm test                # Run all backend tests (correlation, scoring, triage)
npm run test:watch    # Watch mode for TDD
```

### Adding Custom Event Sources

Events must conform to the [Zod EventSchema](/shared/schemas/event.ts):

```typescript
{
  source: string;        // "prometheus", "github", "slack", etc.
  event_type: string;    // "alert", "deploy", "error", etc.
  service: string;       // Service name (used for correlation)
  severity: string;      // "critical" | "high" | "medium" | "low"
  message: string;       // Human-readable description
  metadata?: Record;     // Optional structured data
  timestamp: string;     // ISO 8601 timestamp
}
```

Any event matching this schema will be automatically:
1. Enqueued to Redis
2. Correlated with recent events from same service
3. Scored based on severity and frequency
4. Persisted to database
5. Analyzed by AI triage (if configured)

## Deployment Guide

### Docker Deployment

```bash
# Build & run locally with Compose
docker-compose up

# Or build production image
docker build -t signalflow:latest .
docker run -p 3000:3000 --env-file .env signalflow:latest
```

### Kubernetes Deployment

1. Deploy PostgreSQL via StatefulSet (or use Supabase)
2. Deploy Redis via Helm (or use Upstash)
3. Deploy Next.js app via Deployment
4. Deploy background worker as separate Deployment
5. Create Service for frontend (port 3000)

### Monitoring & Logs

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# View worker logs
docker-compose logs -f backend

# Database logs
docker-compose logs -f postgres
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -am 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Database Connection Error
- Ensure `.env` has correct credentials
- Run `npm run db:up` if using local Docker
- Check Supabase project is active

### Redis Connection Error
- Verify local Redis running: `redis-cli ping`
- Check Upstash credentials if using cloud

### AI Triage Not Working
- `GROQ_API_KEY` must be set in `.env`
- Check Groq API quota and rate limits
- Triage is optional - app works without it

## License

MIT
| `GET` | `/api/signals/:id` | Signal detail with events and AI triage |
| `GET` | `/api/health` | Health check (DB, Redis, Supabase, queue size) |

## Folder Structure

```
├── frontend/           Next.js app + API routes + dashboard UI
├── backend/            Worker, correlation, scoring, AI triage
├── shared/             Shared DB layer, Zod schemas, env loader
├── database/           SQL migrations and seed data
├── docker-compose.yml  Local Redis + PostgreSQL
├── .env.example        Environment template
└── package.json        Monorepo workspace root
```

## Implementation Status (v1.0.0)

### Completed

- Event ingestion API with Zod validation
- Redis queue (Upstash + local Docker)
- Background worker with correlation engine
- Deterministic risk scoring (P0–P3 priorities)
- Groq AI triage (hypothesis, evidence, next steps)
- Supabase PostgreSQL storage with auto-migration
- Dashboard UI with live health status
- Signal detail page with AI triage panel
- Health endpoint with provider detection
- 43 unit tests passing

### Planned

- External webhook integrations (GitHub, Slack, Jira, Prometheus)
- Authentication and RBAC via Supabase Auth
- Real-time signal updates (Supabase Realtime)
- Feedback loop for operator resolution
- Alert routing to on-call teams

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend + worker together |
| `npm run frontend:dev` | Next.js dev server only |
| `npm run backend:worker` | Background worker only |
| `npm run frontend:build` | Production build |
| `npm run test` | Run backend unit tests |
| `npm run db:up` | Start local Docker services |
| `npm run db:down` | Stop local Docker services |

## License

Private — SignalLabs AI HackDay project.
