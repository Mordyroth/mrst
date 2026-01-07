# MRST Master Prompt for Claude Code

Copy and paste this entire prompt when starting a Claude Code session:

---

## START PROMPT (Copy below this line)

You are building MRST, a multi-tenant SaaS platform for vehicle rental and collision businesses.

## CRITICAL: Read These Documents First
1. `MRST_FINAL_ARCHITECTURE.md` - Complete technical specification
2. `PROJECT_LEDGER.md` - Current state and what to do next
3. `CLAUDE.md` - Coding rules and patterns

## Execution Mode
- **USE MAXIMUM TOKENS** - Don't conserve, work until phase completion
- **WORK AUTONOMOUSLY** - Don't ask questions, make reasonable decisions and document them
- **UPDATE LEDGER** - After each major task, update PROJECT_LEDGER.md
- **COMMIT FREQUENTLY** - Git commit after significant changes
- **TEST EVERYTHING** - Tests alongside implementation, verify before marking done
- **USE AGENTS WISELY** - For isolated tasks, 2-3 max concurrent

## Context Management
- If context is filling up: Update PROJECT_LEDGER.md completely → then use `/compact`
- After compacting: Re-read PROJECT_LEDGER.md to restore state

## Your Output Must Include
- Working, tested code
- Proper file structure per architecture doc
- Database migrations that actually run
- Integration tests that pass with real credentials
- Updated PROJECT_LEDGER.md showing progress

## Session End Protocol
Before ending, you MUST:
1. Update PROJECT_LEDGER.md with exact current state
2. Add entry to SESSION_LOG.md
3. Commit all changes to git
4. State clearly what the next session should do first

## Current Phase
Read PROJECT_LEDGER.md to determine current phase and task.
If Phase 0 not started, begin with project initialization.

## Credentials Location
- API credentials: `/home/ec2-user/API_CREDENTIALS.md`
- Google service account: `/home/ec2-user/google-service-account.json`
- Project directory: `~/projects/mrst`

## Begin
Start by reading the documents, assess current state, then continue work.
Do not stop until the current phase is complete or you run out of context.

---

## END PROMPT (Copy above this line)

---

## Phase-Specific Additions

When starting a specific phase, add this to the prompt:

### For Phase 0 (Foundation)
```
FOCUS: Phase 0 - Foundation

Build complete project infrastructure:
1. pnpm monorepo with turbo
2. All packages (db, integrations, ai, ui, shared, apps)
3. Complete Drizzle schema from architecture doc
4. Database migrations
5. pg-boss job queue
6. Basic auth (users, sessions, RBAC)
7. S3 file storage
8. Sync logging system

Do not stop until all Phase 0 checklist items are complete.
```

### For Phase 1 (Monday Mirror)
```
FOCUS: Phase 1 - Monday.com Mirror

Build complete Monday.com mirroring:
1. GraphQL client with rate limiting (10M complexity/min)
2. Sync: workspaces → boards → columns → items → values
3. Sync: updates, replies, activity logs
4. Download all files/attachments to S3
5. Map external_column_id to display titles
6. Track value changes via hash
7. Test with all 17 boards from credentials

Store raw JSONB on every record. Never lose data fidelity.
```

### For Phase 2 (HQ Mirror)
```
FOCUS: Phase 2 - HQ Rental Mirror

Build complete HQ Rental mirroring:
1. REST client with Basic auth
2. Sync: customers, vehicles, reservations
3. Sync: contracts, payments, charges
4. Download all documents to S3
5. Create core_customers from HQ data
6. Create core_vehicles from HQ data
7. Create external_links entries

API: https://api-america-3.caagcrm.com/api-america-3
Auth: Basic base64(tenant_token:user_token)
```

### For Phase 3 (Timeline)
```
FOCUS: Phase 3 - Timeline v1

Build unified timeline to validate mirroring:
1. Create timeline_events from Monday updates/activity
2. Create timeline_events from HQ reservations/payments
3. Implement collapse_group_key for consecutive Monday events
4. Create timeline_event_links
5. Timeline API endpoint
6. Basic timeline UI component
7. Verify ALL mirrored data appears in timeline

This phase validates that mirroring is complete and working.
```

---

## Recovery Prompt

If a session crashed or was interrupted:

```
SESSION RECOVERY

The previous session was interrupted unexpectedly.

Please:
1. Read PROJECT_LEDGER.md for last known state
2. Read SESSION_LOG.md for recent session history  
3. Check `git log --oneline -10` for recent commits
4. Check `git status` for uncommitted changes
5. Assess what was in progress
6. Report current state
7. Resume work from where it stopped

Do not start over - continue from interruption point.
```
