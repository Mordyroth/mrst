# MRST Project Ledger

> This file is the source of truth for project state. Read this first every session.

## Current Status
- **Phase:** 0 - Foundation
- **Task:** Phase 0 Complete
- **Progress:** 100%
- **Blockers:** None

## Last Session
- **Date:** 2026-01-07
- **Duration:** ~2 hours
- **Completed:** Full Phase 0 Foundation
- **Stopped at:** Phase 0 complete, ready for Phase 1

## Next Steps (Ordered)
1. Begin Phase 1: Monday.com Mirror
2. Create Monday.com GraphQL client with rate limiting
3. Implement workspace sync
4. Implement board sync (mark in_scope boards)
5. Implement column sync with display name mapping
6. Implement item sync with column values
7. Implement updates and replies sync
8. Implement activity log sync
9. Implement file download to S3
10. Create sync jobs and test with all 17 boards

## Phase Checklist

### Phase 0: Foundation ✅ COMPLETE
- [x] Monorepo initialized (pnpm + turbo)
- [x] All packages created (db, integrations, ai, ui, shared, api, worker, web)
- [x] Database schema complete (50 tables)
- [x] Migrations run successfully
- [x] pg-boss working (worker service created)
- [x] Auth system working (tRPC router with login/session)
- [x] S3 integration working (utility functions)
- [x] Sync logging working (sync_runs table + API)
- [x] Initial tenant and admin user seeded

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
| Monday.com  | ❌ | ✅ | ❌ | ❌ | ❌ |
| HQ Rental   | ❌ | ✅ | ❌ | ❌ | ❌ |
| Gmail       | ❌ | ✅ | ❌ | ❌ | ❌ |
| Spireon     | ❌ | ✅ | ❌ | ❌ | ❌ |
| WhatsApp    | ❌ | ✅ | ❌ | ❌ | ❌ |

## Files Created (Phase 0)

### Root
- package.json (monorepo root)
- pnpm-workspace.yaml
- turbo.json
- tsconfig.json
- .gitignore
- .env.local

### packages/shared/
- src/index.ts
- src/types/index.ts
- src/utils/index.ts
- src/utils/s3.ts
- package.json, tsconfig.json

### packages/db/
- src/index.ts
- src/schema/index.ts
- src/schema/platform.ts (tenants, users, sessions, api_keys, audit_logs)
- src/schema/integrations.ts (integration_accounts, sync_runs, sync_cursors, files)
- src/schema/monday.ts (workspaces, boards, columns, groups, items, values, updates, replies, activity_logs, files, users)
- src/schema/hq.ts (customers, vehicles, reservations, contracts, payments, charges, documents)
- src/schema/gmail.ts (accounts, labels, threads, messages, attachments)
- src/schema/spireon.ts (devices, locations, diagnostics, geofences, geofence_events)
- src/schema/whatsapp.ts (accounts, contacts, messages, media)
- src/schema/core.ts (core_customers, core_vehicles, external_links, identity_merges, alerts)
- src/schema/timeline.ts (timeline_events, timeline_event_links, timeline_views)
- src/seed.ts
- drizzle.config.ts
- package.json, tsconfig.json

### packages/integrations/
- src/index.ts
- src/monday/index.ts (placeholder)
- src/hq/index.ts (placeholder)
- src/gmail/index.ts (placeholder)
- src/spireon/index.ts (placeholder)
- src/whatsapp/index.ts (placeholder)
- package.json, tsconfig.json

### packages/ai/
- src/index.ts (placeholder)
- package.json, tsconfig.json

### packages/ui/
- src/index.ts
- src/primitives/index.ts
- src/adhd/index.ts
- package.json, tsconfig.json

### apps/api/
- src/index.ts (Hono server)
- src/trpc/router.ts (tRPC with auth, tenants, integrations, sync, users)
- src/middleware/auth.ts
- package.json, tsconfig.json

### apps/worker/
- src/index.ts (pg-boss worker with job handlers)
- package.json, tsconfig.json

### apps/web/
- src/app/layout.tsx
- src/app/globals.css
- src/app/page.tsx
- src/app/login/page.tsx
- src/app/dashboard/page.tsx
- next.config.ts
- tailwind.config.ts
- postcss.config.js
- package.json, tsconfig.json

## Database State
- 50 tables created
- Extensions: citext, pgcrypto, pg_trgm
- Initial tenant: Travel Auto Rental (slug: travel-auto)
- Admin user: admin@travelautorental.com (password: admin123)

## Decisions Log
| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-01-07 | Drizzle over Prisma | Better JSONB/PostGIS support |
| 2026-01-07 | pg-boss over BullMQ | One less service, jobs in DB |
| 2026-01-07 | Hono over NestJS | AI generates cleaner code |
| 2026-01-07 | PM2 initially | Docker when multi-tenant |
| 2026-01-07 | Gmail poll 60s | Push later if needed |
| 2026-01-07 | SHA256 for passwords | Simple for dev, bcrypt for production |

## Environment Info
- Server: EC2 at app.travelautorental.com
- Node: 18.20.8
- pnpm: 10.27.0
- PostgreSQL: 15.15
- Credentials: /home/ec2-user/API_CREDENTIALS.md

## Notes for Next Session
Phase 0 is complete. Begin Phase 1 - Monday.com Mirror:
1. Read the Monday.com API docs
2. Create GraphQL client with rate limiting (10M complexity/min)
3. Start with workspace sync, then boards, columns, items
4. Map column external_id to display titles (CRITICAL)
5. Sync all 17 boards from credentials file
