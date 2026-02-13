import os
import time
import requests


BASE = os.environ.get("E2E_BASE_URL", "http://localhost:5000")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "test-admin-token")


def _cleanup_e2e_artifacts():
    # Best-effort cleanup; endpoint may be disabled outside test docker env.
    requests.post(
        f"{BASE}/api/admin/cleanup-tests",
        headers={"X-Admin-Token": ADMIN_TOKEN},
        timeout=10,
    )


def test_devices_update_delete_and_snapshot_recreate_flow():
    _cleanup_e2e_artifacts()
    unique = int(time.time() * 1000)

    create_payload = {
        "name": f"E2E History Device {unique}",
        "device_type": "switch",
        "ip": "10.99.0.10",
        "x": 0.31,
        "y": 0.42,
        "note": "before",
        "mac": "00:11:22:33:44:55",
        "room": "Lab-A",
    }

    r_create = requests.post(f"{BASE}/api/devices", json=create_payload, timeout=10)
    assert r_create.status_code == 200, r_create.text
    create_json = r_create.json()
    assert "id" in create_json
    device_id = create_json["id"]

    update_payload = {
        "name": f"E2E History Device Updated {unique}",
        "note": "after",
        "x": 0.11,
        "y": 0.22,
    }
    r_update = requests.put(
        f"{BASE}/api/devices/{device_id}", json=update_payload, timeout=10
    )
    assert r_update.status_code == 200, r_update.text
    update_json = r_update.json()
    assert "prev" in update_json
    assert update_json["prev"]["name"] == create_payload["name"]
    assert update_json["prev"]["note"] == create_payload["note"]

    r_delete = requests.delete(f"{BASE}/api/devices/{device_id}", timeout=10)
    assert r_delete.status_code == 200, r_delete.text
    delete_json = r_delete.json()
    assert delete_json.get("status") == "deleted"
    assert "snapshot" in delete_json
    snapshot = delete_json["snapshot"]
    assert snapshot["id"] == device_id
    assert snapshot["name"] == update_payload["name"]

    r_get_deleted = requests.get(f"{BASE}/api/devices/{device_id}", timeout=10)
    assert r_get_deleted.status_code == 404

    # Undo behavior today recreates via POST /api/devices from snapshot and gets a new id.
    recreate_payload = {
        "name": snapshot["name"],
        "device_type": snapshot["device_type"],
        "ip": snapshot["ip"],
        "building_id": snapshot["building_id"],
        "floorplan_id": snapshot["floorplan_id"],
        "x": snapshot["x"],
        "y": snapshot["y"],
        "note": snapshot["note"],
        "mac": snapshot.get("mac"),
        "room": snapshot.get("room"),
    }
    r_recreate = requests.post(f"{BASE}/api/devices", json=recreate_payload, timeout=10)
    assert r_recreate.status_code == 200, r_recreate.text
    recreated_id = r_recreate.json()["id"]
    # DB behavior differs between backends — accept either a new id or reuse of the
    # deleted id (SQLite may reuse autoincrement values). The important check is
    # that a device with `recreated_id` exists and has the expected name.
    assert recreated_id is not None

    r_list = requests.get(f"{BASE}/api/devices", timeout=10)
    assert r_list.status_code == 200
    devices = r_list.json()
    assert any(d["id"] == recreated_id and d["name"] == snapshot["name"] for d in devices)
