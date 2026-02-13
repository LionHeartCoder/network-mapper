# FRONTEND: structure & developer notes

## Files of interest
- `frontend/index.html` — small navigation page
- `frontend/master.html` & `frontend/js/master.js` — master Leaflet map and building markers
- `frontend/building.html` & `frontend/js/building.js` — main building editor and device logic
- `frontend/style.css` — central styling

## Key UI flows
- Device placement: click floorplan -> open modal -> POST `/api/devices` -> add marker
- Drag to move: pointer events update marker positions; on pointerup a PUT is sent to save {x,y}
- Properties panel: edit simple fields (name, type, note) and Delete from panel
- Validation: client-side IP/MAC checks live in `building.js`

## History / Undo/Redo
- Implemented in `building.js` via `undoStack` and `redoStack`.
- Use `pushHistory({type, id, prev?, next?, payload?, snapshot?, ts})` to register actions.
- Use `performUndo()` and `performRedo()` to operate on stacks and call server endpoints as needed.

## Tips for UI changes
- Markers are simple `div.marker` elements placed inside `#floorWrap` using percentages.
- Coordinates are normalized between 0..1 so they are layout and size independent.
- When restoring a deleted device, a new DB row is created. Update any client references (selectors use `data-id`).

## Adding new device types
- Add the button to the `#palette` in `building.html` and extend the UI logic in `building.js` if custom behavior is needed.

## Testing UI changes
- Manual testing using browser developer tools and the History panel is recommended before writing automation.

---

If you refactor JS files, keep `pushHistory`/`performUndo`/`performRedo` semantics intact so the History UI continues to work.