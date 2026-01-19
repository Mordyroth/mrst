#!/bin/bash
#
# Claude Code PreToolUse Hook: Block href="/mrst patterns in .tsx files
#
# This hook prevents Claude from writing code that includes href="/mrst
# in Link components. This is a common mistake that causes 404 errors
# because Next.js basePath: '/mrst' auto-prepends /mrst to Link hrefs.
#
# Exit codes:
#   0 = Allow the operation
#   2 = Block the operation (with error message on stderr)
#

# Read JSON from stdin
INPUT=$(cat)

# Extract file_path
FILE_PATH=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Only check .tsx files
if [[ ! "$FILE_PATH" == *.tsx ]]; then
    exit 0
fi

# Extract content (for Write tool) or new_string (for Edit tool)
CONTENT=$(echo "$INPUT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ti = d.get('tool_input',{})
content = ti.get('content','') or ti.get('new_string','')
print(content)
" 2>/dev/null)

# Check for the bad pattern: href="/mrst or href={`/mrst in Link/navigation
# We need to catch string literals and template literals
# BUT we must ALLOW anchor tags <a href="/mrst/..."> - those are correct
#
# Strategy: Check for href=/mrst pattern, but NOT if preceded by <a
# We use grep -P for Perl regex with negative lookbehind
if echo "$CONTENT" | grep -qP '(?<!<a )href=.*["\x27\`]/mrst'; then
    echo "" >&2
    echo "============================================================" >&2
    echo "BLOCKED: Detected href=\"/mrst pattern in .tsx file!" >&2
    echo "============================================================" >&2
    echo "" >&2
    echo "This violates the basePath routing rules:" >&2
    echo "" >&2
    echo "  WRONG:   <Link href=\"/mrst/dashboard\">" >&2
    echo "  CORRECT: <Link href=\"/dashboard\">" >&2
    echo "" >&2
    echo "Next.js basePath: '/mrst' automatically prepends /mrst to Link hrefs." >&2
    echo "Using href=\"/mrst/...\" causes /mrst/mrst/... = 404 error!" >&2
    echo "" >&2
    echo "File: $FILE_PATH" >&2
    echo "============================================================" >&2
    exit 2
fi

exit 0
