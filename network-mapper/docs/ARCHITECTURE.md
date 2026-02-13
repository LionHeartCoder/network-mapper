# ARCHITECTURE

## Overview
- Backend: Flask app (`backend/app.py`) with SQLite (SQLAlchemy) for persistence.
- Frontend: Static HTML/CSS/vanilla JS in `frontend/` (no build step required).
- Packaging: `Dockerfile` + `docker-compose.yml` for local and containerized deployments.

## Components
- API Layer (`backend/app.py`)
  - Endpoints for buildings, floorplans (upload), devices (CRUD + import), health and ping.
  - Uses SQLAlchemy models in `backend/models.py`.
- Storage
  - SQLite DB (default `sqlite:///network-mapper.db` in environment; in Docker mounts it's persisted in container's `/tmp` for dev).
  - Uploaded floorplans saved to `backend/uploads/` (served at `/uploads/<filename>`).
- UI
  - `frontend/master.html` — Leaflet master map showing building markers.
  - `frontend/building.html` — building editor for floorplans and placing devices.
  - `frontend/js/building.js` — core interaction logic (placement, drag, create/edit modal, history stack).

## Dataflow examples
- Create device
  - User places marker -> open modal -> POST /api/devices -> server saves -> UI adds marker and pushHistory({type:'create', id, payload})
- Move device
  - On drag release -> PUT /api/devices/<id> (x,y) -> pushHistory({type:'move', id, prev, next})
- Delete device
  - Client GET /api/devices/<id> to snapshot -> DELETE /api/devices/<id> -> pushHistory({type:'delete', id, snapshot})

## Undo/Redo
- Performed in `frontend/js/building.js` via `undoStack` and `redoStack`.
- Actions contain `type` and either `prev`/`next` or `snapshot` (for delete).
- Undo/Redo interactions may create new DB rows when restoring deletes (new id) — see `docs/ROADMAP.md` for plan to preserve IDs if desired.

## Notes
- The implementation is intentionally simple and synchronous for most UI interactions — useful for an MVP and easy to reason about.
- If you need to add transactional or cross-request consistency, add server-side locks or persistent history.