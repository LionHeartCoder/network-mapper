import os
import pytest
import requests

BASE = 'http://localhost:5000'


def _server_has_restore():
    try:
        r = requests.post(BASE + '/api/devices/restore', json={'snapshot': {}}, timeout=2)
        return r.status_code not in (404, 405)
    except Exception:
        return False


def create_device(payload=None):
    payload = payload or {"name": "TAudit", "device_type": "switch", "ip": "10.0.0.99"}
    r = requests.post(BASE + '/api/devices', json=payload)
    r.raise_for_status()
    return r.json().get('id')


@pytest.mark.skipif(os.environ.get('ADMIN_TOKEN') is None, reason="ADMIN_TOKEN not set")
@pytest.mark.skipif(not _server_has_restore(), reason="server does not expose /api/devices/restore")
def test_restore_writes_audit_entry():
    # create -> delete -> restore -> assert audit endpoint contains an entry
    did = create_device()
    dres = requests.delete(BASE + f'/api/devices/{did}')
    assert dres.status_code == 200
    snap = dres.json().get('snapshot')
    assert snap and snap.get('id') == did

    r = requests.post(BASE + '/api/devices/restore', json={'snapshot': snap})
    assert r.status_code == 200

    token = os.environ.get('ADMIN_TOKEN')
    headers = {'X-Admin-Token': token}
    ar = requests.get(BASE + '/api/admin/audit', headers=headers)
    assert ar.status_code == 200
    entries = ar.json()
    assert isinstance(entries, list)
    assert any(e.get('action') == 'restore' and e.get('restoredId') == did for e in entries)
