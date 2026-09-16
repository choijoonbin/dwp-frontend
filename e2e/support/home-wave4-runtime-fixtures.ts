import { OWNER_WIDGET_CONTRACTS } from '../../apps/dwp/src/features/home/runtime/owner-widgets/owner-widget-contracts';
import { NATIVE_HOME_WIDGET_BINDINGS } from '../../apps/dwp/src/features/home/runtime/widget-registry-runtime';
import { HOME_LAUNCHPAD_CONTRACT } from './home-launchpad-contract-fixture';

import type {
  HomeDeviceClass,
  HomeExperienceVariant,
  HomeV2ReadModel,
  HomeV2RolloutRing,
  HomeV2RuntimeMode,
  HomeV2RuntimeState,
  HomeV2Widget,
  HomeV2WidgetState,
} from '@dwp-frontend/shared-utils';
import type { OwnerWidgetDefinitionKey } from '../../apps/dwp/src/features/home/runtime/owner-widgets/owner-widget-contracts';

export const HOME_V2_ROUTE = '**/api/platform/v2/home**';
export const HOME_V2_VARY =
  'Accept-Language, X-DWP-Tenant-ID, X-DWP-User-ID, X-DWP-Person-Public-ID, X-DWP-Permissions, X-DWP-Roles, X-DWP-Group-Refs, X-DWP-Current-Decision-Revision, X-DWP-Current-Revalidate-At, X-DWP-Home-Runtime-State, X-DWP-Home-Rollout-Ring, X-DWP-Home-Rollout-Revision';

// Independently pinned to the backend V261 full 19-binding catalog receipt.
// Do not derive this from the frontend constant: the E2E gate must detect drift.
export const HOME_V2_BACKEND_BINDING_CATALOG_REVISION =
  'd9cdfe69d6d5c7f2fc04cd2423365b6b1101d91e56069ffe1b82fb5b1c854643';

const SERVER_GROUP_BY_CONTRACT_GROUP = {
  work: 'WORK_START',
  connect: 'COLLABORATION',
  services: 'PEOPLE_SERVICES',
  systems: 'SYSTEM_CONTROL',
} as const;

const OWNER_STATE_FIXTURES = [
  ['approval.focus-queue', 'AVAILABLE'],
  ['approval.my-requests', 'EMPTY'],
  ['meetings.next-prep', 'PARTIAL'],
  ['space.change-feed', 'FORBIDDEN'],
  ['messaging.response-queue', 'UNAVAILABLE'],
  ['hr.edu', 'STALE'],
] as const satisfies readonly (readonly [OwnerWidgetDefinitionKey, HomeV2WidgetState])[];

const OWNER_PLACEMENT_ORDER: readonly OwnerWidgetDefinitionKey[] = [
  'meetings.next-prep',
  'approval.focus-queue',
  'hr.edu',
  'approval.my-requests',
  'space.change-feed',
  'messaging.response-queue',
];

function ownerContract(definitionKey: OwnerWidgetDefinitionKey) {
  const value = OWNER_WIDGET_CONTRACTS.find(
    (candidate) => candidate.definitionKey === definitionKey
  );
  if (!value) throw new Error(`Missing owner widget contract for ${definitionKey}.`);
  return value;
}

function ownerPayload(definitionKey: OwnerWidgetDefinitionKey, marker: string): unknown {
  switch (definitionKey) {
    case 'approval.focus-queue':
      return {
        pendingCount: 7,
        dueTodayCount: 2,
        overdueCount: 1,
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            requestNumber: 'APR-WAVE4',
            title: `Verified approval ${marker}`,
            status: 'PENDING',
            priority: 'HIGH',
            dueAt: '2026-09-16T01:00:00Z',
            version: 4,
          },
        ],
      };
    case 'meetings.next-prep':
      return {
        meetingsToday: 2,
        meetingMinutesToday: 75,
        items: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            title: `Verified meeting ${marker}`,
            state: 'READY',
            startsAt: '2026-09-16T02:00:00Z',
            endsAt: '2026-09-16T02:30:00Z',
            attendeeCount: 4,
            version: 3,
          },
        ],
      };
    case 'hr.edu':
      return {
        requiredLearningCount: 1,
        activeGoalCount: 3,
        state: { availability: 'AVAILABLE', dataOrigin: 'SOURCE' },
      };
    default:
      return {};
  }
}

