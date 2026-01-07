# MRST Project Ledger

> This file is the source of truth for project state. Read this first every session.

## Current Status
- **Phase:** 0 - Foundation
- **Task:** Project not yet initialized
- **Progress:** 0%
- **Blockers:** None

## Last Session
- **Date:** Not started
- **Duration:** N/A
- **Completed:** Nothing yet
- **Stopped at:** N/A

## Next Steps (Ordered)
1. Initialize pnpm monorepo with turbo
2. Create package.json files for all packages
3. Install dependencies (drizzle, pg-boss, hono, etc.)
4. Create complete Drizzle schema (all tables from architecture doc)
5. Run database migrations
6. Set up pg-boss job queue
7. Create basic auth system (users, sessions, RBAC)
8. Set up S3 file storage utility
9. Create sync_runs logging system
10. Create basic admin UI skeleton

## Phase Checklist

### Phase 0: Foundation
- [ ] Monorepo initialized
- [ ] All packages created
- [ ] Database schema complete
- [ ] Migrations run successfully
- [ ] pg-boss working
- [ ] Auth system working
- [ ] S3 integration working
- [ ] Sync logging working

### Phase 1: Monday.com Mirror
- [ ] GraphQL client with rate limiting
- [ ] Workspaces synced
- [ ] Boards synced (in_scope marked)
- [ ] Columns synced (display names mapped)
- [ ] Items synced with values
- [ ] Updates/replies synced
- [ ] Activity logs synced
- [ ] Files downloaded
- [ ] Sync jobs created
- [ ] Tested with all 17 boards

### Phase 2: HQ Rental Mirror
- [ ] REST client created
- [ ] Customers synced
- [ ] Vehicles synced
- [ ] Reservations synced
- [ ] Contracts/payments/charges synced
- [ ] Documents downloaded
- [ ] core_customers populated
- [ ] core_vehicles populated
- [ ] external_links created
- [ ] Sync jobs created

### Phase 3: Timeline v1
- [ ] timeline_events from Monday
- [ ] timeline_events from HQ
- [ ] Collapse grouping working
- [ ] timeline_event_links created
- [ ] Timeline API endpoint
- [ ] Timeline UI component
- [ ] Mirroring validated via timeline

### Phase 4: Gmail Mirror
- [ ] Gmail client (service account auth)
- [ ] Labels synced
- [ ] Threads synced (all 10 accounts)
- [ ] Messages synced
- [ ] Attachments downloaded
- [ ] History-based incremental sync
- [ ] Gap handling (historyId too old)
- [ ] Timeline events created

### Phase 5: Spireon GPS
- [ ] OAuth token flow
- [ ] Devices synced
- [ ] Location polling working
- [ ] GPS history backfill
- [ ] Diagnostics synced
- [ ] Geofence created (shop location)
- [ ] "At shop" detection working
- [ ] Timeline events created

### Phase 6: WhatsApp
- [ ] 360Dialog client
- [ ] Webhook endpoint
- [ ] Messages synced
- [ ] Media downloaded
- [ ] Contacts linked to customers
- [ ] Timeline events created

### Phase 7: AI Intelligence Layer
- [ ] pgvector extension added
- [ ] Embedding pipeline built
- [ ] All data types embedded
- [ ] Claude client with Gemini fallback
- [ ] Natural language query engine
- [ ] "What should I do next?" endpoint
- [ ] Vehicle image generation

## Integration Status
| Integration | Client | Schema | Sync Job | Tested | Timeline |
|-------------|--------|--------|----------|--------|----------|
| Monday.com  | ❌ | ❌ | ❌ | ❌ | ❌ |
| HQ Rental   | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gmail       | ❌ | ❌ | ❌ | ❌ | ❌ |
| Spireon     | ❌ | ❌ | ❌ | ❌ | ❌ |
| WhatsApp    | ❌ | ❌ | ❌ | ❌ | ❌ |

## Files Created
None yet.

## Decisions Log
| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-01-07 | Drizzle over Prisma | Better JSONB/PostGIS support |
| 2026-01-07 | pg-boss over BullMQ | One less service, jobs in DB |
| 2026-01-07 | Hono over NestJS | AI generates cleaner code |
| 2026-01-07 | PM2 initially | Docker when multi-tenant |
| 2026-01-07 | Gmail poll 60s | Push later if needed |

## Environment Info
- Server: EC2 at app.travelautorental.com
- Node: 20.x (to be installed)
- PostgreSQL: 15 with PostGIS
- Credentials: /home/ec2-user/API_CREDENTIALS.md

## Notes for Next Session
This is a fresh start. Read MRST_FINAL_ARCHITECTURE.md for complete specs.
First task: Initialize the monorepo structure.
