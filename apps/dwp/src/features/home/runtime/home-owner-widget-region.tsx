import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';

import {
  WORKSPACE_WIDGET_GRID_COLUMNS,
  workspaceWidgetGridColumn,
} from '../../../components/workspace-composer/workspace-widget-layout-policy';
import { HomeContentState } from './home-content-state';
import { isOwnerWidgetDefinitionKey, OwnerWidgetRuntimeBoundary } from './owner-widgets';

import type { HomeV2ReadModel, HomeV2Widget, HomeWidgetSize } from '@dwp-frontend/shared-utils';
import type { OwnerWidgetDefinitionKey, OwnerWidgetRendererVariant } from './owner-widgets';
import type { useHomeV2Runtime } from './use-home-v2-runtime';

type HomeV2Runtime = ReturnType<typeof useHomeV2Runtime>;
const WIDGET_STATES = [
  'AVAILABLE',
  'EMPTY',
  'PARTIAL',
  'FORBIDDEN',
  'UNAVAILABLE',
  'STALE',
] as const;
const OWNER_DEFINITION_BY_PLACEMENT = {
  'focus-queue': 'approval.focus-queue',
  'my-requests': 'approval.my-requests',
  'meeting-next-prep': 'meetings.next-prep',
  'meeting-followups': 'meetings.followup-candidates',
  'application-dock': 'notification.app-badges',
  'notification-response-queue': 'notification.response-queue',
  'space-change-feed': 'space.change-feed',
  'space-response-queue': 'space.response-queue',
  'messaging-response-queue': 'messaging.response-queue',
  'messaging-change-feed': 'messaging.change-feed',
  'hr-education': 'hr.edu',
  'hr-team-pulse': 'hr.team-pulse',
  'workplace-booking': 'workplace.booking',
  'dwaion-artifact': 'dwaion.artifact',
} as const satisfies Readonly<Record<string, OwnerWidgetDefinitionKey>>;
const NATIVE_PLACEMENT_KEYS = new Set([
  'command-rail',
  'daily-brief',
  'focus',
  'schedule',
  'activity',
  'focus-balance',
  'meeting-load',
]);
const NATIVE_DEFINITION_KEYS = new Set([
  'core.workspace.command-rail',
  'core.workspace.daily-brief',
  'core.work.focus',
  'core.calendar.schedule',
  'core.activity.activity',
  'core.work.focus-balance',
  'core.calendar.meeting-load',
]);

export type HomeOwnerWidgetPlacement = Readonly<{
  placementKey: string;
  size: HomeWidgetSize;
  widget: HomeV2Widget | null;
}>;

/** Aggregate-only diagnostics: never expose provider keys, routes, payloads, or user content. */
export function homeV2RuntimeEvidence(
  runtime: HomeV2Runtime,
  commandState = 'DISABLED',
  draftPreserved = false,
  shadowComparison: Readonly<{ count: number; outcome: string }> | null = null
): Readonly<Record<string, string>> {
  const model =
    runtime.activation.kind === 'ACTIVE' || runtime.activation.kind === 'SHADOW'
      ? runtime.activation.result.snapshot.data
      : null;
  const stateCounts = WIDGET_STATES.map(
    (state) =>
      `${state.toLowerCase()}:${model?.widgets.filter((item) => item.state === state).length ?? 0}`
  ).join(',');
  const metadata =
    runtime.activation.kind === 'ACTIVE' || runtime.activation.kind === 'SHADOW'
      ? runtime.activation.result.metadata
      : null;
  return {
    'data-home-runtime-path': runtime.readPath.render.toLowerCase(),
    'data-home-runtime-http-status': String(runtime.query.data?.status ?? 'none'),
    'data-home-runtime-not-modified': runtime.query.data?.notModified ? 'true' : 'false',
    'data-home-runtime-refresh-failed':
      runtime.activation.kind === 'ACTIVE' || runtime.activation.kind === 'SHADOW'
        ? String(runtime.activation.refreshFailed)
        : 'none',
    'data-home-runtime-partial': model ? (model.partial ? 'true' : 'false') : 'none',
    'data-home-runtime-unavailable-count': String(model?.unavailableSources.length ?? 0),
    'data-home-runtime-widget-state-counts': stateCounts,
    'data-home-legacy-fanout': runtime.legacyEnabled ? 'enabled' : 'disabled',
    'data-home-runtime-state': metadata?.runtimeState.toLowerCase() ?? 'unavailable',
    'data-home-rollout-ring': metadata?.rolloutRing.toLowerCase() ?? 'unavailable',
    'data-home-render-authority': metadata?.renderAuthority.toLowerCase() ?? 'none',
    'data-home-action-authority': metadata?.actionAuthority.toLowerCase() ?? 'disabled',
    'data-home-registry-authoritative': metadata?.registryAuthoritative ? 'true' : 'false',
    'data-home-command-state': commandState.toLowerCase(),
    'data-home-shadow-outcome': shadowComparison?.outcome.toLowerCase() ?? 'inactive',
    'data-home-shadow-mismatch-count': String(shadowComparison?.count ?? 0),
    'data-home-runtime-draft-preserved': draftPreserved ? 'true' : 'false',
  };
}

