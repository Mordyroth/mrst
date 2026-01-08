# MRST Project Ledger

> This file is the source of truth for project state. Read this first every session.

## Current Status
- **Phase:** 4 - Gmail Mirror
- **Task:** Domain-wide delegation configuration
- **Progress:** 40%
- **Blockers:** Service account needs domain-wide delegation setup in Google Admin Console

## Last Session
- **Date:** 2026-01-08
- **Duration:** ~8 hours
- **Completed:** Phase 3 complete, Gmail client/sync/schema created
- **Stopped at:** Waiting for Google Workspace domain-wide delegation configuration

## Next Steps (Ordered)
1. Configure domain-wide delegation in Google Workspace Admin
2. Test Gmail client with actual admin email
3. Sync labels and threads
4. Sync messages and attachments (filter junk attachments)
5. Create history-based incremental sync
6. Create timeline events from emails

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

### Phase 1: Monday.com Mirror ✅ COMPLETE
- [x] GraphQL client with rate limiting
- [x] Workspaces synced (8 workspaces)
- [x] Boards synced (62 boards, 5 marked in_scope)
- [x] Columns synced with display names (82 columns)
- [x] Items synced with values (6,690 items, 98,031 column values)
- [x] Updates/replies synced
- [x] Activity logs synced (512 logs)
- [x] Files downloaded to S3 (downloadPendingFiles function)
- [x] Sync jobs created (SYNC_MONDAY_FULL, SYNC_MONDAY_INCREMENTAL, SYNC_MONDAY_BOARD, DOWNLOAD_FILE)
- [x] Tested with top 5 boards by item count

### Phase 2: HQ Rental Mirror ✅ COMPLETE
- [x] REST client created (Basic Auth, rate limiting, retry logic)
- [x] Customers synced (2,383 customers from reservation details)
- [x] Vehicles synced (243 vehicles)
- [x] Reservations synced (3,250 reservations)
- [x] Contracts synced (70 active rentals)
- [x] Documents synced (2,209 customer documents)
- [x] Document download to S3 function added (downloadPendingDocuments)
- [x] Sync jobs created (SYNC_HQ_FULL, SYNC_HQ_INCREMENTAL)
- [x] core_customers populated (2,285 created, 98 linked)
- [x] core_vehicles populated (242 created, 1 linked)
- [x] external_links created (2,383 customer links, 243 vehicle links)

### Phase 3: Timeline v1 ✅ COMPLETE
- [x] timeline_events from Monday (512 activity events, 215 value changes)
- [x] timeline_events from HQ (3,250 reservation events)
- [x] timeline_event_links created (16,762 links)
- [x] Timeline API endpoint (list, get, forCustomer, forVehicle, stats, expandGroup)
- [x] Timeline UI component (Timeline, TimelineEvent, TimelineFilters, TimelineCompact)
- [x] Collapse grouping for consecutive events (API + UI toggle)
- [x] Mirroring validated (3,250 events linked to core_customers and core_vehicles)

### Phase 4: Gmail Mirror
- [x] Gmail schema created (5 tables)
- [x] Gmail client with service account auth
- [x] Gmail sync service (labels, threads, messages, attachments)
- [x] Junk attachment filtering logic
- [ ] Domain-wide delegation configured (BLOCKED - Google Admin setup needed)
- [ ] Labels synced
- [ ] Threads synced (all mailboxes discovered via Admin SDK)
- [ ] Messages synced
- [ ] Attachments downloaded (with junk filtering)
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

## Cross-Cutting Requirements (All Phases)

### Gmail Attachments
- Download EVERY attachment from every email
- Filter OUT junk: company logos, email signature icons, tracking pixels, legal footers, virus warnings, unsubscribe images, social media icons
- Keep: documents, PDFs, actual content images, spreadsheets, any file over 50KB
- Store in S3 with proper organization

### File and Image Previews (Entire App)
- Never show just a link - always show large nice preview
- Images display big enough to see clearly without clicking
- PDFs show first page large and readable
- Documents show meaningful preview not just an icon

### Grouped Media Display
- Display multiple images/files from same source as a group
- Group sources: all attachments in one email, all files in one Monday column, all files in one Monday update, consecutive WhatsApp messages, consecutive text messages
- Display groups in gallery style

### PDF and Document Handling (CRITICAL)
- PDFs must preview inline showing first page large and clear
- Click to open full screen viewer inside the app
- Option to open in new tab
- Applies to ALL PDFs/docs from everywhere: Monday, HQ, Gmail, WhatsApp, uploads
- Test extensively with Puppeteer
- Write tests for every PDF scenario: preview renders, fullscreen opens, new tab works, multiple pages navigate, zoom works
- This feature requires thorough testing before marking complete

