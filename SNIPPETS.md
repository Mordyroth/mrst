# Claude Code Session Prompts

Copy these or type the keyword and expand. The workflow: one task per session, exit between tasks.

---

## start
Read PROJECT_LEDGER.md and CLAUDE.md. Tell me the current phase, blockers, and first task in queue. Do not start coding until I confirm.

## done
Task complete. Update PROJECT_LEDGER.md task queue, commit all changes, tell me the commit hash.

## partial
Stopping mid-task. Update PROJECT_LEDGER.md with exactly where we stopped. Commit with message "WIP: [description]".

## abort
Stop. Do not try to fix. Update PROJECT_LEDGER.md with what happened, add to blockers if needed. Commit current state.

## status
Read PROJECT_LEDGER.md. Tell me phase, blockers, next task. Change nothing.

## pm2
pm2 status && pm2 logs mrst-web --lines 15

## rebuild
pnpm build && pm2 restart mrst-web && pm2 logs mrst-web --lines 10

## linkcheck
./scripts/check-link-paths.sh

---

## Workflow Reminder

**One task = one session.** Exit and restart between tasks to prevent context decay.

Signs Claude is drifting: re-introduces fixed bugs, forgets patterns, gets creative with standards. Don't correct - use `abort`, exit, start fresh.

When a bug happens 3+ times: don't add to CLAUDE.md, create a hook in `.claude/hooks/` instead.
