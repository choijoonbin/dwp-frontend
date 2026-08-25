import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, CalendarRange, Inbox, ListTodo, Zap } from 'lucide-react';

import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';

import { WorkspaceWidgetCanvas } from '../../../components/workspace-composer/workspace-widget-canvas';
import { TenantWorkscape } from '../../../components/tenant-workscape';
import { FlowHomeContext } from './flow-home-context';
import { HomePurposeWidget } from './home-purpose-widget';
import { MyAppDock } from './my-app-dock';
import { FLOW_HOME_SECTION_REGISTRY } from './flow-home-preference';
import {
  FlowRequiredNotice,
  FlowUpdates,
  hasFlowGeneralUpdates,
  hasFlowRequiredNotice,
} from './flow-updates';
import { flowSourceLabel } from './flow-source-label';
import { resolveFlowTrailingGovernedPlacement } from './flow-governed-placement';
import { homePurposeAllRoute } from './home-purpose-route-policy';
import { HOME_OVERVIEW_FRESHNESS_SECONDS } from '../home-widget-registry';

import type {
  HomeAudienceProfile,
  HomeBackgroundPosition,
  GovernedHomeZone,
  HomeOverview,
  HomePresentation,
  HomeRecommendation,
  HomeWidgetConfiguration,
} from '@dwp-frontend/shared-utils';
import type {
  HomeAppDefinition,
  HomeAppGroup,
  LaunchpadLayout,
} from '../../../components/workspace-composer/app-launchpad-model';
import type { HomeContributionModel } from '../contributions';
import type { FlowHomeSectionKey, FlowHomeSectionPreference } from './flow-home-preference';

type FlowHomeProps = {
  audience: HomeAudienceProfile;
  now: Date;
  currentDate: string;
  headline: string;
  subheadline: string;
  updatedAt: string;
  timeZone: string;
  backgroundUrl?: string;
  backgroundPosition?: HomeBackgroundPosition;
  overlayOpacity?: number;
  apps: readonly HomeAppDefinition[];
  appGroups: readonly HomeAppGroup[];
  appLayout: LaunchpadLayout;
  sections: readonly FlowHomeSectionPreference[];
  widgetConfigurations: Record<string, HomeWidgetConfiguration>;
  overview?: HomeOverview;
  overviewLoading: boolean;
  overviewFetching: boolean;
  overviewFailed: boolean;
  supplementalPartial?: boolean;
  contributionModel: HomeContributionModel;
  contributionLoading: boolean;
  contributionFetching: boolean;
  contributionPartial: boolean;
  announcementsPolicy: GovernedHomeZone;
  editing: boolean;
  customizationEnabled: boolean;
  customizationBusy: boolean;
  presentation: HomePresentation;
  density: 'comfortable' | 'compact';
  previewDevice: 'desktop' | 'mobile';
  feedbackBusy: boolean;
  onBrowseAllApps: () => void;
  onStartEditing?: () => void;
  onOpenStudio?: () => void;
  onAppLayoutChange: (layout: LaunchpadLayout) => void;
  onSectionsChange: (sections: FlowHomeSectionPreference[]) => void;
  onLaunchApp: (app: HomeAppDefinition) => void;
  onRetryOverview: () => void;
  onRetryContributions: () => void;
  onRecommendationFeedback: (recommendation: HomeRecommendation) => void;
};

function useLargeTextReflow(): boolean {
  const [largeText, setLargeText] = useState(false);
  useEffect(() => {
    const sync = () => {
      const rootSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize
      );
      setLargeText(Number.isFinite(rootSize) && rootSize >= 24);
    };
    const resizeObserver = new ResizeObserver(sync);
    const mutationObserver = new MutationObserver(sync);
    resizeObserver.observe(document.documentElement);
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    window.addEventListener('resize', sync);
    sync();
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, []);
  return largeText;
}

