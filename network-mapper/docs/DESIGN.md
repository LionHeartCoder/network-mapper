# DESIGN — Network Mapper

## Purpose
This project is a small, HTML-first web app to map school buildings, floorplans and network devices (switches, MDF/IDF, phones, APs, cameras), with a master geospatial map and a logical topology view. It is built to be simple to deploy (Docker) and easy to extend.

## Goals
- Provide per-building indoor floorplans with device placement and properties.
- Provide a master geospatial map for building locations.
- Inventory management via CSV import and manual creation.
- Manual, on-demand device checks (ping) and basic monitoring.
- Robust undo/redo for user actions (move, create, update, delete).

## Non-goals (MVP exclusions)
- High-frequency automated monitoring or SNMP polling.
- Full RBAC / multi-tenant access control (can be added later).

## Key Concepts
- Floorplan: image file uploaded per building; devices are placed in normalized (0..1) x/y coordinates relative to the image.
- Device: one row in the `devices` table containing `name`, `ip`, `device_type`, `x`, `y`, `floorplan_id`, `building_id`, optional `mac` and `room`.
- History: client-side undo/redo stack with server snapshots for delete/update so changes can be reversed.

## Where to start for new development
1. Read `docs/ARCHITECTURE.md` for component relationships.
2. See `frontend/js/building.js` for UI flows and `backend/app.py` for REST endpoints.
3. Run the app locally (see `docs/SETUP.md`) and use the history UI to test undo/redo behaviors.

---

This file is intended as a quick orientation for developers or an AI that is taking over the project.