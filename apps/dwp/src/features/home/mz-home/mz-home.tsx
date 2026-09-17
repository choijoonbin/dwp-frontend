import type { ComponentProps } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { FlowHome } from '../flow-home/flow-home';
import { FlowFutureWidgetMesh } from '../flow-home/flow-future-widget-mesh';
import { FlowRequiredNotice, hasFlowRequiredNotice } from '../flow-home/flow-updates';
import { MyAppDock } from '../flow-home/my-app-dock';
import { MzAiStage } from './mz-ai-stage';
import { MzCompactLauncher } from './mz-compact-launcher';
import { MzGroundedWorkspace } from './mz-grounded-workspace';
import { MzRelevantContext } from './mz-relevant-context';

export type MzHomeProps = ComponentProps<typeof FlowHome> &
  Readonly<{
    onStartMzIntent: (intent: string) => void;
    mzIntentBusy: boolean;
  }>;

function contributionCount(
  items: ComponentProps<typeof FlowHome>['contributionModel']['buckets']['action']
): number {
  return Math.min(
    999,
    items.reduce((total, item) => total + Math.max(1, item.count), 0)
  );
}

/**
 * Independent MZ / AI Stage renderer. It shares only approved primitives (the 18-app dock and
 * owner-widget mesh) with Flow; mode identity, first viewport, persistence, and runtime selection
 * remain MZ_V1. This keeps the personalized design assets while avoiding a Flow presentation
 * preset masquerading as a third mode.
 */
