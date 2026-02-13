import os
import time
import requests


BASE = os.environ.get("E2E_BASE_URL", "http://localhost:5000")


def test_import_csv_with_missing_extra_and_duplicate_rows():
    unique = int(time.time() * 1000)
    csv_data = (
        "name,type,building,extra\n"
        f"E2E-imp-{unique}-a,switch,E2E Import Building {unique},x\n"
        f"E2E-imp-{unique}-a,switch,E2E Import Building {unique},duplicate\n"
        f"E2E-imp-{unique}-b,camera,E2E Import Building {unique},missing-ip-column\n"
    )

    r = requests.post(
        f"{BASE}/api/devices/import",
        files={"file": ("edgecases.csv", csv_data, "text/csv")},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert isinstance(j.get("created"), int)
    # Current API creates one row per CSV line and tolerates missing/extra columns.
    assert j["created"] == 3


def test_import_csv_with_minimal_columns_does_not_crash():
    csv_data = "name\nOnlyNameDevice\n"
    r = requests.post(
        f"{BASE}/api/devices/import",
        files={"file": ("minimal.csv", csv_data, "text/csv")},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("created") == 1


def test_import_requires_file():
    r = requests.post(f"{BASE}/api/devices/import", timeout=10)
    assert r.status_code == 400
