import { describe, expect, it } from 'vitest';

import {
  HOME_STUDIO_CATALOG,
  HOME_STUDIO_INSTANCE_CAP,
  homeStudioRegistryReasonKey,
  homeStudioRegistryStateKey,
  homeStudioWidgetsEqual,
  moveStudioWidget,
  reconcileStudioWidgets,
  resolveHomeStudioCatalog,
} from './home-layout-studio-workbench';

import type {
  EffectiveWidgetCatalog,
  EffectiveWidgetCatalogItem,
  HomeWidgetPreference,
} from '@dwp-frontend/shared-utils';

const widgets: HomeWidgetPreference[] = [
  { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
  { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
];

describe('Home layout studio workbench contract', () => {
  it('publishes twelve catalog entries while keeping only seven native renderers', () => {
    expect(HOME_STUDIO_CATALOG).toHaveLength(12);
    expect(HOME_STUDIO_CATALOG.filter(({ kind }) => kind === 'native')).toHaveLength(7);
    expect(HOME_STUDIO_CATALOG.filter(({ kind }) => kind === 'projection')).toHaveLength(5);
    expect(new Set(HOME_STUDIO_CATALOG.map(({ key }) => key)).size).toBe(12);
    expect(HOME_STUDIO_CATALOG.slice(0, 8).map(({ catalogId }) => catalogId)).toEqual([
      'meetings.next-prep',
      'meetings.decisions',
      'space.feed',
      'dwai.artifacts',
      'workplace.status',
      'hr.learning',
      'services.requests',
      'security.bulletin',
    ]);
  });

  it('moves a widget deterministically without mutating the saved baseline', () => {
    const moved = moveStudioWidget(widgets, 'schedule', -1);
    expect(moved.map(({ widgetKey }) => widgetKey)).toEqual([
      'schedule',
      'command-rail',
      'daily-brief',
    ]);
    expect(widgets.map(({ widgetKey }) => widgetKey)).toEqual([
      'command-rail',
      'schedule',
      'daily-brief',
    ]);
    expect(homeStudioWidgetsEqual(moved, widgets)).toBe(false);
    expect(homeStudioWidgetsEqual(moveStudioWidget(widgets, 'command-rail', -1), widgets)).toBe(
      true
    );
  });

  it('uses the 100-definition server catalog while keeping renderers and reasons explicit', () => {
    const items: EffectiveWidgetCatalogItem[] = Array.from({ length: 100 }, (_, index) => ({
      definitionId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      definitionKey: index === 0 ? 'core.calendar.schedule' : `partner.widget-${index}`,
      legacyWidgetKey: index === 0 ? 'schedule' : null,
      resolvedVersionId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      semanticVersion: '1.0.0',
      effectiveState: index === 99 ? 'DENY' : 'AVAILABLE',
      reasonCodes: [index === 99 ? 'APP_ACCESS_REQUIRED' : 'AVAILABLE'],
      placementCapabilities: {
        canAdd: index !== 99,
        canHide: index !== 99,
        canMove: index !== 99,
        canResize: true,
      },
      addedInstanceCount: 0,
    }));
    const catalog: EffectiveWidgetCatalog = {
      schemaVersion: 1,
      mode: 'SHADOW',
      catalogRevision: 'catalog-100',
      bindingCatalogRevision: 'a'.repeat(64),
      policyRevision: 'policy-1',
      safetyRevision: 'safety-1',
      hostContext: {
        surfaceKey: 'workspace-home',
        resolvedHostMode: 'CLASSIC',
        homeExperienceVersion: 1,
        compositionSchemaVersion: 4,
        layoutSource: 'HOME_VIEW',
        activeViewRef: 'view-1',
        layoutRevision: 1,
        hostConfigurationRevision: 'host-1',
        hostCapabilityVersion: 1,
        decisionRevision: 'decision-1',
      },
      contexts: [
        {
          placementContext: 'CLASSIC_PERSONAL',
          capabilities: {
            libraryRead: true,
            legacyPlacementWrite: true,
            instanceV6Write: true,
            brokerRead: false,
            presetCreate: false,
            presetShare: false,
          },
          items,
        },
      ],
    };

    const resolved = resolveHomeStudioCatalog(catalog, 'CLASSIC');
    expect(resolved).toHaveLength(100);
    expect(resolved[0]).toMatchObject({ key: 'schedule', kind: 'native', canAdd: true });
    expect(resolved[1]).toMatchObject({
      key: 'partner.widget-1',
      kind: 'projection',
      canAdd: true,
    });
    expect(resolved[99]).toMatchObject({
      key: 'partner.widget-99',
      canAdd: false,
      reasonCodes: ['APP_ACCESS_REQUIRED'],
    });
    expect(HOME_STUDIO_INSTANCE_CAP).toBe(30);
    expect(homeStudioRegistryReasonKey('APP_ACCESS_REQUIRED')).toBe('APP_ACCESS_REQUIRED');
    expect(homeStudioRegistryReasonKey('UNTRUSTED_BACKEND_VALUE')).toBe('UNKNOWN');
    expect(homeStudioRegistryStateKey('AVAILABLE')).toBe('AVAILABLE');
    expect(homeStudioRegistryStateKey('UNTRUSTED_BACKEND_VALUE')).toBe('UNKNOWN');
    expect(
      resolveHomeStudioCatalog({ ...catalog, contexts: [] }, 'CLASSIC').every(
        (item) => item.canAdd === false
      )
    ).toBe(true);
    expect(
      resolveHomeStudioCatalog(
        {
          ...catalog,
          contexts: [
            {
              ...catalog.contexts[0]!,
              capabilities: { ...catalog.contexts[0]!.capabilities, libraryRead: false },
            },
          ],
        },
        'CLASSIC'
      ).every((item) => item.canAdd === false)
    ).toBe(true);
  });

  it('keeps future definition mutations disabled while the registry stays in shadow mode', () => {
    const catalog: EffectiveWidgetCatalog = {
      schemaVersion: 1,
      mode: 'SHADOW',
      catalogRevision: 'shadow-catalog',
      bindingCatalogRevision: 'b'.repeat(64),
      policyRevision: 'policy-1',
      safetyRevision: 'safety-1',
      hostContext: {
        surfaceKey: 'workspace-home',
        resolvedHostMode: 'CLASSIC',
        homeExperienceVersion: 1,
        compositionSchemaVersion: 4,
        layoutSource: 'HOME_VIEW',
        activeViewRef: 'view-1',
        layoutRevision: 1,
        hostConfigurationRevision: 'host-1',
        hostCapabilityVersion: 1,
        decisionRevision: 'decision-1',
      },
      contexts: [
        {
          placementContext: 'CLASSIC_PERSONAL',
          capabilities: {
            libraryRead: true,
            legacyPlacementWrite: false,
            instanceV6Write: false,
            brokerRead: false,
            presetCreate: false,
            presetShare: false,
          },
          items: [
            {
              definitionId: '00000000-0000-4000-8000-000000000001',
              definitionKey: 'partner.future-widget',
              legacyWidgetKey: null,
              resolvedVersionId: '10000000-0000-4000-8000-000000000001',
              semanticVersion: '1.0.0',
              effectiveState: 'AVAILABLE',
              reasonCodes: ['AVAILABLE'],
              placementCapabilities: {
                canAdd: true,
                canHide: true,
                canMove: true,
                canResize: true,
              },
              addedInstanceCount: 1,
            },
          ],
        },
      ],
    };

    expect(resolveHomeStudioCatalog(catalog, 'CLASSIC')[0]).toMatchObject({
      key: 'partner.future-widget',
      canAdd: false,
      canHide: false,
      canMove: false,
    });
  });

  it('keeps approved presentation metadata while the effective catalog remains authoritative', () => {
    const item: EffectiveWidgetCatalogItem = {
      definitionId: '00000000-0000-4000-8000-000000000001',
      definitionKey: 'meetings.next-prep',
      legacyWidgetKey: 'schedule',
      resolvedVersionId: '10000000-0000-4000-8000-000000000001',
      semanticVersion: '1.0.0',
      effectiveState: 'AVAILABLE',
      reasonCodes: ['AVAILABLE'],
      placementCapabilities: { canAdd: true, canHide: true, canMove: true, canResize: true },
      addedInstanceCount: 1,
    };
    const catalog: EffectiveWidgetCatalog = {
      schemaVersion: 1,
      mode: 'SHADOW',
      catalogRevision: 'approved-overlay',
      bindingCatalogRevision: 'c'.repeat(64),
      policyRevision: 'policy-1',
      safetyRevision: 'safety-1',
      hostContext: {
        surfaceKey: 'workspace-home',
        resolvedHostMode: 'FLOW',
        homeExperienceVersion: 1,
        compositionSchemaVersion: 4,
        layoutSource: 'HOME_VIEW',
        activeViewRef: 'view-1',
        layoutRevision: 1,
        hostConfigurationRevision: 'host-1',
        hostCapabilityVersion: 1,
        decisionRevision: 'decision-1',
      },
      contexts: [
        {
          placementContext: 'FLOW_PERSONAL',
          capabilities: {
            libraryRead: true,
            legacyPlacementWrite: true,
            instanceV6Write: false,
            brokerRead: false,
            presetCreate: false,
            presetShare: false,
          },
          items: [item],
        },
      ],
    };

    expect(resolveHomeStudioCatalog(catalog, 'FLOW_V1')[0]).toMatchObject({
      key: 'schedule',
      catalogId: 'meetings.next-prep',
      owner: 'DWP Calendar',
      permission: 'APP.CALENDAR:VIEW',
      translatedLabel: true,
      canMove: true,
      effectiveState: 'AVAILABLE',
    });
  });

  it('preserves unknown saved instances while reconciling known native widgets', () => {
    const reconciled = reconcileStudioWidgets([
      { widgetKey: 'partner.widget-42', visible: false, size: 'full', height: 'expanded' },
      { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
    ]);

    expect(reconciled.slice(0, 2)).toEqual([
      { widgetKey: 'partner.widget-42', visible: false, size: 'full', height: 'expanded' },
      { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
    ]);
    expect(reconciled).toHaveLength(8);
  });

  it('fails closed while the effective catalog is unavailable or unreadable', () => {
    const unavailable = resolveHomeStudioCatalog(undefined, 'CLASSIC');
    expect(unavailable).toHaveLength(12);
    expect(unavailable.every((item) => item.canAdd === false && item.canMove === false)).toBe(true);
    expect(unavailable.every((item) => item.reasonCodes?.includes('TEMPORARILY_UNAVAILABLE'))).toBe(
      true
    );
  });
});
