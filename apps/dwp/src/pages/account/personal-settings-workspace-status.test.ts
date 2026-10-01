import { describe, expect, it } from 'vitest';

import {
  personalSettingsFreshnessState,
  resolvePersonalSettingsWorkspaceRuntime,
} from './personal-settings-workspace-status';

describe('personal settings workspace runtime status', () => {
  it('makes an in-memory snapshot read-only when the browser is offline', () => {
    expect(
      resolvePersonalSettingsWorkspaceRuntime({
        online: false,
        hasSnapshot: true,
        queryError: false,
        freshnessState: 'CURRENT',
      })
    ).toEqual({ state: 'OFFLINE_CACHED', readOnly: true });
  });

  it('distinguishes offline-without-data from a failed refresh with cached data', () => {
    expect(
      resolvePersonalSettingsWorkspaceRuntime({
        online: false,
        hasSnapshot: false,
        queryError: false,
      }).state
    ).toBe('OFFLINE_UNAVAILABLE');
    expect(
      resolvePersonalSettingsWorkspaceRuntime({
        online: true,
        hasSnapshot: true,
        queryError: true,
      })
    ).toEqual({ state: 'REFRESH_FAILED_CACHED', readOnly: true });
  });

  it('requires review for every server freshness state except current', () => {
    for (const freshnessState of [
      'UNCONFIRMED',
      'CHANGED_SINCE_CONFIRMATION',
      'REVIEW_DUE',
    ] as const) {
      expect(
        resolvePersonalSettingsWorkspaceRuntime({
          online: true,
          hasSnapshot: true,
          queryError: false,
          freshnessState,
        })
      ).toEqual({ state: 'REVIEW_REQUIRED', readOnly: false });
    }
  });

  it('fails closed for a missing or future server freshness state', () => {
    for (const freshnessState of [undefined, 'FUTURE_STATE']) {
      expect(
        resolvePersonalSettingsWorkspaceRuntime({
          online: true,
          hasSnapshot: true,
          queryError: false,
          freshnessState,
        })
      ).toEqual({ state: 'UNAVAILABLE', readOnly: true });
      expect(personalSettingsFreshnessState(freshnessState)).toBe('UNAVAILABLE');
    }
  });
});
