import { describe, expect, it, vi } from 'vitest';

import {
  ORGANIZATION_PUBLISH_RELEASE,
  organizationPublishAccess,
} from './organization-publish-release';

describe('organizationPublishAccess', () => {
  it('fails closed before external G-05 and PS-03 approval', () => {
    expect(ORGANIZATION_PUBLISH_RELEASE).toEqual({
      enabled: false,
      blockers: ['G-05', 'PS-03'],
    });
    expect(
      organizationPublishAccess({ governed: true, hasWritableCapability: () => true })
    ).toEqual({ authorized: true, enabled: false });
  });

  it('never substitutes a legacy role for exact publish authority', () => {
    const hasWritableCapability = vi.fn(() => true);

    expect(organizationPublishAccess({ governed: false, hasWritableCapability }, true)).toEqual({
      authorized: false,
      enabled: false,
    });
    expect(hasWritableCapability).not.toHaveBeenCalled();
  });

  it('can open only after both release and exact capability are present', () => {
    expect(
      organizationPublishAccess({ governed: true, hasWritableCapability: () => true }, true)
    ).toEqual({ authorized: true, enabled: true });
  });
});
