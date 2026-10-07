import { describe, expect, it, vi } from 'vitest';

import { workforceExportActionAccess } from './workforce-export-action-access';

describe('workforceExportActionAccess', () => {
  it('does not treat a legacy administrator role as controlled-export authority', () => {
    const hasWritableCapability = vi.fn(() => true);

    expect(workforceExportActionAccess({ governed: false, hasWritableCapability }, true)).toEqual({
      create: false,
      cancel: false,
      retry: false,
    });
    expect(hasWritableCapability).not.toHaveBeenCalled();
  });

  it('projects each mutation from its exact governed capability', () => {
    const granted = new Set(['hcm.controlled-export.create', 'hcm.controlled-export.cancel']);

    expect(
      workforceExportActionAccess(
        {
          governed: true,
          hasWritableCapability: (capability) => granted.has(capability),
        },
        false
      )
    ).toEqual({ create: true, cancel: true, retry: false });
  });
});
