import { describe, expect, it } from 'vitest';

import {
  homeV2ToExperience,
  homeV2NativeRuntimeState,
  homeV2ToNotificationSummary,
  homeV2ToOverview,
} from './home-v2-legacy-adapter';
import {
  HOME_NATIVE_BINDING_CATALOG_REVISION,
  NATIVE_HOME_WIDGET_BINDINGS,
} from './widget-registry-runtime';

import type { HomeV2ReadModel, HomeV2Widget } from '@dwp-frontend/shared-utils';

const generatedAt = '2026-09-16T00:00:00Z';

function widget(definitionKey: string, data: unknown): HomeV2Widget {
  const binding = NATIVE_HOME_WIDGET_BINDINGS.find(
    (candidate) => candidate.definitionKey === definitionKey
  );
  if (!binding) throw new Error(`Missing native test binding: ${definitionKey}`);
  return {
    definitionKey,
    definitionManifestHash: binding.expectedManifestHash,
    definitionVersion: binding.semanticVersion,
    rendererBindingRevision: HOME_NATIVE_BINDING_CATALOG_REVISION,
    rendererKey: binding.rendererKey,
    state: 'AVAILABLE',
    payload: { data },
    source: {
      sourceKey: `SOURCE:${definitionKey}`,
      generatedAt,
      expiresAt: '2026-09-16T00:01:00Z',
      lastSuccessAt: generatedAt,
      reasonCode: null,
      retryable: false,
      resultVersion: '1',
    },
  } as unknown as HomeV2Widget;
}

function model(widgets: readonly HomeV2Widget[] = []): HomeV2ReadModel {
  return {
    appDock: [
      {
        groupKey: 'WORK_START',
        label: '업무 시작',
        apps: [
          {
            appKey: 'dwp-approvals',
            label: '결재',
            iconKey: 'approvals',
            sourceRoute: '/approvals/home',
            badgeState: 'AVAILABLE',
            badge: { total: 4, urgent: 1, version: '3' },
          },
        ],
      },
    ],
    changeVersion: 'change-1',
    expiresAt: '2026-09-16T00:01:00Z',
    generatedAt,
    mode: 'CLASSIC',
    runtime: {
      state: 'READ_ONLY_ACTIVE',
      homeMode: 'CLASSIC',
      rolloutRing: 'INTERNAL',
      rolloutRevision: 'wave6-adapter-r1',
      commandsEnabled: false,
      registryAuthoritative: false,
      expiresAt: '2026-09-16T00:05:00Z',
    },
    partial: false,
    registryMode: 'SHADOW',
    schemaVersion: 3,
    shell: {
      announcements: [],
      backgroundAssetRoute: null,
      contentAlignment: 'LEFT',
      density: 'COMFORTABLE',
      headline: '오늘의 업무',
      subheadline: '우선순위를 확인하세요.',
    },
    unavailableSources: [],
    view: {
      composition: { appLayout: null, presentation: 'balanced', widgets: [] },
      deviceClass: 'DESKTOP_STANDARD',
      deviceOverlay: null,
      mode: 'CLASSIC',
      revision: 1,
      source: 'USER',
      viewId: null,
    },
    widgets,
  };
}

const rawWorkQueue = {
  summary: { total: 2, dueSoon: 1, inProgress: 1, waiting: 0, completed: 0, active: 2, overdue: 0 },
  items: [
    {
      workItemId: '29c581c2-ef06-4563-8cc4-c897671e6934',
      id: 'approval-14',
      title: 'Purchase approval',
      summary: null,
      dataClassification: 'INTERNAL',
      type: 'APPROVAL',
      priority: 'HIGH',
      status: 'DUE_SOON',
      owner: 'Finance',
      dueAt: '2026-09-17T00:00:00Z',
      sourceSystem: 'APPROVAL',
      sourceReference: 'APR-14',
      sourceRoute: '/approvals/home',
      reason: null,
      recommendedNext: null,
      latestActivity: null,
      version: 2,
      updatedAt: generatedAt,
      capabilities: { canStart: true, canComplete: false, canWait: true },
    },
  ],
  generatedAt,
};

