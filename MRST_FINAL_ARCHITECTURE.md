# MRST Final Architecture Document
## Merged from Claude + ChatGPT Analysis

> **Philosophy:** Mirror everything first. Build AI intelligence layer on data. Let AI drive the UI.

---

# Executive Summary

MRST is a multi-tenant platform that:
1. **Mirrors 100% of data** from Monday.com, HQ Rental, Gmail, Spireon, WhatsApp
2. **Builds an AI intelligence layer** on top of mirrored data
3. **Provides adaptive, AI-driven interfaces** per user role
4. **Eventually replaces HQ** as source of truth

---

# 1. Tech Stack (Final)

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND                                                   │
│  Next.js 15 (App Router) + TypeScript + Tailwind           │
│  shadcn/ui (ADHD-customized) + TanStack Query + Zustand    │
│  Socket.io-client (real-time)                              │
├─────────────────────────────────────────────────────────────┤
│  BACKEND                                                    │
│  Hono (fast, AI-friendly) + tRPC (typed app API)           │
│  TypeScript strict mode                                     │
│  Drizzle ORM (better JSONB/PostGIS than Prisma)            │
│  pg-boss (Postgres-backed jobs)                            │
│  Socket.io (real-time server)                              │
├─────────────────────────────────────────────────────────────┤
│  DATABASE                                                   │
│  PostgreSQL 15 + PostGIS + pg_trgm + citext + pgcrypto     │
├─────────────────────────────────────────────────────────────┤
│  AI LAYER                                                   │
│  Claude API (primary reasoning, OCR, suggestions)          │
│  Gemini API (fallback + image generation)                  │
│  Vector embeddings (pgvector) for semantic search          │
│  Fine-tuned small model (future) on mirrored data          │
├─────────────────────────────────────────────────────────────┤
│  STORAGE                                                    │
│  S3 (files, images, backups)                               │
│  Local PostgreSQL with WAL archiving to S3                 │
├─────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE                                             │
│  AWS EC2 (existing) + PM2 (process manager)                │
│  Nginx (reverse proxy) + Let's Encrypt (SSL)               │
│  Move to Docker when tenant #2 goes live                   │
└─────────────────────────────────────────────────────────────┘
```

### Why These Choices (ChatGPT Validated)

| Decision | Reasoning |
|----------|-----------|
| **Hono over NestJS** | AI generates cleaner code without decorator/DI complexity |
| **Drizzle over Prisma** | Better for JSONB + PostGIS heavy workloads |
| **pg-boss over BullMQ** | One less service, jobs in DB backups |
| **PM2 over Docker (initially)** | Faster iteration, Docker when multi-tenant |
| **Separate API + Worker processes** | Prevents sync jobs from blocking UI |

---

# 2. Architecture Principles

## 2.1 Data Mirroring Rules

Every mirrored record gets:
```typescript
{
  raw: JSONB,              // Complete API response (NEVER lose fidelity)
  first_seen_at: timestamp, // When we first saw this record
  last_seen_at: timestamp,  // Last sync time
  source_hash: string,      // Hash of raw for change detection
  deleted_at: timestamp,    // Soft delete only
  synced_at: timestamp      // When we synced
}
```

## 2.2 Identity Resolution Rules

| Match Type | Action | Confidence |
|------------|--------|------------|
| Exact email (unambiguous) | Auto-link | 100 |
| Exact phone E.164 (unambiguous) | Auto-link | 90 |
| Same phone but appears on multiple customers | REVIEW | - |
| Same email but appears on multiple customers | REVIEW | - |
| Name similarity only | REVIEW | 10-30 |
| AI-suggested | REVIEW | varies |

**Auto-link threshold:** >= 90 AND no ambiguity

## 2.3 Core vs Mirror Tables

| Table Type | Source of Truth For | Write Strategy |
|------------|---------------------|----------------|
| Mirror tables | External systems (Monday/HQ/Gmail/etc) | Sync jobs only |
| Core tables | MRST-native features (alerts, merges, MRST reservations) | Direct write |
| Write-through | When MRST creates something that must exist in HQ | Write core → queue push to HQ |

## 2.4 Monday Column History

Track value changes over time:
```sql
monday_item_column_value_versions (
  item_id, external_column_id,
  value_json, text_value,
  value_hash,  -- Detect changes via hash
  changed_at,  -- From activity log or sync time
  detected_by  -- 'activity_log' | 'diff_snapshot'
)
```

On every sync: compute hash → if different → insert version row.

---

# 3. Process Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         EC2 Server                          │
├─────────────────────────────────────────────────────────────┤
│  PM2 Process: web (Next.js)        Port 3000               │
│  PM2 Process: api (Hono + tRPC)    Port 3001               │
│  PM2 Process: worker (pg-boss)     No port                 │
│  PM2 Process: realtime (Socket.io) Port 3002               │
├─────────────────────────────────────────────────────────────┤
│  Nginx reverse proxy                                        │
│  ├── app.travelautorental.com → web:3000                   │
│  ├── app.travelautorental.com/api → api:3001               │
│  └── app.travelautorental.com/ws → realtime:3002           │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL (local, WAL → S3)                              │
└─────────────────────────────────────────────────────────────┘
```

