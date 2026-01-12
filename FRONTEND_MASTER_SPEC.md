# MRST Frontend Master Specification

> **This is the complete frontend specification. Claude Code should read this file and execute autonomously.**

---

## 0. Execution Rules

### 0.1 Mobile-First Design (CRITICAL)

```
MOBILE IS PRIMARY - Design for phone screens FIRST, then scale up to desktop.

- All layouts must work on 375px width (iPhone SE)
- Touch targets minimum 44px
- No horizontal scrolling on mobile
- Test every page on mobile viewport BEFORE desktop
- Sidebar becomes bottom nav or hamburger on mobile
- Cards stack vertically
- Tables become cards on mobile
```

### 0.2 Puppeteer Testing Strategy

```
Run Puppeteer tests at EFFICIENT times:
- After completing each major component (not every small change)
- After finishing a full page
- Before marking any phase complete
- When something "should work" but you want to verify

DO NOT run Puppeteer:
- After every single file change
- For simple CSS tweaks
- When you can verify in browser manually first

Test on BOTH viewports:
- Mobile: 375x667 (iPhone SE)
- Desktop: 1280x800
```

### 0.3 Agent Usage (BE RESPONSIBLE)

```
Use agents for ISOLATED tasks only:
- Installing packages
- Running a specific test file
- Generating a single component
- Database queries

DO NOT use agents for:
- Tasks that need context from multiple files
- Complex multi-step operations
- Anything that modifies many files at once

Maximum 2-3 concurrent agents. Prefer sequential work for complex tasks.
```

### 0.4 Documentation Updates

```
After EACH major task:
1. Update PROJECT_LEDGER.md - current status, completed items
2. Git commit with descriptive message

At SESSION END:
3. Append to SESSION_LOG.md
4. Push to git
```

---

## 1. Current State

**Backend:** 95% complete  
**Frontend:** Functional but ugly - needs enterprise-grade redesign  
**Live URL:** https://app.travelautorental.com/mrst/

### Data Available

| Source | Count | Notes |
|--------|-------|-------|
| HQ Vehicles | 86 active | Source of truth for vehicles |
| Spireon GPS | 165 devices (122 matched) | Matched to HQ via VIN |
| Active Rentals | 70 | From HQ |
| Reservations | 29 upcoming | From HQ |
| Customers | 2,383 | From HQ |
| Timeline Events | 18,749 | From all sources |
| Gmail Messages | 14,893 | With 6,591 attachments |
| Gmail Attachments | 2.2 GB | Stored in S3 |

### Shop Location

```
Address: 1621 63rd Street, Brooklyn, NY 11204
Latitude: 40.622877
Longitude: -73.993128
Radius: 0.3 miles (≈483 meters)
```

---

## 2. Pages to Build

| Route | Page | Priority | Status |
|-------|------|----------|--------|
| /mrst/dashboard | Dashboard | P1 | Needs redesign |
| /mrst/vehicles | Vehicle List | P1 | NEW |
| /mrst/vehicles/[id] | Vehicle Detail | P1 | NEW |
| /mrst/timeline | Timeline | P1 | Needs redesign |
| /mrst/map | Fleet Map | P2 | Needs redesign |
| /mrst/suggestions | AI Suggestions | P2 | Needs redesign |
| /mrst/customers | Customer List | P3 | NEW |
| /mrst/customers/[id] | Customer Detail | P3 | NEW |

---

## 3. Vehicles Page - CRITICAL

### 3.1 Data Source Rules

```
IMPORTANT: Show ONLY vehicles from hq_vehicles table
- Do NOT show vehicles that exist only in Monday.com
- Do NOT show vehicles that exist only in Spireon
- Join with Spireon GPS via VIN for location data
- Currently ~86 active HQ vehicles
```

### 3.2 Vehicle Card Components

Each vehicle card displays:

#### A. AI-Generated Image
- Angle: Front driver-side 3/4 angle
- Background: Transparent PNG
- Source: Gemini free tier
- Cache: S3 + ai_generated_images table
- Fallback: Placeholder image while generating

#### B. HQ Status Badge
```
Available   → Green badge
Rented      → Blue badge
Maintenance → Orange badge
Out of Service → Red badge
```

#### C. Vehicle Info
- Vehicle Key (V136, V267, etc.) - prominent
- Year Make Model (2024 Ford Expedition)
- Color
- License Plate
- VIN (last 6 characters only)

#### D. GPS Location
- Street address from Spireon
- "Location Unknown" if no GPS match
- Last updated timestamp
- Click to open in Google Maps

#### E. At Shop Indicator
```sql
-- Calculate distance from shop
ST_Distance(
  device_location,
  ST_MakePoint(-73.993128, 40.622877)::geography
) <= 483  -- 0.3 miles in meters

-- Results:
Within 0.3 miles → "At Shop" (green badge)
Outside 0.3 miles → "Away" (orange badge)  
No GPS data → "GPS Unknown" (gray badge)
```

#### F. Anomaly Detection - CRITICAL

**Trigger conditions (ALL must be true):**
1. `hq_vehicles.status` = 'available'
2. GPS shows vehicle > 0.3 miles from shop
3. GPS has data from last 24 hours

**Display when triggered:**
```
┌─────────────────────────────────────────┐
│ ⚠️  Vehicle available but not at shop   │
│                                         │
│ Last seen: 123 Main St, Brooklyn        │
│ 2 hours ago                             │
│                                         │
│ [Add info about this vehicle]           │
└─────────────────────────────────────────┘
```
- Yellow/orange warning styling
- Show at TOP of vehicle list
- "Add info" opens modal to create note/alert

### 3.3 Filtering & Sorting

**Filters:**
- Status: All | Available | Rented | Maintenance | Out of Service
- Location: All | At Shop | Away
- Issues: All | Has Issues Only

**Sort options:**
- Vehicle Key (A-Z)
- Status
- Last GPS Update
- Year (newest first)

**Search:**
- Vehicle Key
- License Plate
- VIN
- Make/Model

### 3.4 Vehicle Detail Page (/mrst/vehicles/[id])

- Large AI-generated image
- Full vehicle specifications
- Current GPS location with embedded map
- GPS breadcrumbs (last 7 days)
- Current rental info (if rented)
- Timeline of all vehicle activity
- Linked Monday.com items
- Documents/photos from HQ
- Alert history
- "Add Alert" button

---

## 4. AI Vehicle Image Generation

### 4.1 Prompt Template

```
Professional photo of a [YEAR] [MAKE] [MODEL] in [COLOR], 
front driver-side 3/4 angle, studio lighting, 
transparent PNG background, no watermarks, 
no background elements, isolated vehicle only
```

For customer vehicles (collision): use "rear passenger-side 3/4 angle"

### 4.2 Implementation

