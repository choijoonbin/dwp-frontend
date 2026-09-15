import { describe, expect, it } from 'vitest';
import { HOME_CONTRACT_CAPABILITIES, hasHomeContractCapability } from '@dwp-frontend/shared-utils';

import {
  activeHomeStoreUsesViews,
  freezeHomeStudioContractScope,
  resolveActiveHomeViewScope,
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

  it('pins a Flow scoped edit until close, then rotates to the live Classic scope', () => {
    const liveScope = { modeKey: 'CLASSIC' as const, modeScoped: false };
    const editingScope = resolveActiveHomeViewScope(liveScope, {
      store: 'VIEWS',
      experienceVariant: 'FLOW_V1',
      modeScopedViews: true,
    });

    expect(editingScope).toEqual({ modeKey: 'FLOW_V1', modeScoped: true });
    expect(resolveActiveHomeViewScope(liveScope, null)).toEqual({
      modeKey: 'CLASSIC',
      modeScoped: false,
    });
  });

  it('freezes the Studio contract until its scope is cleared on close', () => {
    const opened = freezeHomeStudioContractScope(null, {
      modeKey: 'FLOW_V1',
      modeScopedViews: true,
      fourDeviceLayoutsSupported: true,
    });
    const whileOpen = freezeHomeStudioContractScope(opened, {
      modeKey: 'CLASSIC',
      modeScopedViews: false,
      fourDeviceLayoutsSupported: false,
    });
    const reopened = freezeHomeStudioContractScope(null, {
      modeKey: 'CLASSIC',
      modeScopedViews: false,
      fourDeviceLayoutsSupported: false,
    });

    expect(whileOpen).toBe(opened);
    expect(
      resolveActiveHomeViewScope({ modeKey: 'CLASSIC', modeScoped: false }, null, whileOpen)
    ).toEqual({ modeKey: 'FLOW_V1', modeScoped: true });
    expect(reopened).toEqual({
      modeKey: 'CLASSIC',
      modeScopedViews: false,
      fourDeviceLayoutsSupported: false,
    });
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
