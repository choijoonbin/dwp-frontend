import { describe, expect, it } from 'vitest';
import { resolveWidgetRegistryConnection } from '@dwp-frontend/shared-utils';

import firstPartyFixture from '../../../../../../architecture/widget-registry-native-manifests.v1.json';
import {
  homeWidgetRegistryEffectiveQueryKey,
  NATIVE_HOME_WIDGET_BINDINGS,
  observeHomeWidgetShadow,
  resolveHomeWidgetRuntimeDecisions,
} from './widget-registry-runtime';

import type {
  EffectiveWidgetCatalog,
  EffectiveWidgetCatalogItem,
  WidgetRegistryReadiness,
} from '@dwp-frontend/shared-utils';

const capabilities = [
  'WIDGET_REGISTRY_CONTROL_PLANE',
  'WIDGET_REGISTRY_SHADOW_EVALUATION',
  'TENANT_WIDGET_POLICY',
] as const;

function readiness(overrides: Partial<WidgetRegistryReadiness> = {}): WidgetRegistryReadiness {
  return {
    schemaVersion: 1,
    migrationMode: 'SHADOW',
    controlPlaneReady: true,
    runtimeActivationReady: false,
    capabilities,
    registryRevision: 1,
    policyRevision: 1,
    safetyRevision: 1,
    ...overrides,
  };
}

function item(
  legacyWidgetKey: string,
  definitionKey: string,
  overrides: Partial<EffectiveWidgetCatalogItem> = {}
): EffectiveWidgetCatalogItem {
  const index = NATIVE_HOME_WIDGET_BINDINGS.findIndex(
    (binding) => binding.legacyWidgetKey === legacyWidgetKey
  );
  const suffix = String(index + 1).padStart(12, '0');
  return {
    definitionId: `30000000-0000-4000-8000-${suffix}`,
    definitionKey,
    legacyWidgetKey,
    resolvedVersionId: `40000000-0000-4000-8000-${suffix}`,
    semanticVersion: '1.0.0',
    effectiveState: 'AVAILABLE',
    reasonCodes: ['AVAILABLE'],
    placementCapabilities: { canAdd: true, canHide: true, canMove: true, canResize: true },
    addedInstanceCount: 0,
    ...overrides,
  };
}

function catalog(
  overrides: Partial<EffectiveWidgetCatalog> = {},
  itemOverrides: Partial<EffectiveWidgetCatalogItem> = {}
): EffectiveWidgetCatalog {
  return {
    schemaVersion: 1,
    mode: 'AUTHORITATIVE',
    catalogRevision: 'catalog-1',
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
          instanceV6Write: false,
          brokerRead: false,
          presetCreate: false,
          presetShare: false,
        },
        items: NATIVE_HOME_WIDGET_BINDINGS.map((binding) =>
          item(binding.legacyWidgetKey, binding.definitionKey, itemOverrides)
        ),
      },
    ],
    ...overrides,
  };
}

