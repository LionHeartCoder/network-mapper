Developer coordination & parallel-work guide

Purpose
- Short guide for coordinating parallel work by multiple agents or developers (human, Codex, Copilot).
- Prevents overlap on the same files and clarifies ownership for features like undo/redo, tests, and e2e.

Branching & PR rules
- Branch naming:
  - Agent Copilot (server/feature work): `copilot/<short-task>`
  - Agent Codex (tests & e2e): `codex/<short-task>`
  - Human contributors: `feature/<short-task>` or `fix/<short-bug>`
- Open small PRs and reference the complementary PR if agents are working in parallel.

File ownership & non‑interference
- Copilot (GitHub Copilot):
  - Backend endpoints and core server logic (`backend/*.py`, DB schema changes).
  - Server-side features that require DB or API contracts (e.g., `POST /api/devices/restore`).
  - Integration tests that validate server behavior.
- Codex (your automated test/e2e agent):
  - Add/extend pytest backend tests under `backend/tests/` (non-breaking, additive).
  - Add Playwright e2e specs under `e2e/` (UI-driven flows: create → undo → redo, CSV import UI).
  - Small frontend tidy: comments and exported helpers used by tests (but do not change undo/restore logic).
- Shared files (coordinate before changes): `frontend/js/building.js`, `docs/*`, CI workflows.
  - If either agent needs to change shared files, open an issue and coordinate branches.

CI & testing responsibilities
- Codex: implement Playwright tests and CI job that runs `npx playwright test` (headless) on PRs.
- Copilot: ensure backend tests cover new endpoints and keep API docs updated.
- PRs must pass both pytest and Playwright in CI before merging.

Quick coordination checklist (for PR authors)
1. Ensure your branch name follows the conventions above.
2. Run `pytest -q` and (if applicable) `npx playwright test` locally.
3. Add tests or docs for any changed behavior.
4. Add `@copilot` and `@codex` in PR description to request cross-agent review.
5. If editing `frontend/js/building.js`, coordinate in an issue to avoid merge conflicts.

How to run locally
- Backend tests: `pytest -q`
- Playwright e2e: `npx playwright install && npx playwright test`
- Start service: `docker compose up -d --build`

Notes
- Keep commits small and focused; prefer adding tests first when changing behavior.
- Use `E2E` prefixes for test data (buildings/devices) so `api/admin/cleanup-tests` can remove them safely.

