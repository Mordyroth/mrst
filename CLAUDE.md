# CLAUDE.md - MRST Project

## Project Overview
MRST: Multi-tenant SaaS for vehicle businesses (rental + collision).
Philosophy: Mirror all data → AI intelligence layer → Adaptive UI.

## Session Protocol
1. READ `PROJECT_LEDGER.md` first - it has current state
2. CONFIRM phase/task before starting work
3. UPDATE ledger after each completed task
4. COMMIT after every significant change
5. Before ending: update ledger + SESSION_LOG.md

## Tech Stack
- Frontend: Next.js 15 + TypeScript + Tailwind + shadcn/ui
- Backend: Hono + tRPC + Drizzle ORM + pg-boss
- Database: PostgreSQL 15 + PostGIS + pgvector
- AI: Claude (primary) + Gemini (images/fallback)

## Code Standards
- TypeScript strict mode, no `any` without reason
- JSDoc on all exports
- Tests alongside implementation
- Drizzle schema in `packages/db/src/schema/`

## Integration Rules (CRITICAL)
- NEVER code integrations without reading full API docs
- ALWAYS store complete `raw` JSONB response
- ALWAYS include: `first_seen_at`, `last_seen_at`, `source_hash`, `synced_at`
- NEVER auto-link identities if phone/email appears on multiple records

## Mirror Table Pattern
```typescript
{
  id: uuid,
  integration_account_id: uuid,
  external_id: text,
  // ... extracted fields for indexing ...
  raw: jsonb,           // Complete API response
  first_seen_at: timestamp,
  last_seen_at: timestamp,
  source_hash: text,    // SHA256 of raw for change detection
  synced_at: timestamp
}
```

## File Locations
```
packages/db/src/schema/     - Drizzle schema
packages/integrations/src/  - API clients per provider
apps/api/src/routes/        - HTTP endpoints
apps/api/src/trpc/          - tRPC routers  
apps/worker/src/jobs/       - Background jobs
apps/web/src/app/           - Next.js pages
```

## Git Rules
- Commit after each task
- Message format: `type(scope): description`
- Never force push main

## When Stuck
1. Check API docs in `docs/api/`
2. Search codebase for patterns
3. Log blocker in PROJECT_LEDGER.md
4. Continue with next unblocked task

## Context Management
- If context filling: update ledger → `/compact`
- After compact: read ledger to restore state

## Credentials Location
- `/home/ec2-user/API_CREDENTIALS.md`
- `/home/ec2-user/google-service-account.json`
- Copy to `.env.local` (gitignored)

## Key Decisions Made
- Drizzle over Prisma (better JSONB/PostGIS)
- pg-boss over BullMQ (Postgres-backed, one less service)
- PM2 over Docker (initially, Docker when multi-tenant)
- Poll Gmail every 60s (push later if needed)
- Separate API + Worker processes (reliability)