function ownerWidget(
  definitionKey: OwnerWidgetDefinitionKey,
  state: HomeV2WidgetState,
  index: number,
  marker: string
): HomeV2Widget {
  const contract = ownerContract(definitionKey);
  const sourceAction = {
    actionId: 'open-source',
    commandKey: null,
    expectedResultVersion: null,
    kind: 'SOURCE_ROUTE' as const,
    labelKey: 'home.action.openSource',
    requiresConfirmation: false,
    sourceRoute: contract.canonicalSourceRoute,
  };
  return {
    instanceId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    definitionKey,
    definitionVersion: contract.definitionVersion,
    definitionManifestHash: contract.definitionManifestHash,
    rendererBindingRevision: contract.rendererBindingRevision,
    rendererKey: contract.rendererKey,
    state,
    source: {
      sourceKey: `${definitionKey.toUpperCase().replaceAll('.', '_')}_SOURCE`,
      generatedAt: '2026-09-16T00:00:00Z',
      expiresAt: '2026-09-16T00:01:00Z',
      lastSuccessAt:
        state === 'AVAILABLE' || state === 'PARTIAL' || state === 'STALE'
          ? '2026-09-16T00:00:00Z'
          : null,
      reasonCode:
        state === 'PARTIAL' || state === 'FORBIDDEN' || state === 'UNAVAILABLE'
          ? `WAVE4_${state}`
          : null,
      retryable: state === 'PARTIAL',
      resultVersion: `wave4-${index + 1}`,
    },
    payload: ownerPayload(definitionKey, marker) as Readonly<Record<string, unknown>>,
    actions: state === 'FORBIDDEN' || state === 'UNAVAILABLE' ? [] : [sourceAction],
    redactions: [],
    governance: {
      owner: definitionKey.split('.')[0]!,
      sourceAppResourceKey: `APP.${definitionKey.split('.')[0]!.toUpperCase()}`,
      requiredAuthorities: [],
      classification: 'INTERNAL',
      retention: 'SESSION',
      sourceRoute: contract.canonicalSourceRoute,
    },
  };
}

function appDock(): HomeV2ReadModel['appDock'] {
  return HOME_LAUNCHPAD_CONTRACT.groups.map((group) => ({
    groupKey:
      SERVER_GROUP_BY_CONTRACT_GROUP[group.groupKey as keyof typeof SERVER_GROUP_BY_CONTRACT_GROUP],
    label: group.groupKey,
    apps: group.apps.map((app) => ({
      appKey: app.appId,
      label: app.resourceKey,
      iconKey: app.iconKey,
      sourceRoute: app.route,
      badgeState:
        app.appId === 'dwp-approvals' ? ('AVAILABLE' as const) : ('NOT_REQUESTED' as const),
      badge: app.appId === 'dwp-approvals' ? { total: 7, urgent: 2, version: '4' } : null,
    })),
  }));
}