```typescript
// Location: packages/ai/src/vehicle-images.ts

import { sha256 } from 'crypto'
import { db } from '@mrst/db'
import { aiGeneratedImages, coreVehicles } from '@mrst/db/schema'
import { gemini } from './gemini'
import { uploadToS3, getS3Url } from '@mrst/shared/s3'

export async function generateVehicleImage(vehicle: {
  id: string
  tenantId: string
  year: number
  make: string
  model: string
  color: string
  isCustomerVehicle?: boolean
}): Promise<string> {
  const angle = vehicle.isCustomerVehicle 
    ? 'rear passenger-side 3/4 angle' 
    : 'front driver-side 3/4 angle'
  
  const prompt = `Professional photo of a ${vehicle.year} ${vehicle.make} ${vehicle.model} in ${vehicle.color}, ${angle}, studio lighting, transparent PNG background, no watermarks, no background elements, isolated vehicle only`
  
  const promptHash = sha256(prompt)
  
  // Check cache
  const cached = await db.query.aiGeneratedImages.findFirst({
    where: eq(aiGeneratedImages.promptHash, promptHash)
  })
  if (cached) return cached.imageUrl
  
  // Generate with Gemini
  const imageData = await gemini.generateImage({
    prompt,
    aspectRatio: '16:9'
  })
  
  // Upload to S3
  const s3Key = `generated/vehicles/${vehicle.id}-${promptHash.slice(0,8)}.png`
  await uploadToS3(imageData, s3Key, 'image/png')
  const imageUrl = getS3Url(s3Key)
  
  // Cache in database
  await db.insert(aiGeneratedImages).values({
    tenantId: vehicle.tenantId,
    promptHash,
    prompt,
    model: 'gemini-2.0-flash',
    imageUrl
  })
  
  // Update vehicle record
  await db.update(coreVehicles)
    .set({ 
      generatedImageUrl: imageUrl,
      generatedImageAngle: vehicle.isCustomerVehicle ? 'rear_passenger' : 'front_driver'
    })
    .where(eq(coreVehicles.id, vehicle.id))
  
  return imageUrl
}
```

### 4.3 Background Job

```typescript
// Add to worker job handlers
{
  name: 'GENERATE_VEHICLE_IMAGE',
  handler: async (job) => {
    const { vehicleId } = job.data
    const vehicle = await getVehicleById(vehicleId)
    await generateVehicleImage(vehicle)
  },
  options: {
    retryLimit: 3,
    retryDelay: 5000 // 5 seconds between retries
  }
}
```

Rate limit: 1 image per 5 seconds (Gemini free tier)

---

## 5. File & Image Previews - CRITICAL

### 5.1 Core Rules

```
NEVER show just a link - ALWAYS show preview

Images: 
- Display at least 300px wide
- Clearly visible without clicking
- Lazy load with skeleton

PDFs:
- Render first page inline
- Minimum 400px height
- Readable without clicking

Documents:
- Show meaningful preview
- NOT just a file icon
```

### 5.2 On Click Behavior

Open fullscreen modal with:
- Navigation arrows for galleries
- Zoom controls for PDFs (50% - 200%)
- Page navigation for multi-page PDFs
- "Open in new tab" button
- "Download" button
- Close with ESC key or X button

### 5.3 Grouped Media Display

Group files from same source as gallery:
- All attachments from one email
- All files from one Monday.com update
- All files in one Monday.com column

Gallery display:
- Show 4 thumbnails max in grid
- "+N more" badge if > 4 files
- Click any to open modal gallery

### 5.4 PDF Implementation

```typescript
// Use react-pdf or @react-pdf-viewer/core

// Inline preview component
<PDFPreview 
  url={file.url}
  height={400}
  showFirstPageOnly
  onClick={() => openFullscreenViewer(file)}
/>

// Fullscreen viewer features:
// - Page navigation (prev/next, page input)
// - Zoom (fit width, fit page, 50%-200%)
// - Download button
// - Open in new tab button
// - ESC to close
```

### 5.5 Testing Requirements

Write Puppeteer tests for:
1. PDF thumbnail renders
2. Click opens modal
3. Page navigation works
4. Zoom controls work
5. Download works
6. ESC closes modal

**WARNING: This feature has caused problems before. Do NOT mark complete without passing tests.**

---

## 6. ADHD-First Design Principles

### 6.1 Visual Hierarchy

- Most important info jumps out immediately
- Use size, color, spacing to create hierarchy
- Chunk everything into cards
- Max 3-4 things competing for attention

### 6.2 Source Color Coding

```css
:root {
  --source-monday: #4B7BEC;   /* Blue */
  --source-hq: #27AE60;       /* Green */
  --source-gmail: #EA4335;    /* Red */
  --source-spireon: #FF9500;  /* Orange */
  --source-whatsapp: #25D366; /* WhatsApp Green */
}
```

