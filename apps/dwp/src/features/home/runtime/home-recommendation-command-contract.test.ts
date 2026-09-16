import { describe, expect, it } from 'vitest';

import {
  HOME_WIDGET_BINDING_CATALOG_REVISION,
  NATIVE_HOME_WIDGET_BINDINGS,
} from './widget-registry-runtime';
import { resolveHomeRecommendationCommand } from './home-recommendation-command-contract';

import type { HomeV2ReadModel, HomeV2ResponseMetadata } from '@dwp-frontend/shared-utils';

const binding = NATIVE_HOME_WIDGET_BINDINGS.find(
  (candidate) => candidate.definitionKey === 'core.workspace.daily-brief'
)!;

function metadata(overrides: Partial<HomeV2ResponseMetadata> = {}): HomeV2ResponseMetadata {
  return {
    actionAuthority: 'EXACT_ALLOWLIST',
    cacheControl: 'private, max-age=0, must-revalidate',
    commandsEnabled: true,
    decisionRevision: 'home-route-decision-r1',
    registryAuthoritative: false,
    renderAuthority: 'HOME_V2',
    rolloutRing: 'INTERNAL',
    rolloutRevision: 'wave6-r1',
    runtimeMode: 'ACTIVE',
    runtimeState: 'COMMAND_CANARY',
    vary: 'bounded',
    ...overrides,
  };
}

function model(
  widgetOverrides: Record<string, unknown> = {},
  actionOverrides: Record<string, unknown> = {}
): HomeV2ReadModel {
  return {
    runtime: {
      commandsEnabled: true,
      expiresAt: '2026-09-16T02:00:00Z',
      homeMode: 'CLASSIC',
      registryAuthoritative: false,
      rolloutRing: 'INTERNAL',
      rolloutRevision: 'wave6-r1',
      state: 'COMMAND_CANARY',
    },
    schemaVersion: 3,
    mode: 'CLASSIC',
    view: {
      viewId: null,
      revision: 1,
      source: 'BROKER',
      mode: 'CLASSIC',
      deviceClass: 'DESKTOP_STANDARD',
      composition: { appLayout: null, widgets: [] },
      deviceOverlay: null,
    },
    shell: {
      headline: 'Home',
      subheadline: 'Home',
      contentAlignment: 'LEFT',
      density: 'COMFORTABLE',
      backgroundAssetRoute: null,
      announcements: [],
    },
    appDock: [],
    widgets: [
      {
        instanceId: '11111111-1111-4111-8111-111111111111',
        definitionKey: binding.definitionKey,
        definitionVersion: binding.semanticVersion,
        definitionManifestHash: binding.expectedManifestHash,
        rendererBindingRevision: HOME_WIDGET_BINDING_CATALOG_REVISION,
        rendererKey: binding.rendererKey,
        state: 'AVAILABLE',
        source: {
          sourceKey: 'HOME_RECOMMENDATIONS',
          generatedAt: '2026-09-16T00:00:00Z',
          expiresAt: '2026-09-16T00:01:00Z',
          lastSuccessAt: '2026-09-16T00:00:00Z',
          reasonCode: null,
          retryable: false,
          resultVersion: 'recommendation-7',
        },
        payload: { data: [{ key: 'daily-focus' }] },
        actions: [
          {
            actionId: 'dismiss-recommendation',
            commandKey: 'home.recommendation.dismiss',
            expectedResultVersion: 'recommendation-7',
            kind: 'COMMAND',
            labelKey: 'home.action.dismissRecommendation',
            requiresConfirmation: true,
            sourceRoute: null,
            ...actionOverrides,
          },
        ],
        redactions: [],
        governance: {
          owner: 'core.workspace',
          sourceAppResourceKey: 'APP.WORK',
          requiredAuthorities: ['APP.WORK:VIEW'],
          classification: 'INTERNAL',
          retention: 'NONE',
          sourceRoute: '/work',
        },
        ...widgetOverrides,
      },
    ],
    generatedAt: '2026-09-16T00:00:00Z',
    expiresAt: '2026-09-16T00:01:00Z',
    partial: false,
    unavailableSources: [],
    changeVersion: 'wave6-1',
    registryMode: 'SHADOW',
  } as HomeV2ReadModel;
}

describe('Home recommendation command contract', () => {
  it('admits only the exact native binding, owner action, result version, and payload key', () => {
    expect(resolveHomeRecommendationCommand(model(), metadata())).toEqual({
      kind: 'READY',
      command: {
        actionId: 'dismiss-recommendation',
        expectedResultVersion: 'recommendation-7',
        instanceId: '11111111-1111-4111-8111-111111111111',
        recommendationKeys: ['daily-focus'],
      },
    });
    expect(resolveHomeRecommendationCommand(model({ state: 'PARTIAL' }), metadata()).kind).toBe(
      'READY'
    );
  });

  it.each([
    ['read-only state', {}, {}],
    ['global header alone', {}, { actionAuthority: 'DISABLED' }],
    ['manifest drift', { definitionManifestHash: '0'.repeat(64) }, {}],
    ['unavailable owner', { state: 'UNAVAILABLE' }, {}],
    ['version drift', {}, { expectedResultVersion: 'recommendation-6' }],
    ['wrong command', {}, { commandKey: 'home.recommendation.delete' }],
    ['confirmation bypass', {}, { requiresConfirmation: false }],
  ])('fails closed for %s', (_label, widget, action) => {
    const result = resolveHomeRecommendationCommand(
      model(widget, action),
      metadata(
        _label === 'read-only state'
          ? {
              runtimeState: 'READ_ONLY_ACTIVE',
              commandsEnabled: false,
              actionAuthority: 'DISABLED',
            }
          : _label === 'global header alone'
            ? { actionAuthority: 'DISABLED' }
            : {}
      )
    );
    expect(result.kind).not.toBe('READY');
  });

  it('distinguishes provider denial from owner unavailability', () => {
    expect(resolveHomeRecommendationCommand(model({ state: 'FORBIDDEN' }), metadata()).kind).toBe(
      'DENIED'
    );
    expect(resolveHomeRecommendationCommand(model({ state: 'STALE' }), metadata()).kind).toBe(
      'UNAVAILABLE'
    );
  });
});
