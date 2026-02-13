# BACKEND — architecture & dev notes

## Key files
- `backend/app.py` — main Flask application and route handlers.
- `backend/models.py` — SQLAlchemy models: `Building`, `Floorplan`, `Device`.
- `backend/uploads/` — folder for floorplan images served by `/uploads/<filename>`.

## Models (summary)
- Building: `id`, `name`, `lat`, `lon`
- Floorplan: `id`, `building_id`, `filename`, `width`, `height`
- Device: `id`, `name`, `ip`, `device_type`, `building_id`, `floorplan_id`, `x`, `y`, `note`, `mac`, `room`

## DB & migrations
- Currently uses SQLite and `Base.metadata.create_all(engine)` for schema creation.
- For production or schema evolution, add Alembic and a migration pipeline.

## Endpoint guidelines
- Keep endpoints RESTful (use appropriate HTTP verbs).
- Write idempotent updates where possible (PUT for replacing/updating object properties).
- For destructive operations (DELETE), return a snapshot in the response to support client undo.

## Session handling
- App uses `SessionLocal = sessionmaker(bind=engine)` per request.
- Ensure `session.close()` is called on all branches to avoid leaking connections.

## Adding new features
- Add model fields in `models.py` and create Alembic migration.
- Add tests in `tests/backend/test_<feature>.py` (see `docs/TESTING.md`).
- Update `docs/API.md` to reflect new endpoints or changed payloads.

## Example: add a simple endpoint
```py
@app.route('/api/thing', methods=['GET'])
def thing():
    session = SessionLocal()
    items = session.query(Thing).all()
    session.close()
    return jsonify([serialize(i) for i in items])
```

---
Keep server logic simple and predictable — prefer returning `prev` snapshots on updates and `snapshot` on deletes to help client undo/redo.