function nativeWorkWidget(
  marker: string,
  bindingRevision: string,
  trust: 'TRUSTED' | 'UNTRUSTED' = 'TRUSTED'
): HomeV2Widget {
  const binding = NATIVE_HOME_WIDGET_BINDINGS.find(
    (candidate) => candidate.definitionKey === 'core.workspace.command-rail'
  );
  if (!binding) throw new Error('Missing native command rail contract.');
  return {
    instanceId: '00000000-0000-4000-8000-000000000099',
    definitionKey: binding.definitionKey,
    definitionVersion: binding.semanticVersion,
    definitionManifestHash: binding.expectedManifestHash,
    rendererBindingRevision: bindingRevision,
    rendererKey: binding.rendererKey,
    state: 'AVAILABLE',
    source: {
      sourceKey: trust === 'TRUSTED' ? 'WORK_RUNTIME_SOURCE' : 'UNTRUSTED_NATIVE_TUPLE_SOURCE',
      generatedAt: '2026-09-16T00:00:00Z',
      expiresAt: '2026-09-16T00:01:00Z',
      lastSuccessAt: '2026-09-16T00:00:00Z',
      reasonCode: null,
      retryable: false,
      resultVersion: 'native-drift-1',
    },
    payload: {
      data: {
        summary: {
          total: 1,
          dueSoon: 1,
          inProgress: 0,
          waiting: 0,
          completed: 0,
          active: 1,
          overdue: 0,
        },
        items: [
          {
            workItemId: '99999999-9999-4999-8999-999999999999',
            id: 'native-drift-item',
            title:
              trust === 'TRUSTED'
                ? `Verified native work ${marker}`
                : `UNTRUSTED NATIVE PAYLOAD ${marker}`,
            summary: null,
            dataClassification: 'INTERNAL',
            type: 'TASK',
            priority: 'HIGH',
            status: 'DUE_SOON',
            owner: trust === 'TRUSTED' ? 'DWP Work' : 'Untrusted provider',
            dueAt: '2026-09-17T00:00:00Z',
            sourceSystem: trust === 'TRUSTED' ? 'DWP' : 'UNTRUSTED',
            sourceReference: trust === 'TRUSTED' ? 'WORK-WAVE4-1' : 'UNTRUSTED-1',
            sourceRoute: '/work',
            reason: null,
            recommendedNext: null,
            latestActivity: null,
            version: 1,
            updatedAt: '2026-09-16T00:00:00Z',
            capabilities: { canStart: false, canComplete: false, canWait: false },
          },
        ],
        generatedAt: '2026-09-16T00:00:00Z',
      },
    },
    actions: [],
    redactions: [],
    governance: {
      owner: 'core.workspace',
      sourceAppResourceKey: 'APP.WORK',
      requiredAuthorities: ['APP.WORK:VIEW'],
      classification: 'CONFIDENTIAL',
      retention: 'NONE',
      sourceRoute: '/work',
    },
  };
}

export function createHomeWave4Model({
  deviceClass,
  marker,
  mode = 'CLASSIC',
}: Readonly<{
  deviceClass: HomeDeviceClass;
  marker: string;
  mode?: HomeExperienceVariant;
}>): HomeV2ReadModel {
  return {
    schemaVersion: 3,
    mode,
    runtime: {
      state: 'READ_ONLY_ACTIVE',
      homeMode: mode,
      rolloutRing: 'INTERNAL',
      rolloutRevision: 'wave6-read-only-r1',
      commandsEnabled: false,
      registryAuthoritative: false,
      expiresAt: '2026-09-16T00:05:00Z',
    },
    view: {
      viewId: '33333333-3333-4333-8333-333333333333',
      revision: 4,
      source: 'BROKER',
      mode,
      deviceClass,
      composition: {
        appLayout: null,
        presentation: 'balanced',
        widgets: OWNER_STATE_FIXTURES.map(([definitionKey], index) => ({
          widgetKey: definitionKey,
          visible: true,
          size: index === 2 ? 'large' : 'medium',
          height: 'standard',
        })),
      },
      deviceOverlay: {
        density: deviceClass.startsWith('MOBILE_') ? 'compact' : 'comfortable',
        widgetOrder: [...OWNER_PLACEMENT_ORDER],
        widgetSizes: {
          'meetings.next-prep': 'full',
          'approval.focus-queue': 'medium',
        },
      },
    },
    shell: {
      headline: `Broker Home ${marker}`,
      subheadline: 'Verified Wave 4 runtime broker receipt',
      contentAlignment: 'LEFT',
      density: 'COMFORTABLE',
      backgroundAssetRoute: null,
      announcements: [],
    },
    appDock: appDock(),
    widgets: [
      nativeWorkWidget(marker, HOME_V2_BACKEND_BINDING_CATALOG_REVISION),
      ...OWNER_STATE_FIXTURES.map(([definitionKey, state], index) =>
        ownerWidget(definitionKey, state, index, marker)
      ),
    ],
    generatedAt: '2026-09-16T00:00:00Z',
    expiresAt: '2026-09-16T00:01:00Z',
    partial: true,
    unavailableSources: ['SPACE_HOME', 'MESSAGING_HOME'],
    changeVersion: `wave4-${marker}`,
    registryMode: 'SHADOW',
  };
}

