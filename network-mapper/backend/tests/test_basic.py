import requests

BASE='http://localhost:5000'

def test_health():
    r = requests.get(BASE + '/api/health')
    assert r.status_code == 200
    assert 'status' in r.json()


def test_import_devices_csv():
    csv_data = "name,ip,type,building\nTestSwitch,10.0.0.5,switch,TestBuilding\n"
    files = {'file': ('devices.csv', csv_data)}
    r = requests.post(BASE + '/api/devices/import', files=files)
    assert r.status_code == 200
    created = r.json().get('created')
    assert isinstance(created, int)
    assert created >= 1


def test_admin_cleanup_unauthorized():
    r = requests.post(BASE + '/api/admin/cleanup-tests')
    assert r.status_code == 403


def test_admin_cleanup_invalid_token():
    headers = {'X-Admin-Token': 'wrong-token'}
    r = requests.post(BASE + '/api/admin/cleanup-tests', headers=headers)
    assert r.status_code == 403
