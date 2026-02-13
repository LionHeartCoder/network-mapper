import { expect, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

test.describe('Admin audit API', () => {
  test('restore actions are recorded and retrievable via /api/admin/audit', async ({ request }) => {
    // quick probe: see whether the admin/audit endpoint exists and whether the
    // running server accepts the test admin token. If not, skip the test so
    // local / minimal environments (no ADMIN_TOKEN) don't fail.
    const probeNoAuth = await request.get(`${BASE}/api/admin/audit`);
    if (probeNoAuth.status() === 404) {
      test.skip(true, 'admin/audit endpoint not available on this deployment');
    }
    if (probeNoAuth.status() === 403) {
      // server requires an ADMIN_TOKEN; verify whether the test token will be accepted
      const probeWithAuth = await request.get(`${BASE}/api/admin/audit`, {
        headers: { 'X-Admin-Token': ADMIN_TOKEN },
      });
      if (!probeWithAuth.ok()) {
        test.skip(true, 'admin/audit protected and ADMIN_TOKEN not configured for this environment');
      }
    }

    // create a device
    const createRes = await request.post(`${BASE}/api/devices`, {
      data: { name: `E2E-Audit-${Date.now()}`, device_type: 'switch', ip: '10.254.0.1' },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    const did = created.id;
    expect(did).toBeTruthy();

    // delete the device and grab the snapshot
    const delRes = await request.delete(`${BASE}/api/devices/${did}`);
    expect(delRes.ok()).toBeTruthy();
    const delJson = await delRes.json();
    const snap = delJson.snapshot;
    expect(snap).toBeTruthy();
    expect(snap.id).toBe(did);

    // restore using the snapshot
    const restoreRes = await request.post(`${BASE}/api/devices/restore`, {
      data: { snapshot: snap },
    });
    expect(restoreRes.ok()).toBeTruthy();
    const rr = await restoreRes.json();
    expect(rr.restored).toBeTruthy();

    // fetch audit entries via admin audit endpoint (we already probed above)
    const auditRes = await request.get(`${BASE}/api/admin/audit`, {
      headers: { 'X-Admin-Token': ADMIN_TOKEN },
    });
    expect(auditRes.ok()).toBeTruthy();
    const entries = await auditRes.json();
    expect(Array.isArray(entries)).toBeTruthy();

    // look for a restore entry matching our restored id
    const found = entries.some((e: any) => e.action === 'restore' && (e.restoredId === did || e.requestedId === did));
    expect(found).toBeTruthy();
  });
});
