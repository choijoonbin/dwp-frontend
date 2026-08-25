import { describe, expect, it, vi } from 'vitest';

import { resolveHomeViewCustomized, resolvePendingHomeSaveCommand } from './home-view-bootstrap';

import type { HomePreferenceLayout, HomeView } from '@dwp-frontend/shared-utils';

const layout: HomePreferenceLayout = {
  appLayout: null,
  presentation: 'balanced',
  widgets: [{ widgetKey: 'schedule', visible: true }],
};

function view(overrides: Partial<HomeView> = {}): HomeView {
  return {
    viewId: 'view-1',
    viewKey: 'default',
    surfaceKey: 'workspace-home',
    name: 'My work home',
    isDefault: true,
    schemaVersion: 1,
    layout,
    version: 0,
    createdAt: '2026-08-21T00:00:00Z',
    updatedAt: '2026-08-21T00:00:00Z',
    widgetConfigurations: {},
    ...overrides,
  };
}

describe('home view cutover bootstrap', () => {
  it('uses the server customization state and keeps the pre-contract compatibility fallback', () => {
    expect(resolveHomeViewCustomized(view({ customized: false }), true)).toBe(false);
    expect(resolveHomeViewCustomized(view(), false)).toBe(true);
    expect(resolveHomeViewCustomized(null, false)).toBe(false);
  });

  it('reuses one idempotency key while retrying the same draft and rotates it after a change', () => {
    const createKey = vi
      .fn()
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');

    const first = resolvePendingHomeSaveCommand(null, layout, createKey);
    const retry = resolvePendingHomeSaveCommand(first, structuredClone(layout), createKey);
    const changed = resolvePendingHomeSaveCommand(
      retry,
      { ...layout, presentation: 'expressive' },
      createKey
    );

    expect(retry).toBe(first);
    expect(changed.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(createKey).toHaveBeenCalledTimes(2);
  });

  it('rotates the command key when the same layout changes from save to reset', () => {
    const createKey = vi
      .fn()
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    const save = resolvePendingHomeSaveCommand(null, layout, createKey);
    const reset = resolvePendingHomeSaveCommand(save, layout, createKey, true);

    expect(reset.idempotencyKey).not.toBe(save.idempotencyKey);
    expect(createKey).toHaveBeenCalledTimes(2);
  });
});
