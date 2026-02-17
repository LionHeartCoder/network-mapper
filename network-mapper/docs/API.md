# API Reference

Base URL: `/`

## Health
- GET `/api/health`
- Response: `{ "status": "ok", "pingBinary": true|false }`

## Ping
- GET `/api/ping?ip=<target>`
- Response: `{ "success": true|false, "time": <ms|null>, "error": <string|null> }`

## Buildings
- GET `/api/buildings` — list buildings
- POST `/api/buildings` — create building
  - Body: `{ "name": "Building A", "lat": 12.345, "lon": 67.890 }`
  - Response: `{ "id": 1 }`

## Floorplans
- GET `/api/floorplans` — list floorplans
- POST `/api/floorplans` — upload, multipart form fields: `file`, `building`
  - Response: `{ "id": 2, "filename": "site-floor-1.png" }`

## Devices
- GET `/api/devices` — list all devices
- GET `/api/devices/<id>` — get single device (used for snapshotting before delete)
- POST `/api/devices` — create device
  - Body: `{ "name": "Switch 1", "device_type": "switch", "ip": "10.0.0.2", "floorplan_id": 3, "x": 0.4, "y": 0.6, "mac": "00:11:22:33:44:55", "room": "Room 101" }`
  - Response: `{ "id": 123 }`
- PUT `/api/devices/<id>` — update device; returns `{ "status": "updated", "prev": {...} }` where `prev` contains previous field values (used for undo)
- DELETE `/api/devices/<id>` — delete device; returns `{ "status": "deleted", "snapshot": {...} }` where `snapshot` contains the deleted row (used for undo)
- POST `/api/devices/restore` — restore a previously-snapshotted device. Accepts JSON body: `{ "snapshot": { ... } }`. The server will attempt to preserve the original `id` when possible; response: `{ "restored": true, "id": <id>, "preservedId": true|false }`.

## CSV Import
- POST `/api/devices/import` — `multipart/form-data` file field `file` with CSV; returns `{ "created": N }`

## Admin
- GET `/api/admin/audit` — returns recent audit entries for restore actions. Requires header `X-Admin-Token: <ADMIN_TOKEN>`; response is an array of JSON objects: `{ id, action, timestamp, requestedId, restoredId, preservedId, detail }`.
- POST `/api/admin/audit/cleanup` — remove old audit rows. Requires header `X-Admin-Token: <ADMIN_TOKEN>`.
  - Parameters (query or JSON body):
    - `before` — ISO timestamp (e.g. `2026-02-17T12:00:00Z`). Deletes audit entries with `timestamp < before`.
    - `days` — integer number of days (e.g. `30`) — deletes entries older than `now - days`.
    - If neither `before` nor `days` is provided, the server defaults to removing entries older than **90 days**.
  - Response: `{ "removed": <number> }` on success.
  - Errors: `403` for unauthorized; `500` for cleanup failures.

---

If you add endpoints, please update this doc and add tests in `docs/TESTING.md`.