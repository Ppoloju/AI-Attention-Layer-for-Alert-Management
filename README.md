# SignalFlow — AI Attention Layer for Incident Alert Management

SignalFlow is an AI-powered attention layer for operational incidents. It ingests events from multiple sources (GitHub, Slack, Prometheus, etc.), correlates them, and routes them to the right team with AI-powered triage.

This repository contains the **initial vertical slice**: event ingestion via API → Redis queue → worker → PostgreSQL.

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (Docker Desktop must be running)

### Clone and Run

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AI-Attention-Layer-for-Alert-Management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   This installs both `frontend/` and `backend/` via npm workspaces.

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   The default values in `.env.example` work with the Docker setup. Edit `.env` only if your local ports differ.

4. **Start Docker services (Redis + PostgreSQL)**
   ```bash
   docker-compose up -d
   ```
   Verify they're running:
   ```bash
   docker-compose ps
   ```

5. **Initialize the database**
   ```bash
   docker exec signalflow-postgres psql -U signalflow -d signalflow -c "CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, source TEXT NOT NULL, event_type TEXT NOT NULL, service TEXT NOT NULL, severity TEXT NOT NULL, timestamp TIMESTAMP WITH TIME ZONE NOT NULL, message TEXT NOT NULL, metadata JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());"
   docker exec signalflow-postgres psql -U signalflow -d signalflow -c "CREATE INDEX IF NOT EXISTS idx_events_service ON events(service);"
   docker exec signalflow-postgres psql -U signalflow -d signalflow -c "CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);"
   ```
   Optionally seed test data:
   ```bash
   docker exec signalflow-postgres psql -U signalflow -d signalflow -c "INSERT INTO events (source, event_type, service, severity, timestamp, message, metadata) VALUES ('github', 'pull_request', 'payment-api', 'high', NOW() - INTERVAL '1 hour', 'Payment API deployment health check failed', '{\"repository\": \"demo/repo\", \"action\": \"opened\"}'), ('prometheus', 'alert', 'auth-service', 'critical', NOW() - INTERVAL '30 minutes', 'High error rate detected in authentication service', '{\"error_rate\": \"0.95\", \"endpoint\": \"/login\"}'), ('slack', 'incident', 'user-service', 'medium', NOW() - INTERVAL '15 minutes', 'Users reporting slow response times', '{\"affected_users\": 150, \"region\": \"us-east\"}');"
   ```

6. **Start the frontend application (Next.js API)**
   ```bash
   npm run frontend:dev
   ```
   The API will be available at `http://localhost:3000`

7. **Start the backend worker (in a separate terminal)**
   ```bash
   npm run backend:worker
   ```

The application is now running! You can:
- Send events to `POST http://localhost:3000/api/events`
- Query events at `GET http://localhost:3000/api/events`
- Check health at `GET http://localhost:3000/api/health`

## Architecture

```
Browser / Event Sources
        │
        ▼
   Next.js API        ← POST /api/events (validate + enqueue)
        │
        ▼
     Redis             ← Queue (events:queue)
        │
        ▼
   Worker              ← Polls Redis, persists to DB
        │
        ▼
   PostgreSQL          ← events table (durable storage)
```

## Folder Structure

```
├── frontend/              # Next.js app + API routes
│   ├── app/
│   │   ├── api/
│   │   │   ├── events/    # POST (enqueue) + GET (query persisted)
│   │   │   └── health/    # GET (Redis + PostgreSQL check)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── lib/
│   │   └── queue.ts       # Redis queue client
│   ├── package.json
│   └── tsconfig.json
│
├── backend/               # Core processing
│   ├── lib/
│   │   ├── db.ts          # PostgreSQL pool + queries
│   │   └── redis.ts       # Redis queue (enqueue/dequeue)
│   ├── queue/
│   │   └── worker.ts      # Polls Redis, validates, inserts to DB
│   └── package.json
│
├── database/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
│
├── shared/
│   └── schemas/
│       └── event.ts       # Zod schema (shared by API + worker)
│
├── docker-compose.yml     # Redis + PostgreSQL
├── .env.example
├── .gitignore
├── package.json           # Workspace root
└── README.md
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `signalflow` | PostgreSQL database |
| `DB_USER` | `signalflow` | PostgreSQL user |
| `DB_PASSWORD` | `signalflow_password` | PostgreSQL password |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |

## API Endpoints

### POST /api/events

Accept and validate an event, enqueue it for processing.

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "source": "github",
    "event_type": "pull_request",
    "service": "payment-api",
    "severity": "high",
    "timestamp": "2026-08-29T10:20:00Z",
    "message": "Payment API deployment health check failed",
    "metadata": {"repository": "demo/repo", "action": "opened"}
  }'
```

Returns `202 Accepted` with the event.

### GET /api/events

Query persisted events from PostgreSQL.

```bash
curl http://localhost:3000/api/events?limit=10
```

### GET /api/health

Check Redis and PostgreSQL connectivity.

