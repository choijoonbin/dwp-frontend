import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isTenantExperiencePreviewFresh,
  isTenantExperiencePreviewFreshAtRender,
  TENANT_EXPERIENCE_PREVIEW_MAX_STALE_MS,
  tenantExperiencePreviewDeadline,
} from './provider-tenant-experience-preview-model';

describe('tenant experience preview freshness', () => {
  const updatedAt = 1_000_000;

  afterEach(() => vi.useRealTimers());

  it('expires exactly at the maximum stale deadline', () => {
    expect(tenantExperiencePreviewDeadline(updatedAt)).toBe(
      updatedAt + TENANT_EXPERIENCE_PREVIEW_MAX_STALE_MS
    );
    expect(
      isTenantExperiencePreviewFresh(
        updatedAt,
        updatedAt + TENANT_EXPERIENCE_PREVIEW_MAX_STALE_MS - 1
      )
    ).toBe(true);
    expect(
      isTenantExperiencePreviewFresh(updatedAt, updatedAt + TENANT_EXPERIENCE_PREVIEW_MAX_STALE_MS)
    ).toBe(false);
  });

  it('fails closed when no successful response timestamp exists', () => {
    expect(isTenantExperiencePreviewFresh(0, updatedAt)).toBe(false);
  });

  it('fails closed on the first render after switching to an expired cached preview', () => {
    vi.useFakeTimers();
    vi.setSystemTime(tenantExperiencePreviewDeadline(updatedAt));

    expect(
      isTenantExperiencePreviewFreshAtRender(
        updatedAt,
        tenantExperiencePreviewDeadline(updatedAt) - 1
      )
    ).toBe(false);
  });
});
