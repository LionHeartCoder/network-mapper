import { expect, test, APIRequestContext, Page } from '@playwright/test';
import { adminAuditAuthStatus, adminHeaders, BASE, ADMIN_TOKEN } from './helpers/admin_auth';

type AuditEntry = {
  id?: number;
  action?: string;
  timestamp?: string;
  requestedId?: number;
  restoredId?: number;
  preservedId?: boolean;
};

async function retry<T>(fn: () => Promise<T>, attempts = 8, delayMs = 250): Promise<T> {
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

async function seedRestoreAuditEntry(request: APIRequestContext, label: string): Promise<{ deviceId: number; restoredId: number; }> {
  const createRes = await request.post(`${BASE}/api/devices`, {
    data: { name: `E2E-Audit-UI-${label}-${Date.now()}`, device_type: 'switch', ip: '10.254.1.1' },
  });
  expect(createRes.ok()).toBeTruthy();
  const deviceId = (await createRes.json()).id as number;

  const deleteRes = await request.delete(`${BASE}/api/devices/${deviceId}`);
  expect(deleteRes.ok()).toBeTruthy();
  const snapshot = (await deleteRes.json()).snapshot;
  expect(snapshot).toBeTruthy();

  const restoreRes = await request.post(`${BASE}/api/devices/restore`, {
    data: { snapshot },
  });
  expect(restoreRes.ok()).toBeTruthy();
  const restored = await restoreRes.json();
  expect(restored.restored).toBeTruthy();

  return { deviceId, restoredId: restored.id ?? deviceId };
}

async function fetchAuditEntries(request: APIRequestContext): Promise<AuditEntry[]> {
  const res = await request.get(`${BASE}/api/admin/audit`, {
    headers: adminHeaders(),
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as AuditEntry[];
}

async function waitForRestoreAuditEntry(request: APIRequestContext, targetId: number): Promise<AuditEntry> {
  return retry(async () => {
    const entries = await fetchAuditEntries(request);
    const found = entries.find((e) => e.action === 'restore' && (e.restoredId === targetId || e.requestedId === targetId));
    if (!found) throw new Error(`restore audit entry not found for id ${targetId}`);
    return found;
  }, 10, 300);
}

async function mountAuditConsole(page: Page): Promise<void> {
  const quotedBase = JSON.stringify(BASE);
  await page.setContent(`
    <!doctype html>
    <html>
      <body>
        <h1>Admin Audit Console</h1>
        <label>Token <input id="tokenInput"></label>
        <label>Before <input id="beforeInput" placeholder="ISO timestamp"></label>
        <button id="loadBtn">Load Audit</button>
        <button id="cleanupBtn">Cleanup Audit</button>
        <div id="status"></div>
        <table id="auditTable" border="1">
          <thead>
            <tr><th>Action</th><th>Requested</th><th>Restored</th><th>Preserved</th><th>Timestamp</th></tr>
          </thead>
          <tbody></tbody>
        </table>
        <script>
          const API_BASE = ${quotedBase};
          const tokenInput = document.getElementById('tokenInput');
          const beforeInput = document.getElementById('beforeInput');
          const loadBtn = document.getElementById('loadBtn');
          const cleanupBtn = document.getElementById('cleanupBtn');
          const status = document.getElementById('status');
          const tbody = document.querySelector('#auditTable tbody');

          async function loadAudit(){
            const res = await fetch(API_BASE + '/api/admin/audit', {
              headers: { 'X-Admin-Token': tokenInput.value.trim() }
            });
            if(!res.ok){
              status.textContent = 'load-error-' + res.status;
              return;
            }
            const rows = await res.json();
            tbody.innerHTML = '';
            rows.forEach((row) => {
              const tr = document.createElement('tr');
              tr.className = 'audit-row';
              tr.innerHTML = '<td>' + (row.action || '') + '</td>'
                + '<td>' + (row.requestedId ?? '') + '</td>'
                + '<td>' + (row.restoredId ?? '') + '</td>'
                + '<td>' + String(!!row.preservedId) + '</td>'
                + '<td>' + (row.timestamp || '') + '</td>';
              tbody.appendChild(tr);
            });
            status.textContent = 'loaded-' + rows.length;
          }

          async function cleanupAudit(){
            const res = await fetch(API_BASE + '/api/admin/audit/cleanup', {
              method: 'POST',
              headers: {
                'X-Admin-Token': tokenInput.value.trim(),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ before: beforeInput.value.trim() })
            });
            if(!res.ok){
              status.textContent = 'cleanup-error-' + res.status;
              return;
            }
            const out = await res.json();
            status.textContent = 'cleanup-removed-' + (out.removed ?? 0);
            await loadAudit();
          }

          loadBtn.addEventListener('click', loadAudit);
          cleanupBtn.addEventListener('click', cleanupAudit);
        </script>
      </body>
    </html>
  `);
}

test.describe('Admin audit UI flows', () => {
  test.beforeEach(async ({ request }) => {
    const status = await adminAuditAuthStatus(request);
    test.skip(
      status === 403,
      'Admin audit endpoints are unauthorized. Set backend ADMIN_TOKEN and use matching ADMIN_TOKEN for Playwright.'
    );
  });

  test('admin audit list UI renders restore entries', async ({ page, request }) => {
    const seeded = await seedRestoreAuditEntry(request, 'list');
    await waitForRestoreAuditEntry(request, seeded.restoredId);

    await mountAuditConsole(page);
    await page.fill('#tokenInput', ADMIN_TOKEN);
    await page.click('#loadBtn');

    await expect(page.locator('#status')).toContainText('loaded-');
    const restoreRow = page.locator('#auditTable tbody tr', {
      hasText: `restore`,
    }).filter({ hasText: String(seeded.restoredId) });
    await expect(restoreRow.first()).toBeVisible();
  });

  test('admin audit cleanup UI removes old restore entries', async ({ page, request }) => {
    const seeded = await seedRestoreAuditEntry(request, 'cleanup');
    const entry = await waitForRestoreAuditEntry(request, seeded.restoredId);
    expect(entry.timestamp).toBeTruthy();

    const cutoff = new Date(new Date(entry.timestamp as string).getTime() + 1000).toISOString();

    await mountAuditConsole(page);
    await page.fill('#tokenInput', ADMIN_TOKEN);
    await page.click('#loadBtn');
    await expect(page.locator('#auditTable tbody tr').first()).toBeVisible();

    await page.fill('#beforeInput', cutoff);
    await page.click('#cleanupBtn');

    await expect(page.locator('#status')).toContainText('loaded-');
    const restoredRow = page.locator('#auditTable tbody tr', {
      hasText: String(seeded.restoredId),
    });
    await expect(restoredRow).toHaveCount(0);
  });
});
