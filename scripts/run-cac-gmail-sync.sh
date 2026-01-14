#!/bin/bash
# CAC Gmail Sync Runner
# Runs in background, logs to file

LOG_FILE="/home/ec2-user/projects/mrst/scripts/cac-gmail-sync.log"
LOCK_FILE="/tmp/cac-gmail-sync.lock"

# Check if already running
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo "$(date): Sync already running (PID $PID)" >> "$LOG_FILE"
        exit 0
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

# Run sync
cd /home/ec2-user/projects/mrst
echo "$(date): Starting CAC Gmail sync..." >> "$LOG_FILE"

npx tsx packages/integrations/src/gmail/sync-cac.ts >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

echo "$(date): Sync completed with exit code $EXIT_CODE" >> "$LOG_FILE"

# Remove lock file
rm -f "$LOCK_FILE"

exit $EXIT_CODE
