# CHANGELOG

All notable changes to this project are documented here.

## Unreleased
- Added history/undo/redo client logic and wired server snapshots for delete/update.
- Added `mac` and `room` fields to `Device` model.
- Improved validation for IP and MAC formats in the device modal.
- Removed duplicate CSV-import block in `backend/app.py` and added pytest coverage for CSV import and admin cleanup endpoints.
- Added server-side restore endpoint `POST /api/devices/restore` (preserve ID on undo when possible) and tests for restore semantics.

## v0.1.0 — Initial scaffold
- Project scaffolded with Flask backend and static frontend.
- Implemented endpoints: health, ping, buildings, floorplans (upload), devices (CRUD), devices/import (CSV).
- Implemented frontend: master map, building editor, device placement and drag, modal property editing, CSV import.

## Known issues / TODO
- History/undo logic needs complete test coverage and some cleanup: old ad-hoc undo handlers were refactored but careful verification is required.
- Deleting/restoring devices currently creates a new DB id when restored (acceptable for now but may need server-side restore to preserve ids).

---

When releasing updates, add a new section with the version and brief notes.