# MRST Frontend Briefing

> This document contains everything needed to redesign and improve the MRST frontend.

## Project Overview

MRST is a multi-tenant SaaS for Travel Auto Rental that:
- Mirrors data from Monday.com, HQ Rental, Gmail, and Spireon GPS
- Provides a unified timeline of all business activity
- Shows real-time fleet vehicle locations on a map
- Will have AI-powered suggestions and natural language search

**Live URL:** https://app.travelautorental.com/mrst/

## Current Tech Stack

```
Framework:     Next.js 15 (App Router)
Language:      TypeScript (strict mode)
Styling:       Tailwind CSS + CSS Variables (shadcn/ui pattern)
State:         React hooks + tRPC for data fetching
Components:    Custom + @mrst/ui package
Icons:         None currently installed
Charts:        None currently installed
```

## Current Pages

| Route | Description | Status |
|-------|-------------|--------|
| `/mrst/dashboard` | Main dashboard with stats cards | Functional but basic |
| `/mrst/timeline` | Activity feed from all sources | Functional, needs polish |
| `/mrst/map` | Fleet vehicle GPS locations | Functional, basic styling |
| `/mrst/suggestions` | AI task suggestions | Placeholder UI |
| `/mrst/login` | Login page | Basic, rarely used (demo mode) |

## File Structure

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Landing (redirects)
│   │   ├── globals.css         # Tailwind + CSS variables
│   │   ├── dashboard/page.tsx  # Dashboard
│   │   ├── timeline/page.tsx   # Timeline
│   │   ├── map/page.tsx        # Fleet Map
│   │   ├── suggestions/page.tsx# AI Suggestions
│   │   └── login/page.tsx      # Login
│   ├── components/
│   │   └── ai/
│   │       └── Suggestions.tsx # AI suggestions widget
│   └── lib/
│       ├── trpc.ts             # tRPC client setup
│       ├── providers.tsx       # React providers
│       └── auth.tsx            # Auth context
├── tailwind.config.ts
├── next.config.ts
└── package.json

packages/ui/
├── src/
│   ├── timeline/
│   │   ├── Timeline.tsx        # Main timeline component
│   │   ├── TimelineEvent.tsx   # Single event card
│   │   ├── TimelineFilters.tsx # Filter controls
│   │   └── types.ts            # Timeline types
│   ├── primitives/             # Empty - needs components
│   └── adhd/                   # Empty - ADHD-friendly components
└── package.json
```

## Available API Endpoints

All endpoints are tRPC and return JSON. Base URL: `/api/trpc/`

### Dashboard Stats (`dashboard.stats`)
```typescript
{
  fleetVehicles: number      // 122 - matched Monday+Spireon
  activeVehicles: number     // 119 - online with GPS
  totalSpieonDevices: number // 165
  activeRentals: number      // 70
  openReservations: number   // 29
  totalReservations: number  // 3,250
  totalCustomers: number     // 2,383
  integrations: {
    monday: { itemCount: number, lastSync: string | null }
    hq: { reservationCount: number, customerCount: number, lastSync: string | null }
    gmail: { messageCount: number, lastSync: string | null }
    spireon: { deviceCount: number, lastSync: string | null }
  }
  totalTimelineEvents: number // 18,749
  recentEventsBySource: Record<string, number> // Last 7 days by source
}
```

### Vehicles (`vehicles.listWithLocation`, `vehicles.stats`)
```typescript
// listWithLocation returns:
{
  vehicles: [{
    id: string
    name: string           // "V402 2024 Black Ford Expedition"
    vin: string
    make: string
    model: string
    year: number
    licensePlate: string
    unitNumber: string     // "V402"
    location: {
      lat: number
      lng: number
      address: string
      speed: string
      updatedAt: string
    } | null
    ignitionOn: boolean
    isOnline: boolean
    status: string
  }]
  total: number
}

// stats returns:
{
  total: number
  active: number
  recentLocation: number
  moving: number
}
```

### Timeline (`timeline.list`)
```typescript
// Input:
{ limit: number, cursor?: string, sources?: string[], searchQuery?: string, collapsed?: boolean }

// Returns:
{
  events: [{
    id: string
    type: string           // 'reservation_created', 'email_received', etc.
    source: string         // 'monday', 'hq', 'gmail', 'spireon'
    title: string
    description: string
    occurredAt: string
    metadata: object
    customerName?: string
    vehicleName?: string
    collapsedCount?: number
  }]
  nextCursor: string | null
  hasMore: boolean
}
```

### AI Suggestions (`ai.getSuggestions`, `ai.getStats`)
```typescript
// getSuggestions returns:
{
  suggestions: [{
    id: string
    type: string           // 'follow_up', 'overdue', 'urgent', etc.
    priority: 'high' | 'medium' | 'low'
    title: string
    description: string
    actionLabel: string
    relatedEntityType?: string
    relatedEntityId?: string
  }]
}

