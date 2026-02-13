import { expect, test, APIRequestContext, Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 250): Promise<T> {
  let lastErr: unknown;
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

async function uploadCsvViaUi(page: Page, csv: string, fileName: string): Promise<string> {
  const dialogPromise = page.waitForEvent('dialog', { timeout: 15_000 });
  await page.setInputFiles('form#importForm input[name="file"]', {
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf-8'),
  });
  await page.click('form#importForm button[type="submit"]');

  const dialog = await dialogPromise;
  const msg = dialog.message();
  await dialog.accept();
  return msg;
}

async function waitForDeviceRowWithText(page: Page, text: string, attempts = 15): Promise<void> {
  await retry(async () => {
    const found = await page.evaluate((needle) => {
      return Array.from(document.querySelectorAll('#devices tbody tr')).some((row) =>
        (row.textContent || '').includes(needle)
      );
    }, text);
    if (!found) {
      throw new Error(`row not found yet: ${text}`);
    }
  }, attempts, 250);
}

async function countDevicesByPrefix(request: APIRequestContext, prefix: string): Promise<number> {
  const res = await request.get(`${BASE}/api/devices`);
  expect(res.ok()).toBeTruthy();
  const devices = (await res.json()) as Array<{ name?: string }>;
  return devices.filter((d) => (d.name || '').startsWith(prefix)).length;
}

test.describe('CSV import edge cases (E2E)', () => {
  test.beforeEach(async ({ request }) => {
    await cleanupE2E(request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupE2E(request);
  });

  test('imports rows with missing optional columns and extra columns', async ({ page, request }) => {
    const unique = `E2E-CSV-MISSING-${Date.now()}`;
    await page.goto(`${BASE}/devices.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#devices tbody');

    const csv = [
      'hostname,device_type,building,extra_field',
      `${unique}-host,switch,${unique}-Building,ignored`,
    ].join('\n');

    const alertText = await uploadCsvViaUi(page, csv, 'missing-cols.csv');
    expect(alertText).toContain('Imported 1 devices');

    await waitForDeviceRowWithText(page, `${unique}-host`);
    const count = await countDevicesByPrefix(request, unique);
    expect(count).toBe(1);
  });

  test('imports duplicate rows without crashing and reports created count', async ({ page, request }) => {
    const unique = `E2E-CSV-DUPE-${Date.now()}`;
    await page.goto(`${BASE}/devices.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#devices tbody');

    const csv = [
      'name,ip,type,building',
      `${unique}-dup,10.88.0.10,switch,${unique}-Building`,
      `${unique}-dup,10.88.0.10,switch,${unique}-Building`,
      `${unique}-other,10.88.0.11,camera,${unique}-Building`,
    ].join('\n');

    const alertText = await uploadCsvViaUi(page, csv, 'dupes.csv');
    expect(alertText).toContain('Imported 3 devices');

    await waitForDeviceRowWithText(page, `${unique}-other`);
    const count = await countDevicesByPrefix(request, unique);
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('imports a larger CSV batch and makes rows queryable via API', async ({ page, request }) => {
    const unique = `E2E-CSV-BULK-${Date.now()}`;
    const batchSize = 75;
    await page.goto(`${BASE}/devices.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#devices tbody');

    const rows = ['name,ip,type,building'];
    for (let i = 0; i < batchSize; i += 1) {
      rows.push(`${unique}-${i},10.77.${Math.floor(i / 250)}.${(i % 250) + 1},switch,${unique}-Building`);
    }

    const alertText = await uploadCsvViaUi(page, rows.join('\n'), 'bulk.csv');
    expect(alertText).toContain(`Imported ${batchSize} devices`);

    await waitForDeviceRowWithText(page, `${unique}-${batchSize - 1}`, 20);
    const count = await countDevicesByPrefix(request, unique);
    expect(count).toBeGreaterThanOrEqual(batchSize);
  });
});