export function FlowHome({
  audience,
  now,
  currentDate,
  headline,
  subheadline,
  updatedAt,
  backgroundUrl,
  backgroundPosition = 'RIGHT',
  overlayOpacity = 18,
  apps,
  appGroups,
  appLayout,
  sections,
  widgetConfigurations,
  overview,
  overviewLoading,
  overviewFetching,
  overviewFailed,
  supplementalPartial = false,
  contributionModel,
  contributionLoading,
  contributionFetching,
  contributionPartial,
  announcementsPolicy,
  editing,
  customizationEnabled,
  customizationBusy,
  presentation,
  density,
  previewDevice,
  onBrowseAllApps,
  onStartEditing,
  onOpenStudio,
  onAppLayoutChange,
  onSectionsChange,
  onLaunchApp,
  onRetryOverview,
  onRetryContributions,
}: FlowHomeProps) {
  const { t } = useTranslation('home');
  const narrowViewport = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const largeTextReflow = useLargeTextReflow();
  const compactPreview = previewDevice === 'mobile' && editing;
  const compactContent = compactPreview || narrowViewport || largeTextReflow;
  const compactDensity = density === 'compact';
  const purposeStageRef = useRef<HTMLDivElement | null>(null);
  const communicationsForbidden = overview?.communications.status === 'FORBIDDEN';
  const requiredNoticeUnavailable =
    !overviewLoading &&
    (overviewFailed || overview?.communications.status === 'UNAVAILABLE' || !overview);
  const requiredNoticeVisible =
    (!overviewLoading && hasFlowRequiredNotice(overview)) || requiredNoticeUnavailable;
  const showUpdates =
    !communicationsForbidden &&
    announcementsPolicy.visible &&
    (editing ||
      overviewLoading ||
      overviewFailed ||
      overview?.communications.status === 'UNAVAILABLE' ||
      hasFlowGeneralUpdates(overview));
  const sourceSections = [
    overview?.work,
    overview?.calendar,
    overview?.activity,
    overview?.communications,
  ];
  const partial =
    overviewFailed ||
    supplementalPartial ||
    contributionPartial ||
    sourceSections.some((section) => section?.status === 'UNAVAILABLE');
  const generatedAt = overview?.generatedAt ? Date.parse(overview.generatedAt) : Number.NaN;
  const staleThresholdMs = HOME_OVERVIEW_FRESHNESS_SECONDS * 1000;
  const delayedSource = sourceSections.reduce<
    Readonly<{ source: string; lagMs: number }> | undefined
  >((oldest, section) => {
    if (!section || section.status !== 'AVAILABLE') return oldest;
    const sectionGeneratedAt = Date.parse(section.generatedAt);
    if (!Number.isFinite(sectionGeneratedAt)) return oldest;
    const lagMs = now.getTime() - sectionGeneratedAt;
    if (lagMs <= staleThresholdMs || (oldest && oldest.lagMs >= lagMs)) return oldest;
    return { source: section.source, lagMs };
  }, undefined);
  const stale =
    (Number.isFinite(generatedAt) && now.getTime() - generatedAt > staleThresholdMs) ||
    Boolean(delayedSource);
  const staleDetail = delayedSource
    ? t(partial ? 'flow.context.partialAndSourceStale' : 'flow.context.sourceStale', {
        source: flowSourceLabel(delayedSource.source, t),
        count: Math.max(1, Math.ceil(delayedSource.lagMs / 60_000)),
      })
    : undefined;
  const configuredLimit = (storageKey: string, fallback = 3) => {
    const value = widgetConfigurations[storageKey]?.itemLimit;
    return Math.min(3, Math.max(1, typeof value === 'number' ? value : fallback));
  };
  const announcementsPlacement = resolveFlowTrailingGovernedPlacement(announcementsPolicy.size);

  useEffect(() => {
    const stage = purposeStageRef.current;
    if (!stage) return;
    const markLauncherEdgeWidgets = () => {
      const stageRight = stage.getBoundingClientRect().right;
      stage.querySelectorAll<HTMLElement>('[data-workspace-widget]').forEach((widget) => {
        const atInlineEnd = widget.getBoundingClientRect().right >= stageRight - 24;
        if (atInlineEnd) widget.setAttribute('data-flow-launcher-edge', 'true');
        else widget.removeAttribute('data-flow-launcher-edge');
      });
    };
    const resizeObserver = new ResizeObserver(markLauncherEdgeWidgets);
    resizeObserver.observe(stage);
    stage
      .querySelectorAll<HTMLElement>('[data-workspace-widget]')
      .forEach((widget) => resizeObserver.observe(widget));
    markLauncherEdgeWidgets();
    return () => resizeObserver.disconnect();
  }, [editing, presentation, sections, showUpdates]);

  return (
    <Box
      data-testid="flow-home"
      data-flow-home-presentation={presentation}
      data-flow-home-density={density}
      data-flow-large-text={largeTextReflow ? 'true' : 'false'}
      data-preview-device={editing ? previewDevice : undefined}
      sx={(theme) => ({
        '--flow-shell-width': '1680px',
        '--flow-stack-space': compactDensity ? '12px' : '16px',
        '--flow-section-space': compactDensity ? '14px' : '18px',
        '--flow-surface-radius': 'var(--home-radius-section)',
        '--flow-title-size': 'clamp(1.55rem, 2vw, 1.95rem)',
        '--home-surface':
          theme.palette.mode === 'dark' ? theme.palette.background.paper : '#FFFFFF',
        '--home-surface-subtle':
          theme.palette.mode === 'dark' ? theme.palette.background.default : '#FAFBFC',
        width: 1,
        minWidth: 0,
        maxWidth: compactPreview ? 390 : 'var(--flow-shell-width)',
        mx: 'auto',
        px: compactPreview ? 2 : { xs: 2, sm: 3, lg: 'clamp(20px, 2vw, 36px)' },
        py: compactPreview ? 2 : { xs: 2, md: 2 },
        display: 'flex',
        flexDirection: 'column',
        gap: compactPreview ? 2 : 'var(--flow-stack-space)',
        border: compactPreview ? 1 : 0,
        borderColor: 'divider',
        borderRadius: compactPreview ? 4 : 0,
        bgcolor: compactPreview ? 'background.default' : 'transparent',
        '&[data-flow-home-presentation="focused"]': {
          '--flow-shell-width': '1280px',
          '--flow-title-size': 'clamp(1.45rem, 1.8vw, 1.8rem)',
        },
        '&[data-flow-home-presentation="expressive"]': {
          '--flow-shell-width': '2560px',
          px: compactPreview ? 2 : { xs: 2, sm: 3, lg: '20px' },
        },
        '& [data-flow-app-dock-list] button': { minHeight: editing ? 72 : 62 },
        '&[data-preview-device="mobile"] [data-flow-app-dock-list]': {
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        },
        '&[data-preview-device="mobile"] [data-workspace-presentation], &[data-flow-large-text="true"] [data-workspace-presentation]':
          {
            gridTemplateColumns: 'minmax(0, 1fr)',
          },
        '&[data-preview-device="mobile"] [data-workspace-widget], &[data-flow-large-text="true"] [data-workspace-widget]':
          {
            gridColumn: '1 / -1',
          },
        '@media (forced-colors: active)': {
          '--home-surface': 'Canvas',
          '--home-surface-subtle': 'Canvas',
        },
      })}
    >
      <TenantWorkscape
        backgroundUrl={backgroundUrl}
        backgroundPosition={backgroundPosition}
        overlayOpacity={overlayOpacity}
        presentation={presentation}
        compact={compactPreview}
        ariaLabel={t('flow.workscape.label')}
      >
        <FlowHomeContext
          audience={audience}
          currentDate={currentDate}
          headline={headline}
          subheadline={subheadline}
          updatedAt={updatedAt}
          backgroundPosition={backgroundPosition}
          partial={partial}
          stale={stale}
          staleDetail={staleDetail}
          editing={editing}
          customizationEnabled={customizationEnabled}
          customizationBusy={customizationBusy}
          compact={compactPreview}
          priorityCompact={narrowViewport || compactPreview}
          onEdit={onStartEditing}
          onOpenStudio={onOpenStudio}
          onRetry={onRetryOverview}
        />
        <MyAppDock
          apps={apps}
          groups={appGroups}
          layout={appLayout}
          editing={editing}
          customizationEnabled={customizationEnabled}
          busy={customizationBusy}
          compact={compactPreview}
          priorityCompact={narrowViewport || compactPreview}
          presentation={presentation}
          onBrowseAll={onBrowseAllApps}
          onLaunch={onLaunchApp}
          onStartEditing={onStartEditing}
          onLayoutChange={onAppLayoutChange}
        />
      </TenantWorkscape>

      {requiredNoticeVisible && (
        <FlowRequiredNotice
          overview={overview}
          editing={editing}
          unavailable={requiredNoticeUnavailable}
          fetching={overviewFetching}
          onRetry={onRetryOverview}
        />
      )}

      <Box
        ref={purposeStageRef}
        data-testid="flow-home-personal-sections"
        data-flow-layout-contract="purpose-widgets"
        sx={{
          '& [data-workspace-presentation]': {
            gridAutoFlow: 'row',
            alignItems: { xs: 'start', lg: 'stretch' },
          },
          '& [data-workspace-widget]': {
            scrollMarginTop: 88,
            alignSelf: { xs: 'start', lg: 'stretch' },
          },
          '& [data-workspace-widget-content]': {
            height: { xs: editing ? '100%' : 'auto', lg: '100%' },
          },
          '& [data-workspace-widget-content] > section': {
            height: { xs: editing ? '100% !important' : 'auto !important', lg: '100% !important' },
            minHeight: 0,
            bgcolor: 'var(--home-surface)',
            border: 1,
            borderColor: 'divider',
            borderRadius: 'var(--flow-surface-radius)',
          },
          '& [data-flow-launcher-edge="true"] [data-flow-section^="purpose-"]': {
            '@media (min-width: 600px)': { pr: 9 },
          },
          '@media (max-width: 1199.95px)': {
            '& [data-workspace-widget]': { gridColumn: '1 / -1', alignSelf: 'start' },
            '& [data-workspace-widget-content]': { height: editing ? '100%' : 'auto' },
            '& [data-workspace-widget-content] > section': {
              height: editing ? '100% !important' : 'auto !important',
            },
          },
          '@media (forced-colors: active)': {
            '& [data-workspace-widget-content] > section': { borderColor: 'CanvasText' },
          },
        }}
      >
        <WorkspaceWidgetCanvas<FlowHomeSectionKey>
          registry={FLOW_HOME_SECTION_REGISTRY}
          widgets={sections}
          governedWidgets={[
            {
              widgetKey: 'action-queue',
              label: t('flow.purpose.action.title'),
              governance: 'SYSTEM',
              size: 'large',
              height: 'standard',
              surface: 'plain',
              content: (
                <HomePurposeWidget
                  sectionKey="action"
                  icon={Zap}
                  items={contributionModel.buckets.action}
                  loading={contributionLoading}
                  fetching={contributionFetching}
                  state={contributionModel.bucketStates.action}
                  maxItems={3}
                  allRoute={homePurposeAllRoute('action', contributionModel.buckets.action)}
                  compact={compactContent}
                  footprintHeight="standard"
                  featuredFirst
                  wideFeatured={presentation === 'expressive'}
                  onRetry={onRetryContributions}
                />
              ),
            },
          ]}
          trailingGovernedWidgets={
            showUpdates
              ? [
                  {
                    widgetKey: 'announcements',
                    label: t('flow.updates.title'),
                    governance: 'ORGANIZATION',
                    size: announcementsPlacement.renderSize,
                    height: announcementsPolicy.height,
                    surface: 'plain',
                    content: (
                      <FlowUpdates
                        overview={overview}
                        loading={overviewLoading}
                        fetching={overviewFetching}
                        requestFailed={overviewFailed}
                        compact={compactContent}
                        wide={presentation === 'expressive'}
                        size={announcementsPlacement.renderSize}
                        height={announcementsPolicy.height}
                        itemLimit={3}
                        onRetry={onRetryOverview}
                      />
                    ),
                  },
                ]
              : []
          }
          editing={editing && customizationEnabled}
          busy={customizationBusy}
          presentation={presentation}
          scrollMode="document"
          getLabel={(sectionKey) => t(`flow.editor.sections.${sectionKey}`)}
          onStartEditing={customizationEnabled && !editing ? onStartEditing : undefined}
          onChange={onSectionsChange}
          renderWidget={(sectionKey, _size, height) => {
            const common = {
              loading: contributionLoading,
              fetching: contributionFetching,
              compact: compactContent,
              footprintHeight: height,
              onRetry: onRetryContributions,
            };
            if (sectionKey === 'today') {
              return (
                <HomePurposeWidget
                  {...common}
                  sectionKey="timeline"
                  icon={CalendarRange}
                  items={contributionModel.buckets.timeline}
                  state={contributionModel.bucketStates.timeline}
                  maxItems={configuredLimit('schedule')}
                  allRoute={homePurposeAllRoute('timeline', contributionModel.buckets.timeline)}
                  timeline
                />
              );
            }
            if (sectionKey === 'response-hub') {
              return (
                <HomePurposeWidget
                  {...common}
                  sectionKey="response"
                  icon={Inbox}
                  items={contributionModel.buckets.response}
                  state={contributionModel.bucketStates.response}
                  maxItems={configuredLimit('daily-brief')}
                  allRoute={homePurposeAllRoute('response', contributionModel.buckets.response)}
                />
              );
            }
            if (sectionKey === 'request-tracker') {
              return (
                <HomePurposeWidget
                  {...common}
                  sectionKey="request"
                  icon={ListTodo}
                  items={contributionModel.buckets.request}
                  state={contributionModel.bucketStates.request}
                  maxItems={configuredLimit('focus')}
                  allRoute={homePurposeAllRoute('request', contributionModel.buckets.request)}
                />
              );
            }
            return (
              <HomePurposeWidget
                {...common}
                sectionKey="pulse"
                icon={Activity}
                items={contributionModel.buckets.pulse}
                state={contributionModel.bucketStates.pulse}
                maxItems={configuredLimit('activity')}
                allRoute={homePurposeAllRoute('pulse', contributionModel.buckets.pulse)}
              />
            );
          }}
        />
      </Box>
    </Box>
  );
}
