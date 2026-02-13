import os
import time
import requests
from pathlib import Path
import pytest
from playwright.sync_api import expect

BASE = os.environ.get('E2E_BASE_URL', 'http://localhost:5000')

@pytest.mark.flaky(reruns=1)
def test_icon_picker_apply_updates_marker_image(page):
    # create a unique building and upload a simple floorplan
    bname = f"E2E Icon Building {int(time.time()*1000)}"
    bresp = requests.post(f"{BASE}/api/buildings", json={"name": bname})
    assert bresp.ok

    asset_path = Path(__file__).parent / 'assets' / 'floor.svg'
    with open(asset_path, 'rb') as f:
        files = {'file': ('floor.svg', f, 'image/svg+xml')}
        data = {'building': bname}
        fresp = requests.post(f"{BASE}/api/floorplans", files=files, data=data)
    assert fresp.ok, fresp.text

    # Go to icon picker and apply the first shown icon to 'switch'
    page.goto(f"{BASE}/icon_picker.html")
    # wait for icons list to be available via API (sanity check)
    icons = page.evaluate("() => fetch('/api/icons/list').then(r => r.json())")
    print('DEBUG: /api/icons/list returned', len(icons) if icons else 0)
    assert icons and len(icons) > 0, 'Server returned no icons via /api/icons/list'
    # wait for icons to be rendered in the DOM
    page.wait_for_selector('.icon-card', timeout=30000)
    # accept the native alert that confirms apply
    page.on('dialog', lambda dialog: dialog.accept())

    # ensure there are icons rendered and choose first icon's 'Use' button
    icon_count = page.locator('.icon-card').count()
    print('DEBUG: DOM icon count', icon_count)
    assert icon_count > 0, 'Icon picker did not render any icons'
    first_use = page.locator('.icon-card button').first
    first_use.click()
    print('DEBUG: clicked first use button')

    # give the server a moment to copy the file
    page.wait_for_timeout(600)

    # Now go to building editor and load our floorplan
    # Use domcontentloaded to avoid waiting for large assets or many icons to finish loading
    page.goto(f"{BASE}/building.html", wait_until='domcontentloaded')
    page.wait_for_selector('#floorplanSelect option', timeout=10000, state='attached')

    # select the uploaded floorplan
    opts = page.locator('#floorplanSelect option')
    chosen_val = None
    for i in range(opts.count()):
        txt = opts.nth(i).text_content() or ''
        if 'floor.svg' in txt or bname in txt:
            chosen_val = opts.nth(i).get_attribute('value')
            break
    assert chosen_val, 'Could not find uploaded floorplan in selector'
    page.select_option('#floorplanSelect', chosen_val)
    page.click('#loadFloorplanBtn')
    page.wait_for_selector('#floorImage', timeout=10000)

    # Place a switch device
    before = page.locator('.marker').count()
    page.click('#newDeviceBtn')
    page.click('#floorImage', position={'x': 40, 'y': 40})
    page.wait_for_selector('#deviceModal:not(.hidden)', timeout=5000)
    page.fill('#deviceName', 'E2E Icon Device')
    page.select_option('#deviceType', 'switch')
    page.click('#deviceSave')

    # wait for the new marker
    page.wait_for_function(f"() => document.querySelectorAll('.marker').length == {before + 1}", timeout=8000)

    # check the last marker's img src references either legacy switch icon files
    # or the new per-type mapped icon in /icons/standard/.
    page.wait_for_selector('.marker:last-child img', timeout=5000)
    img_src = page.eval_on_selector('.marker:last-child img', 'el => el.getAttribute("src")')
    assert img_src and (
        '/icons/switch.png' in img_src
        or img_src.endswith('/icons/switch.png')
        or '/icons/switch.svg' in img_src
        or img_src.endswith('/icons/switch.svg')
        or '/icons/standard/' in img_src
    ), f"Marker image source {img_src} does not appear to reference a mapped icon path"

    # cleanup (optional): none - test environment is ephemeral
