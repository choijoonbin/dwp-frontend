import type { OrganizationScenarioChange } from '@dwp-frontend/shared-utils';

export function plusDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function scenarioKey(): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `org-${timestamp}-${crypto.randomUUID().slice(0, 8)}`;
}

export function scenarioStatusColor(
  state: string
): 'default' | 'info' | 'warning' | 'success' | 'error' {
  if (state === 'DRAFT') return 'default';
  if (state === 'IN_REVIEW') return 'warning';
  if (state === 'APPROVED' || state === 'PUBLISHED') return 'success';
  if (state === 'REJECTED' || state === 'STALE') return 'error';
  return 'info';
}

export function changeSnapshot(change: OrganizationScenarioChange): Record<string, unknown> {
  try {
    return JSON.parse(change.afterSnapshot) as Record<string, unknown>;
  } catch {
    return {};
  }
}