## Integration Status
| Integration | Client | Schema | Sync Job | Tested | Timeline |
|-------------|--------|--------|----------|--------|----------|
| Monday.com  | ✅ | ✅ | ✅ | ✅ | ✅ |
| HQ Rental   | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gmail       | ✅ | ✅ | ⏳ | ⏳ | ❌ |
| Spireon     | ❌ | ✅ | ❌ | ❌ | ❌ |
| WhatsApp    | ❌ | ✅ | ❌ | ❌ | ❌ |

⏳ = Waiting for Google Workspace domain-wide delegation configuration

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

## Files Created (Phase 1)

### packages/integrations/src/monday/
- client.ts (GraphQL client with rate limiting, complexity tracking)
- queries.ts (GraphQL query definitions)
- types.ts (TypeScript interfaces for Monday.com API)
- sync.ts (Full sync service using Drizzle ORM - 1449 lines)
- test-sync.ts (Test script for sync validation)
- index.ts (Module exports)

## Test Results (Phase 1)
```
Synced to Database:
  Workspaces:      8
  Boards:          62 (5 in scope)
  Columns:         82
  Groups:          6
  Items:           6,690
  Column Values:   98,031
  Updates:         0 (boards tested had none)
  Replies:         0
  Activity Logs:   512
  Users:           10
  Files:           0 (sync pending)
```

## Files Created (Phase 2)

### packages/integrations/src/hq/
- client.ts (REST client with Basic Auth, rate limiting, retry logic)
- types.ts (TypeScript interfaces for HQ API responses)
- sync.ts (Sync service: syncAll, syncIncremental, downloadPendingDocuments - 800 lines)
- test-sync.ts (Test script for sync validation)
- index.ts (Module exports)

### apps/worker/src/
- index.ts (Updated with HQ sync job handlers)

## Test Results (Phase 2)
```
Synced to Database:
  Customers:     2,383
  Vehicles:      243
  Reservations:  3,250
  Contracts:     70 (active rentals)
  Documents:     2,209

HQ API Notes:
- Reservation-centric API (no direct customer/vehicle endpoints)
- Customers/vehicles extracted from reservation details
- One HQ API 500 error on reservation #774 (server-side bug)
```

## Files Created (Phase 3)

### packages/integrations/src/timeline/
- generate.ts (Timeline event generation from Monday/HQ sources)
- index.ts (Module exports)
- test-generate.ts (Test script for timeline generation)

### packages/ui/src/timeline/
- index.ts (Module exports)
- types.ts (Timeline types, source labels/colors)
- Timeline.tsx (Main timeline container + TimelineCompact)
- TimelineEvent.tsx (Single event display component)
- TimelineFilters.tsx (Filter controls component)

### apps/web/src/app/timeline/
- page.tsx (Timeline page with API integration)

### apps/api/src/trpc/
- router.ts (Updated with timeline router: list, get, forCustomer, forVehicle, stats)

## Test Results (Phase 3)
```
Timeline Events Generated:
  Monday activity:    512
  Monday value changes: 215
  HQ reservations:    3,250
  Total events:       3,762
  Event links:        16,762
```

## Files Created (Phase 4)

### packages/integrations/src/gmail/
- client.ts (Gmail/Admin SDK client with domain-wide delegation - 193 lines)
- types.ts (Gmail types, junk attachment filtering - 264 lines)
- sync.ts (Sync service: labels, threads, messages, attachments - 650 lines)
- test-sync.ts (Test script with mailbox discovery)
- index.ts (Module exports)

## Notes for Next Session
Phase 4 Gmail Mirror is IN PROGRESS (40% complete).

**BLOCKER:** Google Workspace domain-wide delegation needs to be configured:
1. Go to Google Workspace Admin (admin.google.com)
2. Security → API controls → Domain-wide delegation
3. Add the service account client ID with scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.metadata`
   - `https://www.googleapis.com/auth/admin.directory.user.readonly`
4. Use a valid super admin email (not admin@travelautorental.com - that failed)

Service account: `travelauto-email-service@travelauto-email-integration.iam.gserviceaccount.com`

Code completed:
- Gmail client with service account authentication (domain-wide delegation)
- Admin SDK integration to discover ALL mailboxes across domains
- Full sync for labels, threads, messages
- Attachment filtering (keeps PDFs/docs/real content, filters junk icons/pixels)
- Database schema (5 tables: accounts, labels, threads, messages, attachments)

Timeline summary (Phase 3):
- 3,762 total timeline events (512 Monday, 3,250 HQ)
- 16,762 event links connecting to core entities
- Timeline UI with filtering, collapse grouping, and pagination

TypeScript strictness: Some TS errors in Monday.com sync code due to noUncheckedIndexedAccess.
Gmail code uses proper null checks and type assertions.
