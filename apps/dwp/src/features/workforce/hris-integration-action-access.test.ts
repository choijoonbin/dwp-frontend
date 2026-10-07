import { describe, expect, it } from 'vitest';

import { hrisIntegrationActionAccess } from './hris-integration-action-access';

describe('hrisIntegrationActionAccess', () => {
  it('keeps draft configuration compatible but denies execution without governed authority', () => {
    expect(
      hrisIntegrationActionAccess({ governed: false, hasWritableCapability: () => true }, true)
    ).toEqual({ create: true, update: true, execute: false });
  });

  it('requires the exact execution capability in governed mode', () => {
    const granted = new Set(['hcm.integration.create', 'hcm.integration.update']);

    expect(
      hrisIntegrationActionAccess(
        {
          governed: true,
          hasWritableCapability: (capability) => granted.has(capability),
        },
        false
      )
    ).toEqual({ create: true, update: true, execute: false });
  });
});
