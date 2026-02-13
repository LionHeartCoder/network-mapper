import fs from 'node:fs';
import path from 'node:path';
import { expect, test, APIRequestContext, Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

// small retry helper to make API interactions more tolerant to transient errors
async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 250): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function cleanupE2E(request: APIRequestContext): Promise<void> {
  await retry(async () => {
    const res = await request.post(`${BASE}/api/admin/cleanup-tests`, {
      headers: { 'X-Admin-Token': ADMIN_TOKEN },
    });
    if (res.status() !== 200 && res.status() !== 403) {
      throw new Error(`Unexpected cleanup status: ${res.status()}`);
    }
    return res;
  }, 3, 300);
}

async function createFloorplanFixture(
  request: APIRequestContext,
  buildingName: string
): Promise<void> {
  await retry(async () => {
    const bRes = await request.post(`${BASE}/api/buildings`, {
      data: { name: buildingName },
    });
    if (!bRes.ok()) throw new Error('create building failed');

    const floorAsset = path.resolve(process.cwd(), 'tests/e2e/assets/floor.svg');
    const floorBuffer = fs.readFileSync(floorAsset);

    const fpRes = await request.post(`${BASE}/api/floorplans`, {
      multipart: {
        building: buildingName,
        file: {
          name: 'floor.svg',
          mimeType: 'image/svg+xml',
          buffer: floorBuffer,
        },
      },
    });
    if (!fpRes.ok()) throw new Error('upload floorplan failed');
    return fpRes;
  }, 3, 300);
} 

