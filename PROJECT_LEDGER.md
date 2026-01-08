# MRST Project Ledger

> This file is the source of truth for project state. Read this first every session.

## Current Status
- **Phase:** 7 - AI Intelligence Layer (in progress)
- **Task:** Spireon GPS integration complete, worker fixed
- **Progress:** 92%
- **Blockers:** Need API keys (ANTHROPIC_API_KEY, VOYAGE_API_KEY) to run embedding pipeline

## Production Deployment ✅
- **URL:** https://app.travelautorental.com/mrst/
- **API:** https://app.travelautorental.com/api/
- **Services:** PM2 managed (mrst-api, mrst-web)
- **Login:** admin@travelautorental.com / admin123
- **Config:** ecosystem.config.js, nginx-mrst.conf

## Outstanding Issues
1. **certifiedautocollision.com Gmail**: Needs SEPARATE service account
   - The old code used TWO service account files - one per domain
   - travelautorental.com: Client ID `113685960413666521570`, scope `gmail.readonly`
   - certifiedautocollision.com: Client ID `113779064017479202218`, scope `https://mail.google.com/`
   - Need to provide `certified-service-account.json` (not in git repo, was on production server)

2. **Spireon GPS API**: ✅ COMPLETE
   - Auth fixed: Basic Auth + X-Nspire-AppToken header
   - 247 devices synced to database
   - Geofence API returned 404 (no geofences configured)

## Last Session
- **Date:** 2026-01-08
- **Duration:** Continuation session
- **Completed:**
  - Spireon location polling implementation (pollCurrentLocations)
  - Spireon GPS history backfill (backfillLocations)
  - Spireon timeline event generation (generateTimelineEvents, 94 events)
  - Fixed Spireon API client to properly parse lastLocation data
  - Fixed worker pg-boss queue issue (createQueue before schedule)
  - Added worker job types: SYNC_SPIREON_POLL, SYNC_SPIREON_BACKFILL, SYNC_SPIREON_TIMELINE
  - Updated credentials in integration_accounts table
  - Location records now being stored (157 records created)
- **Stopped at:** Spireon GPS complete, worker running, ready for AI API keys

## Next Steps (Ordered)
1. Configure API keys (ANTHROPIC_API_KEY, VOYAGE_API_KEY) for embedding generation
2. Run embedding pipeline to populate vector index
3. Build AI suggestions UI component
4. Add certifiedautocollision.com domain (needs DWD setup)
5. Complete Phase 5: Spireon GPS location polling
6. Move to Phase 6: WhatsApp

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

### Phase 4: Gmail Mirror ✅ COMPLETE
- [x] Gmail schema created (5 tables)
- [x] Gmail client with service account auth
- [x] Gmail sync service (labels, threads, messages, attachments)
- [x] Junk attachment filtering logic
- [x] Domain-wide delegation working (travelautorental.com)
- [x] Labels synced (16 labels)
- [x] Threads synced (9,039 threads)
- [x] Messages synced (14,893 messages)
- [x] Attachments filtered and recorded (6,591 attachments: 4,491 PDFs, 773 JPEGs, 604 PNGs)
- [x] Timeline events created (14,893 events: 9,929 received, 4,964 sent)
- [x] Attachments downloaded to S3 (6,591 files, 2.2 GiB)
- [x] History-based incremental sync (uses Gmail History API)
- [x] Gap handling (marks needsFullResync when historyId too old)
- [ ] certifiedautocollision.com domain (blocked - needs DWD setup)

### Phase 5: Spireon GPS ✅ COMPLETE
- [x] Basic Auth + X-Nspire-AppToken auth (247 assets found)
- [x] Devices synced to database (247 devices, 25 active)
- [x] Location polling working (pollCurrentLocations function)
- [x] GPS history backfill (backfillLocations function)
- [ ] Diagnostics synced (pending)
- [ ] Geofence created (shop location) - API returned 404
- [ ] "At shop" detection working (pending)
- [x] Timeline events created (94 events, generateTimelineEvents function)

### Phase 6: WhatsApp
- [ ] 360Dialog client
- [ ] Webhook endpoint
- [ ] Messages synced
- [ ] Media downloaded
- [ ] Contacts linked to customers
- [ ] Timeline events created

