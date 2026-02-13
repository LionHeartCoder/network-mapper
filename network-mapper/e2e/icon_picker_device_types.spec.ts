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

async function waitForIconCards(page: Page): Promise<void> {
  await retry(async () => {
    const count = await page.locator('.icon-card').count();
    if (count < 1) throw new Error('icon cards not loaded yet');
  }, 10, 300);
}

async function waitForOptionCount(page: Page, selector: string, expected: number): Promise<void> {
  await retry(async () => {
    const count = await page.locator(selector).count();
    if (count !== expected) {
      throw new Error(`expected ${expected} options for ${selector}, got ${count}`);
    }
  }, 10, 250);
}

async function waitForMarkerCount(page: Page, expected: number): Promise<void> {
  await retry(async () => {
    const count = await page.locator('.marker').count();
    if (count !== expected) throw new Error(`expected ${expected} markers, got ${count}`);
  }, 12, 250);
}

test.describe('E2E icon picker and device type flows', () => {
  test('E2E home page includes icon picker link', async ({ page }) => {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });

    const iconPickerLink = page.getByRole('link', { name: 'Open Icon Picker' });
    await expect(iconPickerLink).toBeVisible();

    await Promise.all([
      page.waitForURL(/icon_picker\.html/),
      iconPickerLink.click(),
    ]);

    await expect(page.locator('h1')).toHaveText('Icon Picker');
  });

  test('E2E icon picker renders shorter friendly labels', async ({ page }) => {
    await page.goto(`${BASE}/icon_picker.html`, { waitUntil: 'domcontentloaded' });
    await waitForIconCards(page);

    const summary = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.icon-card')).slice(0, 60);
      const names = cards
        .map((card) => (card.querySelector('.icon-name')?.textContent || '').trim())
        .filter(Boolean);
      const rawFiles = cards
        .map((card) => (card.querySelector('.icon-file')?.textContent || '').trim())
        .filter(Boolean);

      const maxFriendlyLen = names.reduce((m, text) => Math.max(m, text.length), 0);
      const hasShortened = names.some((friendly, idx) => {
        const raw = (rawFiles[idx] || '').replace(/\.[a-z0-9]+$/i, '');
        return raw.length > friendly.length;
      });

      return { maxFriendlyLen, hasShortened, total: cards.length };
    });

    expect(summary.total).toBeGreaterThan(10);
    expect(summary.maxFriendlyLen).toBeLessThanOrEqual(24);
    expect(summary.hasShortened).toBeTruthy();
  });

  test('E2E can add and remove custom type in icon picker', async ({ page }) => {
    await page.goto(`${BASE}/icon_picker.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#targetSelect option', { timeout: 15_000, state: 'attached' });

    const typeSlug = `e2e-type-${Date.now()}`;

    await page.fill('#typeAddInput', typeSlug);
    await page.click('#typeAddBtn');
    await waitForOptionCount(page, `#targetSelect option[value="${typeSlug}"]`, 1);

    await page.selectOption('#typeRemoveSelect', typeSlug);
    await page.click('#typeRemoveBtn');
    await waitForOptionCount(page, `#targetSelect option[value="${typeSlug}"]`, 0);
  });

  test('E2E mapped icon is used for custom type marker in building editor', async ({ page, request }) => {
    await cleanupE2E(request);
    try {
      const typeSlug = `e2e-map-${Date.now()}`;

      await page.goto(`${BASE}/icon_picker.html`, { waitUntil: 'domcontentloaded' });
      await waitForIconCards(page);

      await page.fill('#typeAddInput', typeSlug);
      await page.click('#typeAddBtn');
      await waitForOptionCount(page, `#targetSelect option[value="${typeSlug}"]`, 1);
      await page.selectOption('#targetSelect', typeSlug);

      const selectedIconFile = ((await page.locator('.icon-card .icon-file').first().textContent()) || '').trim();
      expect(selectedIconFile).toBeTruthy();

      await page.locator('.icon-card button').first().click();
      await expect(page.locator('#statusMsg')).toContainText('Mapped');

      const buildingName = `E2E Icon Map ${Date.now()}`;
      await createFloorplanFixture(request, buildingName);
      await loadBuildingFloorplan(page, buildingName);

      const before = await page.locator('.marker').count();
      await page.click('#newDeviceBtn');
      await page.click('#floorImage', { position: { x: 70, y: 70 } });
      await expect(page.locator('#deviceModal:not(.hidden)')).toBeVisible();
      await page.fill('#deviceName', `E2E Mapped ${Date.now()}`);
      await page.selectOption('#deviceType', typeSlug);
      await page.click('#deviceSave');
      await waitForMarkerCount(page, before + 1);

      const markerIcon = await page.$eval('.marker:last-child img', (img) => {
        const src = (img as HTMLImageElement).src;
        const url = new URL(src);
        return {
          src,
          decodedPath: decodeURIComponent(url.pathname),
        };
      });

      expect(markerIcon.src).toContain('/icons/standard/');
      expect(markerIcon.decodedPath).toContain(`/icons/standard/${selectedIconFile}`);
    } finally {
      await cleanupE2E(request);
    }
  });
});
