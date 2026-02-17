import os
import pytest
import requests
from datetime import datetime, timedelta

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


@pytest.mark.skipif(os.environ.get('ADMIN_TOKEN') is None, reason="ADMIN_TOKEN not set")
@pytest.mark.skipif(not _server_has_restore(), reason="server does not expose /api/devices/restore")
def test_admin_audit_cleanup():
    # create -> delete -> restore to generate an audit entry, then remove it via cleanup
    did = create_device()
    dres = requests.delete(BASE + f'/api/devices/{did}')
    assert dres.status_code == 200
    snap = dres.json().get('snapshot')
    assert snap and snap.get('id') == did

    r = requests.post(BASE + '/api/devices/restore', json={'snapshot': snap})
    assert r.status_code == 200

    token = os.environ.get('ADMIN_TOKEN')
    headers = {'X-Admin-Token': token}

    # locate the restore audit entry we just created
    ar = requests.get(BASE + '/api/admin/audit', headers=headers)
    assert ar.status_code == 200
    entries = ar.json()
    matching = [e for e in entries if e.get('action') == 'restore' and e.get('restoredId') == did]
    assert matching, "expected restore audit entry for restored device"
    ts = matching[0].get('timestamp')

    # set cutoff to 1 second after the found entry so it will be removed
    cutoff_dt = datetime.fromisoformat(ts.replace('Z', '+00:00')) + timedelta(seconds=1)
    cutoff = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%SZ')

    cr = requests.post(BASE + '/api/admin/audit/cleanup', headers=headers, json={'before': cutoff})
    assert cr.status_code == 200
    resp = cr.json()
    assert isinstance(resp.get('removed'), int)
    assert resp.get('removed') >= 1

    # confirm the specific entry is no longer present
    ar2 = requests.get(BASE + '/api/admin/audit', headers=headers)
    assert ar2.status_code == 200
    entries2 = ar2.json()
    assert not any(e.get('action') == 'restore' and e.get('restoredId') == did for e in entries2)
