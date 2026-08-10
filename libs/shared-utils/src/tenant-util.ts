const TENANT_ID_KEY = 'dwp.tenantId';

export function getTenantId(): string {
  if (typeof window === 'undefined') return '1';
  return window.localStorage.getItem(TENANT_ID_KEY) || '1';
}

export function setTenantId(tenantId: string | number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TENANT_ID_KEY, String(tenantId));
}
