import json


def test_create_and_list_device(client):
    payload = {"name": "Test Switch", "device_type": "switch", "ip": "10.0.0.5", "x": 0.3, "y": 0.4}
    r = client.post('/api/devices', data=json.dumps(payload), content_type='application/json')
    assert r.status_code == 200
    j = r.get_json()
    assert 'id' in j
    device_id = j['id']

    r2 = client.get('/api/devices')
    assert r2.status_code == 200
    devs = r2.get_json()
    assert any(d['id'] == device_id for d in devs)


def test_update_returns_prev(client):
    # create device
    payload = {"name": "ToUpdate", "device_type": "ap"}
    r = client.post('/api/devices', data=json.dumps(payload), content_type='application/json')
    device_id = r.get_json()['id']
    # update
    new = {"name": "Updated", "device_type": "ap"}
    r2 = client.put(f'/api/devices/{device_id}', data=json.dumps(new), content_type='application/json')
    assert r2.status_code == 200
    jr = r2.get_json()
    assert 'prev' in jr
    assert jr['prev']['name'] == 'ToUpdate'


def test_delete_returns_snapshot(client):
    payload = {"name": "ToDelete", "device_type": "phone"}
    r = client.post('/api/devices', data=json.dumps(payload), content_type='application/json')
    device_id = r.get_json()['id']
    r2 = client.delete(f'/api/devices/{device_id}')
    assert r2.status_code == 200
    jr = r2.get_json()
    assert jr.get('status') == 'deleted'
    assert 'snapshot' in jr
    assert jr['snapshot']['name'] == 'ToDelete'