export function selectOwnerRuntimeWidgets(
  widgets: readonly HomeV2Widget[]
): readonly HomeV2Widget[] {
  return widgets.filter(
    (widget) =>
      isOwnerWidgetDefinitionKey(widget.definitionKey) &&
      widget.definitionKey !== 'notification.app-badges'
  );
}

/** Projects the owner-placement subset of Composition v4; native slots stay in their sealed canvas. */
export function projectOwnerWidgetPlacements(
  model: HomeV2ReadModel,
  excludedDefinitionKeys: readonly OwnerWidgetDefinitionKey[] = []
): readonly HomeOwnerWidgetPlacement[] {
  const excludedDefinitions = new Set(excludedDefinitionKeys);
  const runtimeByDefinition = new Map(
    model.widgets.map((widget) => [widget.definitionKey, widget])
  );
  const baseOrder = new Map(
    model.view.composition.widgets.map((preference, index) => [preference.widgetKey, index])
  );
  const overlayOrder = new Map(
    (model.view.deviceOverlay?.widgetOrder ?? []).map((widgetKey, index) => [widgetKey, index])
  );
  return model.view.composition.widgets
    .filter((preference) => preference.visible)
    .flatMap<HomeOwnerWidgetPlacement>((preference) => {
      const definitionKey = isOwnerWidgetDefinitionKey(preference.widgetKey)
        ? preference.widgetKey
        : OWNER_DEFINITION_BY_PLACEMENT[
            preference.widgetKey as keyof typeof OWNER_DEFINITION_BY_PLACEMENT
          ];
      if (
        definitionKey === 'notification.app-badges' ||
        (definitionKey !== undefined && excludedDefinitions.has(definitionKey)) ||
        NATIVE_PLACEMENT_KEYS.has(preference.widgetKey) ||
        NATIVE_DEFINITION_KEYS.has(preference.widgetKey)
      ) {
        return [];
      }
      const size = (model.view.deviceOverlay?.widgetSizes[preference.widgetKey] ??
        preference.size ??
        'medium') as HomeWidgetSize;
      return [
        {
          placementKey: preference.widgetKey,
          size,
          widget: definitionKey ? (runtimeByDefinition.get(definitionKey) ?? null) : null,
        },
      ];
    })
    .sort((left, right) => {
      const leftOverlay = overlayOrder.get(left.placementKey);
      const rightOverlay = overlayOrder.get(right.placementKey);
      if (leftOverlay !== undefined || rightOverlay !== undefined) {
        if (leftOverlay === undefined) return 1;
        if (rightOverlay === undefined) return -1;
        return leftOverlay - rightOverlay;
      }
      return (baseOrder.get(left.placementKey) ?? 0) - (baseOrder.get(right.placementKey) ?? 0);
    });
}