export function withHomeWave6Runtime(
  model: HomeV2ReadModel,
  state: Exclude<HomeV2RuntimeState, 'DISABLED'>,
  options: Readonly<{
    registryAuthoritative?: boolean;
    rolloutRevision?: string;
    rolloutRing?: HomeV2RolloutRing;
  }> = {}
): HomeV2ReadModel {
  const commandsEnabled = state === 'COMMAND_CANARY';
  const registryAuthoritative = options.registryAuthoritative === true;
  return {
    ...model,
    registryMode: registryAuthoritative ? 'AUTHORITATIVE' : 'SHADOW',
    runtime: {
      state,
      homeMode: model.mode,
      rolloutRing: options.rolloutRing ?? (state === 'SHADOW_COMPARE' ? 'CONTROL' : 'INTERNAL'),
      rolloutRevision: options.rolloutRevision ?? `wave6-${state.toLowerCase()}-r1`,
      commandsEnabled,
      registryAuthoritative,
      expiresAt: '2026-09-16T00:05:00Z',
    },
  };
}

export function withHomeWave6DismissCommand(
  model: HomeV2ReadModel,
  widgetState: HomeV2WidgetState = 'AVAILABLE'
): HomeV2ReadModel {
  const binding = NATIVE_HOME_WIDGET_BINDINGS.find(
    (candidate) => candidate.definitionKey === 'core.workspace.daily-brief'
  );
  if (!binding) throw new Error('Missing native daily brief contract.');
  const recommendation = {
    key: 'wave6-daily-focus',
    kind: 'ACTION',
    priority: 'HIGH',
    title: 'Review the Wave 6 release gate',
    description: 'Check the bounded rollout evidence before promotion.',
    actionPath: '/work',
    source: 'DWP Work',
    evidenceCount: 3,
    confidence: 'HIGH',
  } as const;
  const commandWidget: HomeV2Widget = {
    instanceId: '66666666-6666-4666-8666-666666666666',
    definitionKey: binding.definitionKey,
    definitionVersion: binding.semanticVersion,
    definitionManifestHash: binding.expectedManifestHash,
    rendererBindingRevision: HOME_V2_BACKEND_BINDING_CATALOG_REVISION,
    rendererKey: binding.rendererKey,
    state: widgetState,
    source: {
      sourceKey: 'HOME_RECOMMENDATIONS',
      generatedAt: '2026-09-16T00:00:00Z',
      expiresAt: '2026-09-16T00:05:00Z',
      lastSuccessAt: '2026-09-16T00:00:00Z',
      reasonCode: widgetState === 'FORBIDDEN' ? 'ACTION_DENIED' : null,
      retryable: false,
      resultVersion: 'recommendation-wave6-1',
    },
    payload: { data: [recommendation] },
    actions:
      widgetState === 'AVAILABLE'
        ? [
            {
              actionId: 'dismiss-recommendation',
              commandKey: 'home.recommendation.dismiss',
              expectedResultVersion: 'recommendation-wave6-1',
              kind: 'COMMAND',
              labelKey: 'home.action.dismissRecommendation',
              requiresConfirmation: true,
              sourceRoute: null,
            },
          ]
        : [],
    redactions: [],
    governance: {
      owner: 'core.workspace',
      sourceAppResourceKey: 'APP.WORK',
      requiredAuthorities: ['APP.WORK:VIEW'],
      classification: 'INTERNAL',
      retention: 'NONE',
      sourceRoute: '/work',
    },
  };
  return withHomeWave6Runtime(
    {
      ...model,
      view: {
        ...model.view,
        composition: {
          ...model.view.composition,
          widgets: [
            ...model.view.composition.widgets,
            { widgetKey: 'daily-brief', visible: true, size: 'large', height: 'standard' },
          ],
        },
        deviceOverlay: model.view.deviceOverlay
          ? {
              ...model.view.deviceOverlay,
              widgetOrder: [...model.view.deviceOverlay.widgetOrder, 'daily-brief'],
            }
          : null,
      },
      widgets: [...model.widgets, commandWidget],
    },
    'COMMAND_CANARY'
  );
}