describe('widget registry connection', () => {
  it('keeps static runtime authoritative when readiness is absent or partial', () => {
    expect(resolveWidgetRegistryConnection(undefined)).toMatchObject({
      runtimeSource: 'STATIC',
      queryEffectiveCatalog: false,
      reason: 'ABSENT',
    });
    expect(
      resolveWidgetRegistryConnection(
        readiness({ capabilities: ['WIDGET_REGISTRY_CONTROL_PLANE'] })
      )
    ).toMatchObject({ runtimeSource: 'STATIC', queryEffectiveCatalog: false, reason: 'PARTIAL' });
    expect(resolveWidgetRegistryConnection(readiness({ capabilities: [] }))).toMatchObject({
      runtimeSource: 'STATIC',
      queryEffectiveCatalog: false,
      reason: 'PARTIAL',
    });
    expect(
      resolveWidgetRegistryConnection(
        readiness({ migrationMode: 'UNKNOWN' as WidgetRegistryReadiness['migrationMode'] })
      )
    ).toMatchObject({ runtimeSource: 'STATIC', queryEffectiveCatalog: false, reason: 'PARTIAL' });
  });

  it('observes a complete shadow contract without changing runtime or allowing mutations', () => {
    expect(resolveWidgetRegistryConnection(readiness())).toEqual({
      runtimeSource: 'STATIC',
      queryEffectiveCatalog: true,
      observeShadow: true,
      mutationAllowed: false,
      reason: 'SHADOW',
    });
  });

  it('requires explicit activation readiness and authoritative capability', () => {
    const incomplete = readiness({ migrationMode: 'AUTHORITATIVE', runtimeActivationReady: true });
    expect(resolveWidgetRegistryConnection(incomplete).runtimeSource).toBe('STATIC');
    const active = readiness({
      migrationMode: 'AUTHORITATIVE',
      runtimeActivationReady: true,
      capabilities: [
        'WIDGET_REGISTRY_CONTROL_PLANE',
        'TENANT_WIDGET_POLICY',
        'WIDGET_REGISTRY_AUTHORITATIVE_RUNTIME',
      ],
    });
    expect(resolveWidgetRegistryConnection(active)).toMatchObject({
      runtimeSource: 'AUTHORITATIVE',
      queryEffectiveCatalog: true,
      mutationAllowed: true,
    });
  });

  it('rotates the effective cache key across identity and decision revisions', () => {
    const initial = homeWidgetRegistryEffectiveQueryKey(1, 7, readiness());
    expect(homeWidgetRegistryEffectiveQueryKey(1, 7, readiness())).toEqual(initial);
    expect(homeWidgetRegistryEffectiveQueryKey(1, 7, readiness({ safetyRevision: 2 }))).not.toEqual(
      initial
    );
    expect(homeWidgetRegistryEffectiveQueryKey(2, 7, readiness())).not.toEqual(initial);
  });
});

describe('native renderer allowlist', () => {
  it('matches all seven first-party fixture bindings exactly', () => {
    const fixtureBindings = firstPartyFixture.fixtures.map(({ legacyWidgetKey, manifest }) => ({
      legacyWidgetKey,
      definitionKey: manifest.definitionKey,
      semanticVersion: '1.0.0',
      rendererKey: manifest.renderer.rendererKey,
      minimumHostApiVersion: manifest.renderer.minimumHostApiVersion,
      supportedContexts: manifest.placement.supportedContexts,
    }));
    expect(NATIVE_HOME_WIDGET_BINDINGS).toEqual(fixtureBindings);
    expect(new Set(fixtureBindings.map((binding) => binding.rendererKey)).size).toBe(7);
  });

  it('never accepts a renderer transport or executable location from registry data', () => {
    const serialized = JSON.stringify(firstPartyFixture.fixtures);
    expect(serialized).not.toMatch(/remoteEntry|scriptUrl|htmlUrl|javascript:/iu);
    expect(
      firstPartyFixture.fixtures.every(({ manifest }) => manifest.renderer.kind === 'NATIVE')
    ).toBe(true);
  });
});