export function HomeOwnerWidgetRegion({
  locale,
  onRetry,
  refreshing,
  variant,
  model,
  excludedDefinitionKeys = [],
}: Readonly<{
  locale: string;
  onRetry: () => void;
  refreshing: boolean;
  variant: OwnerWidgetRendererVariant;
  model: HomeV2ReadModel;
  excludedDefinitionKeys?: readonly OwnerWidgetDefinitionKey[];
}>) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const placements = projectOwnerWidgetPlacements(model, excludedDefinitionKeys);
  if (placements.length === 0) return null;

  return (
    <Box
      component="section"
      aria-label={t('ownerWidgets.regionLabel')}
      data-home-owner-widget-region={variant.toLowerCase()}
      data-home-owner-composition-scope="owner-subset"
      data-home-owner-widget-count={placements.length}
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          lg: `repeat(${WORKSPACE_WIDGET_GRID_COLUMNS}, minmax(0, 1fr))`,
        },
        columnGap: 0,
        rowGap: { xs: 1.5, md: 2 },
        minWidth: 0,
      }}
    >
      {placements.map(({ placementKey, size, widget }) => (
        <Box
          key={placementKey}
          data-home-owner-placement={placementKey}
          data-home-owner-placement-size={size}
          sx={{ gridColumn: workspaceWidgetGridColumn(size), minWidth: 0, px: { xs: 0, lg: 1 } }}
        >
          {widget ? (
            <OwnerWidgetRuntimeBoundary
              runtimeWidget={{
                definitionKey: widget.definitionKey,
                definitionVersion: widget.definitionVersion,
                definitionManifestHash: widget.definitionManifestHash,
                rendererBindingRevision: widget.rendererBindingRevision,
                rendererKey: widget.rendererKey,
                state: widget.state,
                payload: widget.payload,
                actions: widget.actions,
                governanceSourceRoute: widget.governance.sourceRoute,
                source: {
                  sourceKey: widget.source.sourceKey,
                  lastSuccessAt: widget.source.lastSuccessAt,
                  retryable: widget.source.retryable,
                  resultVersion: widget.source.resultVersion,
                },
              }}
              variant={variant}
              label={(key, values) => t(key, values)}
              locale={locale}
              onOpenSource={(route) => navigate(route)}
              onRetry={onRetry}
              refreshing={refreshing}
            />
          ) : (
            <HomeContentState kind="widget-error" size="compact" />
          )}
        </Box>
      ))}
    </Box>
  );
}

export function ActiveHomeOwnerWidgetRegion({
  runtime,
  excludedDefinitionKeys = [],
}: Readonly<{
  runtime: HomeV2Runtime;
  excludedDefinitionKeys?: readonly OwnerWidgetDefinitionKey[];
}>) {
  const { i18n } = useTranslation('home');
  if (runtime.activation.kind !== 'ACTIVE') return null;
  const model = runtime.activation.result.snapshot.data;
  const region = (
    <HomeOwnerWidgetRegion
      model={model}
      excludedDefinitionKeys={excludedDefinitionKeys}
      variant={model.mode === 'FLOW_V1' ? 'FLOW' : model.mode === 'MZ_V1' ? 'MZ' : 'CLASSIC'}
      locale={i18n.resolvedLanguage || i18n.language || 'en'}
      refreshing={runtime.query.isFetching && !runtime.query.isLoading}
      onRetry={() => void runtime.query.refetch()}
    />
  );
  return runtime.activation.refreshFailed ? (
    <HomeContentState
      kind="stale"
      lastSuccessfulAt={model.generatedAt}
      onAction={() => void runtime.query.refetch()}
      busy={runtime.query.isFetching}
      preservedContent={region}
      size="compact"
    />
  ) : (
    region
  );
}
