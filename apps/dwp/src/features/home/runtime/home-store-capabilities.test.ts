import { describe, expect, it } from 'vitest';
import { HOME_CONTRACT_CAPABILITIES, hasHomeContractCapability } from '@dwp-frontend/shared-utils';

import {
  activeHomeStoreUsesViews,
  resolveModeIsolatedHomeExperience,
} from './home-store-capabilities';

describe('home personalization store capabilities', () => {
  it('only trusts the exact server-advertised Wave 1 capability', () => {
    expect(hasHomeContractCapability(undefined, HOME_CONTRACT_CAPABILITIES.modeScopedViews)).toBe(
      false
    );
    expect(
      hasHomeContractCapability(
        { homeContractCapabilities: [] },
        HOME_CONTRACT_CAPABILITIES.modeScopedViews
      )
    ).toBe(false);
    expect(
      hasHomeContractCapability(
        { homeContractCapabilities: ['MODE_SCOPED_HOME_VIEW'] },
        HOME_CONTRACT_CAPABILITIES.modeScopedViews
      )
    ).toBe(false);
    expect(
      hasHomeContractCapability(
        { homeContractCapabilities: ['MODE_SCOPED_HOME_VIEWS'] },
        HOME_CONTRACT_CAPABILITIES.modeScopedViews
      )
    ).toBe(true);
  });

  it('does not expose VIEWS-only capabilities for the LEGACY store', () => {
    expect(activeHomeStoreUsesViews(false)).toBe(false);
  });

  it('keeps an active LEGACY edit session isolated from a refreshed VIEWS policy', () => {
    expect(activeHomeStoreUsesViews(true, 'LEGACY')).toBe(false);
  });

  it('keeps an active VIEWS edit session on VIEWS until that draft closes', () => {
    expect(activeHomeStoreUsesViews(false, 'VIEWS')).toBe(true);
  });

  it('keeps Classic on its legacy rollback source', () => {
    expect(resolveModeIsolatedHomeExperience('CLASSIC', false)).toBe('CLASSIC');
    expect(resolveModeIsolatedHomeExperience('CLASSIC', true)).toBe('CLASSIC');
  });

  it('keeps Flow off the Classic legacy row but preserves a pre-Wave 1 Views tenant mode', () => {
    expect(resolveModeIsolatedHomeExperience('FLOW_V1', false)).toBe('CLASSIC');
    expect(resolveModeIsolatedHomeExperience('FLOW_V1', true)).toBe('FLOW_V1');
  });
});
