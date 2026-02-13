# Agent Communication Protocol — Copilot ⇄ Codex

Purpose: provide a concise, machine‑ and human‑readable protocol so the two agentic AIs working on this repo can clearly claim work, avoid overlap, hand off tasks, and escalate to humans when needed.

---

## Core principles
- Single-claim rule: one agent owns a file/task at a time. Claim by creating a branch named `copilot/<task>` or `codex/<task>`.
- No surprise edits: never modify files claimed by another agent unless explicitly ACK'd.  
- Tests & docs required: any behavior change must add/adjust tests and update `docs/` or `API.md` where applicable.
- Non-destructive: never remove unrelated files or secrets. Escalate before large refactors.

---

## Quick workflow (short)
1. Claim task: post a single-line claim message and create a branch `agent/short-task`.
2. Work locally on claimed files only; run tests frequently.
3. Open a PR with description, link tests, request review from the other agent if needed.
4. Handoff: mark PR `handoff-complete` and post the handoff template.
5. Merge only after CI passes and any requested reviews are satisfied.

---

## Claim message (required fields)
Use this one-line template for claiming work (can be posted to agent channel or PR):

`[AGENT] Claim | Files: <glob-or-list> | Branch: <agent/branch> | Goal: <one-line> | ETA: <mins/hours> | Tests: yes/no | Blockers: <short>`

Example:

`[Copilot] Claim | Files: backend/app.py, backend/models.py | Branch: copilot/audit-db | Goal: persist restore-audit to DB | ETA: 1h | Tests: yes | Blockers: none`

---

## Handoff template (when ready for review)
`[AGENT] Handoff | Branch: <agent/branch> | PR: <url> | Status: ready-for-review | Tests: <passed/pending> | Next: <tasks>`

---

## Conflict & pause rules
- If an agent encounters unclaimed/untracked files created by the other agent: PAUSE and post
  `Conflict: <files> | Action: pause | Request: <owner> ACK`.
- If no ACK in 10 minutes, escalate to human with `Escalate: <who>`.
- When paused, **do not** add/commit or push overlapping changes.

---

## File-locking / claiming (practical)
- Prefer branch-based claiming (`copilot/…`, `codex/…`).
- Optional: create `.agent/claims/<branch>.claim` (single‑line JSON) to make claims discoverable.
- Always include the claim message in the PR description.

---

## Merge rules
- Do not merge into `main` without:
  - All CI checks green
  - Relevant tests added/updated
  - At least one agent or human ACK when the change touches shared areas (undo/redo, DB schema, CI)

---

## Testing & docs requirement
- Unit + integration tests for backend changes (pytest).  
- Playwright e2e for UI flows.  
- Update `docs/API.md` or `docs/TESTING.md` when adding endpoints or test requirements.

---

## Commit / PR metadata conventions
- Prefix agent commits with `AGENT: <Copilot|Codex> — <short>` (keeps history searchable).
- PR title: `<agent>: <short description>`
- Include `#agent-claim: <agent/branch>` in PR body for traceability.

---

## Escalation & human involvement
- Any schema migration, secret handling, or destructive refactor → require human approval before merging.
- If agents can’t resolve a conflict within 10 minutes, tag the repo maintainer and add `Escalate: human` in the claim.

---

## Example exchanges
- Claim: `[Codex] Claim | Files: e2e/undo_redo.spec.ts | Branch: codex/e2e-undo-redo | Goal: add undo/redo E2E | ETA: 45m | Tests: yes`
- ACK: `[Copilot] ACK | Not touching e2e/*; will not claim until PR is ready.`
- Handoff: `[Codex] Handoff | Branch: codex/e2e-undo-redo | PR: <url> | Status: ready-for-review | Tests: passed | Next: merge-after-CI`

---

## Short checklist before merge
- [ ] CI green
- [ ] Tests added/updated
- [ ] Docs/API updated where applicable
- [ ] No active claims overlapping
- [ ] PR description contains `#agent-claim:`

## Live agent chat (append-only)
- File: `docs/AGENT_CHAT.md` — a single, append-only markdown used by agents to exchange short, timestamped messages.
- Purpose: enable quick agent-to-agent handoffs, pause/resume signals, claims and status updates without opening PRs for every message.
- Rules:
  - Append only; do **not** edit or remove prior entries.
  - Messages must be one paragraph and use the format shown in `docs/AGENT_CHAT.md`.
  - Use explicit tags: `[Copilot]` or `[Codex]` and ISO-8601 UTC timestamp.
  - Short control messages allowed: `CLAIM`, `ACK`, `PAUSE`, `RESUME`, `HANDOFF`, `ESCALATE`.
  - Human escalation (or schema changes) still require a PR and human ACK.

See `docs/AGENT_CHAT.md` for the message format and examples.

---

## Copy‑paste template for Codex (give this exactly to Codex)

```text
AGENT PROTOCOL — READ/RESPOND/ACK

When you take work:
- Claim using branch name: codex/<short-task>
- Post a Claim line (see format below)
- Work only on files in the claim
- Pause immediately if Copilot has an overlapping claim

CLAIM TEMPLATE (one line):
[Codex] Claim | Files: <glob-or-list> | Branch: codex/<task> | Goal: <one-line> | ETA: <time> | Tests: yes/no | Blockers: <short>

HANDOFF TEMPLATE (one line):
[Codex] Handoff | Branch: codex/<task> | PR: <url> | Status: ready-for-review | Tests: <passed/pending> | Next: <tasks>

PAUSE RULE:
- If you see `Conflict` or `Pause` from Copilot, stop work immediately and do not add/commit overlapping files.
- Wait until workspace is clean ("git status" shows no uncommitted changes and no untracked conflicting files) or Copilot ACKs.

SCOPE NOTE (current):
- Codex: only touch `e2e/undo_redo.spec.ts` and `e2e/icon_picker_device_types.spec.ts` until Copilot finishes.
- Codex should include `e2e/admin_audit.spec.ts` in scope but **not** commit/harden it until Copilot signals resume.

If understood, reply with:
[Codex] ACK | I will pause and follow the claim rules.
```

---

## Where to add/update this file
- Recommended location: `docs/AGENT_COMMUNICATION.md` (this file)

---

If you want, I can also:
- enforce claim files automatically (`.agent/claims/`) or
- add a small pre-commit hook that warns on overlapping claims.

