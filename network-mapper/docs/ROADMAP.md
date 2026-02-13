# ROADMAP & PRIORITIES

## High priority (next sprint)
- Finish and harden Undo/Redo semantics:
  - Ensure all actions (create, update, move, delete) are fully instrumented with snapshots.
  - Add automated tests that exercise create → undo → redo flows.
  - Consider server-side restore endpoint to preserve original IDs when undoing deletes (optional).
- Add automated tests for backend endpoints (pytest) and basic e2e tests (Playwright/Cypress).

## Medium priority
- Logical topology view (Cytoscape / vis.js) to show network connections between devices.
- Master geospatial map improvements (bulk import, better building icons, clustering).
- Role-based access control and authentication (JWT/session-based) for multi-user environments.

## Long term
- Persistent, server-side history + audit log (optionally per-user)
- Integrate monitoring (SNMP, syslog) for status updates and alerts
- Sync with CMDB or external inventory sources

## Ideas / Nice-to-have
- Export floorplan annotations (PDF/PNG), printable reports
- Mobile-friendly UI for quick walk-through inventory updates

Prioritize test coverage and undo robustness before adding new major features.