### 6.3 Business Unit Theming

```css
/* Rental = Red accent */
[data-business-unit="rental"] {
  --accent: #E74C3C;
}

/* Collision = Blue accent */
[data-business-unit="collision"] {
  --accent: #3498DB;
}
```

### 6.4 Required Patterns

- Progress indicators prominent
- Status badges large and obvious
- Action buttons clearly labeled
- Generous whitespace
- Large click targets (min 44px)

### 6.5 Forbidden Patterns

```
❌ Dense data tables with 10+ columns
❌ Multi-step wizards > 3 steps
❌ Modals on modals
❌ Click targets < 44px
❌ Icon-only buttons (always add labels)
❌ Forms with > 5 visible fields
❌ Walls of unformatted text
```

---

## 7. Dashboard Requirements

### 7.1 Hero Stats Row

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   VEHICLES   │   RENTALS    │  CUSTOMERS   │   ISSUES     │
│      86      │      70      │    2,383     │      3       │
│   ▁▂▃▂▄▅▆    │   ▁▂▃▄▅▄▃    │   ▁▂▃▄▅▆▇    │   ▃▂▁▂▃▂▁    │
│   +2 this wk │   -1 today   │   +12 wk     │   ⚠️ Action   │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

Each card shows:
- Large number
- Sparkline (7-day trend)
- Change indicator

### 7.2 Charts Section

**Pie Chart:** Vehicle status breakdown
- Available (green)
- Rented (blue)
- Maintenance (orange)
- Out of Service (red)

**Line Chart:** Rentals over past 30 days

**Bar Chart:** Activity by source (last 7 days)

### 7.3 Integration Health

```
┌─────────────────────────────────────────┐
│ Integration Status                       │
├──────────────┬──────────┬───────────────┤
│ Monday.com   │ 6,862    │ 🟢 2 min ago  │
│ HQ Rental    │ 3,250    │ 🟢 5 min ago  │
│ Gmail        │ 14,893   │ 🟢 10 min ago │
│ Spireon GPS  │ 165      │ 🟢 Just now   │
│ WhatsApp     │ --       │ 🔴 Not setup  │
└──────────────┴──────────┴───────────────┘
```

### 7.4 Quick Actions

- "New Reservation" button (opens modal)
- "Find Vehicle" search
- "Search Customer" search

### 7.5 Anomaly Summary

```
⚠️ 3 vehicles need attention
[View vehicles with issues →]
```

---

## 8. Timeline Requirements

### 8.1 Filter Bar

```
┌─────────────────────────────────────────────────────────┐
│ [🔵 Monday] [🟢 HQ] [🔴 Gmail] [🟠 Spireon]  🔍 Search  │
│                                                         │
│ Date: [Last 7 days ▼]    [☐ Collapse groups]           │
└─────────────────────────────────────────────────────────┘
```

- Source filters are colored pills (toggle on/off)
- Search with instant results
- Date range picker
- Collapse toggle for grouped events

### 8.2 Event Card Structure

```
┌─────────────────────────────────────────────────────────┐
│ 🔴 Gmail                                    2 hours ago │
├─────────────────────────────────────────────────────────┤
│ Email received from john@insurance.com                  │
│ RE: Claim #12345 - Vehicle Damage Assessment            │
│                                                         │
│ 📎 3 attachments                                        │
│ ┌─────┐ ┌─────┐ ┌─────┐                                │
│ │ PDF │ │ IMG │ │ IMG │                                │
│ └─────┘ └─────┘ └─────┘                                │
│                                                         │
│ 🚗 V136 Ford Expedition  👤 John Smith    [Expand ▼]   │
└─────────────────────────────────────────────────────────┘
```

### 8.3 Infinite Scroll

- Load 20 events initially
- Load more on scroll
- Show skeleton while loading
- "No more events" at end

---

## 9. Fleet Map Requirements

### 9.1 Map Setup

