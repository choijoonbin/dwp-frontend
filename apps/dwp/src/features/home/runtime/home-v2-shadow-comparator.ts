import {
  NATIVE_HOME_WIDGET_BINDINGS,
  HOME_WIDGET_BINDING_CATALOG_REVISION,
} from './widget-registry-runtime';
import { resolveOwnerWidgetContract } from './owner-widgets/owner-widget-contracts';

import type {
  HomeDeviceLayoutOverlay,
  HomeExperienceVariant,
  HomeOverview,
  HomePresentation,
  HomeV2ReadModel,
  HomeV2WidgetState,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type {
  HomeAppDefinition,
  LaunchpadLayout,
} from '../../../components/workspace-composer/app-launchpad-model';

export const HOME_SHADOW_OUTCOMES = [
  'MATCH',
  'EXPECTED_TRANSIENT',
  'MISMATCH',
  'UNAVAILABLE',
] as const;
export type HomeShadowOutcome = (typeof HOME_SHADOW_OUTCOMES)[number];

export const HOME_SHADOW_REASONS = [
  'MATCH',
  'EXPECTED_TRANSIENT',
  'STRUCTURE',
  'AUTHORITY',
  'MODE',
  'LAYOUT',
  'APP_DOCK',
  'WIDGET_STATE',
  'ROUTE_ACTION',
  'FRESHNESS',
  'UNAVAILABLE',
] as const;
export type HomeShadowReason = (typeof HOME_SHADOW_REASONS)[number];

type WidgetStateProjection = Readonly<{
  binding: 'TRUSTED' | 'UNTRUSTED';
  key: string;
  state: HomeV2WidgetState;
}>;

export type HomeShadowSemanticSnapshot = Readonly<{
  appDock: readonly string[];
  customized: boolean;
  density: 'comfortable' | 'compact';
  freshness: 'CURRENT' | 'STALE';
  layout: readonly string[];
  mode: HomeExperienceVariant;
  partial: boolean;
  presentation: HomePresentation;
  requiredAnnouncements: readonly string[];
  routeActions: readonly string[];
  widgets: readonly WidgetStateProjection[];
}>;

export type HomeShadowComparison = Readonly<{
  count: number;
  outcome: HomeShadowOutcome;
  reasons: readonly HomeShadowReason[];
}>;

const SERVER_GROUPS: Readonly<Record<string, string>> = {
  WORK_START: 'work',
  COLLABORATION: 'connect',
  PEOPLE_SERVICES: 'services',
  SYSTEM_CONTROL: 'systems',
};
const NATIVE_BY_DEFINITION = new Map(
  NATIVE_HOME_WIDGET_BINDINGS.map((binding) => [binding.definitionKey, binding] as const)
);
const NATIVE_BY_LEGACY = new Map<string, (typeof NATIVE_HOME_WIDGET_BINDINGS)[number]>(
  NATIVE_HOME_WIDGET_BINDINGS.map((binding) => [binding.legacyWidgetKey, binding] as const)
);

function canonicalWidgetKey(key: string): string {
  return NATIVE_BY_DEFINITION.get(key)?.legacyWidgetKey ?? key;
}

function legacyBadgeCounts(app: HomeAppDefinition): readonly [number, number] {
  if (app.badgeMetadata) {
    return [app.badgeMetadata.totalUnread, app.badgeMetadata.urgentUnread];
  }
  const visibleCount = app.badge ? Number.parseInt(app.badge, 10) : 0;
  return [Number.isFinite(visibleCount) ? visibleCount : 0, 0];
}

function widgetBindingTrusted(widget: HomeV2ReadModel['widgets'][number]): boolean {
  const native = NATIVE_BY_DEFINITION.get(widget.definitionKey);
  if (native) {
    return (
      widget.definitionVersion === native.semanticVersion &&
      widget.definitionManifestHash === native.expectedManifestHash &&
      widget.rendererBindingRevision === HOME_WIDGET_BINDING_CATALOG_REVISION &&
      widget.rendererKey === native.rendererKey
    );
  }
  return resolveOwnerWidgetContract(widget) !== null;
}

function canonicalLayout(
  widgets: readonly PersonalHomeWidgetPreference<string>[],
  overlay: HomeDeviceLayoutOverlay | null | undefined
): readonly string[] {
  const order = new Map((overlay?.widgetOrder ?? []).map((key, index) => [key, index]));
  return widgets
    .map((widget, baseIndex) => ({
      baseIndex,
      key: canonicalWidgetKey(widget.widgetKey),
      order: order.get(widget.widgetKey) ?? Number.MAX_SAFE_INTEGER,
      size: overlay?.widgetSizes[widget.widgetKey] ?? widget.size ?? 'medium',
      height: widget.height ?? 'standard',
      visible: widget.visible,
    }))
    .sort((left, right) => left.order - right.order || left.baseIndex - right.baseIndex)
    .map(
      ({ key, visible, size, height }) =>
        `${key}:${visible ? 'visible' : 'hidden'}:${size}:${height}`
    );
}

function sectionState(
  section:
    | Readonly<{
        data?: unknown;
        status: 'AVAILABLE' | 'FORBIDDEN' | 'UNAVAILABLE';
      }>
    | undefined
): HomeV2WidgetState {
  if (!section) return 'UNAVAILABLE';
  if (section.status === 'FORBIDDEN') return 'FORBIDDEN';
  if (section.status === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (Array.isArray(section.data) && section.data.length === 0) return 'EMPTY';
  return section.data == null ? 'EMPTY' : 'AVAILABLE';
}

function legacyWidgetState(key: string, overview: HomeOverview | undefined): HomeV2WidgetState {
  switch (key) {
    case 'daily-brief':
      return sectionState(overview?.recommendations);
    case 'schedule':
    case 'meeting-load':
      return sectionState(overview?.calendar);
    case 'activity':
      return sectionState(overview?.activity);
    case 'command-rail':
    case 'focus':
    case 'focus-balance':
      return sectionState(overview?.work);
    default:
      return 'AVAILABLE';
  }
}

export function projectHomeV2ShadowSnapshot(
  model: HomeV2ReadModel,
  now = Date.now()
): HomeShadowSemanticSnapshot {
  return {
    appDock: model.appDock.flatMap((group) => [
      `group:${SERVER_GROUPS[group.groupKey] ?? group.groupKey}`,
      ...group.apps.map(
        (app) =>
          `app:${app.appKey}:${app.badgeState}:${app.badge?.total ?? 0}:${app.badge?.urgent ?? 0}:${app.badge && /^\d+$/u.test(app.badge.version) ? 'COUNTER' : 'NONE'}`
      ),
    ]),
    customized: model.view.source !== 'DEFAULT',
    density: model.view.deviceOverlay?.density ?? 'comfortable',
    freshness: Date.parse(model.expiresAt) < now ? 'STALE' : 'CURRENT',
    layout: canonicalLayout(model.view.composition.widgets, model.view.deviceOverlay),
    mode: model.mode,
    partial: model.partial || model.unavailableSources.length > 0,
    presentation: model.view.composition.presentation ?? 'balanced',
    requiredAnnouncements: model.shell.announcements
      .filter((announcement) => announcement.kind === 'REQUIRED')
      .map((announcement) => announcement.kind)
      .sort(),
    routeActions: model.widgets
      .flatMap((widget) =>
        widget.actions.map(
          (action) =>
            `${canonicalWidgetKey(widget.definitionKey)}:${action.kind}:${action.sourceRoute ?? 'COMMAND'}`
        )
      )
      .sort(),
    widgets: model.widgets
      .map((widget) => ({
        binding: widgetBindingTrusted(widget) ? ('TRUSTED' as const) : ('UNTRUSTED' as const),
        key: canonicalWidgetKey(widget.definitionKey),
        state: widget.state,
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
}

export function projectLegacyHomeShadowSnapshot({
  appLayout,
  apps,
  customized,
  deviceOverlay,
  mode,
  overview,
  presentation,
  requiredAnnouncements = [],
  widgets,
  now = Date.now(),
}: Readonly<{
  appLayout: LaunchpadLayout;
  apps: readonly HomeAppDefinition[];
  customized: boolean;
  deviceOverlay?: HomeDeviceLayoutOverlay;
  mode: HomeExperienceVariant;
  now?: number;
  overview?: HomeOverview;
  presentation: HomePresentation;
  requiredAnnouncements?: readonly string[];
  widgets: readonly PersonalHomeWidgetPreference<string>[];
}>): HomeShadowSemanticSnapshot {
  const appById = new Map(apps.map((app) => [app.id, app]));
  const appDock = Object.entries(appLayout.groups).flatMap(([group, appIds]) => [
    `group:${group}`,
    ...appIds.flatMap((appId) => {
      const app = appById.get(appId);
      if (!app) return [];
      const [total, urgent] = legacyBadgeCounts(app);
      return [
        `app:${app.id}:${app.badgeMetadata || app.badge ? 'AVAILABLE' : 'NOT_REQUESTED'}:${total}:${urgent}:${app.badgeMetadata || app.badge ? 'COUNTER' : 'NONE'}`,
      ];
    }),
  ]);
  const freshness =
    overview && now - Date.parse(overview.generatedAt) <= 5 * 60 * 1000 ? 'CURRENT' : 'STALE';
  return {
    appDock,
    customized,
    density: deviceOverlay?.density ?? 'comfortable',
    freshness,
    layout: canonicalLayout(widgets, deviceOverlay),
    mode,
    partial: Boolean(
      overview &&
      [
        overview.work,
        overview.calendar,
        overview.activity,
        overview.recommendations,
        overview.communications,
      ].some((section) => section.status === 'UNAVAILABLE')
    ),
    presentation,
    requiredAnnouncements: [...requiredAnnouncements].sort(),
    routeActions: (overview?.recommendations.data ?? [])
      .map((recommendation) => `daily-brief:SOURCE_ROUTE:${recommendation.actionPath}`)
      .sort(),
    widgets: widgets
      .filter((widget) => widget.visible)
      .map((widget) => ({
        binding: NATIVE_BY_LEGACY.has(widget.widgetKey)
          ? ('TRUSTED' as const)
          : ('UNTRUSTED' as const),
        key: canonicalWidgetKey(widget.widgetKey),
        state: legacyWidgetState(widget.widgetKey, overview),
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function compareHomeShadowSnapshots(
  legacy: HomeShadowSemanticSnapshot | null,
  homeV2: HomeShadowSemanticSnapshot | null
): HomeShadowComparison {
  if (!legacy || !homeV2) return { count: 1, outcome: 'UNAVAILABLE', reasons: ['UNAVAILABLE'] };
  const reasons: HomeShadowReason[] = [];
  if (legacy.mode !== homeV2.mode) reasons.push('MODE');
  if (
    legacy.customized !== homeV2.customized ||
    legacy.presentation !== homeV2.presentation ||
    legacy.density !== homeV2.density ||
    !equal(legacy.layout, homeV2.layout)
  ) {
    reasons.push('LAYOUT');
  }
  if (!equal(legacy.appDock, homeV2.appDock)) reasons.push('APP_DOCK');
  if (homeV2.widgets.some((widget) => widget.binding === 'UNTRUSTED')) reasons.push('AUTHORITY');
  if (
    !equal(
      legacy.widgets.map(({ key, state }) => ({ key, state })),
      homeV2.widgets.map(({ key, state }) => ({ key, state }))
    )
  ) {
    reasons.push('WIDGET_STATE');
  }
  if (!equal(legacy.routeActions, homeV2.routeActions)) reasons.push('ROUTE_ACTION');
  if (!equal(legacy.requiredAnnouncements, homeV2.requiredAnnouncements)) {
    reasons.push('STRUCTURE');
  }
  if (legacy.partial !== homeV2.partial) reasons.push('UNAVAILABLE');
  if (legacy.freshness !== homeV2.freshness) reasons.push('FRESHNESS');
  if (reasons.length === 0) return { count: 0, outcome: 'MATCH', reasons: ['MATCH'] };
  const comparableReasons = reasons.filter((reason) => reason !== 'UNAVAILABLE');
  if (comparableReasons.length === 0) {
    return { count: 1, outcome: 'UNAVAILABLE', reasons: ['UNAVAILABLE'] };
  }
  if (comparableReasons.every((reason) => reason === 'FRESHNESS')) {
    return {
      count: comparableReasons.length,
      outcome: 'EXPECTED_TRANSIENT',
      reasons: ['EXPECTED_TRANSIENT', 'FRESHNESS'],
    };
  }
  return {
    count: Math.min(comparableReasons.length, 100),
    outcome: 'MISMATCH',
    reasons: comparableReasons,
  };
}