```bash
curl http://localhost:3000/api/health
```

Returns `status: "ok"` when both are healthy.

## Event Schema

Events must conform to:

```typescript
{
  source: "github" | "slack" | "jira" | "prometheus" | "custom"
  event_type: string
  service: string
  severity: "low" | "medium" | "high" | "critical"
  timestamp: string  // ISO 8601
  message: string
  metadata?: Record<string, any>
}
```

Invalid events are rejected with `400 Bad Request`.

## Worker Behavior

The worker (`npm run backend:worker`) runs in an infinite loop:

1. Polls Redis every 1 second
2. Dequeues one event at a time
3. Validates against the Zod schema
4. Inserts into PostgreSQL `events` table
5. Logs the result

If the worker is down, events accumulate in Redis and are processed when it restarts.

## Implementation Status

### Completed

- Event ingestion API (POST /api/events)
- Zod schema validation (shared between API and worker)
- Redis queue (enqueue/dequeue)
- Background worker (poll + persist)
- PostgreSQL storage with indexes
- Health endpoint (Redis + PostgreSQL)
- Docker Compose (Redis + PostgreSQL)
- Event querying (GET /api/events)

### Not Implemented

- Correlation engine
- Risk scoring
- AI/Grok integration
- Dashboard UI
- Event routing
- External integrations (GitHub, Slack, Jira, Prometheus)
- Authentication
- Feedback loop

## Future Scope

1. **Correlation Engine** — Group related events into incidents by service, time window, and keywords
2. **Risk Scoring** — Deterministic scoring based on severity, frequency, and service criticality
3. **AI Triage** — Use AI to generate summaries, hypotheses, and suggested next steps
4. **Dashboard** — Real-time UI for viewing signals, incidents, and event flow
5. **Routing** — Direct events to the responsible team based on rules and AI classification
6. **Integrations** — GitHub webhooks, Slack notifications, Jira ticket creation, Prometheus alerts
7. **Authentication** — User auth and role-based access control
8. **Feedback Loop** — Allow operators to mark events as resolved, improving AI over time

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `signalflow` | PostgreSQL database |
| `DB_USER` | `signalflow` | PostgreSQL user |
| `DB_PASSWORD` | `signalflow_password` | PostgreSQL password |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |

## API Endpoints

### POST /api/events

Accept and validate an event, enqueue it for processing.

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "source": "github",
    "event_type": "pull_request",
    "service": "payment-api",
    "severity": "high",
    "timestamp": "2026-08-29T10:20:00Z",
    "message": "Payment API deployment health check failed",
    "metadata": {"repository": "demo/repo", "action": "opened"}
  }'
```

Returns `202 Accepted` with the event.

### GET /api/events

Query persisted events from PostgreSQL.

```bash
curl http://localhost:3000/api/events?limit=10
```

### GET /api/health

Check Redis and PostgreSQL connectivity.

```bash
curl http://localhost:3000/api/health
```

Returns `status: "ok"` when both are healthy.

## Event Schema

Events must conform to:

```typescript
{
  source: "github" | "slack" | "jira" | "prometheus" | "custom"
  event_type: string
  service: string
  severity: "low" | "medium" | "high" | "critical"
  timestamp: string  // ISO 8601
  message: string
  metadata?: Record<string, any>
}
```

Invalid events are rejected with `400 Bad Request`.

## Worker Behavior

The worker (`npm run backend:worker`) runs in an infinite loop:

1. Polls Redis every 1 second
2. Dequeues one event at a time
3. Validates against the Zod schema
4. Inserts into PostgreSQL `events` table
5. Logs the result

If the worker is down, events accumulate in Redis and are processed when it restarts.

## Implementation Status

### Completed

- Event ingestion API (POST /api/events)
- Zod schema validation (shared between API and worker)
- Redis queue (enqueue/dequeue)
- Background worker (poll + persist)
- PostgreSQL storage with indexes
- Health endpoint (Redis + PostgreSQL)
- Docker Compose (Redis + PostgreSQL)
- Event querying (GET /api/events)

### Not Implemented

- Correlation engine
- Risk scoring
- AI/Grok integration
- Dashboard UI
- Event routing
- External integrations (GitHub, Slack, Jira, Prometheus)
- Authentication
- Feedback loop

## Future Scope

1. **Correlation Engine** — Group related events into incidents by service, time window, and keywords
2. **Risk Scoring** — Deterministic scoring based on severity, frequency, and service criticality
3. **AI Triage** — Use AI to generate summaries, hypotheses, and suggested next steps
4. **Dashboard** — Real-time UI for viewing signals, incidents, and event flow
5. **Routing** — Direct events to the responsible team based on rules and AI classification
6. **Integrations** — GitHub webhooks, Slack notifications, Jira ticket creation, Prometheus alerts
7. **Authentication** — User auth and role-based access control
8. **Feedback Loop** — Allow operators to mark events as resolved, improving AI over time
