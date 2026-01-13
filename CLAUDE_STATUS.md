# CLAUDE_STATUS.md - Cross-Session Status Report

> Last updated: 2026-01-13 01:55 UTC
> Updated by: Claude Code session

---

## Project Structure Overview

```
/home/ec2-user/projects/mrst/
├── apps/
│   ├── api/                 # Hono + tRPC backend server (port 3002)
│   ├── web/                 # Next.js 15 frontend (port 3000)
│   │   └── public/images/vehicles/  # AI-generated vehicle images
│   └── worker/              # pg-boss background job processor
├── packages/
│   ├── db/                  # Drizzle ORM, PostgreSQL schema (50+ tables)
│   ├── integrations/        # External API clients
│   │   ├── monday/          # Monday.com GraphQL sync
│   │   ├── hq/              # HQ Rental REST API sync
│   │   ├── gmail/           # Gmail API with domain-wide delegation
│   │   ├── spireon/         # Spireon GPS tracking API
│   │   └── whatsapp/        # 360Dialog (not yet implemented)
│   ├── ai/                  # Claude/Gemini clients, embeddings, suggestions
│   ├── shared/              # Shared types, utils, constants
│   └── ui/                  # Shared UI components
├── scripts/                 # Utility scripts, sync runners
├── config/                  # Service account JSON files
└── docs/                    # API documentation
```

---

## Vehicle Image Generation Status

### Model & Approach
- **Primary Model:** `imagen-4.0-generate-preview-06-06` (Google Imagen 4)
- **Background Removal:** `rembg` Python library (U2Net model)
- **Output Format:** PNG with RGBA transparency (cars float on any background)
- **Auto-crop:** Images cropped to remove transparent padding, cars appear larger

### Progress
| Status | Count | Details |
|--------|-------|---------|
| Completed | 64 | Imagen 4 + transparent bg + zoomed |
| Pending | 23 | Waiting for daily quota reset |
| **Total** | **87** | All active fleet vehicles |

### Pending Vehicles (quota exhausted)
V387, V389, V390, V391, V392, V393, V394, V396, V397, V400, V401, V402, V403, V404, V407, V408, V409, V410, V411, V412, V414, V60, Z201

### Automated Completion
- **Cron job:** `5 8 * * *` (8:05 AM UTC daily)
- **Script:** `/home/ec2-user/projects/mrst/scripts/finish_remaining_vehicles.py`
- **Log:** `/home/ec2-user/projects/mrst/scripts/finish_remaining.log`
- Quota resets at midnight Pacific (8:00 AM UTC)
- Script auto-removes from cron when complete

### Image Storage
- **Location:** `/home/ec2-user/projects/mrst/apps/web/public/images/vehicles/`
- **Naming:** `{unitNumber}.png` (e.g., V385.png, G304.png)
- **Served at:** `https://app.travelautorental.com/images/vehicles/{unitNumber}.png`

### Generation Scripts
- `scripts/generate_uniform_vehicle_images.py` - Main batch generator (Gemini)
- `scripts/finish_remaining_vehicles.py` - Imagen 4 completion script

---

## Tech Stack

### Backend
- **Runtime:** Node.js 18.20.8
- **API Framework:** Hono + tRPC
- **Database:** PostgreSQL 15 with PostGIS, pgvector
- **ORM:** Drizzle ORM
- **Job Queue:** pg-boss (PostgreSQL-backed)
- **Process Manager:** PM2

### Frontend
- **Framework:** Next.js 15
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** React hooks, tRPC client

### AI/ML
- **Text Generation:** Claude (primary), Gemini (fallback)
- **Image Generation:** Imagen 4 (Google)
- **Background Removal:** rembg (Python, U2Net)
- **Embeddings:** Voyage AI / Google (pending API keys)

### Deployment
- **Server:** AWS EC2 (app.travelautorental.com)
- **Web Server:** nginx (reverse proxy)
- **SSL:** Let's Encrypt
- **Services via PM2:**
  - `mrst-api` - Backend API (port 3002)
  - `mrst-web` - Next.js frontend (port 3000)
  - `mrst-worker` - Background jobs

---

## Environment Variables & API Keys

