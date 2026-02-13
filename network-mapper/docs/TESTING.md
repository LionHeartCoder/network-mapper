# TESTING PLAN

## Goals
- Ensure backend endpoints behave correctly (including `prev`/`snapshot` semantics used for undo).
- Ensure UI history (create/move/update/delete) is reversible via undo/redo.
- Prevent regressions when refactoring `building.js` or server endpoints.

## Recommended frameworks
- Backend: `pytest` + `pytest-flask` or `requests` for integration tests.
- Frontend: Playwright or Cypress for e2e tests (exercise the UI: create -> undo -> redo flows).

## Test ideas
- API tests:
  - POST `/api/devices` → assert created id and record exists.
  - PUT `/api/devices/<id>` → assert `prev` is returned and DB updated.
  - DELETE `/api/devices/<id>` → assert `snapshot` returned and DB row removed.
  - POST `/api/devices/import` → verify CSV import returns `created` count and new devices appear in `/api/devices`.
  - `POST /api/admin/cleanup-tests` → assert unauthorized (403) when no or invalid `ADMIN_TOKEN` is provided.
  - `GET /api/admin/audit` → verify audit entries for restore actions are returned when `X-Admin-Token` is provided.
- UI e2e tests:
  - Create device on floorplan, confirm marker present, call Undo and confirm marker removed, call Redo and confirm marker present.
  - Move device, Undo, Redo and confirm positions revert/reapply.
  - Edit properties, Undo, Redo and confirm values revert/reapply.
  - Create -> delete -> undo using History panel and confirm marker returns.
  - CSV import through UI and confirm device table count increases.

## Current test files
- `backend/tests/test_devices_history.py`
  - Verifies create/update/delete snapshots and documented recreate-via-snapshot behavior.
- `backend/tests/test_import_edgecases.py`
  - Verifies CSV import tolerates missing/extra columns and duplicate rows without server crash.
- `backend/tests/test_audit.py`
  - Verifies `/api/devices/restore` produces an audit entry and `/api/admin/audit` returns it (requires `ADMIN_TOKEN`).
- `e2e/undo_redo.spec.ts`
  - Playwright suite for create/delete/undo/redo, move/undo/redo, multi-create history race guard, CSV import UI flow, bulk CSV import, and icon-refresh helper invocation.
- `e2e/icon_picker_device_types.spec.ts`
  - Playwright suite for home-page icon-picker navigation, short icon label rendering, custom device type add/remove, and mapped-icon usage in the building editor.

## Running tests (proposed)
- Add `tests/backend/` and `tests/e2e/` directories.
- Example python run:
  ```bash
  pytest -q
  ```
- Playwright (if used): `npx playwright test`

## Local playback steps
1. Start app:
   ```bash
   docker compose up -d --build
   ```
2. Run backend + Python e2e:
   ```bash
   pytest -q
   ```
3. Run TypeScript Playwright suite:
   ```bash
   npx playwright install
   npx playwright test
   ```
4. Optional cleanup endpoint test support:
   - Set `ADMIN_TOKEN` in environment (compose includes `test-admin-token` for local/CI test use).
   - E2E fixtures use building/device names prefixed with `E2E`.

## CI
- Add GitHub Actions (or equivalent) to run backend tests and a minimal headless UI test suite on PRs.

---
Prioritize tests for history/undo/redo actions and the API snapshots to ensure no regressions.
