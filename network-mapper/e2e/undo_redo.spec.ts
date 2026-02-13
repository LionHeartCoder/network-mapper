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

  let selectedValue: string | null = null;
  await retry(async () => {
    const options = page.locator('#floorplanSelect option');
    const count = await options.count();
    selectedValue = null;
    for (let i = 0; i < count; i += 1) {
      const text = (await options.nth(i).textContent()) || '';
      if (text.includes(buildingName)) {
        selectedValue = await options.nth(i).getAttribute('value');
        break;
      }
    }
    if (!selectedValue) {
      await page.click('#refreshFloorplansBtn');
      throw new Error(`floorplan option not visible yet for ${buildingName}`);
    }
  }, 6, 300);

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
  await waitForMarkerCount(page, before + 1);
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

async function waitForMarkerCount(
  page: Page,
  expected: number,
  attempts = 15,
  delayMs = 250
): Promise<void> {
  await retry(async () => {
    const actual = await page.locator('.marker').count();
    if (actual !== expected) {
      throw new Error(`expected ${expected} markers, got ${actual}`);
    }
  }, attempts, delayMs);
}

async function waitForDeviceRowWithText(
  page: Page,
  text: string,
  attempts = 15,
  delayMs = 250
): Promise<void> {
  await retry(async () => {
    const found = await page.evaluate((needle) => {
      return Array.from(document.querySelectorAll('#devices tbody tr')).some((row) =>
        (row.textContent || '').includes(needle)
      );
    }, text);
    if (!found) {
      throw new Error(`row not found yet: ${text}`);
    }
  }, attempts, delayMs);
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
    await waitForMarkerCount(page, expectedCountAfterCreate - 1);

    await page.click('#histUndo');
    await waitForMarkerCount(page, expectedCountAfterCreate);

    await page.click('#histRedo');
    await waitForMarkerCount(page, expectedCountAfterCreate - 1);
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
    await waitForMarkerCount(page, start + 1);
    await page.click('#histUndo');
    await waitForMarkerCount(page, start);

    await page.click('#histRedo');
    await waitForMarkerCount(page, start + 1);
    await page.click('#histRedo');
    await waitForMarkerCount(page, start + 2);
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

    await waitForDeviceRowWithText(page, unique);

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

    await waitForDeviceRowWithText(page, `${unique}-${bulkCount - 1}`);

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
