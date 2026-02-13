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


@pytest.mark.skipif(os.environ.get('ADMIN_TOKEN') is None, reason='ADMIN_TOKEN not set')
@pytest.mark.skipif(not _server_has_restore(), reason='server does not expose /api/devices/restore')
def test_restore_writes_audit_entry():
    # create device
    r = requests.post(BASE + '/api/devices', json={"name": "TAudit", "device_type": "switch", "ip": "10.0.0.99"})
    assert r.status_code == 200
    did = r.json().get('id')
    assert did

    # delete -> snapshot
    dres = requests.delete(BASE + f'/api/devices/{did}')
    assert dres.status_code == 200
    snap = dres.json().get('snapshot')
    assert snap and snap.get('id') == did

    # restore
    r2 = requests.post(BASE + '/api/devices/restore', json={'snapshot': snap})
    assert r2.status_code == 200

    # audit endpoint
    token = os.environ.get('ADMIN_TOKEN')
    headers = {'X-Admin-Token': token}
    ar = requests.get(BASE + '/api/admin/audit', headers=headers)
    assert ar.status_code == 200
    entries = ar.json()
    assert isinstance(entries, list)
    assert any(e.get('action') == 'restore' and (e.get('restoredId') == did or e.get('requestedId') == did) for e in entries)