```typescript
// Use Mapbox GL JS or react-leaflet
// Center on shop by default
const shopLocation = {
  lat: 40.622877,
  lng: -73.993128
}
```

### 9.2 Markers

- Shop: Special marker icon
- Vehicles: Colored by status
  - Green = Available
  - Blue = Rented  
  - Orange = Maintenance
  - Red = Out of Service
- Show vehicle key on marker (V136)
- Cluster when zoomed out

### 9.3 Marker Popup

```
┌─────────────────────────┐
│ V136 - Ford Expedition  │
│ Status: Available       │
│ Last update: 5 min ago  │
│                         │
│ [View Details] [📍 Nav] │
└─────────────────────────┘
```

### 9.4 Side Panel

- Scrollable vehicle list
- Search/filter
- Click → zoom to vehicle on map
- Show distance from shop

---

## 10. Navigation & Layout

### 10.1 Sidebar (Desktop)

```
┌──────────────────────┐
│ 🚗 MRST              │
├──────────────────────┤
│ 📊 Dashboard         │
│ 🚙 Vehicles          │
│ 📋 Timeline          │
│ 🗺️ Fleet Map         │
│ 💡 Suggestions       │
│ 👥 Customers         │
├──────────────────────┤
│                      │
│                      │
├──────────────────────┤
│ ⚙️ Settings          │
│ 👤 admin@...         │
└──────────────────────┘
```

- Collapsible to icons only
- Active state clearly visible
- Icons + labels always

### 10.2 Bottom Nav (Mobile)

```
┌─────────────────────────────────────────┐
│  📊      🚙      📋      🗺️      ☰    │
│ Home   Vehicles Timeline  Map   More   │
└─────────────────────────────────────────┘
```

- Fixed at bottom of screen
- 5 items max (More opens sheet with rest)
- Active state with color + label
- 44px minimum touch targets

### 10.3 Header

**Desktop:**
- Breadcrumbs on detail pages
- Dark mode toggle
- User dropdown (logout)

**Mobile:**
- Page title only
- Hamburger menu (if not using bottom nav)
- Dark mode in settings, not header

---

## 11. Component Library

### 11.1 Install shadcn/ui

```bash
npx shadcn-ui@latest init

npx shadcn-ui@latest add \
  button card input dialog sheet tabs badge \
  avatar skeleton toast dropdown-menu popover \
  command separator scroll-area tooltip
```

### 11.2 Additional Packages

```bash
pnpm add lucide-react recharts react-pdf \
  @react-pdf-viewer/core mapbox-gl react-map-gl \
  date-fns class-variance-authority clsx \
  tailwind-merge
```

---

## 12. File Structure

```
apps/web/src/
├── app/mrst/
│   ├── layout.tsx              # Sidebar + header
│   ├── dashboard/page.tsx
│   ├── vehicles/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── timeline/page.tsx
│   ├── map/page.tsx
│   ├── suggestions/page.tsx
│   └── customers/
│       ├── page.tsx
│       └── [id]/page.tsx
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Breadcrumbs.tsx
│   │
│   ├── dashboard/
│   │   ├── StatsCard.tsx
│   │   ├── StatsCardSkeleton.tsx
│   │   ├── VehicleStatusChart.tsx
│   │   ├── RentalsChart.tsx
│   │   └── IntegrationHealth.tsx
│   │
│   ├── vehicles/
│   │   ├── VehicleCard.tsx
│   │   ├── VehicleCardSkeleton.tsx
│   │   ├── VehicleAnomalyCard.tsx
│   │   ├── VehicleFilters.tsx
│   │   ├── VehicleImage.tsx
│   │   └── VehicleDetail.tsx
│   │
│   ├── timeline/
│   │   ├── EventCard.tsx
│   │   ├── EventCardSkeleton.tsx
│   │   ├── SourceFilter.tsx
│   │   ├── DateRangePicker.tsx
│   │   └── CollapsedGroup.tsx
│   │
│   ├── map/
│   │   ├── FleetMap.tsx
│   │   ├── VehicleMarker.tsx
│   │   ├── ShopMarker.tsx
│   │   └── VehiclePanel.tsx
│   │
│   ├── files/
│   │   ├── FilePreview.tsx
│   │   ├── ImagePreview.tsx
│   │   ├── PDFViewer.tsx
│   │   ├── PDFFullscreen.tsx
│   │   ├── MediaGallery.tsx
│   │   └── FileModal.tsx
│   │
│   └── shared/
│       ├── StatusBadge.tsx
│       ├── SourceBadge.tsx
│       ├── AtShopBadge.tsx
│       ├── EmptyState.tsx
│       ├── ErrorBoundary.tsx
│       └── LoadingSpinner.tsx
│
└── lib/
    ├── trpc.ts
    ├── providers.tsx
    ├── utils.ts
    └── constants.ts
```

