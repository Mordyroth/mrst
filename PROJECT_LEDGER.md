# MRST Project Ledger

> **Claude: Read this FIRST every session. Keep this file under 3KB.**

## Current Status
- **Phase:** 7 - AI Intelligence Layer (96% complete)
- **Branch:** claude/find-uncommitted-changes-6sZ5T
- **Blockers:** Need ANTHROPIC_API_KEY + VOYAGE_API_KEY for embeddings

## Production
- **URL:** https://app.travelautorental.com/mrst/
- **API:** https://app.travelautorental.com/api/
- **Login:** admin@travelautorental.com / admin123
- **Services:** PM2 (mrst-api, mrst-web, mrst-worker)

## CRITICAL: basePath Routing
```
CORRECT: <Link href="/dashboard">      → /mrst/dashboard
WRONG:   <Link href="/mrst/dashboard"> → /mrst/mrst/dashboard = 404!

<a>, <img src>, window.location DO need /mrst prefix.
Run ./scripts/check-link-paths.sh before committing frontend.
```

## Task Queue
1. Configure API keys and run embedding pipeline
2. Test AI suggestions with real data
3. Add certifiedautocollision.com Gmail (needs DWD setup)
4. WhatsApp integration (needs 360Dialog credentials)
5. Vehicle image generation with AI

## Active Blockers
| Blocker | Needed | Status |
|---------|--------|--------|
| AI embeddings | VOYAGE_API_KEY or GOOGLE_API_KEY | Blocked |
| AI chat | ANTHROPIC_API_KEY | Blocked |
| Gmail CAC domain | certified-service-account.json | Blocked |
| WhatsApp | 360Dialog credentials | Blocked |

## Key Paths
```
packages/db/src/schema/     - Drizzle schema
packages/integrations/src/  - API clients
apps/api/src/trpc/          - tRPC routers
apps/web/src/app/           - Next.js pages
/home/ec2-user/API_CREDENTIALS.md - Credentials
```

## Quick Commands
```bash
pnpm dev                    # Start all services
pnpm build                  # Build all
pnpm lint                   # Lint (includes link check)
pm2 restart all             # Restart production
./scripts/check-link-paths.sh  # Check for bad Link hrefs
```

## Protection Stack (href="/mrst" bugs)
| Layer | When |
|-------|------|
| Claude Hook | Real-time, blocks Write/Edit |
| Pre-commit | At git commit |
| pnpm lint | During development |

## Data Summary
- 2,383 customers, 243 vehicles, 3,250 reservations
- 14,893 emails, 6,591 attachments
- 247 GPS devices, 122 fleet-matched
- 18,749 timeline events

---

**For project history, see PROJECT_HISTORY.md (don't load unless specifically needed)**
