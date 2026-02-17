import { APIRequestContext } from '@playwright/test';

export const BASE = process.env.E2E_BASE_URL || 'http://localhost:5000';
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

export function adminHeaders(token = ADMIN_TOKEN): Record<string, string> {
  return { 'X-Admin-Token': token };
}

export async function adminAuditAuthStatus(request: APIRequestContext): Promise<number> {
  const res = await request.get(`${BASE}/api/admin/audit`, { headers: adminHeaders() });
  return res.status();
}
