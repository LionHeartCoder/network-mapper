import { expect, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

test.describe('Admin audit API', () => {
  // Skip these tests when ADMIN_TOKEN is not provided in the environment
  test.skip(!ADMIN_TOKEN, 'ADMIN_TOKEN not set');

  test('restore actions are recorded and retrievable via /api/admin/audit', async ({ request }) => {
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

    // fetch audit entries via admin audit endpoint
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

  test('admin audit cleanup removes old entries', async ({ request }) => {
    // create -> delete -> restore to generate an audit entry
    const createRes = await request.post(`${BASE}/api/devices`, { data: { name: `E2E-Cleanup-${Date.now()}`, device_type: 'switch' } });
    expect(createRes.ok()).toBeTruthy();
    const did = (await createRes.json()).id;

    const delRes = await request.delete(`${BASE}/api/devices/${did}`);
    expect(delRes.ok()).toBeTruthy();
    const snap = (await delRes.json()).snapshot;
    expect(snap).toBeTruthy();

    const restoreRes = await request.post(`${BASE}/api/devices/restore`, { data: { snapshot: snap } });
    expect(restoreRes.ok()).toBeTruthy();
    const rr = await restoreRes.json();
    const restoredId = rr.id;
    expect(rr.restored).toBeTruthy();

    // fetch audit entries and find the timestamp for our restore entry
    const auditRes = await request.get(`${BASE}/api/admin/audit`, { headers: { 'X-Admin-Token': ADMIN_TOKEN } });
    expect(auditRes.ok()).toBeTruthy();
    const entries = await auditRes.json();
    const myEntry = entries.find((e: any) => e.action === 'restore' && (e.restoredId === restoredId || e.requestedId === restoredId));
    expect(myEntry).toBeTruthy();

    // set cutoff to 1 second after the entry timestamp so it will be removed
    const ts = myEntry.timestamp;
    const cutoff = new Date(new Date(ts).getTime() + 1000).toISOString();

    const cr = await request.post(`${BASE}/api/admin/audit/cleanup`, { headers: { 'X-Admin-Token': ADMIN_TOKEN }, data: { before: cutoff } });
    expect(cr.ok()).toBeTruthy();
    const cresp = await cr.json();
    expect(typeof cresp.removed).toBe('number');
    expect(cresp.removed).toBeGreaterThanOrEqual(1);

    // confirm entry removed
    const auditRes2 = await request.get(`${BASE}/api/admin/audit`, { headers: { 'X-Admin-Token': ADMIN_TOKEN } });
    expect(auditRes2.ok()).toBeTruthy();
    const entries2 = await auditRes2.json();
    const still = entries2.some((e: any) => e.action === 'restore' && (e.restoredId === restoredId || e.requestedId === restoredId));
    expect(still).toBeFalsy();
  });
});
