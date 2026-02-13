import fs from 'node:fs';
import path from 'node:path';
import { expect, test, APIRequestContext, Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

async function cleanupE2E(request: APIRequestContext): Promise<void> {
  const res = await request.post(`${BASE}/api/admin/cleanup-tests`, {
    headers: { 'X-Admin-Token': ADMIN_TOKEN },
  });
  if (res.status() !== 200 && res.status() !== 403) {
    throw new Error(`Unexpected cleanup status: ${res.status()}`);
  }
}

async function createFloorplanFixture(
  request: APIRequestContext,
  buildingName: string
): Promise<void> {
  const bRes = await request.post(`${BASE}/api/buildings`, {
    data: { name: buildingName },
  });
  expect(bRes.ok()).toBeTruthy();

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
  expect(fpRes.ok()).toBeTruthy();
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

async function createDeviceMarker(page: Page, name: string, type = 'switch'): Promise<number> {
  const before = await page.locator('.marker').count();
  await page.click('#newDeviceBtn');
  await page.click('#floorImage', { position: { x: 60, y: 60 } });
  await expect(page.locator('#deviceModal:not(.hidden)')).toBeVisible();
  await page.fill('#deviceName', name);
  await page.selectOption('#deviceType', type);
  await page.click('#deviceSave');
  await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, before + 1);
  return before + 1;
}

test.describe('Undo/Redo + Import E2E', () => {
  test('create -> delete -> undo restores marker in client history', async ({ page, request }) => {
    await cleanupE2E(request);
    const buildingName = `E2E Undo Delete ${Date.now()}`;
    await createFloorplanFixture(request, buildingName);
    await loadBuildingFloorplan(page, buildingName);

    const expectedCountAfterCreate = await createDeviceMarker(page, `E2E Delete Device ${Date.now()}`);
    const marker = page.locator('.marker').last();
    page.once('dialog', (dialog) => dialog.accept());
    await marker.click({ button: 'right' });
    await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, expectedCountAfterCreate - 1);

    await page.click('#histUndo');
    await page.waitForFunction((expected) => document.querySelectorAll('.marker').length === expected, expectedCountAfterCreate);

    await cleanupE2E(request);
  });

  test('create -> move -> undo -> redo reverts and reapplies coordinates', async ({ page, request }) => {
    await cleanupE2E(request);
    const buildingName = `E2E Move ${Date.now()}`;
    await createFloorplanFixture(request, buildingName);
    await loadBuildingFloorplan(page, buildingName);

    await createDeviceMarker(page, `E2E Move Device ${Date.now()}`);
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

    await cleanupE2E(request);
  });

  test('csv import UI flow increases device rows', async ({ page }) => {
    await page.goto(`${BASE}/devices.html`);
    await page.waitForSelector('#devices tbody');

    const beforeRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#devices tbody tr'));
      return rows.filter((r) => {
        const text = r.textContent || '';
        return !text.includes('Loading') && !text.includes('No devices');
      }).length;
    });

    const unique = `E2ECSV${Date.now()}`;
    const csv = [
      'name,ip,type,building',
      `${unique}-switch,10.10.0.1,switch,E2E CSV Building`,
      `${unique}-camera,10.10.0.2,camera,E2E CSV Building`,
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

    const afterRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#devices tbody tr'));
      return rows.filter((r) => {
        const text = r.textContent || '';
        return !text.includes('Loading') && !text.includes('No devices');
      }).length;
    });
    expect(afterRows).toBeGreaterThan(beforeRows);
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