### Configured & Working
| Variable | Status | Location |
|----------|--------|----------|
| `DATABASE_URL` | ✅ | `.env.local` |
| `GOOGLE_API_KEY` | ✅ | `.env.local` (Gemini/Imagen) |
| `HQ_API_KEY` | ✅ | `.env.local` |
| `HQ_API_SECRET` | ✅ | `.env.local` |
| `MONDAY_API_TOKEN` | ✅ | `.env.local` |
| `SPIREON_USERNAME` | ✅ | `.env.local` |
| `SPIREON_PASSWORD` | ✅ | `.env.local` |
| `SPIREON_APP_TOKEN` | ✅ | `.env.local` |

### Service Accounts
| Domain | File | Status |
|--------|------|--------|
| travelautorental.com | `config/google-service-account.json` | ✅ Working |
| certifiedautocollision.com | `config/certified-service-account.json` | ✅ Working |

### Not Yet Configured
| Variable | Needed For |
|----------|------------|
| `ANTHROPIC_API_KEY` | Claude AI chat |
| `VOYAGE_API_KEY` | Text embeddings |
| `WHATSAPP_API_KEY` | 360Dialog integration |

---

## Recent Changes (2026-01-13)

### Vehicle Images
1. Generated 64/87 vehicle images with Imagen 4
2. Implemented transparent backgrounds using rembg
3. Added auto-crop/zoom to make cars larger in thumbnails
4. Updated VehicleCard component to remove white background
5. Changed mobile layout from 2-column to 1-column
6. Added hero image to vehicle detail page
7. Set up cron job for remaining 23 vehicles

### Gmail Integration
1. Discovered 6 accessible CAC mailboxes (~170K emails):
   - claims@ (84,270), accounting@ (42,210), office@ (23,618)
   - info@ (18,891), shop@ (1,576), moshe@ (44)
2. Created sync script: `packages/integrations/src/gmail/sync-cac.ts`
3. **Currently running:** Background sync of all CAC emails
4. Junk attachment filtering active (logos, signatures, pixels filtered)

### Code Changes
- `apps/web/src/app/vehicles/page.tsx` - 1-column mobile, transparent images
- `apps/web/src/app/vehicles/[id]/page.tsx` - Hero image, raw.vehicle_key fallback
- `packages/integrations/src/gmail/sync-cac.ts` - CAC email sync script

---

## Current Blockers & Issues

### Active Issues
1. **Imagen 4 Quota:** 70/day limit hit, 23 vehicles pending (auto-resolves at 8:05 AM UTC)
2. **CAC Gmail Sync:** Running in background (~170K emails, will take hours)

### Missing API Keys
- `ANTHROPIC_API_KEY` - Blocks AI chat feature
- `VOYAGE_API_KEY` - Blocks text embeddings/semantic search

### Known Limitations
- Gmail Admin SDK not authorized for CAC domain (using direct mailbox access instead)
- `moishy@certifiedautocollision.com` - Invalid user (doesn't exist or no access)

---

## Background Processes Running

### Cron Jobs
```
5 8 * * * - Vehicle image completion (Imagen 4)
```

### Active Now
- CAC Gmail sync (started 2026-01-13 01:53 UTC)
  - Log: `/home/ec2-user/projects/mrst/scripts/cac-gmail-sync.log`
  - Check: `tail -f scripts/cac-gmail-sync.log`

---

## Quick Commands

```bash
# Check vehicle image cron
cat /home/ec2-user/projects/mrst/scripts/finish_remaining.log

# Check CAC email sync progress
tail -50 /home/ec2-user/projects/mrst/scripts/cac-gmail-sync.log

# Restart services
pm2 restart all

# Rebuild frontend
cd /home/ec2-user/projects/mrst/apps/web && pnpm build && pm2 restart mrst-web

# Database queries
psql "postgresql://mrst:mrst_dev_2025@localhost:5432/mrst"
```

---

## URLs

- **App:** https://app.travelautorental.com/mrst/
- **Vehicles:** https://app.travelautorental.com/mrst/vehicles
- **Dashboard:** https://app.travelautorental.com/mrst/dashboard
- **Map:** https://app.travelautorental.com/mrst/map
- **API:** https://app.travelautorental.com/api/

---

*This file is auto-updated by Claude Code sessions. For detailed project history, see PROJECT_LEDGER.md*