export function createHomeWave4NativeBindingDriftModel(
  input: Parameters<typeof createHomeWave4Model>[0]
): HomeV2ReadModel {
  const model = createHomeWave4Model(input);
  const driftedRevision = `0${HOME_V2_BACKEND_BINDING_CATALOG_REVISION.slice(1)}`;
  return {
    ...model,
    widgets: [
      nativeWorkWidget(input.marker, driftedRevision, 'UNTRUSTED'),
      ...model.widgets.filter((widget) => widget.definitionKey !== 'core.workspace.command-rail'),
    ],
  };
}

export function createHomeWave4UnsafeRouteModel(
  input: Parameters<typeof createHomeWave4Model>[0]
): HomeV2ReadModel {
  const model = createHomeWave4Model(input);
  let mutatedActionCount = 0;
  const widgets = model.widgets.map((widget) =>
    widget.definitionKey === 'approval.focus-queue'
      ? {
          ...widget,
          actions: widget.actions.map((action) => {
            if (action.actionId !== 'open-source') return action;
            mutatedActionCount += 1;
            return {
              ...action,
              sourceRoute: '/approvals/%252e%252e/admin',
            };
          }),
        }
      : widget
  );
  if (mutatedActionCount !== 1) {
    throw new Error(`Expected one unsafe-route action fixture, received ${mutatedActionCount}.`);
  }
  return {
    ...model,
    widgets,
  };
}

export function homeWave4ResponseHeaders(
  runtimeMode: HomeV2RuntimeMode,
  etag: string,
  options: Readonly<{
    registryAuthoritative?: boolean;
    rolloutRevision?: string;
    rolloutRing?: HomeV2RolloutRing;
    runtimeState?: Exclude<HomeV2RuntimeState, 'DISABLED'>;
  }> = {}
): Readonly<Record<string, string>> {
  const runtimeState =
    options.runtimeState ?? (runtimeMode === 'SHADOW' ? 'SHADOW_COMPARE' : 'READ_ONLY_ACTIVE');
  return {
    'Cache-Control': 'private, max-age=0, must-revalidate',
    Vary: HOME_V2_VARY,
    ETag: etag,
    'X-DWP-Decision-Revision': 'home-route-decision-r1',
    'X-DWP-Home-Commands-Enabled': runtimeState === 'COMMAND_CANARY' ? 'true' : 'false',
    'X-DWP-Home-Runtime-Mode': runtimeMode,
    'X-DWP-Home-Runtime-State': runtimeState,
    'X-DWP-Home-Rollout-Ring':
      options.rolloutRing ?? (runtimeState === 'SHADOW_COMPARE' ? 'CONTROL' : 'INTERNAL'),
    'X-DWP-Home-Rollout-Revision':
      options.rolloutRevision ?? `wave6-${runtimeState.toLowerCase()}-r1`,
    'X-DWP-Widget-Registry-Authoritative': options.registryAuthoritative ? 'true' : 'false',
  };
}

export function homeWave4ResponseBody(model: HomeV2ReadModel): string {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', data: model });
}
