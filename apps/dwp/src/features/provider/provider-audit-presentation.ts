const CATEGORIES = new Set([
  'ADMINISTRATION',
  'CHANGE',
  'PRIVILEGED_ACCESS',
  'SERVICE_HEALTH',
  'SUPPORT',
  'TENANT',
  'CHANGE_MANAGEMENT',
  'DATA_GOVERNANCE',
  'TENANT_LIFECYCLE',
]);
const OUTCOMES = new Set(['SUCCESS', 'FAILED', 'DENIED']);

export function providerAuditCategory(value: string): string {
  return CATEGORIES.has(value) ? value : 'UNAVAILABLE';
}

export function providerAuditOutcome(value: string): string {
  return OUTCOMES.has(value) ? value : 'UNAVAILABLE';
}

export function providerAuditSnapshotFieldCount(value: unknown): number | null {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return Object.keys(parsed).length;
}
