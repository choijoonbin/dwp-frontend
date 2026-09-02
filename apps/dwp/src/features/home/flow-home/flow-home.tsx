import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, CalendarRange, Inbox, ListTodo, Zap } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';

import { WorkspaceWidgetCanvas } from '../../../components/workspace-composer/workspace-widget-canvas';
import {
  writeHomeLaunchpadGroupItemCounts,
  writeHomePresentationHint,
} from '../../../components/home-loading-layout-policy';
import { HOME_LAUNCHPAD_GROUP_ITEM_LIMIT } from '../../../components/workspace-composer/home-launchpad-layout-contract';
import { defaultHomeContentAlignment } from '../../../components/tenant-workscape';
import { FlowHomeContext } from './flow-home-context';
import { resolveFlowLauncherClearance } from './flow-launcher-clearance';
import { HomePurposeWidget } from './home-purpose-widget';
import { MyAppDock } from './my-app-dock';
import { resolveFlowHomeHealth } from './flow-home-health';
import { FLOW_HOME_SECTION_REGISTRY, FLOW_HOME_STORAGE_ALIAS } from './flow-home-preference';
import {
  FLOW_HOME_MEDIUM_MIN_WIDTH,
  FLOW_HOME_WIDE_COMPOSITION,
  FLOW_HOME_WIDE_MIN_WIDTH,
  resolveFlowHomeReadItemLimit,
  resolveFlowHomeReadLayout,
} from './flow-home-layout';
import {
  FlowRequiredNotice,
  FlowUpdates,
  hasFlowGeneralUpdates,
  hasFlowRequiredNotice,
} from './flow-updates';
import { resolveFlowTrailingGovernedPlacement } from './flow-governed-placement';
import { homePurposeAllRoute } from './home-purpose-route-policy';
import { buildFlowSignals } from './flow-home-model';
import { FlowHomeHeroSurface } from './flow-home-hero-surface';
import { filterRolePulseTextItems } from './home-purpose-role-pulse-policy';
import { NextActionCue } from './next-actions';

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
import type { HomeContentAlignment } from '@dwp-frontend/shared-utils';

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
  focalX?: number;
  focalY?: number;
  mobileFocalX?: number;
  mobileFocalY?: number;
  contentAlignment?: HomeContentAlignment;
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
  notificationPartial?: boolean;
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
  onManageApp?: (app: HomeAppDefinition) => void;
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

function contributionCount(items: HomeContributionModel['buckets']['action']): number {
  return Math.min(
    999,
    items.reduce((total, item) => total + Math.max(1, item.count), 0)
  );
}