export function MzHome({
  currentDate,
  headline,
  subheadline,
  backgroundUrl,
  apps,
  appGroups,
  appLayout,
  contributionModel,
  contributionLoading,
  contributionFetching,
  contributionPartial,
  overview,
  overviewLoading,
  overviewFetching,
  overviewFailed,
  editing,
  customizationEnabled,
  customizationBusy,
  availableWidth,
  onBrowseAllApps,
  onLaunchApp,
  onManageApp,
  onStartEditing,
  onAppLayoutChange,
  onRetryOverview,
  onRetryContributions,
  futureWidgetStateByKey,
  futureRuntimeWidgets,
  futureRuntimeRefreshing,
  onOpenFutureRuntimeSource,
  onRetryFutureRuntime,
  ownerWidgetRegion,
  onStartMzIntent,
  mzIntentBusy,
}: MzHomeProps) {
  const compact = availableWidth < 600;
  const aiAvailable = apps.some((app) => app.resourceKey === 'APP.ASK');
  const openRoute = onOpenFutureRuntimeSource ?? (() => undefined);
  const communicationsUnavailable =
    !overviewLoading &&
    (overviewFailed || overview?.communications.status === 'UNAVAILABLE' || !overview);
  const requiredNoticeVisible =
    (!overviewLoading && hasFlowRequiredNotice(overview)) || communicationsUnavailable;
  const starterItems = (['action', 'timeline', 'response', 'request', 'pulse'] as const).flatMap(
    (bucket) => contributionModel.buckets[bucket].map((item) => ({ bucket, item }))
  );
  const starterEvidence = starterItems
    .filter(
      ({ item }, index, items) =>
        items.findIndex((candidate) => candidate.item.dedupeKey === item.dedupeKey) === index
    )
    .slice(0, 8)
    .map(({ bucket, item }) => ({
      id: item.id,
      title: item.title,
      source: item.owner.appLabel ?? item.owner.source,
      bucket,
      appKey: item.owner.appKey,
    }));
  const starterOwnerKeys = new Set(starterItems.slice(0, 8).map(({ item }) => item.owner.appKey));
  const relatedApps = apps.filter((app) => starterOwnerKeys.has(app.resourceKey)).slice(0, 4);

  return (
    <Box
      data-testid="mz-home"
      data-home-experience-surface="MZ_V1"
      data-home-ia="ai-intent-stage"
      data-home-scroll-contract="single-document"
      data-mz-responsive-class={compact ? 'mobile' : availableWidth >= 1440 ? 'wide' : 'standard'}
      sx={{
        width: 1,
        minWidth: 0,
        maxWidth: 1880,
        mx: 'auto',
        px: { xs: 2, sm: 3, lg: 'clamp(20px, 2vw, 36px)' },
        py: { xs: 2, md: 2.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, md: 2.5 },
        overflowX: 'clip',
        ...(compact
          ? {
              '& button, & a': {
                minHeight: '44px',
              },
            }
          : {}),
        '& [data-flow-future-widget-mesh]': { scrollMarginTop: 88 },
        '@media (forced-colors: active)': {
          '&, & *': { borderColor: 'CanvasText' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& *, & *::before, & *::after': {
            animation: 'none !important',
            transition: 'none !important',
            scrollBehavior: 'auto !important',
          },
        },
      }}
    >
      {!editing && (
        <Box
          component="section"
          data-mz-workscape
          sx={{
            position: 'relative',
            isolation: 'isolate',
            overflow: 'hidden',
            p: { xs: 1.5, sm: 2, lg: 2.5 },
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            borderRadius: 4,
            bgcolor: '#071733',
            color: 'common.white',
            backgroundImage: backgroundUrl
              ? `url("${backgroundUrl.replaceAll('"', '%22')}")`
              : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              zIndex: -1,
              bgcolor: 'rgba(5,18,48,0.86)',
            },
            '@media (forced-colors: active)': {
              bgcolor: 'Canvas',
              color: 'CanvasText',
              backgroundImage: 'none',
              '&::before': { display: 'none' },
            },
          }}
        >
          <Stack data-mz-context-brief gap={0.25} sx={{ px: { xs: 0.5, sm: 1 } }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
              {currentDate} · {headline}
            </Typography>
            <Typography
              component="p"
              variant="body2"
              sx={{ m: 0, color: 'common.white', maxWidth: 920, overflowWrap: 'anywhere' }}
            >
              {subheadline}
            </Typography>
          </Stack>
          <MzCompactLauncher
            apps={apps}
            groups={appGroups}
            layout={appLayout}
            onBrowseAll={onBrowseAllApps}
            onLaunch={onLaunchApp}
          />
          <MzAiStage
            currentDate={currentDate}
            headline={headline}
            subheadline={subheadline}
            actionCount={contributionCount(contributionModel.buckets.action)}
            timelineCount={contributionCount(contributionModel.buckets.timeline)}
            responseCount={contributionCount(contributionModel.buckets.response)}
            appCount={apps.length}
            contextLoading={contributionLoading}
            contextFetching={contributionFetching}
            contextPartial={contributionPartial}
            busy={mzIntentBusy}
            aiAvailable={aiAvailable}
            starterEvidence={starterEvidence}
            relatedApps={relatedApps}
            onStart={onStartMzIntent}
          />
          {requiredNoticeVisible && (
            <Box data-mz-required-rail>
              <FlowRequiredNotice
                overview={overview}
                editing={editing}
                unavailable={communicationsUnavailable}
                fetching={overviewFetching}
                onRetry={onRetryOverview}
              />
            </Box>
          )}
        </Box>
      )}

      {editing && (
        <MyAppDock
          apps={apps}
          groups={appGroups}
          layout={appLayout}
          editing
          customizationEnabled={customizationEnabled}
          busy={customizationBusy}
          compact={compact}
          priorityCompact={compact}
          onBrowseAll={onBrowseAllApps}
          onLaunch={onLaunchApp}
          onManage={onManageApp}
          onStartEditing={onStartEditing}
          onLayoutChange={onAppLayoutChange}
        />
      )}

      {editing && requiredNoticeVisible && (
        <FlowRequiredNotice
          overview={overview}
          editing={editing}
          unavailable={communicationsUnavailable}
          fetching={overviewFetching}
          onRetry={onRetryOverview}
        />
      )}

      {!editing && (
        <MzGroundedWorkspace
          model={contributionModel}
          apps={apps}
          aiAvailable={aiAvailable}
          runtimeState={
            contributionLoading
              ? 'LOADING'
              : contributionFetching
                ? 'REFRESHING'
                : contributionPartial
                  ? 'PARTIAL'
                  : undefined
          }
          onRetry={onRetryContributions}
          onLaunchApp={onLaunchApp}
          onOpenRoute={openRoute}
        />
      )}

      {!editing && (
        <FlowFutureWidgetMesh
          stateByKey={futureWidgetStateByKey}
          runtimeWidgets={futureRuntimeWidgets}
          runtimeRefreshing={futureRuntimeRefreshing}
          onOpenRuntimeSource={onOpenFutureRuntimeSource}
          onRetryRuntime={onRetryFutureRuntime}
        />
      )}

      {!editing && ownerWidgetRegion}

      {!editing && (
        <MzRelevantContext
          overview={overview}
          loading={overviewLoading}
          fetching={overviewFetching}
          failed={overviewFailed}
          onOpenRoute={openRoute}
        />
      )}

      {!editing && (
        <MyAppDock
          apps={apps}
          groups={appGroups}
          layout={appLayout}
          editing={false}
          customizationEnabled={customizationEnabled}
          busy={customizationBusy}
          compact={compact}
          priorityCompact={compact}
          onBrowseAll={onBrowseAllApps}
          onLaunch={onLaunchApp}
          onManage={onManageApp}
          onStartEditing={onStartEditing}
          onLayoutChange={onAppLayoutChange}
        />
      )}
    </Box>
  );
}
