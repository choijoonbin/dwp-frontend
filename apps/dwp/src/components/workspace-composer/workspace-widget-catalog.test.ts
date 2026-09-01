import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_WIDGET_CATALOG,
  resolveWorkspaceWidgetAccess,
  workspaceWidgetCatalogDefinition,
} from './workspace-widget-catalog';

describe('workspace widget catalog', () => {
  it('registers every widget with a unique manifest and recipient-context binding', () => {
    expect(new Set(WORKSPACE_WIDGET_CATALOG.map((definition) => definition.key)).size).toBe(
      WORKSPACE_WIDGET_CATALOG.length
    );
    expect(
      new Set(WORKSPACE_WIDGET_CATALOG.map((definition) => definition.analyticsKey)).size
    ).toBe(WORKSPACE_WIDGET_CATALOG.length);
    expect(WORKSPACE_WIDGET_CATALOG.every((definition) => definition.recipientContextBinding)).toBe(
      true
    );
    expect(
      WORKSPACE_WIDGET_CATALOG.every(
        (definition) =>
          definition.contributorAppResourceKeys.length > 0 &&
          new Set(definition.contributorAppResourceKeys).size ===
            definition.contributorAppResourceKeys.length
      )
    ).toBe(true);
  });

  it('allows presets only for bounded configurable definitions', () => {
    const shareable = WORKSPACE_WIDGET_CATALOG.filter((definition) => definition.shareableAsPreset);

    expect(shareable.length).toBeGreaterThan(0);
    expect(shareable.every((definition) => definition.configuration !== null)).toBe(true);
    expect(
      shareable.every(
        (definition) =>
          definition.runtime === 'NATIVE' &&
          definition.configuration?.fieldKeys.length &&
          definition.configuration.filterPresets.length
      )
    ).toBe(true);
  });

  it('classifies the command rail as a bounded personal placement', () => {
    expect(workspaceWidgetCatalogDefinition('command-rail')).toMatchObject({
      policyClass: 'PERSONAL',
      canHide: true,
      defaultSize: 'large',
      allowedSizes: ['large', 'full'],
      defaultHeight: 'short',
      allowedHeights: ['short', 'standard'],
    });
  });

  it('resolves effective access as a fail-closed intersection', () => {
    const allowed = {
      lifecycle: 'ACTIVE' as const,
      providerAllowed: true,
      tenantAllowed: true,
      appEntitled: true,
      sourceAuthorized: true,
    };

    expect(resolveWorkspaceWidgetAccess(allowed)).toBe('AVAILABLE');
    expect(resolveWorkspaceWidgetAccess({ ...allowed, lifecycle: 'BLOCKED' })).toBe(
      'PROVIDER_BLOCKED'
    );
    expect(resolveWorkspaceWidgetAccess({ ...allowed, tenantAllowed: false })).toBe(
      'TENANT_BLOCKED'
    );
    expect(resolveWorkspaceWidgetAccess({ ...allowed, appEntitled: false })).toBe(
      'APP_NOT_ENTITLED'
    );
    expect(resolveWorkspaceWidgetAccess({ ...allowed, sourceAuthorized: false })).toBe(
      'SOURCE_FORBIDDEN'
    );
  });

  it('returns null for unregistered widget keys', () => {
    expect(workspaceWidgetCatalogDefinition('unknown')).toBeNull();
  });
});