describe('Home v2 legacy-shaped read adapters', () => {
  it('pins native fixtures to the backend aggregate binding catalog revision', () => {
    const native = widget('core.workspace.command-rail', rawWorkQueue);

    expect(native.rendererBindingRevision).toBe(
      'b03bdd59271207ced7deaa29375ce63f4863137a4b7789d2b7c8c3a13bf345b7'
    );
    expect(native.rendererBindingRevision).toBe(HOME_NATIVE_BINDING_CATALOG_REVISION);
    expect(native.rendererBindingRevision).not.toBe(native.definitionManifestHash);
  });

  it('maps canonical backend appDock groups, placements, and badges exactly', () => {
    const source = model();
    expect(homeV2ToExperience(source, 'ko').launchpadConfiguration).toMatchObject({
      groups: [{ groupKey: 'work' }],
      placements: [{ resourceKey: 'APP.APPROVALS', groupKey: 'work' }],
    });
    expect(homeV2ToNotificationSummary(source).apps).toEqual([
      expect.objectContaining({ appKey: 'approvals', totalUnread: 4, urgentUnread: 1 }),
    ]);
  });

  it('normalizes actual Platform native uppercase work and activity DTOs', () => {
    const overview = homeV2ToOverview(
      model([
        widget('core.workspace.command-rail', rawWorkQueue),
        widget('core.activity.activity', {
          events: [],
          generatedAt,
          nextCursor: null,
          hasMore: false,
          coverage: {
            supportedObjectTypes: ['WORK_ITEM'],
            includesLegacy: true,
            includesUsage: false,
            excludedProvenance: ['SAMPLE'],
            sourceScope: 'WORKSPACE',
          },
          snapshotAt: generatedAt,
          startCursor: null,
        }),
      ])
    );

    expect(overview.work.data?.items[0]).toMatchObject({
      type: 'Approval',
      priority: 'high',
      status: 'due-soon',
    });
    expect(overview.activity).toMatchObject({ status: 'AVAILABLE', data: { events: [] } });
  });

  it('fails a malformed nested native payload closed without crashing the page', () => {
    const overview = homeV2ToOverview(
      model([widget('core.workspace.command-rail', { summary: {}, items: [null] })])
    );

    expect(overview.work).toMatchObject({ status: 'UNAVAILABLE', data: null });
  });

  it.each(['/work/../admin', '/work/.%2e/admin', '/work/%252e%252e/admin'])(
    'fails unsafe native sourceRoute %s closed before navigation',
    (sourceRoute) => {
      const unsafeWorkQueue = {
        ...rawWorkQueue,
        items: [{ ...rawWorkQueue.items[0], sourceRoute }],
      };

      expect(
        homeV2ToOverview(model([widget('core.workspace.command-rail', unsafeWorkQueue)])).work
      ).toMatchObject({ status: 'UNAVAILABLE', data: null });
    }
  );

  it('fails an encoded traversal actionPath in a native recommendation closed', () => {
    const recommendations = [
      {
        key: 'unsafe-next-action',
        kind: 'ACTION',
        priority: 'HIGH',
        title: 'Unsafe route',
        description: 'Must not be navigable.',
        actionPath: '/work/%2e%2e/admin',
        source: 'HOME_RUNTIME_V2',
        evidenceCount: 1,
        confidence: 'HIGH',
      },
    ];

    expect(
      homeV2ToOverview(model([widget('core.workspace.daily-brief', recommendations)]))
        .recommendations
    ).toMatchObject({ status: 'UNAVAILABLE', data: null });
  });

  it.each([
    ['definitionVersion', '9.9.9'],
    ['definitionManifestHash', '0'.repeat(64)],
    ['rendererBindingRevision', '0'.repeat(64)],
    ['rendererKey', 'home.untrusted'],
  ] as const)('fails native %s drift closed before using its payload', (field, value) => {
    const native = { ...widget('core.workspace.command-rail', rawWorkQueue), [field]: value };
    const source = model([native]);

    expect(homeV2ToOverview(source).work).toMatchObject({
      status: 'UNAVAILABLE',
      source: 'HOME_RUNTIME_V2',
      data: null,
      reason: 'HOME_RUNTIME_SOURCE_UNAVAILABLE',
    });
    expect(homeV2NativeRuntimeState(source)).toBeNull();
  });

  it('does not treat an unknown native definition alias as an approved binding', () => {
    const native = {
      ...widget('core.workspace.command-rail', rawWorkQueue),
      definitionKey: 'core.workspace.command-rail.alias',
    };

    expect(homeV2ToOverview(model([native])).work).toMatchObject({
      status: 'UNAVAILABLE',
      source: 'HOME_RUNTIME_V2',
      data: null,
    });
  });

  it.each(['PARTIAL', 'STALE'] as const)(
    'preserves verified native %s data with a separate freshness state',
    (state) => {
      const native = { ...widget('core.workspace.command-rail', rawWorkQueue), state };
      const source = model([native]);

      expect(homeV2ToOverview(source).work).toMatchObject({
        status: 'AVAILABLE',
        data: { items: [expect.objectContaining({ id: 'approval-14' })] },
      });
      expect(homeV2NativeRuntimeState(source)).toEqual({
        kind: state === 'STALE' ? 'stale' : 'partial',
        lastSuccessfulAt: generatedAt,
      });
    }
  );

  it('drops an app when its canonical backend group does not match the local app contract', () => {
    const source = model();
    const drifted = {
      ...source,
      appDock: [{ ...source.appDock[0], groupKey: 'COLLABORATION' }],
    } as HomeV2ReadModel;

    expect(homeV2ToExperience(drifted, 'en').launchpadConfiguration?.placements).toEqual([]);
    expect(homeV2ToNotificationSummary(drifted).apps).toEqual([]);
  });

  it('isolates an unsupported tenant extension group from the sealed legacy app dock', () => {
    const source = model();
    const extended = {
      ...source,
      appDock: [
        ...source.appDock,
        {
          groupKey: 'TENANT_TOOLS',
          label: 'Tenant tools',
          apps: source.appDock[0].apps,
        },
      ],
    } as HomeV2ReadModel;

    expect(homeV2ToExperience(extended, 'en').launchpadConfiguration?.groups).toHaveLength(1);
    expect(homeV2ToNotificationSummary(extended).apps).toHaveLength(1);
  });
});
