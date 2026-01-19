#!/bin/bash
# Check for incorrect /mrst prefix in Next.js Link components
# The basePath config automatically adds /mrst, so Links should NOT include it
#
# This script catches BOTH patterns:
#   - href="/mrst/..."     (string literal)
#   - href={`/mrst/...`}   (template literal)

# Get script directory and navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "Checking for incorrect /mrst prefix in Link hrefs..."

# Find ALL hrefs with /mrst (both string and template literals)
# Then exclude <a tags which legitimately need /mrst prefix
# Also exclude comments
ALL_HREFS=$(grep -rn 'href=.*/mrst' apps/web/src --include="*.tsx" 2>/dev/null || true)

# Filter out legitimate uses: <a tags and comments
ERRORS=$(echo "$ALL_HREFS" | grep -v '<a ' | grep -v '// ' | grep -v '{/\*' || true)

if [ -n "$ERRORS" ]; then
  echo ""
  echo "==========================================================="
  echo "ERROR: Found Link/navigation components with /mrst prefix!"
  echo "==========================================================="
  echo ""
  echo "Next.js basePath automatically adds /mrst to Link hrefs."
  echo "Remove the /mrst prefix from these:"
  echo ""
  echo "$ERRORS"
  echo ""
  echo "FIX EXAMPLES:"
  echo "  <Link href=\"/mrst/dashboard\">   → <Link href=\"/dashboard\">"
  echo "  <Link href={\`/mrst/foo/\${id}\`}> → <Link href={\`/foo/\${id}\`}>"
  echo ""
  echo "NOTE: <a> tags, <img src>, and window.location DO need /mrst prefix."
  echo "==========================================================="
  exit 1
else
  echo "OK: No incorrect Link hrefs found."
  exit 0
fi
