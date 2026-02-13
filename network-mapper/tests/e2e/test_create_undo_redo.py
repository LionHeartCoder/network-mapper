import os
import time
import requests
from pathlib import Path
import pytest
from playwright.sync_api import expect

BASE = os.environ.get('E2E_BASE_URL', 'http://localhost:5000')

@pytest.mark.flaky(reruns=1)
def test_create_move_update_and_undo_redo(page):
    # Use a unique building name to avoid collisions
    bname = f"E2E Building {int(time.time()*1000)}"
    bresp = requests.post(f"{BASE}/api/buildings", json={"name": bname})
    assert bresp.ok

    # Upload floorplan asset
    asset_path = Path(__file__).parent / 'assets' / 'floor.svg'
    with open(asset_path, 'rb') as f:
        files = {'file': ('floor.svg', f, 'image/svg+xml')}
        data = {'building': bname}
        fresp = requests.post(f"{BASE}/api/floorplans", files=files, data=data)
    assert fresp.ok, fresp.text

    # Navigate to building editor
    page.goto(f"{BASE}/building.html")

    # Wait for floorplans to appear and select the one we uploaded
    page.wait_for_selector('#floorplanSelect option', timeout=10000, state='attached')
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

    # Wait for floor image to render fully
    page.wait_for_selector('#floorImage', timeout=10000)

    # Count existing markers (if any)
    before_count = page.locator('.marker').count()

    # Start placement flow and place a device
    page.click('#newDeviceBtn')
    page.click('#floorImage', position={'x': 40, 'y': 40})

    # Fill out modal and wait until Save is enabled
    page.wait_for_selector('#deviceModal:not(.hidden)', timeout=5000)
    page.fill('#deviceName', 'E2E Device')
    page.select_option('#deviceType', 'switch')
    save_btn = page.locator('#deviceSave')
    expect(save_btn).to_be_enabled(timeout=2000)
    save_btn.click()

    # Wait for a new marker to appear
    page.wait_for_function(f"() => document.querySelectorAll('.marker').length == {before_count + 1}", timeout=8000)
    assert page.locator('.marker').count() == before_count + 1

    # Locate the newly added marker
    num_markers = page.locator('.marker').count()
    marker = page.locator('.marker').nth(num_markers - 1)

    # --- MOVE flow: drag marker to a new position and undo/redo ---
    before_style = page.eval_on_selector('.marker:last-child', 'el => el.style.left + " " + el.style.top')
    bbox = marker.bounding_box()
    assert bbox is not None
    x0 = bbox['x'] + bbox['width'] / 2
    y0 = bbox['y'] + bbox['height'] / 2
    x1 = x0 + 60
    y1 = y0 + 40
    # perform drag
    page.mouse.move(x0, y0)
    page.mouse.down()
    page.mouse.move(x1, y1, steps=8)
    page.mouse.up()

    # wait for style to change
    page.wait_for_function('() => document.querySelectorAll(\'.marker\').length && document.querySelector(\'.marker:last-child\').style.left != "%s"' % before_style, timeout=8000)
    after_style = page.eval_on_selector('.marker:last-child', 'el => el.style.left + " " + el.style.top')
    assert after_style != before_style

    # Undo move
    page.locator('#histUndo').click()
    page.wait_for_function('() => document.querySelector(\'.marker:last-child\').style.left + " " + document.querySelector(\'.marker:last-child\').style.top == "%s"' % before_style, timeout=8000)
    undone_style = page.eval_on_selector('.marker:last-child', 'el => el.style.left + " " + el.style.top')
    assert undone_style == before_style

    # Redo move
    page.locator('#histRedo').click()
    page.wait_for_function('() => document.querySelector(\'.marker:last-child\').style.left + " " + document.querySelector(\'.marker:last-child\').style.top != "%s"' % before_style, timeout=8000)
    redone_style = page.eval_on_selector('.marker:last-child', 'el => el.style.left + " " + el.style.top')
    assert redone_style != before_style

    # --- UPDATE flow: edit device name via props panel and undo/redo ---
    prev_title = page.get_attribute('.marker:last-child', 'title')
    # open props panel by clicking marker
    marker.click()
    page.wait_for_selector('#propsPanel:not(.hidden)', timeout=4000)
    page.click('#propEdit')
    page.wait_for_selector('#deviceModal:not(.hidden)', timeout=4000)

    # change name and save
    page.fill('#deviceName', 'E2E Device Updated')
    page.click('#deviceSave')

    # wait for marker title to update
    page.wait_for_function("() => document.querySelector('.marker:last-child').title === 'E2E Device Updated'", timeout=8000)
    updated_title = page.get_attribute('.marker:last-child', 'title')
    assert updated_title == 'E2E Device Updated'

    # Undo update
    page.locator('#histUndo').click()
    page.wait_for_function("() => document.querySelector('.marker:last-child').title === '%s'" % prev_title, timeout=8000)
    undone_title = page.get_attribute('.marker:last-child', 'title')
    assert undone_title == prev_title

    # Redo update
    page.locator('#histRedo').click()
    page.wait_for_function("() => document.querySelector('.marker:last-child').title === 'E2E Device Updated'", timeout=8000)
    redone_title = page.get_attribute('.marker:last-child', 'title')
    assert redone_title == 'E2E Device Updated'
