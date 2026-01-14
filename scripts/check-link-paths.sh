#!/bin/bash
# Check for incorrect /mrst prefix in Next.js Link components
# The basePath config automatically adds /mrst, so Links should NOT include it

# Get script directory and navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "Checking for incorrect /mrst prefix in Link hrefs..."

# Find Link imports and hrefs with /mrst
ERRORS=$(grep -rn 'href="/mrst' apps/web/src --include="*.tsx" | grep -v '<a ' | grep -v '// ' || true)

if [ -n "$ERRORS" ]; then
  echo ""
  echo "ERROR: Found Link components with /mrst prefix!"
  echo "Next.js basePath automatically adds /mrst to Link hrefs."
  echo "Remove the /mrst prefix from these Links:"
  echo ""
  echo "$ERRORS"
  echo ""
  echo "Example fix: <Link href=\"/mrst/dashboard\"> → <Link href=\"/dashboard\">"
  exit 1
else
  echo "OK: No incorrect Link hrefs found."
  exit 0
fi
