# Vehicles Route Protection Document

**Created:** 2026-01-19
**Purpose:** Prevent recurring 404 errors on the /mrst/vehicles route

## Route Summary

| URL | File | Purpose |
|-----|------|---------|
| `/mrst/vehicles` | `apps/web/src/app/vehicles/page.tsx` | Vehicle list page |
| `/mrst/vehicles/[id]` | `apps/web/src/app/vehicles/[id]/page.tsx` | Vehicle detail page |

---

## ROOT CAUSE OF RECURRING 404s

The `/mrst/vehicles` route keeps breaking due to **incorrect Link href usage with Next.js basePath**.

### How basePath Works

```ts
// apps/web/next.config.ts
const nextConfig: NextConfig = {
  basePath: '/mrst',  // <-- THIS CAUSES THE CONFUSION
  ...
}
```

When `basePath: '/mrst'` is set:
- **Next.js `<Link>` components AUTO-PREPEND `/mrst` to all hrefs**
- Writing `<Link href="/mrst/vehicles">` renders as `/mrst/mrst/vehicles` = **404**
- Writing `<Link href="/vehicles">` correctly renders as `/mrst/vehicles`

### The Pattern That Breaks Things

Every time this route has broken, it followed this pattern:
1. Developer implements a new feature
2. Developer adds a `<Link href="/mrst/something">` thinking that's the correct URL
3. Next.js prepends `/mrst` again → `/mrst/mrst/something` = 404
4. The vehicles page appears broken

---

## CRITICAL FILES - DO NOT MODIFY WITHOUT TESTING

### Primary Route Files
```
apps/web/src/app/vehicles/page.tsx          # Main vehicles list
apps/web/src/app/vehicles/[id]/page.tsx     # Vehicle detail page
```

### Layout Dependencies (shared across all pages)
```
apps/web/src/components/layout/AppLayout.tsx   # Main layout wrapper
apps/web/src/components/layout/Sidebar.tsx     # Navigation sidebar - contains hrefs!
```

### Configuration
```
apps/web/next.config.ts                        # basePath config - NEVER CHANGE
```

### UI Components Used
```
apps/web/src/components/ui/card.tsx
apps/web/src/components/ui/input.tsx
apps/web/src/components/ui/button.tsx
apps/web/src/components/ui/badge.tsx
apps/web/src/components/ui/skeleton.tsx
apps/web/src/components/ui/dropdown-menu.tsx
apps/web/src/components/ui/sheet.tsx
apps/web/src/components/ui/separator.tsx
apps/web/src/components/ui/tooltip.tsx
```

### API Dependencies
```
apps/api/src/trpc/router.ts                    # Contains vehiclesRouter
  - vehicles.listWithLocation
  - vehicles.stats
  - vehicles.get
  - vehicles.locationHistory
```

---

## DEPENDENCY CHAIN

```
/mrst/vehicles (browser URL)
    ↓
apps/web/src/app/vehicles/page.tsx
    ↓
├── AppLayout (layout wrapper)
│   └── Sidebar (navigation - contains Link hrefs)
│       ├── Link href="/vehicles"    ← CORRECT (no /mrst prefix)
│       ├── Link href="/dashboard"   ← CORRECT
│       └── ... other nav items
├── UI Components (card, input, button, etc.)
├── API calls to /api/trpc/vehicles.* endpoints
│   └── apps/api/src/trpc/router.ts (vehiclesRouter)
└── Static assets: /mrst/images/vehicles/*.png  ← MUST have /mrst prefix
```

---

## RULES FOR LINK HREFS

### CORRECT Usage

```tsx
// Next.js Link - NO /mrst prefix
<Link href="/vehicles">              // → renders as /mrst/vehicles
<Link href="/vehicles/123">          // → renders as /mrst/vehicles/123
<Link href="/dashboard">             // → renders as /mrst/dashboard

// Static assets - MUST have /mrst prefix
<img src="/mrst/images/vehicles/V385.png">

// window.location - MUST have /mrst prefix
window.location.href = '/mrst/login'

// HTML anchor tags - MUST have /mrst prefix
<a href="/mrst/timeline">Timeline</a>
```

### INCORRECT Usage (CAUSES 404)

```tsx
// WRONG - causes double prefix = 404
<Link href="/mrst/vehicles">         // → renders as /mrst/mrst/vehicles = 404!
<Link href="/mrst/dashboard">        // → renders as /mrst/mrst/dashboard = 404!
```

---

## PRE-COMMIT CHECKLIST

Before committing ANY frontend changes, run these checks:

### 1. Run the Link Path Checker Script
```bash
./scripts/check-link-paths.sh
```
This script will fail if any `<Link href="/mrst...">` patterns are found.

### 2. Manual Grep Check
```bash
# Find incorrect Link hrefs (should return NOTHING)
grep -rn 'href="/mrst' apps/web/src --include="*.tsx" | grep '<Link'

# If this returns any results, those Links need the /mrst prefix REMOVED
```

### 3. Test the Route
```bash
# Start the dev server and manually verify:
# 1. Navigate to https://app.travelautorental.com/mrst/vehicles
# 2. Click on a vehicle card to verify detail page works
# 3. Click "Back to Vehicles" button to verify navigation back works
# 4. Test sidebar navigation to /vehicles
```

---

## RECENT BREAKING CHANGES (Git History)

| Commit | Description | How it Broke |
|--------|-------------|--------------|
| 2bbdf58 | **FIX**: Remove /mrst prefix from Link hrefs | Previous commits had added `/mrst` to Links |
| 3637c84 | Add /mrst basePath prefix to vehicle image URLs | Image URLs needed the prefix (correct) |

Pattern: Features get added → Links accidentally include `/mrst` → Route breaks → Fix commits remove the prefix

---

## FILES THAT COMMONLY INTRODUCE THIS BUG

When modifying these files, be EXTRA careful about Link hrefs:

1. **`apps/web/src/components/layout/Sidebar.tsx`** - Navigation links
2. **`apps/web/src/app/vehicles/page.tsx`** - VehicleCard Link component
3. **`apps/web/src/app/vehicles/[id]/page.tsx`** - "Back to Vehicles" Link
4. **Any new page components** - When adding navigation

---

## QUICK REFERENCE

| Element Type | Include /mrst? | Example |
|--------------|----------------|---------|
| `<Link href="...">` | NO | `<Link href="/vehicles">` |
| `useRouter().push()` | NO | `router.push('/vehicles')` |
| `<img src="...">` | YES | `<img src="/mrst/images/car.png">` |
| `<a href="...">` | YES | `<a href="/mrst/timeline">` |
| `window.location.href` | YES | `window.location.href = '/mrst/login'` |
| `fetch()` to API | NO* | `fetch('/api/trpc/...')` |

*API routes go through the proxy and don't need the prefix.

---

## AUTOMATED PROTECTION

The script `scripts/check-link-paths.sh` exists to catch this mistake. Consider:
1. Adding it to a pre-commit hook
2. Running it in CI/CD pipeline
3. Running it before every PR merge

---

## CONTACT

If this route breaks again, check:
1. Recent commits touching files in the dependency chain above
2. Look for `<Link href="/mrst` patterns
3. Run the check script to find offending files