### Phase 7: AI Intelligence Layer (in progress)
- [x] pgvector extension added (v0.8.0)
- [x] AI schema created (embeddings, conversations, messages, tasks, queue)
- [x] HNSW vector index created
- [x] Claude client with Gemini fallback (@mrst/ai package)
- [x] Voyage/Google embeddings service
- [x] Embedding pipeline built (pipeline.ts - batch processing all data types)
- [x] Semantic search API (search.ts - vector similarity, RAG queries)
- [x] "What should I do next?" feature (suggestions.ts - email/reservation/GPS analysis)
- [x] Worker jobs added (GENERATE_EMBEDDINGS, GENERATE_SUGGESTIONS)
- [x] tRPC endpoints created (ai router: search, suggestions, conversations, messages, stats)
- [x] AI suggestions UI component (SuggestionsList, SuggestionsWidget, /suggestions page)
- [x] tRPC client infrastructure (trpc.ts, providers.tsx)
- [ ] All data types embedded (needs API keys: ANTHROPIC_API_KEY, VOYAGE_API_KEY)
- [ ] Natural language query API endpoint (sendMessage returns placeholder until API keys configured)
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
| Gmail       | ✅ | ✅ | ✅ | ✅ | ✅ |
| Spireon     | ✅ | ✅ | ✅ | ✅ | ✅ |
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
- sync.ts (Sync service: labels, threads, messages, attachments, S3 download - 780 lines)
- run-sync.ts (Full sync for known email addresses)
- sync-messages.ts (Batch message sync)
- download-attachments.ts (S3 attachment download script)
- sync-incremental.ts (Incremental sync script using History API)
- test-sync.ts (Test script with mailbox discovery)
- test-direct.ts (Connection test)
- test-cac-domain.ts (Test certifiedautocollision.com domain access)
- index.ts (Module exports)

## Files Created (Phase 5)

### packages/integrations/src/spireon/
- client.ts (Basic Auth + X-Nspire-AppToken client, ~400 lines)
- sync.ts (Sync service for devices and geofences, ~300 lines)
- run-sync.ts (Test script to run full sync)
- test-client.ts (Test script for API validation)
- index.ts (Module exports)

## Files Created (Phase 7)

### packages/db/src/schema/
- ai.ts (AI schema: embeddings, conversations, messages, tasks, queue - 195 lines)

### packages/ai/src/
- types.ts (AI type definitions)
- claude.ts (Anthropic Claude client with retry logic)
- gemini.ts (Google Gemini client for fallback + vision)
- embeddings.ts (Voyage/Google embeddings service)
- client.ts (Unified AI client with Claude primary, Gemini fallback)
- pipeline.ts (Embedding pipeline for all data types - 450 lines)
- search.ts (Vector similarity search, RAG queries - 250 lines)
- suggestions.ts (AI task suggestions, "what should I do next" - 400 lines)
- run-pipeline.ts (CLI to run embedding generation)
- index.ts (Module exports)

## Notes for Next Session
Phase 7 AI Intelligence Layer significantly complete!

**Completed this session:**
- pgvector 0.8.0 installed and working
- AI schema created with 5 tables (embeddings, ai_conversations, ai_messages, ai_tasks, embedding_queue)
- HNSW vector index created for similarity search
- @mrst/ai package created with:
  - Claude + Gemini clients (claude.ts, gemini.ts)
  - Embeddings service with Voyage/Google support (embeddings.ts)
  - Unified AI client with fallback (client.ts)
  - Embedding pipeline for all data types (pipeline.ts)
  - Semantic search with RAG support (search.ts)
  - "What should I do next?" suggestions (suggestions.ts)
- Spireon devices synced to database (247 devices)
- Worker jobs for GENERATE_EMBEDDINGS and GENERATE_SUGGESTIONS

**To run embedding pipeline:**
```bash
VOYAGE_API_KEY=xxx DATABASE_URL='postgresql://mrst:mrst_dev_2025@localhost:5432/mrst' npx tsx packages/ai/src/run-pipeline.ts
```

**Next Steps:**
1. Get API keys (VOYAGE_API_KEY or GOOGLE_API_KEY for embeddings, ANTHROPIC_API_KEY for chat)
2. Run embedding pipeline to generate vectors
3. Create tRPC endpoints for AI features
4. Build UI for suggestions and natural language search

**Outstanding:**
- certifiedautocollision.com Gmail: Needs second service account file (Client ID `113779064017479202218`)

**Test Scripts:**
- `npx tsx packages/integrations/src/spireon/test-client.ts` - Test Spireon connection
- `npx tsx packages/integrations/src/spireon/run-sync.ts` - Sync Spireon devices to DB
- `npx tsx packages/integrations/src/gmail/run-sync.ts` - Gmail full sync
- `npx tsx packages/integrations/src/gmail/sync-incremental.ts` - Gmail incremental sync
- `S3_REGION=us-east-2 S3_BUCKET=mrst-files npx tsx packages/integrations/src/gmail/download-attachments.ts` - S3 download
- `npx tsx packages/integrations/src/gmail/test-cac-domain.ts` - Test CAC domain access

**AWS Config:**
- S3 Bucket: `mrst-files` in us-east-2
- Credentials configured in `~/.aws/credentials`

TypeScript strictness: Some TS errors in Monday.com sync code due to noUncheckedIndexedAccess.
Gmail code uses proper null checks and type assertions.
