import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import { updateHomeCurrentMode } from './home-preference-api';

import type { HomePreference } from './home-preference-api';

describe('Home preference mode API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the mode-only endpoint without resending layout or changing customization', async () => {
    const preference: HomePreference = {
      schemaVersion: 5,
      surfaceKey: 'workspace-home',
      customized: false,
      layout: { appLayout: null, presentation: 'balanced', widgets: [] },
      version: 12,
      allowedModes: ['CLASSIC', 'FLOW_V1', 'MZ_V1'],
      enabledModes: ['CLASSIC', 'FLOW_V1', 'MZ_V1'],
      defaultMode: 'CLASSIC',
      currentMode: 'CLASSIC',
    };
    const next = { ...preference, currentMode: 'MZ_V1' as const, version: 13 };
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: next } });

    await expect(updateHomeCurrentMode(preference, 'MZ_V1')).resolves.toEqual(next);
    expect(put).toHaveBeenCalledWith('/api/platform/v1/home-preferences/current-mode', {
      currentMode: 'MZ_V1',
      version: 12,
    });
    expect(put.mock.calls[0]?.[1]).not.toHaveProperty('layout');
  });
});