---

## 13. API Endpoints

### Available tRPC Endpoints

```typescript
// Dashboard
dashboard.stats

// Vehicles
vehicles.list({ status?, location?, hasIssues?, search?, sortBy? })
vehicles.get(id)
vehicles.listWithLocation()
vehicles.stats

// Timeline  
timeline.list({ limit, cursor, sources[], searchQuery, dateFrom, dateTo, collapsed })
timeline.forVehicle(vehicleId)
timeline.forCustomer(customerId)
timeline.expandGroup(groupKey)

// AI
ai.getSuggestions()
ai.getStats()
ai.generateVehicleImage(vehicleId)

// GPS
gps.getVehicleLocation(vehicleId)
gps.getVehicleHistory(vehicleId, { days })
```

### New Endpoints Needed

```typescript
// Vehicles with anomaly detection
vehicles.listWithAnomalies()

// Vehicle notes/alerts
vehicles.addNote(vehicleId, { content })
alerts.createForVehicle(vehicleId, { title, description, priority })
```

---

## 14. Testing

### Puppeteer Test Files

```
tests/
├── pdf-preview.test.ts
├── image-gallery.test.ts
├── vehicles-page.test.ts
├── vehicles-anomaly.test.ts
├── fleet-map.test.ts
├── dashboard.test.ts
├── timeline.test.ts
├── mobile-navigation.test.ts
└── responsive-layout.test.ts
```

### Critical Tests

1. **PDF Preview**
   - Thumbnail renders
   - Fullscreen opens
   - Page navigation
   - Zoom controls
   - Download button

2. **Vehicle Anomalies**
   - Anomaly cards appear for correct vehicles
   - "Add info" modal works
   - Filters work correctly

3. **Map**
   - Map renders
   - Markers display
   - Popups work
   - Side panel syncs

4. **Mobile Navigation**
   - Bottom nav renders on mobile viewport
   - All nav items accessible
   - "More" menu opens sheet
   - Touch targets are 44px+

5. **Responsive Layout**
   - All pages render at 375px width
   - No horizontal scroll
   - Cards stack on mobile
   - Tables become cards

### Test Viewports

```typescript
const viewports = {
  mobile: { width: 375, height: 667 },   // iPhone SE
  tablet: { width: 768, height: 1024 },  // iPad
  desktop: { width: 1280, height: 800 }  // Laptop
}

// Run EVERY test on both mobile and desktop at minimum
```

### When to Run Tests

```
✅ Run Puppeteer tests:
- After completing a full page
- After implementing a critical feature (PDF, anomalies, map)
- Before marking a phase complete
- When CI/CD runs (on push)

❌ Don't run Puppeteer for:
- Every small CSS change
- Simple text updates
- When browser DevTools verification is faster
```

---

## 15. Execution Order

