export const TENANT_EXPERIENCE_PREVIEW_MAX_STALE_MS = 10_000;

export function tenantExperiencePreviewDeadline(dataUpdatedAt: number): number {
  return dataUpdatedAt + TENANT_EXPERIENCE_PREVIEW_MAX_STALE_MS;
}

export function isTenantExperiencePreviewFresh(dataUpdatedAt: number, now: number): boolean {
  return dataUpdatedAt > 0 && now < tenantExperiencePreviewDeadline(dataUpdatedAt);
}

export function isTenantExperiencePreviewFreshAtRender(
  dataUpdatedAt: number,
  freshnessClock: number,
  wallClock = Date.now()
): boolean {
  return isTenantExperiencePreviewFresh(dataUpdatedAt, Math.max(freshnessClock, wallClock));
}
