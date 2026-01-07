# Claude Code Execution Guide for MRST

> **Goal:** Run Claude Code autonomously until completion, using maximum tokens, with perfect session continuity.

---

## 1. Understanding Claude Code Capabilities

### Token Usage
- Claude Code has LARGE context windows
- You can tell it to use tokens aggressively
- It can run for hours on complex tasks

### Agents (Sub-tasks)
- Claude Code can spawn "agents" - focused sub-tasks
- Example: "Create an agent to build the Monday.com sync"
- Agents work in isolation, report back
- Use responsibly: 2-3 agents at a time max

### Hooks
- **Pre-command hooks**: Scripts that run BEFORE any Claude action
- **Post-command hooks**: Scripts that run AFTER any Claude action
- Located in `.claude/hooks/`

### Compacting
- When context gets full, use `/compact` to summarize and continue
- Claude Code creates a summary and continues from there
- We'll set up automatic state saving so nothing is lost

---

## 2. Hook Setup for Session Continuity

Create these files on the server:

### .claude/hooks/pre-command.sh
```bash
#!/bin/bash
# Runs BEFORE every Claude Code command

# Load current state
if [ -f "PROJECT_LEDGER.md" ]; then
    echo "📋 Loading project state..."
fi

# Check if we're continuing a session
if [ -f ".claude/last_session.txt" ]; then
    LAST_SESSION=$(cat .claude/last_session.txt)
    echo "🔄 Continuing from session: $LAST_SESSION"
fi
```

### .claude/hooks/post-command.sh
```bash
#!/bin/bash
# Runs AFTER every Claude Code command

# Save timestamp
echo $(date -Iseconds) > .claude/last_activity.txt

# Auto-commit progress (if git changes)
if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "Auto-save: $(date '+%Y-%m-%d %H:%M')" --no-verify 2>/dev/null || true
fi
```

### Making hooks executable
```bash
mkdir -p ~/projects/mrst/.claude/hooks
chmod +x ~/projects/mrst/.claude/hooks/*.sh
```

---

## 3. Session Continuity Files

### PROJECT_LEDGER.md (Auto-maintained by Claude)

This is the "brain" that persists between sessions:

```markdown
# MRST Project Ledger

## Current Status
- **Phase:** 1 - Monday.com Mirror
- **Task:** Syncing board columns
- **Progress:** 45% complete
- **Blockers:** None

## Last Session
- **Date:** 2026-01-07 22:30 EST
- **Duration:** 3 hours
- **Completed:**
  - Database schema created
  - Monday client initialized
  - Board sync working
- **Stopped at:** Column value sync

## Next Steps (Ordered)
1. Complete column value sync with display names
2. Sync updates and replies
3. Sync activity logs
4. Test with all 17 boards

## Integration Status
| Integration | Mirror | Sync Jobs | Tested |
|-------------|--------|-----------|--------|
| Monday.com  | 🟡 In Progress | ❌ | ❌ |
| HQ Rental   | ❌ | ❌ | ❌ |
| Gmail       | ❌ | ❌ | ❌ |
| Spireon     | ❌ | ❌ | ❌ |
| WhatsApp    | ❌ | ❌ | ❌ |

## Files Created This Session
- packages/db/src/schema/monday.ts
- packages/integrations/src/monday/client.ts
- packages/integrations/src/monday/sync.ts

## Decisions Made
- Using Drizzle for ORM
- pg-boss for job queue
- 60-second poll interval for Gmail

## Notes for Next Session
- Monday API rate limit is 10M complexity/minute
- Board 1271995365 has 500+ items, may need pagination
```

### SESSION_LOG.md (Append-only history)

```markdown
# MRST Session Log

---

## Session: 2026-01-07-001
**Started:** 2026-01-07 19:00 EST
**Ended:** 2026-01-07 22:30 EST
**Duration:** 3.5 hours

### Completed
- [x] Project initialized
- [x] Database schema created (all tables)
- [x] Monday.com client created
- [x] Board sync implemented

### Commands Run
1. `pnpm create turbo@latest`
2. `pnpm add drizzle-orm pg-boss`
3. `pnpm db:migrate`
4. `pnpm test:monday`

### Issues Encountered
- Monday API returned 429 rate limit on initial sync
- Solution: Added exponential backoff

### Handoff Notes
Next session should continue with column value sync.
The monday_board_columns table is populated.
Need to map external_column_id to display titles.

---

## Session: 2026-01-08-001
...
```

---

## 4. CLAUDE.md (Compact Rules)

This must stay SMALL so it fits in context. Rules only, no verbosity:

```markdown
# CLAUDE.md - MRST Project Rules

## Session Protocol
1. READ PROJECT_LEDGER.md first
2. CONFIRM current phase/task before starting
3. UPDATE ledger after completing each task
4. COMMIT after every significant change
5. Before ending: update ledger, create handoff notes

## Code Rules
- TypeScript strict mode always
- Every function needs JSDoc comment
- Tests alongside implementation
- No `any` types without explicit reason

## Integration Rules
- NEVER write integration code without reading full API docs first
- ALWAYS store raw JSONB response
- ALWAYS include: first_seen_at, last_seen_at, source_hash, synced_at
- NEVER auto-link identities if ambiguous

## File Rules
- Database schema in packages/db/src/schema/
- Integration clients in packages/integrations/src/{provider}/
- API routes in apps/api/src/routes/
- Jobs in apps/worker/src/jobs/

## Git Rules
- Commit after every task
- Never force push
- Branch naming: feature/{name}, fix/{name}

## When Stuck
- Check API documentation
- Search codebase for similar patterns
- Log issue in PROJECT_LEDGER.md
- Continue with next task if blocked

## Context Management
- If context is filling: use /compact
- Before compacting: ensure PROJECT_LEDGER.md is updated
- After compacting: verify state from ledger
```

---

## 5. How to Start a Claude Code Session

### Initial Setup (One-time)

On your server, run:

```bash
cd ~/projects/mrst

# Create directory structure
mkdir -p .claude/hooks
mkdir -p apps/{web,api,worker}
mkdir -p packages/{db,integrations,ai,ui,shared}

# Create initial files
touch PROJECT_LEDGER.md
touch SESSION_LOG.md
touch CLAUDE.md

# Copy the content from this guide into those files
```

### Starting a Session

Open Claude Code and run this initial prompt:

```
You are building MRST, a multi-tenant SaaS platform.

CRITICAL INSTRUCTIONS:
1. Read MRST_FINAL_ARCHITECTURE.md for complete specs
2. Read PROJECT_LEDGER.md for current state
3. Continue from where last session stopped
4. Use MAXIMUM tokens - don't stop early
5. Update PROJECT_LEDGER.md after each major task
6. Commit frequently
7. If context gets full, update ledger then use /compact

EXECUTION MODE:
- Work autonomously until phase completion
- Don't ask questions - make reasonable decisions and document them
- Test as you build
- Use agents for isolated tasks when helpful

CURRENT GOAL: [State the phase/task from ledger]

Begin.
```

### During Session

Claude Code will:
1. Read the architecture and ledger
2. Continue from last stopping point
3. Build, test, commit
4. Update ledger after each task
5. Use agents for isolated work
6. Compact when needed

### Ending a Session

Before closing, tell Claude:

```
Session ending. Please:
1. Update PROJECT_LEDGER.md with exact current state
2. Update SESSION_LOG.md with session summary
3. Commit all changes
4. List what the next session should do first
```

---

## 6. Execution Phases (What to Tell Claude Code)

### Phase 0 Session Prompt

```
PHASE 0: Foundation

Build the complete project foundation:
1. Initialize pnpm monorepo with turbo
2. Set up all package.json files
3. Create complete database schema in Drizzle
4. Run migrations to create all tables
5. Set up pg-boss job queue
6. Create basic auth system
7. Set up S3 file storage utility
8. Create sync_runs logging system

Use maximum tokens. Work until complete.
Test everything before marking done.
Update PROJECT_LEDGER.md throughout.
```

### Phase 1 Session Prompt

```
PHASE 1: Monday.com Mirror

Read PROJECT_LEDGER.md for current state.
Continue Monday.com integration:

1. Create Monday GraphQL client with rate limiting
2. Sync workspaces
3. Sync boards (mark in_scope for last 5 months activity)
4. Sync board columns (CRITICAL: map external_column_id → display title)
5. Sync items with all column values
6. Sync updates and replies
7. Sync activity logs
8. Download and store all files/attachments
9. Create sync jobs with pg-boss
10. Test with all 17 boards from credentials

Store raw JSONB on every record.
Track value changes with hash comparison.
Use maximum tokens. Work until complete.
```

### Phase 2 Session Prompt

```
PHASE 2: HQ Rental Mirror

Read PROJECT_LEDGER.md for current state.
Continue HQ Rental integration:

1. Create HQ REST client with auth
2. Sync all customers
3. Sync all vehicles  
4. Sync all reservations
5. Sync contracts, payments, charges
6. Download all documents to S3
7. Create initial core_customers from HQ data
8. Create initial core_vehicles from HQ data
9. Create external_links entries
10. Create sync jobs

Store raw JSONB on every record.
Use maximum tokens. Work until complete.
```

### Phase 3 Session Prompt

