import { describe, expect, it } from 'vitest';

import {
  createInitialHomeStudioView,
  createLegacyHomeStudioView,
  replaceHomeStudioView,
  resolveHomePreferenceStore,
} from './home-personalization-studio-model';

import type { HomePreference, HomePreferenceLayout, HomeView } from '@dwp-frontend/shared-utils';

const layout: HomePreferenceLayout<string> = {
  appLayout: null,
  presentation: 'balanced',
  widgets: [{ widgetKey: 'schedule', visible: true }],
};

function view(overrides: Partial<HomeView> = {}): HomeView {
  return {
    viewId: 'view-1',
    viewKey: 'default',
    surfaceKey: 'workspace-home',
    modeKey: 'FLOW_V1',
    name: 'Flow home',
    isDefault: true,
    schemaVersion: 5,
    layout,
    version: 1,
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
    widgetConfigurations: {},
    customized: true,
    ...overrides,
  };
}

describe('Home personalization studio model', () => {
  it('fails closed to the legacy store until the server explicitly advertises views', () => {
    expect(resolveHomePreferenceStore(undefined)).toBe('LEGACY');
    expect(resolveHomePreferenceStore('LEGACY')).toBe('LEGACY');
    expect(resolveHomePreferenceStore('VIEWS')).toBe('VIEWS');
  });

  it('creates an editable seed for an empty mode-scoped view collection', () => {
    const initial = createInitialHomeStudioView(false, null, layout, false, 'MZ_V1', 'My home');

    expect(initial).toMatchObject({
      viewId: 'new-workspace-home',
      modeKey: 'MZ_V1',
      isDefault: true,
      version: 0,
      layout,
    });
  });

  it('does not synthesize a seed while views are unavailable or a persisted view exists', () => {
    expect(createInitialHomeStudioView(false, null, layout, true, 'FLOW_V1', 'My home')).toBeNull();
    expect(
      createInitialHomeStudioView(false, view(), layout, false, 'FLOW_V1', 'My home')
    ).toBeNull();
  });

  it('adapts the legacy preference without losing mode, layout, or optimistic version', () => {
    const preference: HomePreference<string> = {
      schemaVersion: 5,
      surfaceKey: 'workspace-home',
      customized: true,
      layout,
      version: 7,
      currentMode: 'CLASSIC',
      updatedAt: '2026-09-17T01:00:00Z',
    };

    expect(createLegacyHomeStudioView(true, preference, 'CLASSIC', 'My home')).toMatchObject({
      viewId: 'legacy-workspace-home',
      modeKey: 'CLASSIC',
      layout,
      version: 7,
      customized: true,
    });
  });

  it('inserts the first saved view and replaces it on later saves', () => {
    const first = view();
    const updated = view({ version: 2, layout: { ...layout, presentation: 'focused' } });

    expect(replaceHomeStudioView(undefined, first)).toEqual([first]);
    expect(replaceHomeStudioView([first], updated)).toEqual([updated]);
  });
});