// getStats returns:
{
  totalEmbeddings: number
  byPriority: { high: number, medium: number, low: number }
  byStatus: { pending: number, completed: number }
}
```

## Current Design Issues

### 1. No Design System
- No consistent component library
- Hardcoded colors and spacing
- No button/input/card primitives
- Inconsistent hover states

### 2. Basic Visual Design
- Plain white backgrounds
- Minimal visual hierarchy
- No data visualization (charts/graphs)
- OpenStreetMap embed looks dated

### 3. Missing Features
- No dark mode toggle (CSS vars exist)
- No loading skeletons
- No empty states
- No error boundaries
- No toast notifications
- No modals/dialogs

### 4. Navigation
- Simple text links in header
- No sidebar
- No breadcrumbs
- No mobile menu

### 5. Data Display
- Stats cards are basic boxes
- No charts or sparklines
- Timeline events need better cards
- Vehicle list needs better layout

## Design Requirements (from PROJECT_LEDGER.md)

### ADHD-Friendly UI
- Clear visual hierarchy
- Reduce cognitive load
- Highlight what's important
- Make actions obvious

### File/Image Previews (CRITICAL)
- Never show just a link - always show large preview
- Images display big enough to see clearly
- PDFs show first page large and readable
- Gallery view for multiple files from same source

### Grouped Media Display
- Group attachments from same email
- Group files from same Monday update
- Display in gallery style

## Suggested Improvements

### Priority 1: Design System
1. Install shadcn/ui components (Button, Card, Input, Dialog, etc.)
2. Create consistent spacing scale
3. Define color palette for sources (Monday=blue, HQ=green, Gmail=red, Spireon=orange)
4. Add proper icons (Lucide React)

### Priority 2: Dashboard Redesign
1. Add charts (vehicle status pie, rentals over time line chart)
2. Better stats cards with trends/sparklines
3. Quick action buttons
4. Recent activity preview with better cards

### Priority 3: Timeline Improvements
1. Better event cards with source icons
2. Inline image/file previews
3. Click to expand details
4. Better filter UI (chips, not checkboxes)

### Priority 4: Fleet Map
1. Replace OpenStreetMap embed with Mapbox/Google Maps
2. Show vehicle markers on map
3. Click marker to see vehicle details
4. Cluster markers when zoomed out
5. Filter by status (online/offline/moving)

### Priority 5: Navigation
1. Add sidebar with collapsible sections
2. Add breadcrumbs
3. Mobile-responsive menu
4. Quick search in header

### Priority 6: Polish
1. Loading skeletons
2. Empty states with helpful messages
3. Toast notifications for actions
4. Keyboard shortcuts
5. Dark mode toggle

## Color Palette Suggestion

```css
/* Source colors */
--monday: 225 73% 57%;      /* #4B7BEC - Blue */
--hq: 142 71% 45%;          /* #27AE60 - Green */
--gmail: 4 90% 58%;         /* #EA4335 - Red */
--spireon: 36 100% 50%;     /* #FF9500 - Orange */

/* Status colors */
--online: 142 71% 45%;      /* Green */
--offline: 220 9% 46%;      /* Gray */
--moving: 36 100% 50%;      /* Orange */
--alert: 0 84% 60%;         /* Red */
```

## Data Available for Visualization

| Metric | Current Value | Good For |
|--------|---------------|----------|
| Fleet Vehicles | 122 | Pie chart by status |
| Active Rentals | 70 | Trend line over time |
| Customers | 2,383 | Growth chart |
| Timeline Events | 18,749 | Activity heatmap |
| GPS Locations | Real-time | Live map markers |
| Email Volume | 14,893 | Bar chart by month |

## Authentication

Currently using demo mode with hardcoded token:
```typescript
const token = 'demo_token_permanent_access_2026'
```

All API calls include: `Authorization: Bearer ${token}`

No login required for demo - can skip auth UI for now.

## Build & Deploy

```bash
# Development
cd apps/web
pnpm dev

# Build
pnpm build --filter=@mrst/web

# Deploy (PM2)
pm2 restart mrst-web
```

## Screenshots

Current pages can be viewed at:
- Dashboard: https://app.travelautorental.com/mrst/dashboard
- Timeline: https://app.travelautorental.com/mrst/timeline
- Fleet Map: https://app.travelautorental.com/mrst/map
- Suggestions: https://app.travelautorental.com/mrst/suggestions

## Questions to Decide

1. **Design direction**: Modern minimal? Bold colors? Dashboard-heavy?
2. **Component library**: Build custom or use shadcn/ui?
3. **Charts**: Recharts, Chart.js, or Tremor?
4. **Maps**: Mapbox, Google Maps, or Leaflet?
5. **Icons**: Lucide, Heroicons, or Phosphor?
6. **Animations**: Framer Motion or CSS-only?

## Summary for Claude

You're helping redesign the MRST frontend. The backend is complete with rich data from 4 integrations (Monday.com, HQ Rental, Gmail, Spireon GPS). The current UI is functional but basic - it needs to become a polished, professional dashboard that's easy to use and visually appealing.

Key data points:
- 122 fleet vehicles with real-time GPS
- 70 active rentals
- 2,383 customers
- 18,749 timeline events
- AI suggestions ready (needs API keys)

The user wants a "kick ass" frontend. Focus on:
1. Beautiful, modern design
2. Great data visualization
3. Smooth interactions
4. ADHD-friendly (clear, focused, not overwhelming)
