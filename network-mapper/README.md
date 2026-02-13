# Network Mapper

A small, HTML-first web app to map school buildings, floorplans and network devices (switches, MDF/IDF, phones, APs, cameras). Dockerized Flask backend (SQLite) + static frontend.

## Quick start (Docker)
1. Build and start the service:

   docker compose build
   docker compose up -d

2. Open the app:

   http://localhost:5000

## Useful docs
All core documentation is in `docs/`:
- `docs/DESIGN.md` — Project goals and high-level design
- `docs/ARCHITECTURE.md` — System architecture and dataflow
- `docs/SETUP.md` — Setup & running instructions
- `docs/API.md` — REST API reference
- `docs/FRONTEND.md` — Frontend dev notes
- `docs/BACKEND.md` — Backend dev notes
- `docs/TESTING.md` — Testing plan
- `docs/ROADMAP.md` — Roadmap & priorities
- `docs/CONTRIBUTING.md` — How to contribute

## API (quick reference)
- `GET /api/health`
- `GET /api/buildings` / `POST /api/buildings`
- `GET /api/floorplans` / `POST /api/floorplans` (multipart upload)
- `GET /api/devices` / `POST /api/devices` / `GET|PUT|DELETE /api/devices/<id>`
- `POST /api/devices/import` (CSV file upload)

## Notes for developers
- Frontend: `frontend/` (static HTML + `frontend/js/*.js`)
- Backend: `backend/app.py`, `backend/models.py`
- Undo/Redo: client-side history (see `frontend/js/building.js`) backed by server snapshots on update/delete

## Next recommended steps
1. Add tests (pytest for backend, Playwright/Cypress for e2e) — see `docs/TESTING.md`. The backend test suite now includes CSV import and admin cleanup auth checks.
2. Optionally add a server-side restore endpoint to preserve original IDs on undo (see `docs/ROADMAP.md`).

## License
Add a `LICENSE` file if you wish to publish; I can add MIT by default if you want.