export function FlowHome({
  audience,
  now,
  currentDate,
  headline,
  subheadline,
  updatedAt,
  timeZone,
  backgroundUrl,
  backgroundPosition = 'RIGHT',
  focalX,
  focalY,
  mobileFocalX,
  mobileFocalY,
  contentAlignment,
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
  notificationPartial = false,
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
  feedbackBusy,
  onBrowseAllApps,
  onStartEditing,
  onOpenStudio,
  onAppLayoutChange,
  onSectionsChange,
  onLaunchApp,
  onManageApp,
  onRetryOverview,
  onRetryContributions,
  onRecommendationFeedback,
}: FlowHomeProps) {
  const { t } = useTranslation('home');
  const narrowViewport = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const mediumViewport = useMediaQuery(
    `(min-width:${FLOW_HOME_MEDIUM_MIN_WIDTH}px) and (max-width:1199.95px)`,
    { noSsr: true }
  );
  const wideViewport = useMediaQuery(`(min-width:${FLOW_HOME_WIDE_MIN_WIDTH}px)`, {
    noSsr: true,
  });
  const largeTextReflow = useLargeTextReflow();
  const compactPreview = previewDevice === 'mobile' && editing;
  const compactContent = compactPreview || narrowViewport || largeTextReflow;
  const compactDensity = density === 'compact';
  const resolvedContentAlignment =
    contentAlignment ?? defaultHomeContentAlignment(backgroundPosition);
  const readLayout = resolveFlowHomeReadLayout({
    sections,
    audience,
    presentation,
    editing,
    largeText: largeTextReflow,
    mobilePreview: compactPreview,
    mediumViewport,
    wideViewport,
  });
  const adaptiveFirstWidgetSelector = `&[data-flow-read-template="adaptive-wide"] [data-workspace-widget="${
    readLayout.firstSectionKey ?? '__none__'
  }"]`;
  const adaptiveSupportWidgetSelector =
    readLayout.supportSectionKeys
      .map(
        (sectionKey) =>
          `&[data-flow-read-template="adaptive-wide"] [data-workspace-widget="${sectionKey}"]`
      )
      .join(', ') ||
    '&[data-flow-read-template="adaptive-wide"] [data-workspace-widget="__none__"]';
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
  const health = resolveFlowHomeHealth({
    now,
    overview,
    overviewFailed,
    overviewFetching,
    supplementalPartial: supplementalPartial || contributionPartial,
    notificationPartial,
    contributionFetching,
    providers: contributionModel.providers,
  });
  const healthUpdatedAt = health.lastUpdatedAt
    ? formatDate(new Date(health.lastUpdatedAt), {
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      })
    : updatedAt;
  const contextMetrics = {
    action: contributionCount(contributionModel.buckets.action),
    timeline: contributionCount(contributionModel.buckets.timeline),
    response: contributionCount(contributionModel.buckets.response),
  };
  const roleSignals = buildFlowSignals(overview);
  const rolePulseItems = filterRolePulseTextItems(contributionModel.buckets.pulse, roleSignals);
  const sectionItemLimit = (sectionKey: FlowHomeSectionKey) => {
    const storageKey = FLOW_HOME_STORAGE_ALIAS[sectionKey];
    return resolveFlowHomeReadItemLimit({
      template: readLayout.template,
      sectionKey,
      firstSectionKey: readLayout.firstSectionKey,
      configuredItemLimit: widgetConfigurations[storageKey]?.itemLimit,
    });
  };
  const sectionUsesSupportStack = (sectionKey: FlowHomeSectionKey) =>
    readLayout.template === 'adaptive-wide' && readLayout.supportSectionKeys.includes(sectionKey);
  const announcementsPlacement = resolveFlowTrailingGovernedPlacement(announcementsPolicy.size);

  useEffect(() => {
    if (editing || typeof window === 'undefined') return;
    let storage: Storage | undefined;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = undefined;
    }
    writeHomePresentationHint(storage, presentation);
    writeHomeLaunchpadGroupItemCounts(
      storage,
      appGroups.map((group) =>
        Math.min(HOME_LAUNCHPAD_GROUP_ITEM_LIMIT, appLayout.groups[group.id]?.length ?? 0)
      )
    );
  }, [appGroups, appLayout.groups, editing, presentation]);

  useEffect(() => {
    const stage = purposeStageRef.current;
    if (!stage) return;
    let animationFrame = 0;
    let launcherClearanceRevision = 0;
    let observedLauncher: HTMLElement | null = null;
    const observedWidgets = new Set<HTMLElement>();
    const clearLauncherClearance = (widget: HTMLElement) => {
      widget.removeAttribute('data-flow-launcher-edge');
      widget.removeAttribute('data-flow-launcher-clearance');
      widget.style.removeProperty('--flow-launcher-clearance');
    };
    const markLauncherEdgeWidgets = () => {
      animationFrame = 0;
      const launcher = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]');
      const launcherRect = launcher?.getBoundingClientRect();
      const launcherPlacement = launcher?.dataset.shellAuxiliaryPlacement;
      stage.querySelectorAll<HTMLElement>('[data-workspace-widget]').forEach((widget) => {
        const widgetRect = widget.getBoundingClientRect();
        const clearance = resolveFlowLauncherClearance(widgetRect, launcherRect, launcherPlacement);
        if (clearance > 0) {
          widget.setAttribute('data-flow-launcher-edge', 'true');
          widget.setAttribute('data-flow-launcher-clearance', String(clearance));
          widget.style.setProperty('--flow-launcher-clearance', `${clearance}px`);
        } else clearLauncherClearance(widget);
      });
      launcherClearanceRevision += 1;
      stage.setAttribute('data-flow-launcher-clearance-scroll-y', String(window.scrollY));
      stage.setAttribute(
        'data-flow-launcher-clearance-revision',
        String(launcherClearanceRevision)
      );
    };
    const queueLauncherEdgeCheck = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(markLauncherEdgeWidgets);
    };
    const resizeObserver = new ResizeObserver(queueLauncherEdgeCheck);
    const syncWidgetObservation = () => {
      const nextWidgets = new Set(stage.querySelectorAll<HTMLElement>('[data-workspace-widget]'));
      observedWidgets.forEach((widget) => {
        if (nextWidgets.has(widget)) return;
        resizeObserver.unobserve(widget);
        clearLauncherClearance(widget);
        observedWidgets.delete(widget);
      });
      nextWidgets.forEach((widget) => {
        if (observedWidgets.has(widget)) return;
        observedWidgets.add(widget);
        resizeObserver.observe(widget);
      });
      queueLauncherEdgeCheck();
    };
    const syncLauncherObservation = () => {
      const nextLauncher = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]');
      if (nextLauncher === observedLauncher) return;
      if (observedLauncher) resizeObserver.unobserve(observedLauncher);
      observedLauncher = nextLauncher;
      if (observedLauncher) resizeObserver.observe(observedLauncher);
      queueLauncherEdgeCheck();
    };
    const launcherObserver = new MutationObserver(syncLauncherObservation);
    const stageObserver = new MutationObserver(syncWidgetObservation);
    resizeObserver.observe(stage);
    launcherObserver.observe(document.body, { childList: true, subtree: true });
    stageObserver.observe(stage, { childList: true, subtree: true });
    syncWidgetObservation();
    syncLauncherObservation();
    window.addEventListener('scroll', queueLauncherEdgeCheck, { passive: true });
    window.addEventListener('resize', queueLauncherEdgeCheck);
    markLauncherEdgeWidgets();
    return () => {
      resizeObserver.disconnect();
      launcherObserver.disconnect();
      stageObserver.disconnect();
      observedWidgets.forEach(clearLauncherClearance);
      stage.removeAttribute('data-flow-launcher-clearance-scroll-y');
      stage.removeAttribute('data-flow-launcher-clearance-revision');
      window.removeEventListener('scroll', queueLauncherEdgeCheck);
      window.removeEventListener('resize', queueLauncherEdgeCheck);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
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
        '@media (min-width:1800px)': {
          '&:not([data-flow-home-presentation="focused"])': {
            '--flow-shell-width': '2560px',
            px: compactPreview ? 2 : '20px',
          },
        },
        '& [data-flow-dock-launch]': { minHeight: editing ? 72 : 62 },
        '&[data-preview-device="mobile"] [data-workspace-presentation], &[data-flow-large-text="true"] [data-workspace-presentation]':
          {
            gridTemplateColumns: 'minmax(0, 1fr)',
          },
        '&[data-preview-device="mobile"] [data-workspace-widget], &[data-flow-large-text="true"] [data-workspace-widget]':
          {
            gridColumn: '1 / -1',
          },
        '&[data-flow-large-text="true"] [data-flow-context-description]': {
          display: 'block',
          overflow: 'visible',
          WebkitLineClamp: 'unset',
        },
        '&[data-flow-large-text="true"] [data-flow-dock-group-label], &[data-flow-large-text="true"] [data-flow-dock-group-description]':
          {
            minHeight: '2.4em',
            lineHeight: 1.2,
            whiteSpace: 'normal',
            wordBreak: 'keep-all',
            overflowWrap: 'anywhere',
            overflow: 'visible',
            textOverflow: 'clip',
          },
        '&[data-flow-large-text="true"] [data-flow-app-dock-list]': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        },
        '&[data-flow-large-text="true"]': {
          '--launchpad-tile-height': 'calc(44px + 2.25rem)',
          '--launchpad-label-height': '3em',
          '--launchpad-label-line-height': (theme) => theme.typography.caption.lineHeight ?? 1.5,
        },
        '@media (forced-colors: active)': {
          '--home-surface': 'Canvas',
          '--home-surface-subtle': 'Canvas',
        },
      })}
    >
      <FlowHomeHeroSurface
        backgroundUrl={backgroundUrl}
        backgroundPosition={backgroundPosition}
        focalX={focalX}
        focalY={focalY}
        mobileFocalX={mobileFocalX}
        mobileFocalY={mobileFocalY}
        contentAlignment={resolvedContentAlignment}
        overlayOpacity={overlayOpacity}
        presentation={presentation}
        compact={compactPreview}
        editing={editing}
        wide={wideViewport}
        ariaLabel={t('flow.workscape.label')}
        context={
          <FlowHomeContext
            audience={audience}
            currentDate={currentDate}
            headline={headline}
            subheadline={subheadline}
            updatedAt={healthUpdatedAt}
            contentAlignment={resolvedContentAlignment}
            health={health}
            metrics={contextMetrics}
            editing={editing}
            customizationEnabled={customizationEnabled}
            customizationBusy={customizationBusy}
            compact={compactPreview}
            priorityCompact={narrowViewport || compactPreview}
            onEdit={onStartEditing}
            onOpenStudio={onOpenStudio}
            onRetry={onRetryOverview}
          />
        }
        dock={
          <MyAppDock
            apps={apps}
            groups={appGroups}
            layout={appLayout}
            editing={editing}
            customizationEnabled={customizationEnabled}
            busy={customizationBusy}
            compact={compactPreview}
            priorityCompact={narrowViewport || compactPreview}
            onBrowseAll={onBrowseAllApps}
            onLaunch={onLaunchApp}
            onManage={onManageApp}
            onStartEditing={onStartEditing}
            onLayoutChange={onAppLayoutChange}
          />
        }
      />

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
        data-flow-read-template={readLayout.template}
        data-flow-adaptive-eligible={readLayout.adaptiveEligible ? 'true' : 'false'}
        data-flow-adaptive-applied={readLayout.adaptiveApplied ? 'true' : 'false'}
        data-flow-adaptive-first-section={readLayout.firstSectionKey ?? undefined}
        data-flow-wide-composition={
          readLayout.template === 'adaptive-wide' ? FLOW_HOME_WIDE_COMPOSITION.label : undefined
        }
        sx={{
          '& [data-workspace-presentation]': {
            gridAutoFlow: 'row',
            alignItems: 'stretch',
          },
          '& [data-workspace-widget]': {
            scrollMarginTop: 88,
            alignSelf: 'stretch',
          },
          '& [data-workspace-widget-content]': {
            height: '100%',
          },
          '& [data-workspace-widget-content] > section': {
            height: '100% !important',
            minHeight: 0,
            bgcolor: 'var(--home-surface)',
            border: 1,
            borderColor: 'divider',
            borderRadius: 'var(--flow-surface-radius)',
            boxShadow: '0 8px 24px rgba(15,23,42,0.045)',
            transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
          },
          '&:not([data-flow-read-template="editing"]) [data-workspace-widget]:hover [data-workspace-widget-content] > section':
            {
              transform: 'translateY(-2px)',
              borderColor: 'rgba(49,95,213,0.28)',
              boxShadow: '0 14px 34px rgba(15,23,42,0.085)',
            },
          '& [data-flow-launcher-edge="true"] [data-workspace-widget-content] > section': {
            '@media (min-width: 900px)': {
              paddingInlineEnd: 'var(--flow-launcher-clearance, 0px)',
            },
          },
          '&[data-flow-read-template="adaptive-medium"] [data-workspace-widget="action-queue"]': {
            gridColumn: '1 / -1',
          },
          '&[data-flow-read-template="adaptive-medium"] [data-workspace-widget-policy="PERSONAL"]:not([data-workspace-widget="action-queue"])':
            {
              gridColumn: 'span 30',
            },
          '&[data-flow-read-template="adaptive-wide"] [data-workspace-presentation]': {
            rowGap: compactDensity ? 1.5 : 2,
          },
          '&[data-flow-read-template="adaptive-wide"] [data-workspace-widget="action-queue"]': {
            gridColumn: `span ${FLOW_HOME_WIDE_COMPOSITION.actionColumns}`,
          },
          [adaptiveFirstWidgetSelector]: {
            gridColumn: `span ${FLOW_HOME_WIDE_COMPOSITION.firstColumns}`,
          },
          [adaptiveSupportWidgetSelector]: {
            gridColumn: `span ${FLOW_HOME_WIDE_COMPOSITION.supportColumns}`,
          },
          '&:not([data-flow-read-template="editing"]) [data-workspace-presentation]': {
            mx: '-7px',
            rowGap: 2,
          },
          '&:not([data-flow-read-template="editing"]) [data-workspace-widget]': {
            px: '7px !important',
          },
          '@media (max-width: 899.95px)': {
            '&:not([data-flow-read-template="editing"]) [data-workspace-presentation]': {
              mx: 0,
              rowGap: 2,
            },
            '& [data-workspace-widget]': { gridColumn: '1 / -1', alignSelf: 'start' },
            '&:not([data-flow-read-template="editing"]) [data-workspace-widget]': {
              px: '0 !important',
            },
            '& [data-workspace-widget-content]': { height: editing ? '100%' : 'auto' },
            '& [data-workspace-widget-content] > section': {
              height: editing ? '100% !important' : 'auto !important',
            },
          },
          '@media (forced-colors: active)': {
            '& [data-workspace-widget-content] > section': { borderColor: 'CanvasText' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '& [data-workspace-widget-content] > section, & [data-workspace-widget]:hover [data-workspace-widget-content] > section':
              {
                transition: 'none',
                transform: 'none',
              },
          },
        }}
      >
        <WorkspaceWidgetCanvas<FlowHomeSectionKey>
          registry={FLOW_HOME_SECTION_REGISTRY}
          widgets={sections}
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
            if (sectionKey === 'action-queue') {
              return (
                <HomePurposeWidget
                  {...common}
                  sectionKey="action"
                  icon={Zap}
                  items={contributionModel.buckets.action}
                  state={contributionModel.bucketStates.action}
                  maxItems={resolveFlowHomeReadItemLimit({
                    template: readLayout.template,
                    sectionKey: 'action',
                    firstSectionKey: readLayout.firstSectionKey,
                  })}
                  allRoute={homePurposeAllRoute('action', contributionModel.buckets.action)}
                  featuredFirst
                  wideFeatured={readLayout.template === 'adaptive-wide'}
                  headerAccessory={
                    !editing ? (
                      <NextActionCue
                        overview={overview}
                        feedbackBusy={feedbackBusy}
                        onRecommendationFeedback={onRecommendationFeedback}
                      />
                    ) : undefined
                  }
                />
              );
            }
            if (sectionKey === 'today') {
              return (
                <HomePurposeWidget
                  {...common}
                  sectionKey="timeline"
                  icon={CalendarRange}
                  items={contributionModel.buckets.timeline}
                  state={contributionModel.bucketStates.timeline}
                  maxItems={sectionItemLimit('today')}
                  allRoute={homePurposeAllRoute('timeline', contributionModel.buckets.timeline)}
                  supportStack={sectionUsesSupportStack('today')}
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
                  maxItems={sectionItemLimit('response-hub')}
                  allRoute={homePurposeAllRoute('response', contributionModel.buckets.response)}
                  supportStack={sectionUsesSupportStack('response-hub')}
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
                  maxItems={sectionItemLimit('request-tracker')}
                  allRoute={homePurposeAllRoute('request', contributionModel.buckets.request)}
                  supportStack={sectionUsesSupportStack('request-tracker')}
                />
              );
            }
            return (
              <HomePurposeWidget
                {...common}
                sectionKey="pulse"
                icon={Activity}
                items={rolePulseItems}
                state={contributionModel.bucketStates.pulse}
                maxItems={sectionItemLimit('role-pulse')}
                allRoute={homePurposeAllRoute('pulse', rolePulseItems)}
                supportStack={sectionUsesSupportStack('role-pulse')}
                roleSignals={roleSignals}
              />
            );
          }}
        />
      </Box>
    </Box>
  );
}