describe('shadow drift observation', () => {
  const shadowConnection = resolveWidgetRegistryConnection(readiness());

  it('reports inactive, pending, and invalid observations without changing static decisions', () => {
    expect(observeHomeWidgetShadow(resolveWidgetRegistryConnection(undefined), undefined)).toEqual({
      status: 'INACTIVE',
      mismatchCount: 0,
      decisionRevision: null,
      mismatches: [],
    });
    expect(observeHomeWidgetShadow(shadowConnection, undefined).status).toBe('PENDING');
    expect(observeHomeWidgetShadow(shadowConnection, null).status).toBe('INVALID');
    expect(observeHomeWidgetShadow(shadowConnection, catalog()).status).toBe('INVALID');
    expect(resolveHomeWidgetRuntimeDecisions(shadowConnection, null).focus.render).toBe('NATIVE');
  });

  it('reports a matching shadow decision revision while ignoring disabled shadow mutations', () => {
    const shadow = catalog({
      mode: 'SHADOW',
      contexts: catalog().contexts.map((context) => ({
        ...context,
        capabilities: {
          ...context.capabilities,
          legacyPlacementWrite: false,
          instanceV6Write: false,
        },
        items: context.items.map((candidate) => ({
          ...candidate,
          placementCapabilities: {
            canAdd: false,
            canHide: false,
            canMove: false,
            canResize: false,
          },
        })),
      })),
    });

    expect(observeHomeWidgetShadow(shadowConnection, shadow)).toEqual({
      status: 'MATCH',
      mismatchCount: 0,
      decisionRevision: 'decision-1',
      mismatches: [],
    });
  });

  it('reports exact native drift evidence and still returns the static renderer decision', () => {
    const complete = catalog();
    const shadow = catalog({
      mode: 'SHADOW',
      contexts: [
        {
          ...complete.contexts[0]!,
          items: complete.contexts[0]!.items.map((candidate) =>
            candidate.legacyWidgetKey === 'focus'
              ? {
                  ...candidate,
                  effectiveState: 'DENY' as const,
                  reasonCodes: ['DISABLED_BY_ORGANIZATION' as const],
                }
              : candidate
          ),
        },
      ],
    });

    expect(observeHomeWidgetShadow(shadowConnection, shadow)).toEqual({
      status: 'DRIFT',
      mismatchCount: 1,
      decisionRevision: 'decision-1',
      mismatches: [
        {
          widgetKey: 'focus',
          observedRender: 'UNAVAILABLE',
          observedReason: 'DISABLED_BY_ORGANIZATION',
        },
      ],
    });
    expect(resolveHomeWidgetRuntimeDecisions(shadowConnection, shadow).focus).toMatchObject({
      render: 'NATIVE',
      publicReason: 'AVAILABLE',
    });
  });
});

