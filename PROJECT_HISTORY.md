# MRST Project History

> Archive of completed work, session logs, and historical notes.
> For current state, see PROJECT_LEDGER.md

---

## Completed Sessions

### Session 2026-01-19
- **Branch:** claude/find-uncommitted-changes-6sZ5T
- **Completed:**
  - Fixed /mrst/vehicles 404 (missing .next build)
  - Created multi-layer protection against href="/mrst" bugs:
    - Claude Code PreToolUse hook (.claude/hooks/check-mrst-hrefs.sh)
    - Git pre-commit hook (.git/hooks/pre-commit)
    - Lint command integration (pnpm lint)
    - Warning comments in next.config.ts
  - Created VEHICLES_ROUTE_PROTECTION.md documentation

### Session 2026-01-14
- **Branch:** claude/find-uncommitted-changes-6sZ5T
- **Completed:**
  - Fixed RECURRING 404 Issues (basePath routing)
  - Root cause: `<Link href="/mrst/dashboard">` → `/mrst/mrst/dashboard` = 404
  - Created `scripts/check-link-paths.sh` lint script
  - Added CRITICAL sections to CLAUDE.md and PROJECT_LEDGER.md
  - HQ API Anomaly Verification (6 vehicles checked)
  - Restored Vehicles Page Layout with location banners

### Session 2026-01-13
- **Branch:** claude/find-uncommitted-changes-6sZ5T
- **Completed:**
  - Fleet Vehicle Filter Fix (is_fleet_vehicle boolean)
  - GitHub Actions Deployment workflow
  - Customers page implementation
  - Customer detail page with tabs

### Session 2026-01-12/13 (Overnight)
- **Branch:** frontend-work
- **Completed:**
  - HQ Data Mirror Phase 1 - 21 new database tables
  - HQ Data Mirror Phase 2 - Extended sync service
  - Vehicles API rewrite (PostgreSQL instead of direct HQ API)
  - Vehicle Anomaly Detection

### Session 2026-01-12
- **Branch:** frontend-work
- **Completed:**
  - Dashboard Charts (pie chart, sparklines)
  - Collapsible Sidebar
  - Mobile Navigation

### Session 2026-01-08/09
- **Completed:**
  - Fleet Map page with 122 matched vehicles
  - Monday.com Fleet Board sync
  - Dashboard stats API
  - Scheduled 5-minute Spireon polling

---

## Phase Completion Status

### Phase 0: Foundation ✅ COMPLETE
- Monorepo initialized (pnpm + turbo)
- All packages created
- Database schema (50 tables)
- pg-boss, Auth, S3, Sync logging

### Phase 1: Monday.com Mirror ✅ COMPLETE
- 8 workspaces, 62 boards, 6,690 items synced
- Activity logs, updates, files

### Phase 2: HQ Rental Mirror ✅ COMPLETE
- 2,383 customers, 243 vehicles, 3,250 reservations
- 28 total HQ tables (7 original + 21 extended)
- Vehicles API reads from PostgreSQL

### Phase 3: Timeline v1 ✅ COMPLETE
- 3,762 events, 16,762 links
- Timeline UI with filters and grouping

### Phase 4: Gmail Mirror ✅ COMPLETE
- 14,893 messages, 6,591 attachments
- History-based incremental sync
- travelautorental.com working
- certifiedautocollision.com blocked (needs DWD setup)

### Phase 5: Spireon GPS ✅ COMPLETE
- 247 devices synced
- 5-minute polling schedule
- VIN matching with Monday.com (124 matches)

### Phase 6: WhatsApp - NOT STARTED
- Needs 360Dialog credentials

### Phase 7: AI Intelligence Layer - 96% COMPLETE
- pgvector, embeddings schema, Claude/Gemini clients
- Needs API keys to run pipeline

---

## Data Counts Summary

```
Monday.com:     8 workspaces, 62 boards, 6,690 items
HQ Rental:      2,383 customers, 243 vehicles, 3,250 reservations
Gmail:          14,893 messages, 6,591 attachments
Spireon GPS:    247 devices, 178 with VINs
Timeline:       18,749 events
Fleet Match:    122 vehicles (VIN-based)
```

---

## Files Created by Phase

### Phase 0 (Foundation)
- Root: package.json, pnpm-workspace.yaml, turbo.json
- packages/shared/src/: types, utils, s3
- packages/db/src/schema/: platform, integrations, monday, hq, gmail, spireon, whatsapp, core, timeline
- apps/api/src/: Hono server, tRPC router
- apps/worker/src/: pg-boss worker
- apps/web/src/app/: Next.js pages

### Phase 1 (Monday.com)
- packages/integrations/src/monday/: client, queries, types, sync

### Phase 2 (HQ Rental)
- packages/integrations/src/hq/: client, types, sync

### Phase 3 (Timeline)
- packages/integrations/src/timeline/: generate
- packages/ui/src/timeline/: Timeline, TimelineEvent, TimelineFilters

### Phase 4 (Gmail)
- packages/integrations/src/gmail/: client, types, sync

### Phase 5 (Spireon)
- packages/integrations/src/spireon/: client, sync

### Phase 7 (AI)
- packages/db/src/schema/ai.ts
- packages/ai/src/: claude, gemini, embeddings, client, pipeline, search, suggestions

---

## Decisions Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-01-07 | Drizzle over Prisma | Better JSONB/PostGIS support |
| 2026-01-07 | pg-boss over BullMQ | One less service, jobs in DB |
| 2026-01-07 | Hono over NestJS | AI generates cleaner code |
| 2026-01-07 | PM2 initially | Docker when multi-tenant |
| 2026-01-07 | Gmail poll 60s | Push later if needed |
| 2026-01-14 | basePath: '/mrst' | Shared domain routing |

---

## Integration Status Table

| Integration | Client | Schema | Sync Job | Tested | Timeline |
|-------------|--------|--------|----------|--------|----------|
| Monday.com  | ✅ | ✅ | ✅ | ✅ | ✅ |
| HQ Rental   | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gmail       | ✅ | ✅ | ✅ | ✅ | ✅ |
| Spireon     | ✅ | ✅ | ✅ | ✅ | ✅ |
| WhatsApp    | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## Test Commands Reference

```bash
# Monday sync
npx tsx packages/integrations/src/monday/test-sync.ts

# HQ sync
npx tsx packages/integrations/src/hq/test-sync.ts

# Gmail sync
npx tsx packages/integrations/src/gmail/run-sync.ts

# Spireon sync
npx tsx packages/integrations/src/spireon/run-sync.ts

# Embedding pipeline (needs API keys)
VOYAGE_API_KEY=xxx npx tsx packages/ai/src/run-pipeline.ts

# Fleet board sync
npx tsx scripts/sync-fleet-board.ts
```