```
PHASE 3: Timeline v1

Read PROJECT_LEDGER.md for current state.
Build unified timeline:

1. Create timeline_events from Monday updates
2. Create timeline_events from Monday activity logs
3. Create timeline_events from HQ reservations/payments
4. Implement collapse_group_key for consecutive Monday events
5. Create timeline_event_links to entities
6. Build basic timeline API endpoint
7. Build basic timeline UI component
8. Test: verify all mirrored data appears in timeline

This validates mirroring completeness.
Use maximum tokens. Work until complete.
```

### Phase 4-6 Session Prompts

Similar structure for Gmail, Spireon, WhatsApp.

### Phase 7 Session Prompt

```
PHASE 7: AI Intelligence Layer

Read PROJECT_LEDGER.md for current state.
Build AI layer:

1. Add pgvector extension to database
2. Create embeddings table
3. Build embedding pipeline for:
   - Monday items and updates
   - Gmail messages
   - WhatsApp messages
   - HQ records
4. Create Claude API client with fallback to Gemini
5. Build natural language query engine
6. Build "What should I do next?" endpoint
7. Build vehicle image generation (Gemini)
8. Test with sample queries

Use maximum tokens. Work until complete.
```

---

## 7. Agent Usage Guide

Use agents for isolated, well-defined tasks:

### Good Agent Tasks
```
Create an agent to:
- Build the Monday.com GraphQL client with rate limiting
- Create all Drizzle schema files for mirror tables
- Build the Gmail polling sync job
- Create the vehicle image generation service
```

### Bad Agent Tasks (Too broad)
```
DON'T: Create an agent to build the entire backend
DON'T: Create an agent to implement all integrations
```

### Agent Prompt Template
```
AGENT TASK: [Specific task name]

Context:
- This is part of MRST, a multi-tenant SaaS platform
- [Relevant architecture details]

Your task:
1. [Specific step 1]
2. [Specific step 2]
3. [Specific step 3]

Files to create:
- packages/integrations/src/monday/client.ts
- packages/integrations/src/monday/types.ts

When complete:
- All tests pass
- Code is committed
- Report what was built
```

---

## 8. Context Management

### When to Compact

Compact when:
- Claude mentions context is filling
- Response quality decreases
- You've completed a major phase

### Before Compacting

ALWAYS ensure:
1. PROJECT_LEDGER.md is fully updated
2. All changes are committed
3. SESSION_LOG.md has current session info

### Compact Command

```
/compact
```

### After Compacting

Claude will summarize. Then say:
```
Read PROJECT_LEDGER.md and continue from where we left off.
```

---

## 9. Recovery from Interruption

If session dies unexpectedly:

1. Start new session
2. Prompt:
```
Session was interrupted. Please:
1. Read PROJECT_LEDGER.md for last known state
2. Read SESSION_LOG.md for recent history
3. Check git log for recent commits
4. Assess current state
5. Report what needs to be continued
6. Resume work
```

---

## 10. Success Checklist

Before ending any phase, verify:

- [ ] All code compiles (no TypeScript errors)
- [ ] All tests pass
- [ ] Schema migrations run successfully
- [ ] Integration syncs work with real credentials
- [ ] PROJECT_LEDGER.md reflects true state
- [ ] Changes committed to git
- [ ] SESSION_LOG.md updated

---

## 11. Quick Reference Commands

```bash
# Start fresh session
cd ~/projects/mrst && cat PROJECT_LEDGER.md

# Check what's done
git log --oneline -20

# Run tests
pnpm test

# Run specific integration test
pnpm test:monday
pnpm test:hq

# Check database
psql -U mrst -d mrst -c "SELECT COUNT(*) FROM monday_items;"

# View sync status
psql -U mrst -d mrst -c "SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 10;"

# Backup database
./scripts/backup.sh
```

---

## 12. The Master Prompt

Use this to start a full autonomous session:

```
You are building MRST, a multi-tenant SaaS platform for vehicle businesses.

DOCUMENTS TO READ FIRST:
1. MRST_FINAL_ARCHITECTURE.md - Complete technical specification
2. PROJECT_LEDGER.md - Current state and progress
3. CLAUDE.md - Coding rules

EXECUTION INSTRUCTIONS:
- Use MAXIMUM tokens available - don't conserve
- Work AUTONOMOUSLY until phase completion
- DON'T ask questions - make decisions and document them
- UPDATE PROJECT_LEDGER.md after each major task
- COMMIT frequently to git
- TEST everything as you build
- USE agents for isolated tasks (2-3 max at a time)
- If context fills: update ledger → /compact → continue

CURRENT PHASE: [Read from PROJECT_LEDGER.md]

OUTPUT EXPECTATIONS:
- Working, tested code
- All files properly structured
- Database migrations that run
- Integration tests that pass
- Updated ledger showing progress

Begin by reading the documents, then continue from current state.
```

---

*This guide ensures Claude Code can work autonomously for hours, never lose context, and any future session can pick up exactly where the last one stopped.*