describe('authoritative widget access', () => {
  const connection = resolveWidgetRegistryConnection(
    readiness({
      migrationMode: 'AUTHORITATIVE',
      runtimeActivationReady: true,
      capabilities: [
        'WIDGET_REGISTRY_CONTROL_PLANE',
        'TENANT_WIDGET_POLICY',
        'WIDGET_REGISTRY_AUTHORITATIVE_RUNTIME',
      ],
    })
  );

  it('fails closed for missing, duplicate, mismatched, or unresolved definitions', () => {
    expect(resolveHomeWidgetRuntimeDecisions(connection, null).focus.render).toBe('UNAVAILABLE');
    const complete = catalog();
    const missing = catalog({
      contexts: [
        {
          ...complete.contexts[0]!,
          items: complete.contexts[0]!.items.filter(
            (candidate) => candidate.legacyWidgetKey !== 'focus'
          ),
        },
      ],
    });
    expect(resolveHomeWidgetRuntimeDecisions(connection, missing).focus.render).toBe('UNAVAILABLE');

    const duplicate = catalog({
      contexts: [
        {
          ...complete.contexts[0]!,
          items: [
            ...complete.contexts[0]!.items,
            item('focus', 'core.work.focus', {
              definitionId: '50000000-0000-4000-8000-000000000001',
            }),
          ],
        },
      ],
    });
    expect(resolveHomeWidgetRuntimeDecisions(connection, duplicate).focus.render).toBe(
      'UNAVAILABLE'
    );

    const mismatched = catalog({}, { definitionKey: 'unknown.definition' });
    expect(resolveHomeWidgetRuntimeDecisions(connection, mismatched).focus.publicReason).toBe(
      'INCOMPATIBLE'
    );
    const unresolved = catalog({}, { resolvedVersionId: '' });
    expect(resolveHomeWidgetRuntimeDecisions(connection, unresolved).schedule.render).toBe(
      'UNAVAILABLE'
    );
    const unknownVersion = catalog({}, { semanticVersion: '2.0.0' });
    expect(
      resolveHomeWidgetRuntimeDecisions(connection, unknownVersion).schedule.publicReason
    ).toBe('INCOMPATIBLE');
    expect(() =>
      resolveHomeWidgetRuntimeDecisions(connection, {
        ...complete,
        contexts: null,
      } as unknown as EffectiveWidgetCatalog)
    ).not.toThrow();
    expect(
      resolveHomeWidgetRuntimeDecisions(connection, {
        ...complete,
        contexts: null,
      } as unknown as EffectiveWidgetCatalog).focus.render
    ).toBe('UNAVAILABLE');
  });

  it('renders a valid deprecated placement but forbids add and restore', () => {
    const deprecated = catalog({}, { effectiveState: 'DEPRECATED', reasonCodes: ['DEPRECATED'] });
    expect(resolveHomeWidgetRuntimeDecisions(connection, deprecated).activity).toMatchObject({
      render: 'NATIVE',
      deprecated: true,
      canAdd: false,
      canRestore: false,
    });
  });

  it('fails closed for policy denial and unsupported host API', () => {
    const denied = catalog(
      {},
      {
        effectiveState: 'DENY',
        reasonCodes: ['DISABLED_BY_ORGANIZATION'],
      }
    );
    expect(resolveHomeWidgetRuntimeDecisions(connection, denied).focus).toMatchObject({
      render: 'UNAVAILABLE',
      publicReason: 'DISABLED_BY_ORGANIZATION',
    });
    const incompatible = catalog({
      hostContext: { ...catalog().hostContext, hostCapabilityVersion: 2 },
    });
    expect(resolveHomeWidgetRuntimeDecisions(connection, incompatible).focus.publicReason).toBe(
      'INCOMPATIBLE'
    );
    const internalReason = catalog(
      {},
      {
        effectiveState: 'DENY',
        reasonCodes: ['VERSION_REVOKED' as unknown as EffectiveWidgetCatalogItem['reasonCodes'][0]],
      }
    );
    expect(resolveHomeWidgetRuntimeDecisions(connection, internalReason).focus.publicReason).toBe(
      'TEMPORARILY_UNAVAILABLE'
    );
  });

  it('rejects unknown renderer fields and closes placement when host write capability is absent', () => {
    const complete = catalog();
    const unknownRenderer = catalog({
      contexts: [
        {
          ...complete.contexts[0]!,
          items: complete.contexts[0]!.items.map((candidate) =>
            candidate.legacyWidgetKey === 'focus'
              ? ({
                  ...candidate,
                  renderer: { kind: 'REMOTE', scriptUrl: 'javascript:alert(1)' },
                } as unknown as EffectiveWidgetCatalogItem)
              : candidate
          ),
        },
      ],
    });
    expect(resolveHomeWidgetRuntimeDecisions(connection, unknownRenderer).focus).toMatchObject({
      render: 'UNAVAILABLE',
      publicReason: 'TEMPORARILY_UNAVAILABLE',
    });

    const readOnly = catalog({
      contexts: [
        {
          ...complete.contexts[0]!,
          capabilities: {
            ...complete.contexts[0]!.capabilities,
            legacyPlacementWrite: false,
            instanceV6Write: false,
          },
        },
      ],
    });
    expect(resolveHomeWidgetRuntimeDecisions(connection, readOnly).focus).toMatchObject({
      render: 'NATIVE',
      canAdd: false,
      canRestore: false,
    });
  });

  it('does not let a shadow diff alter the static runtime', () => {
    const shadowConnection = resolveWidgetRegistryConnection(readiness());
    const shadow = catalog(
      { mode: 'SHADOW' },
      {
        effectiveState: 'DENY',
        reasonCodes: ['TEMPORARILY_UNAVAILABLE'],
      }
    );
    expect(resolveHomeWidgetRuntimeDecisions(shadowConnection, shadow).focus).toMatchObject({
      render: 'NATIVE',
      canAdd: true,
    });
  });

  it('resolves the governed command rail independently from personal Flow widgets', () => {
    const classicCatalog = catalog();
    const flowCatalog = catalog({
      hostContext: { ...classicCatalog.hostContext, resolvedHostMode: 'FLOW' },
      contexts: [
        {
          ...classicCatalog.contexts[0]!,
          placementContext: 'FLOW_PERSONAL',
          items: classicCatalog.contexts[0]!.items.filter(
            (candidate) => candidate.legacyWidgetKey !== 'command-rail'
          ),
        },
        {
          ...classicCatalog.contexts[0]!,
          placementContext: 'FLOW_GOVERNED',
          items: [item('command-rail', 'core.workspace.command-rail')],
        },
      ],
    });
    const decisions = resolveHomeWidgetRuntimeDecisions(connection, flowCatalog);
    expect(decisions['command-rail'].render).toBe('NATIVE');
    expect(decisions.focus.render).toBe('NATIVE');
  });
});