Why separate processes:
- API stays fast (low latency)
- Worker can spike CPU without affecting UI
- Realtime isolated for WebSocket connections

---

# 4. Implementation Phases

## Phase 0: Foundation (Week 1)
- Project structure + tooling
- Database schema (platform tables only)
- Auth system (users, sessions, RBAC)
- Job queue setup (pg-boss)
- File storage (S3 integration)
- Basic admin UI (sync health dashboard)

## Phase 1: Monday.com Mirror (Week 2)
- Complete mirror: workspaces → boards → columns → items → values
- Updates + replies + files
- Activity logs
- Column title mapping (CRITICAL)
- Value change tracking (hash-based versions)

## Phase 2: HQ Rental Mirror (Week 3)
- Complete mirror: customers, vehicles, reservations
- Contracts, payments, charges, documents
- File downloads to S3
- Build initial core_customers + core_vehicles from HQ

## Phase 3: Timeline v1 (Week 3-4)
- Build timeline_events from Monday + HQ
- Collapse grouping for consecutive Monday events
- Timeline links to entities
- Basic timeline UI to VALIDATE mirroring completeness

## Phase 4: Gmail Mirror (Week 4-5)
- Poll-based sync (history.list every 60 seconds)
- All 10 accounts
- Threads, messages, attachments
- Gap handling (historyId too old → full resync)

## Phase 5: Spireon GPS (Week 5)
- Device sync
- Real-time location polling
- PostGIS geofences ("at shop" detection)
- Diagnostics (odometer, battery, fuel)

## Phase 6: WhatsApp (When Ready)
- Webhook ingestion
- Message sync
- Media downloads

## Phase 7: AI Intelligence Layer (Week 6+)
- Vector embeddings on all mirrored text (pgvector)
- Natural language search
- "What should I do next?" engine
- AI-driven UI suggestions per user role
- Vehicle image generation (Gemini)

## Phase 8: Adaptive UI (Week 7+)
- AI determines what each user sees
- Role-based dashboards generated by AI
- Minimal hardcoded screens
- Focus on ADHD-first principles

---

# 5. AI Intelligence Layer Design

## 5.1 The Vision

Instead of hardcoding "Driver sees X, Receptionist sees Y", we:
1. Mirror ALL data
2. Build embeddings on mirrored data
3. AI understands patterns: "When Moishy asks about vehicle V136, he wants GPS + reservations + alerts"
4. AI generates appropriate responses/views

