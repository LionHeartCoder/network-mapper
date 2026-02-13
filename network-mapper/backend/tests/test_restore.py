import pytest
import requests

BASE = 'http://localhost:5000'


def _server_has_restore():
    # quick probe to see whether the running server accepts POST to the restore
    # endpoint; skip tests if POST is not allowed or endpoint is missing.
    try:
        r = requests.post(BASE + '/api/devices/restore', json={'snapshot': {}}, timeout=2)
        # if server returns 404/405 the endpoint isn't usable in this environment
        return r.status_code not in (404, 405)
    except Exception:
        return False


def create_device(payload=None):
    payload = payload or {"name": "TRestore", "device_type": "switch", "ip": "10.0.0.99"}
    r = requests.post(BASE + '/api/devices', json=payload)
    r.raise_for_status()
    return r.json().get('id')


@pytest.mark.skipif(not _server_has_restore(), reason="server does not expose /api/devices/restore")
def test_restore_preserves_id():
    # create -> delete -> snapshot -> restore (attempt preserve id)
    did = create_device()
    r = requests.get(BASE + f'/api/devices/{did}')
    assert r.status_code == 200
    # delete and capture snapshot
    dres = requests.delete(BASE + f'/api/devices/{did}')
    assert dres.status_code == 200
    snap = dres.json().get('snapshot')
    assert snap and snap.get('id') == did

    # restore using snapshot
    r = requests.post(BASE + '/api/devices/restore', json={'snapshot': snap})
    assert r.status_code == 200
    jr = r.json()
    assert jr.get('restored') is True
    assert jr.get('id') == did
    assert jr.get('preservedId') is True

    # confirm GET returns restored device
    r2 = requests.get(BASE + f'/api/devices/{did}')
    assert r2.status_code == 200


@pytest.mark.skipif(not _server_has_restore(), reason="server does not expose /api/devices/restore")
def test_restore_falls_back_if_id_taken():
    # create -> delete -> snapshot -> restore -> attempt to restore again (id now taken)
    did = create_device({"name": "TRestore2", "device_type": "switch"})
    dres = requests.delete(BASE + f'/api/devices/{did}')
    assert dres.status_code == 200
    snap = dres.json().get('snapshot')

    # first restore should preserve id
    r = requests.post(BASE + '/api/devices/restore', json={'snapshot': snap})
    assert r.status_code == 200
    jr = r.json()
    assert jr.get('preservedId') is True
    restored_id = jr.get('id')

    # second restore attempt with the same snapshot should not be able to preserve id
    r2 = requests.post(BASE + '/api/devices/restore', json={'snapshot': snap})
    assert r2.status_code == 200
    jr2 = r2.json()
    assert jr2.get('preservedId') is False
    assert jr2.get('id') != restored_id
