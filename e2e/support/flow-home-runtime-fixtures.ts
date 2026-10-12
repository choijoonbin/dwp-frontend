import { fulfillSuccess } from './shell-session';
import { widgetRegistryEffectiveCatalog } from './widget-registry';

import type { Page } from '@playwright/test';

export const DEFAULT_HOME_PREFERENCE = {
  schemaVersion: 5,
  surfaceKey: 'workspace-home',
  customized: false,
  layout: {
    appLayout: null,
    presentation: 'balanced',
    widgets: [
      { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
      { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'focus', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'activity', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'focus-balance', visible: true, size: 'medium', height: 'short' },
      { widgetKey: 'meeting-load', visible: true, size: 'medium', height: 'short' },
    ],
  },
  version: 0,
};

export function defaultHomeView(version = 3) {
  return {
    viewId: 'home-view-default',
    viewKey: 'default',
    surfaceKey: 'workspace-home',
    modeKey: 'FLOW_V1',
    name: 'My home',
    isDefault: true,
    schemaVersion: 5,
    layout: DEFAULT_HOME_PREFERENCE.layout,
    version,
    customized: false,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-25T00:00:00Z',
    widgetConfigurations: {},
  };
}

export function flowWidgetRegistryEffectiveCatalog() {
  const catalog = widgetRegistryEffectiveCatalog('SHADOW', 'AVAILABLE');
  return {
    ...catalog,
    hostContext: { ...catalog.hostContext, resolvedHostMode: 'FLOW' as const },
    contexts: catalog.contexts.map((context) => ({
      ...context,
      placementContext: 'FLOW_PERSONAL' as const,
    })),
  };
}

export async function routeDefaultHomeViews(page: Page) {
  await page.route('**/api/platform/v1/home-views**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/home-view-default/device-layouts')) {
      return fulfillSuccess(route, []);
    }
    if (request.method() === 'GET' && path.endsWith('/home-views')) {
      return fulfillSuccess(route, [defaultHomeView()]);
    }
    return route.fallback();
  });
}
