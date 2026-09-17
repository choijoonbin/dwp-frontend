import { describe, expect, it } from 'vitest';

import { parseHomeViewConflict } from './home-view-conflict';

const latestView = {
  viewId: 'view-1',
  viewKey: 'default',
  surfaceKey: 'workspace-home',
  modeKey: 'CLASSIC',
  name: 'My home',
  isDefault: true,
  schemaVersion: 4,
  layout: { appLayout: null, widgets: [] },
  version: 8,
  createdAt: '2026-09-16T00:00:00Z',
  updatedAt: '2026-09-16T00:01:00Z',
  widgetConfigurations: {},
} as const;

describe('parseHomeViewConflict', () => {
  it('reads the shared error envelope without losing the latest server view', () => {
    expect(
      parseHomeViewConflict({
        errorCode: 'HOME_VIEW_VERSION_CONFLICT',
        data: {
          operation: 'UPDATE_VIEW',
          expectedVersion: 7,
          actualVersion: 8,
          expectedDeviceVersion: 2,
          actualDeviceVersion: 3,
          latestDeviceLayout: {
            deviceLayoutId: 'device-layout-1',
            viewId: 'view-1',
            deviceClass: 'DESKTOP_STANDARD',
            overlay: {
              density: 'comfortable',
              widgetOrder: [],
              widgetSizes: {},
            },
            version: 3,
            viewVersion: 8,
            updatedAt: '2026-09-16T00:01:00Z',
          },
          latestView,
          changedFields: ['layout.widgets', 'name'],
        },
      })
    ).toEqual({
      operation: 'UPDATE_VIEW',
      expectedVersion: 7,
      actualVersion: 8,
      expectedDeviceVersion: 2,
      actualDeviceVersion: 3,
      latestDeviceLayout: expect.objectContaining({ version: 3, viewVersion: 8 }),
      latestView,
      changedFields: ['layout.widgets', 'name'],
    });
  });

  it('supports nested conflict payloads and ignores malformed fields', () => {
    expect(
      parseHomeViewConflict({
        code: 'E1009',
        details: {
          conflict: {
            latestVersion: 9,
            changedFields: ['layout.presentation', null, ''],
          },
        },
      })
    ).toEqual({
      expectedVersion: undefined,
      actualVersion: 9,
      expectedDeviceVersion: undefined,
      actualDeviceVersion: undefined,
      latestDeviceLayout: undefined,
      latestView: undefined,
      changedFields: ['layout.presentation'],
      operation: undefined,
    });
  });

  it('does not turn unrelated validation errors into edit conflicts', () => {
    expect(
      parseHomeViewConflict({ code: 'VALIDATION_FAILED', data: { field: 'name' } })
    ).toBeNull();
  });
});