## 5.2 Components

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Intelligence Layer                     │
├─────────────────────────────────────────────────────────────┤
│  Vector Store (pgvector)                                    │
│  ├── All Monday items/updates embedded                      │
│  ├── All Gmail messages embedded                            │
│  ├── All WhatsApp messages embedded                         │
│  └── All HQ records embedded                                │
├─────────────────────────────────────────────────────────────┤
│  Query Engine                                               │
│  ├── Natural language → SQL + vector search                 │
│  ├── Context-aware (knows who's asking)                     │
│  └── Permission-aware (filters by role)                     │
├─────────────────────────────────────────────────────────────┤
│  Response Generator                                         │
│  ├── Claude API for complex reasoning                       │
│  ├── Gemini for image generation                            │
│  └── Cached responses for common queries                    │
├─────────────────────────────────────────────────────────────┤
│  UI Adapter                                                 │
│  ├── Generates component configs based on query             │
│  ├── "Show timeline" → Timeline component with filters      │
│  └── "What's urgent?" → Priority cards component            │
└─────────────────────────────────────────────────────────────┘
```

## 5.3 Example Interactions

**Moishy asks:** "What's going on with the Camry?"
```
AI understands:
- User: Moishy (tenant owner, full access)
- Entity: Camry → core_vehicles WHERE make='Toyota' model='Camry'
- Intent: Overview
- Response: Timeline + current location + active reservation + any alerts
```

**Driver asks:** "Where should I go?"
```
AI understands:
- User: Mike (driver role, limited access)
- Intent: Next task
- Response: List of pickups/deliveries for today (no customer PII)
```

---

# 6. File Structure

```
mrst/
├── .claude/
│   └── settings.json          # Claude Code settings
├── CLAUDE.md                   # AI coding rules (COMPACT)
├── PROJECT_LEDGER.md          # Session state + progress
├── SESSION_LOG.md             # Detailed session history
├── package.json               # Monorepo root
├── pnpm-workspace.yaml
├── turbo.json                 # Turborepo config
│
├── apps/
│   ├── web/                   # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/          # App Router pages
│   │   │   ├── components/   # React components
│   │   │   └── lib/          # Client utilities
│   │   └── package.json
│   │
│   ├── api/                   # Hono API server
│   │   ├── src/
│   │   │   ├── routes/       # HTTP routes
│   │   │   ├── trpc/         # tRPC routers
│   │   │   ├── middleware/   # Auth, logging
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── worker/                # Background jobs
│       ├── src/
│       │   ├── jobs/         # Job handlers
│       │   ├── sync/         # Integration sync logic
│       │   └── index.ts
│       └── package.json
│
├── packages/
│   ├── db/                    # Database layer
│   │   ├── src/
│   │   │   ├── schema/       # Drizzle schema files
│   │   │   ├── migrations/   # SQL migrations
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── integrations/          # External API clients
│   │   ├── src/
│   │   │   ├── monday/       # Monday.com client + parser
│   │   │   ├── hq/           # HQ Rental client + parser
│   │   │   ├── gmail/        # Gmail client + parser
│   │   │   ├── spireon/      # Spireon client + parser
│   │   │   └── whatsapp/     # WhatsApp client + parser
│   │   └── package.json
│   │
│   ├── ai/                    # AI services
│   │   ├── src/
│   │   │   ├── claude.ts     # Claude API client
│   │   │   ├── gemini.ts     # Gemini API client
│   │   │   ├── embeddings.ts # Vector embedding
│   │   │   ├── ocr.ts        # Document OCR
│   │   │   └── query.ts      # Natural language query engine
│   │   └── package.json
│   │
│   ├── ui/                    # Shared UI components
│   │   ├── src/
│   │   │   ├── adhd/         # ADHD-first components
│   │   │   └── primitives/   # Base components
│   │   └── package.json
│   │
│   └── shared/                # Shared types + utils
│       ├── src/
│       │   ├── types/        # TypeScript types
│       │   └── utils/        # Shared utilities
│       └── package.json
│
├── scripts/
│   ├── setup.sh              # Initial server setup
│   ├── deploy.sh             # Deploy script
│   └── backup.sh             # DB backup to S3
│
└── docs/
    ├── api/                   # API documentation
    └── architecture.md        # This document
```

---

# 7. Credentials Reference

From `/home/ec2-user/API_CREDENTIALS.md`:

```
HQ Rental:
  URL: https://api-america-3.caagcrm.com/api-america-3
  Tenant: A50uV6M0jDUcM1ehJsF6kh1YtFfNXkSrDQvqEaJJnPrk3dwFeW
  User: jLwBdr7fMzbrl54elfwm6Um4DqSYcbxGHhTSmYOI72CrowvUSO

Spireon:
  Identity: https://identity.spireon.com/identity/token
  REST: https://services.spireon.com/v0/rest
  App Token: fb086736-9a8b-42f5-85b5-2852bdea37a1
  Username: Spireonintegration@PlatinumCarRental.com
  Password: TAh!3!Tsw3G!
  NSpire ID: 305091

Monday.com:
  URL: https://api.monday.com/v2
  Key: eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjU5MjQ5NjY1NywiYWFpIjoxMSwidWlkIjoyMTc4NTQ0OCwiaWFkIjoiMjAyNS0xMi0wMVQxODo1Njo0MS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6ODYyOTAwOCwicmduIjoidXNlMSJ9.dvyYqMXj7yxTyLdEtqe0QJR_Bk61heKKX1nQ5Bg8vmU
  Boards: [17 board IDs listed in credentials file]

Gmail:
  Service Account: /home/ec2-user/google-service-account.json
  Accounts to monitor: [10 accounts - need list]

Shop Location:
  Address: 1621 63rd Street, Brooklyn, NY 11204
  Lat: 40.622877
  Long: -73.993128
  Radius: 0.3 miles (483 meters)

WhatsApp (360Dialog):
  [PENDING - need from Mordechai]
```

---

# 8. Database Backup Strategy

Since we're staying on local PostgreSQL:

```bash
# Daily full backup to S3
0 3 * * * /home/ec2-user/projects/mrst/scripts/backup.sh

# backup.sh content:
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -U mrst mrst | gzip > /tmp/mrst_$TIMESTAMP.sql.gz
aws s3 cp /tmp/mrst_$TIMESTAMP.sql.gz s3://mrst-backups/daily/
rm /tmp/mrst_$TIMESTAMP.sql.gz

# Keep 30 days of backups
aws s3 ls s3://mrst-backups/daily/ | while read -r line; do
  createDate=$(echo $line | awk '{print $1}')
  if [[ $(date -d "$createDate" +%s) -lt $(date -d "30 days ago" +%s) ]]; then
    fileName=$(echo $line | awk '{print $4}')
    aws s3 rm s3://mrst-backups/daily/$fileName
  fi
done
```

Move to RDS when:
- Tenant #2 or #3 goes live
- After first painful restore event
- When we need multi-AZ availability

---

# 9. Success Metrics

## Mirroring Completeness Dashboard

The "Sync Health" screen shows:

| Integration | Records | Last Sync | Status | Coverage |
|-------------|---------|-----------|--------|----------|
| Monday Boards | 17 | 2 min ago | ✅ | 100% |
| Monday Items | 12,456 | 2 min ago | ✅ | 100% |
| HQ Customers | 1,234 | 5 min ago | ✅ | 100% |
| HQ Vehicles | 73 | 5 min ago | ✅ | 100% |
| Gmail (10 accts) | 45,678 | 1 min ago | ✅ | 100% |
| Spireon Devices | 70 | 30 sec ago | ✅ | 100% |

"Cannot miss data" is validated when:
- Every external record has `first_seen_at` and `last_seen_at`
- Reconciliation jobs detect no gaps
- Timeline shows complete history

---

*End of Architecture Document. See CLAUDE_CODE_EXECUTION.md for how to build this.*