async function loadBuildingFloorplan(page: Page, buildingName: string): Promise<void> {
  await page.goto(`${BASE}/building.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#floorplanSelect option', { timeout: 15_000, state: 'attached' });

  const options = page.locator('#floorplanSelect option');
  const count = await options.count();
  let selectedValue: string | null = null;
  for (let i = 0; i < count; i += 1) {
    const text = (await options.nth(i).textContent()) || '';
    if (text.includes(buildingName) || text.includes('floor.svg')) {
      selectedValue = await options.nth(i).getAttribute('value');
      break;
    }
  }

  expect(selectedValue).toBeTruthy();
  await page.selectOption('#floorplanSelect', selectedValue as string);
  await page.click('#loadFloorplanBtn');
  await expect(page.locator('#floorImage')).toBeVisible();
}

async function createDeviceMarker(
  page: Page,
  name: string,
  type = 'switch',
  position: { x: number; y: number } = { x: 60, y: 60 }
): Promise<number> {
  const before = await page.locator('.marker').count();
  await page.click('#newDeviceBtn');
  await page.click('#floorImage', { position, force: true });
  await expect(page.locator('#deviceModal:not(.hidden)')).toBeVisible();
  await page.fill('#deviceName', name);
  await page.selectOption('#deviceType', type);
  await page.click('#deviceSave');
  await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, before + 1);
  return before + 1;
}

async function visibleDeviceRows(page: Page): Promise<number> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#devices tbody tr'));
    return rows.filter((r) => {
      const text = r.textContent || '';
      return !text.includes('Loading') && !text.includes('No devices');
    }).length;
  });
}

async function waitForMarkerCount(page: Page, expected: number): Promise<void> {
  await page.waitForFunction(
    (target) => document.querySelectorAll('.marker').length === target,
    expected
  );
}

async function markerSnapshotById(page: Page, markerId: string): Promise<{
  left: string;
  top: string;
  title: string;
  type: string;
}> {
  return page.$eval(`.marker[data-id="${markerId}"]`, (el) => {
    const node = el as HTMLElement;
    return {
      left: node.style.left,
      top: node.style.top,
      title: node.title || '',
      type: node.getAttribute('data-type') || '',
    };
  });
}

async function dragMarkerBy(page: Page, markerSelector: string, dx: number, dy: number): Promise<void> {
  const marker = page.locator(markerSelector).first();
  const box = await marker.boundingBox();
  expect(box).toBeTruthy();
  const startX = (box as { x: number; width: number }).x + (box as { width: number }).width / 2;
  const startY = (box as { y: number; height: number }).y + (box as { height: number }).height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 8 });
  await page.mouse.up();
}

test.describe('Undo/Redo + Import E2E', () => {
  test.beforeEach(async ({ request }) => {
    await cleanupE2E(request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupE2E(request);
  });

  test('create -> delete -> undo -> redo (via UI history)', async ({ page, request }) => {
    const buildingName = `E2E-Undo-Delete-${Date.now()}`;
    await createFloorplanFixture(request, buildingName);
    await loadBuildingFloorplan(page, buildingName);

    const expectedCountAfterCreate = await createDeviceMarker(page, `E2E-Delete-Device-${Date.now()}`);
    const marker = page.locator('.marker').last();
    page.once('dialog', (dialog) => dialog.accept());
    await marker.click({ button: 'right' });
    await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, expectedCountAfterCreate - 1);

    await page.click('#histUndo');
    await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, expectedCountAfterCreate);

    await page.click('#histRedo');
    await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, expectedCountAfterCreate - 1);
  });

  test('create -> move -> undo -> redo reverts and reapplies coordinates', async ({ page, request }) => {
    const buildingName = `E2E-Move-${Date.now()}`;
    await createFloorplanFixture(request, buildingName);
    await loadBuildingFloorplan(page, buildingName);

    await createDeviceMarker(page, `E2E-Move-Device-${Date.now()}`);
    const marker = page.locator('.marker').last();

    const beforeStyle = await page.$eval('.marker:last-child', (el) => `${(el as HTMLElement).style.left} ${(el as HTMLElement).style.top}`);
    const box = await marker.boundingBox();
    expect(box).toBeTruthy();
    const x0 = (box as { x: number; width: number }).x + (box as { width: number }).width / 2;
    const y0 = (box as { y: number; height: number }).y + (box as { height: number }).height / 2;

    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x0 + 60, y0 + 35, { steps: 8 });
    await page.mouse.up();

    await page.waitForFunction((style) => {
      const m = document.querySelector('.marker:last-child') as HTMLElement | null;
      return !!m && `${m.style.left} ${m.style.top}` !== style;
    }, beforeStyle);

    await page.click('#histUndo');
    await page.waitForFunction((style) => {
      const m = document.querySelector('.marker:last-child') as HTMLElement | null;
      return !!m && `${m.style.left} ${m.style.top}` === style;
    }, beforeStyle);

    await page.click('#histRedo');
    await page.waitForFunction((style) => {
      const m = document.querySelector('.marker:last-child') as HTMLElement | null;
      return !!m && `${m.style.left} ${m.style.top}` !== style;
    }, beforeStyle);
  });

  test('multiple create actions undo/redo consistently (history race guard)', async ({ page, request }) => {
    const buildingName = `E2E-Multi-History-${Date.now()}`;
    await createFloorplanFixture(request, buildingName);
    await loadBuildingFloorplan(page, buildingName);

    const start = await page.locator('.marker').count();
    await createDeviceMarker(page, `E2E-Multi-1-${Date.now()}`, 'switch', { x: 60, y: 60 });
    await createDeviceMarker(page, `E2E-Multi-2-${Date.now()}`, 'switch', { x: 180, y: 120 });
    const afterCreate = await page.locator('.marker').count();
    expect(afterCreate).toBe(start + 2);

    await page.click('#histUndo');
    await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, start + 1);
    await page.click('#histUndo');
    await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, start);

    await page.click('#histRedo');
    await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, start + 1);
    await page.click('#histRedo');
    await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, start + 2);
  });

  test('bulk create history can fully undo then redo without dropping actions', async ({ page, request }) => {
    const buildingName = `E2E-Bulk-History-${Date.now()}`;
    await createFloorplanFixture(request, buildingName);
    await loadBuildingFloorplan(page, buildingName);

    const start = await page.locator('.marker').count();
    const prefix = `E2E-Bulk-History-Device-${Date.now()}`;
    const total = 5;
    for (let i = 0; i < total; i += 1) {
      await createDeviceMarker(page, `${prefix}-${i}`, 'switch', { x: 60 + i * 20, y: 60 + i * 12 });
    }

    await waitForMarkerCount(page, start + total);

    for (let i = total; i > 0; i -= 1) {
      await page.click('#histUndo');
      await waitForMarkerCount(page, start + i - 1);
    }
    await waitForMarkerCount(page, start);

    let apiList = await request.get(`${BASE}/api/devices`);
    expect(apiList.ok()).toBeTruthy();
    let devices = (await apiList.json()) as Array<{ name?: string }>;
    expect(devices.filter((d) => (d.name || '').startsWith(prefix)).length).toBe(0);

    for (let i = 1; i <= total; i += 1) {
      await page.click('#histRedo');
      await waitForMarkerCount(page, start + i);
    }

    apiList = await request.get(`${BASE}/api/devices`);
    expect(apiList.ok()).toBeTruthy();
    devices = (await apiList.json()) as Array<{ name?: string }>;
    expect(devices.filter((d) => (d.name || '').startsWith(prefix)).length).toBe(total);
  });

  test('move + rename/type update undo/redo preserves chronological order', async ({ page, request }) => {
    const buildingName = `E2E-Move-Rename-${Date.now()}`;
    await createFloorplanFixture(request, buildingName);
    await loadBuildingFloorplan(page, buildingName);

    await createDeviceMarker(page, `E2E-Move-Rename-Device-${Date.now()}`);
    const markerId = await page.locator('.marker').last().getAttribute('data-id');
    expect(markerId).toBeTruthy();
    const markerSelector = `.marker[data-id="${markerId}"]`;

    const original = await markerSnapshotById(page, markerId as string);
    await dragMarkerBy(page, markerSelector, 70, 36);
    await page.waitForFunction(
      ([id, prevLeft, prevTop]) => {
        const marker = document.querySelector(`.marker[data-id="${id}"]`) as HTMLElement | null;
        return !!marker && (marker.style.left !== prevLeft || marker.style.top !== prevTop);
      },
      [markerId, original.left, original.top]
    );

    const moved = await markerSnapshotById(page, markerId as string);
    expect(moved.left === original.left && moved.top === original.top).toBeFalsy();

    await page.locator(markerSelector).click();
    await expect(page.locator('#propsPanel:not(.hidden)')).toBeVisible();
    const renamedValue = `E2E-Renamed-${Date.now()}`;
    await page.click('#propEdit');
    await expect(page.locator('#deviceModal:not(.hidden)')).toBeVisible();
    await expect(page.locator('#deviceName')).toHaveValue(/E2E-Move-Rename-Device-/);
    await page.fill('#deviceName', renamedValue);
    await page.selectOption('#deviceType', 'camera');
    await page.click('#deviceSave');
    await expect(page.locator('#deviceModal')).toBeHidden();

    await page.waitForFunction(([id, expectedTitle]) => {
      const marker = document.querySelector(`.marker[data-id="${id}"]`) as HTMLElement | null;
      return !!marker && marker.getAttribute('data-type') === 'camera' && marker.title === expectedTitle;
    }, [markerId, renamedValue]);
    const updated = await markerSnapshotById(page, markerId as string);

    await page.click('#histUndo');
    await page.waitForFunction(
      ([id, expectedType, expectedTitle]) => {
        const marker = document.querySelector(`.marker[data-id="${id}"]`) as HTMLElement | null;
        return !!marker && marker.getAttribute('data-type') === expectedType && marker.title === expectedTitle;
      },
      [markerId, moved.type || 'switch', moved.title]
    );

    await page.click('#histUndo');
    await page.waitForFunction(
      ([id, expectedLeft, expectedTop]) => {
        const marker = document.querySelector(`.marker[data-id="${id}"]`) as HTMLElement | null;
        return !!marker && marker.style.left === expectedLeft && marker.style.top === expectedTop;
      },
      [markerId, original.left, original.top]
    );

    await page.click('#histRedo');
    await page.waitForFunction(
      ([id, expectedLeft, expectedTop]) => {
        const marker = document.querySelector(`.marker[data-id="${id}"]`) as HTMLElement | null;
        return !!marker && marker.style.left === expectedLeft && marker.style.top === expectedTop;
      },
      [markerId, moved.left, moved.top]
    );

    await page.click('#histRedo');
    await page.waitForFunction(
      ([id, expectedType, expectedTitle]) => {
        const marker = document.querySelector(`.marker[data-id="${id}"]`) as HTMLElement | null;
        return !!marker && marker.getAttribute('data-type') === expectedType && marker.title === expectedTitle;
      },
      [markerId, updated.type, updated.title]
    );
  });

  test('csv import UI flow increases device rows and verifies via API', async ({ page, request }) => {
    await page.goto(`${BASE}/devices.html`);
    await page.waitForSelector('#devices tbody');

    const beforeRows = await visibleDeviceRows(page);
    const unique = `E2E-CSV-${Date.now()}`;
    const csv = [
      'name,ip,type,building',
      `${unique}-switch,10.10.0.1,switch,${unique}-building`,
      `${unique}-camera,10.10.0.2,camera,${unique}-building`,
    ].join('\n');

    page.once('dialog', (dialog) => dialog.accept());
    await page.setInputFiles('form#importForm input[name="file"]', {
      name: 'e2e.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    });
    await page.click('form#importForm button[type="submit"]');

    await page.waitForFunction((needle) => {
      return Array.from(document.querySelectorAll('#devices tbody tr')).some((row) =>
        (row.textContent || '').includes(needle)
      );
    }, unique);

    const afterRows = await visibleDeviceRows(page);
    expect(afterRows).toBeGreaterThan(beforeRows);

    const apiList = await request.get(`${BASE}/api/devices`);
    expect(apiList.ok()).toBeTruthy();
    const devices = await apiList.json();
    expect(devices.some((d: { name?: string }) => d.name === `${unique}-switch`)).toBeTruthy();
  });

  test('bulk CSV import via UI adds expected batch and is queryable via API', async ({ page, request }) => {
    await page.goto(`${BASE}/devices.html`);
    await page.waitForSelector('#devices tbody');

    const beforeRows = await visibleDeviceRows(page);
    const unique = `E2E-BULK-${Date.now()}`;
    const bulkCount = 25;
    const rows = ['name,ip,type,building'];
    for (let i = 0; i < bulkCount; i += 1) {
      rows.push(`${unique}-${i},10.20.0.${(i % 250) + 1},switch,${unique}-building`);
    }
    const csv = rows.join('\n');

    page.once('dialog', (dialog) => dialog.accept());
    await page.setInputFiles('form#importForm input[name="file"]', {
      name: 'e2e-bulk.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    });
    await page.click('form#importForm button[type="submit"]');

    await page.waitForFunction((needle) => {
      return Array.from(document.querySelectorAll('#devices tbody tr')).some((row) =>
        (row.textContent || '').includes(needle)
      );
    }, `${unique}-${bulkCount - 1}`);

    const afterRows = await visibleDeviceRows(page);
    expect(afterRows).toBeGreaterThanOrEqual(beforeRows + bulkCount);

    const apiList = await request.get(`${BASE}/api/devices`);
    expect(apiList.ok()).toBeTruthy();
    const devices = (await apiList.json()) as Array<{ name?: string }>;
    const bulkSeen = devices.filter((d) => (d.name || '').startsWith(unique)).length;
    expect(bulkSeen).toBeGreaterThanOrEqual(bulkCount);
  });

  test('marker icon refresh helper can be invoked in isolation', async ({ page }) => {
    await page.goto(`${BASE}/building.html`);
    await page.waitForSelector('#palette');

    const out = await page.evaluate(() => {
      const testWrap = document.createElement('div');
      document.body.appendChild(testWrap);
      const marker = document.createElement('div');
      marker.className = 'marker';
      marker.setAttribute('data-type', 'switch');
      testWrap.appendChild(marker);

      const helper = (window as any).__nmTestHelpers?.refreshAllMarkerIcons;
      if (typeof helper !== 'function') return { ok: false, src: '' };
      helper();

      const img = marker.querySelector('img');
      return { ok: !!img, src: img?.getAttribute('src') || '' };
    });

    expect(out.ok).toBeTruthy();
    expect(out.src).toContain('/icons/');
  });
});
