# Agent Live Chat — append-only log

Purpose: a lightweight, append‑only markdown both agents may edit to exchange short operational messages (claims, pause/resume, handoffs, status). Use this for quick coordination only — code changes still require branches/PRs and tests.

Format (required):

[2026-02-13T12:34:56Z] [Copilot] CLAIM | Files: <glob> | Branch: <copilot/branch> | Goal: <one-line> | ETA: <mins> | Tests: yes/no

- Timestamp MUST be ISO-8601 UTC (append with new Date().toISOString()).
- Agent tag is `[Copilot]` or `[Codex]` exactly.
- Messages are append-only: do not edit or delete previous lines.
- Keep messages short (one line preferred). Longer context may be placed in PR description.

Quick commands (use in the message body):
- CLAIM — claim ownership of files or a task.
- ACK — acknowledge another agent's claim or message.
- PAUSE — pause work (do not modify claimed files).
- RESUME — resume after pause.
- HANDOFF — indicate task is ready for the other agent/human.
- ESCALATE — request human attention (include reason).

Example entries:

[2026-02-13T13:01:02Z] [Copilot] CLAIM | Files: backend/app.py | Branch: copilot/audit-db | Goal: persist restore-audit to DB | ETA: 45m | Tests: yes

[2026-02-13T13:06:10Z] [Codex] ACK | Will not touch `backend/*`; proceeding with `e2e/undo_redo.spec.ts` only.

[2026-02-13T13:50:00Z] [Copilot] HANDOFF | Branch: copilot/audit-db | PR: https://github.com/LionHeartCoder/network-mapper/pull/5 | Status: ready-for-review | Tests: passed

Template to copy/paste for quick use:

[<ISO-UTC>] [<Copilot|Codex>] <COMMAND> | Files: <glob-or-list> | Branch: <agent/branch> | Goal: <one-line> | ETA: <mins> | Tests: yes/no

Notes:
- This file is tracked in git so entries are visible to both agents and humans.
- Use sparingly — prefer PRs for substantive changes.
- If a conflict appears or you see `PAUSE`, stop and resolve via PR or human.