```
Phase 1: Foundation
├── Install dependencies (shadcn, lucide, recharts, etc.)
├── Build sidebar + header layout
└── Create shared components (badges, empty states)

Phase 2: Vehicles (Priority)
├── Vehicle list page with cards
├── Vehicle filters and search
├── Anomaly detection and display
├── "Add info" modal
└── Vehicle detail page

Phase 3: Vehicle Images
├── Gemini integration
├── Background job for generation
├── S3 upload and caching
└── Placeholder/loading states

Phase 4: Dashboard
├── Stats cards with sparklines
├── Charts (pie, line, bar)
├── Integration health
├── Quick actions

Phase 5: Timeline
├── Event cards with previews
├── Source filters
├── Infinite scroll
├── Grouped events

Phase 6: File Previews
├── PDF inline preview
├── PDF fullscreen viewer
├── Image gallery
├── File modal

Phase 7: Map
├── Mapbox/Leaflet setup
├── Vehicle markers
├── Side panel
├── Filters

Phase 8: Testing & Polish
├── Puppeteer tests
├── Loading states
├── Error handling
├── Empty states
```

---

## 16. Documentation Updates

After each major task:

1. **PROJECT_LEDGER.md** - Update current status, check off completed items
2. **SESSION_LOG.md** - Append session summary at end
3. **Git commit** - Commit with descriptive message

---

## 17. Backend Task: Gmail certifiedautocollision.com Fix

### Problem
The Gmail sync only works for travelautorental.com. It fails for certifiedautocollision.com (9 email accounts).

### Root Cause
The old code used TWO DIFFERENT service account JSON files - one per domain. We were only using the travelauto one.

### Solution

**Two service accounts required:**

| Domain | Service Account File | Client ID | Scope |
|--------|---------------------|-----------|-------|
| travelautorental.com | google-service-account.json | 113685960413666521570 | gmail.readonly |
| certifiedautocollision.com | certified-service-account.json | 113779064017479202218 | https://mail.google.com/ |

**Domain-wide Delegation:** Already configured in Google Admin (verified).

**Implementation:**

```typescript
// packages/integrations/src/gmail/client.ts

function getServiceAccountForDomain(email: string): ServiceAccountCredentials {
  const domain = email.split('@')[1]
  
  if (domain === 'certifiedautocollision.com') {
    // Use certified service account
    return JSON.parse(
      fs.readFileSync('/path/to/certified-service-account.json', 'utf8')
    )
  }
  
  // Default to travelauto service account
  return JSON.parse(
    fs.readFileSync('/path/to/google-service-account.json', 'utf8')
  )
}

// Update Gmail client to use correct credentials per domain
export function createGmailClient(emailToImpersonate: string) {
  const credentials = getServiceAccountForDomain(emailToImpersonate)
  
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://mail.google.com/'],  // Full scope for both
    subject: emailToImpersonate
  })
  
  return google.gmail({ version: 'v1', auth })
}
```

**Email accounts to sync (certifiedautocollision.com):**
- claims@certifiedautocollision.com (use this for testing)
- Plus 8 more accounts (discover via Admin SDK)

**Testing:**
```bash
# Test the certified domain connection
npx tsx packages/integrations/src/gmail/test-cac-domain.ts
```

**Files to update:**
1. Save certified-service-account.json to server (already pasted to Claude Code)
2. Update gmail/client.ts to detect domain and use correct credentials
3. Run test script to verify
4. Run full sync for certifiedautocollision.com accounts

---

## Quick Reference

### Shop Coordinates
```
Lat: 40.622877
Lng: -73.993128
Radius: 0.3 miles (483 meters)
```

### Source Colors
```
Monday:   #4B7BEC (blue)
HQ:       #27AE60 (green)
Gmail:    #EA4335 (red)
Spireon:  #FF9500 (orange)
WhatsApp: #25D366 (green)
```

### Status Colors
```
Available:      green
Rented:         blue
Maintenance:    orange
Out of Service: red
At Shop:        green
Away:           orange
GPS Unknown:    gray
```

---

*End of specification. Execute autonomously, update ledger, test everything.*
