import { useTranslation } from 'react-i18next';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';
import { ActionButton } from '@dwp-frontend/design-system';
import { ArrowRight, Newspaper } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WorkspaceWidgetCanvas } from '../../../components/workspace-composer/workspace-widget-canvas';
import { AppLaunchpad } from '../app-launchpad';
import { HomeDayRail } from '../home-day-rail';
import { HomeOverviewWidget } from '../home-overview-widget';
import { HOME_WIDGET_REGISTRY } from '../home-widget-registry';
import { HomeContentState, HomeWidgetErrorBoundary } from '../runtime/home-content-state';
import {
  ClassicOrganizationResources,
  ClassicSectionHeading,
} from './classic-organization-resources';
import type { ClassicOrganizationResourceState } from './classic-organization-resources';
import { ClassicPersonalSummary } from './classic-personal-summary';
import type { ClassicCommunicationState } from '../home-day-rail';

import type {
  HomeAudienceProfile,
  HomeBackgroundPosition,
  HomeOverview,
  HomePresentation,
  HomeRecommendation,
  HomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { GovernedWorkspaceWidget } from '../../../components/workspace-composer/workspace-widget-canvas';
import type { HomeWidgetRuntimeDecisions } from '../runtime/widget-registry-runtime';
import type {
  HomeAppDefinition,
  HomeAppGroup,
  LaunchpadLayout,
} from '../../../components/workspace-composer/app-launchpad-model';
import type { ReactNode } from 'react';

const classicTypography = {
  caption: foundationTokens.home.typography.captionSize,
  supporting: foundationTokens.home.typography.supportingSize,
  desktopTitle: foundationTokens.home.typography.mobileHeroSize - 4,
  titleLineHeight: foundationTokens.home.typography.cardLineHeight + 0.05,
  bodyLineHeight: foundationTokens.home.typography.tightLineHeight + 0.3,
  launchpadCaption: `${foundationTokens.home.typography.captionSize} !important`,
  launchpadLineHeight: `${foundationTokens.home.typography.mobileHeroSize - 4}px !important`,
} as const;

const CLASSIC_COMMUNICATION_FRESHNESS_MS = 5 * 60 * 1000;

type ClassicHomeProps = {
  audience: HomeAudienceProfile;
  currentDate: string;
  headline: string;
  subheadline: string;
  backgroundUrl: string;
  usesDefaultBackground: boolean;
  backgroundPosition: HomeBackgroundPosition;
  overlayOpacity: number;
  apps: readonly HomeAppDefinition[];
  appGroups: readonly HomeAppGroup[];
  appLayout: LaunchpadLayout;
  widgets: readonly HomeWidgetPreference[];
  widgetRuntimeDecisions: HomeWidgetRuntimeDecisions;
  governedWidgets: readonly GovernedWorkspaceWidget[];
  overview?: HomeOverview;
  overviewLoading: boolean;
  overviewFetching: boolean;
  overviewFailed: boolean;
  editing: boolean;
  customizationEnabled: boolean;
  customizationBusy: boolean;
  personalizationLoading: boolean;
  presentation: HomePresentation;
  availableWidth: number;
  feedbackBusy: boolean;
  onBrowseAllApps: () => void;
  onOpenOrganizationUpdates: () => void;
  onStartEditing?: () => void;
  onOpenStudio?: () => void;
  onAppLayoutChange: (layout: LaunchpadLayout) => void;
  onWidgetsChange: (widgets: HomeWidgetPreference[]) => void;
  onLaunchApp: (app: HomeAppDefinition) => void;
  onManageApp?: (app: HomeAppDefinition) => void;
  onRetryOverview: () => void;
  onRecommendationFeedback?: (recommendation: HomeRecommendation) => void;
  /** Deterministic source-state projection supplied by the evidence/runtime adapter. */
  organizationResourceState?: ClassicOrganizationResourceState;
  disabledAppIds?: readonly string[];
  ownerWidgetRegion?: ReactNode;
};

export function resolveClassicCommunicationState({
  overview,
  loading,
  fetching,
  requestFailed,
  now = Date.now(),
}: Readonly<{
  overview?: HomeOverview;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  now?: number;
}>): ClassicCommunicationState {
  if (loading && !overview) return 'initial-loading';
  if (requestFailed && !overview) return 'widget-error';
  if (!overview) return 'initial-loading';
  if (overview.communications.status === 'FORBIDDEN') return 'forbidden';
  if (overview.communications.status === 'UNAVAILABLE') return 'widget-error';
  if (requestFailed) return 'stale';
  if (fetching) return 'background-refresh';
  const generatedAt = Date.parse(overview.communications.generatedAt);
  if (Number.isFinite(generatedAt) && now - generatedAt > CLASSIC_COMMUNICATION_FRESHNESS_MS) {
    return 'stale';
  }
  const feed = overview.communications.data;
  return feed?.featured || (feed?.items.length ?? 0) > 0 ? null : 'empty';
}

function ClassicSecondaryNews({
  overview,
  state,
  onRetry,
}: {
  overview?: HomeOverview;
  state: ClassicCommunicationState;
  onRetry: () => void;
}) {
  const { t } = useTranslation('home');
  const feed =
    overview?.communications.status === 'AVAILABLE' ? overview.communications.data : null;
  const stories = feed?.items.slice(0, 2) ?? [];
  const verifiedContent = (
    <Box
      data-testid="home-news-carousel"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5,
      }}
    >
      {stories.map((story) => (
        <Box
          component="article"
          key={story.communicationId}
          data-news-story-id={story.communicationId}
          sx={{
            minWidth: 0,
            minHeight: { xs: 88, md: 154 },
            p: { xs: 1, md: 2 },
            display: 'grid',
            gridTemplateColumns: { xs: '64px minmax(0, 1fr)', md: 'minmax(0, 1fr)' },
            gap: { xs: 1, md: 0 },
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: foundationTokens.home.radius.control,
          }}
        >
          <Box
            component="img"
            src={story.coverImageUrl || '/assets/home/wave2/classic-canonical-hero.jpg'}
            alt=""
            sx={{
              display: { xs: 'block', md: 'none' },
              width: 64,
              height: 64,
              objectFit: 'cover',
              borderRadius: foundationTokens.radius.compact,
            }}
          />
          <Stack minWidth={0}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Typography
                component="span"
                sx={{
                  px: 0.75,
                  py: 0.25,
                  color: 'primary.main',
                  bgcolor: 'action.hover',
                  fontSize: classicTypography.caption,
                }}
              >
                {story.publisherName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {story.publishedAt
                  ? formatDate(story.publishedAt, {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </Typography>
            </Stack>
            <Typography
              component="h3"
              sx={{
                mt: { xs: 0.5, md: 1 },
                fontSize: {
                  xs: classicTypography.supporting,
                  md: classicTypography.desktopTitle,
                },
                lineHeight: classicTypography.titleLineHeight,
                fontWeight: foundationTokens.home.typography.weightBold,
                display: '-webkit-box',
                WebkitLineClamp: { xs: 1, md: 2 },
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {story.title}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                mt: 0.5,
                fontSize: classicTypography.supporting,
                lineHeight: classicTypography.bodyLineHeight,
                display: { xs: 'none', sm: '-webkit-box' },
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {story.summary}
            </Typography>
            <ActionButton
              component="a"
              href={`/communications/for-you/${story.communicationId}`}
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={14} aria-hidden="true" />}
              sx={{
                minHeight: 44,
                mt: 'auto',
                ml: 'auto',
                px: 0.75,
                fontSize: classicTypography.caption,
              }}
            >
              {t('classic.newsDetail')}
            </ActionButton>
          </Stack>
        </Box>
      ))}
      {stories.length === 0 && (
        <Box
          sx={{
            gridColumn: '1 / -1',
            p: 3,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Newspaper size={18} aria-hidden="true" />
            <Typography variant="body2" color="text.secondary">
              {t('classic.newsEmpty')}
            </Typography>
          </Stack>
        </Box>
      )}
    </Box>
  );

  if (state === null) return verifiedContent;
  if (state === 'empty') {
    return (
      <HomeContentState
        kind="empty"
        size="compact"
        title={t('classic.newsEmpty')}
        actionLabel={t('states.empty.action')}
        onAction={onRetry}
      />
    );
  }
  if (state === 'initial-loading' || state === 'forbidden') {
    return <HomeContentState kind={state} size="compact" />;
  }
  if (state === 'widget-error') {
    return <HomeContentState kind="widget-error" size="compact" onAction={onRetry} />;
  }
  return (
    <HomeContentState
      kind={state}
      size="compact"
      affectedSources={overview?.communications.source ? [overview.communications.source] : []}
      lastSuccessfulAt={
        overview?.communications.generatedAt
          ? formatDate(new Date(overview.communications.generatedAt), {
              hour: '2-digit',
              minute: '2-digit',
            })
          : undefined
      }
      onAction={state === 'stale' ? onRetry : undefined}
      preservedContent={verifiedContent}
    />
  );
}

/** Stable rollback renderer. It shares the launcher/editor contracts with Flow but keeps Classic IA. */
export function ClassicHome({
  audience,
  currentDate,
  headline,
  subheadline,
  backgroundUrl,
  usesDefaultBackground,
  backgroundPosition,
  overlayOpacity,
  apps,
  appGroups,
  appLayout,
  widgets,
  widgetRuntimeDecisions,
  governedWidgets,
  overview,
  overviewLoading,
  overviewFetching,
  overviewFailed,
  editing,
  customizationEnabled,
  customizationBusy,
  personalizationLoading,
  presentation,
  availableWidth,
  feedbackBusy,
  onBrowseAllApps,
  onOpenOrganizationUpdates,
  onStartEditing,
  onOpenStudio,
  onAppLayoutChange,
  onWidgetsChange,
  onLaunchApp,
  onManageApp,
  onRetryOverview,
  onRecommendationFeedback,
  organizationResourceState,
  disabledAppIds,
  ownerWidgetRegion,
}: ClassicHomeProps) {
  const { t } = useTranslation('home');
  const communicationFeed =
    overview?.communications.status === 'AVAILABLE' ? overview.communications.data : undefined;
  const featuredStory = communicationFeed?.featured ?? communicationFeed?.items[0];
  const requiredStory = [communicationFeed?.featured, ...(communicationFeed?.items ?? [])].find(
    (item) => item?.acknowledgementRequired && !item.readerState.acknowledged
  );
  const communicationState = resolveClassicCommunicationState({
    overview,
    loading: overviewLoading,
    fetching: overviewFetching,
    requestFailed: overviewFailed,
  });
  return (
    <Box
      data-testid="classic-home"
      data-home-ia="organization-portal"
      data-home-scroll-contract="single-document"
      data-classic-home-available-width={Math.round(availableWidth)}
      sx={{
        width: 1,
        minWidth: 0,
        bgcolor: 'var(--home-canvas)',
        pb: { xs: 1, md: 2 },
        '& [data-launchpad-group-target]': {
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) !important',
          '--launchpad-tile-height': '84px',
          gridAutoRows: 'var(--launchpad-tile-height) !important',
          height: 'auto !important',
          maxHeight: 'none !important',
          minHeight: 'var(--launchpad-tile-height) !important',
          overflowX: 'visible !important',
          overflowY: 'visible !important',
          overscrollBehaviorY: 'auto !important',
          scrollbarGutter: 'auto !important',
        },
        '& [data-launchpad-group-grid]': {
          gridTemplateColumns: 'minmax(0, 1fr) !important',
          gap: '10px !important',
        },
        '& [data-launchpad-group-grid] > section': {
          minHeight: 'auto !important',
          px: '10px !important',
          py: '9px !important',
        },
        '& [data-launchpad-group-grid] > section > p': {
          minHeight: '16px !important',
          mt: '0 !important',
          fontSize: classicTypography.launchpadCaption,
          lineHeight: classicTypography.launchpadLineHeight,
        },
        '& [data-launchpad-item-label]': {
          minHeight: '28px',
          flexShrink: '0 !important',
        },
        '& [data-launchpad-group-grid] > section:nth-of-type(3) [data-launchpad-group-target]': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) !important',
        },
        '& [data-launchpad-group-grid] > section:nth-of-type(4) [data-launchpad-group-target]': {
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) !important',
        },
        '@container dwp-home-workspace (min-width: 900px)': {
          '& [data-launchpad-group-target]': {
            '--launchpad-tile-height': '76px',
          },
          '& [data-launchpad-group-grid]': {
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr)) !important',
            gap: '16px !important',
          },
          '& [data-launchpad-group-grid] > section:nth-of-type(1)': { gridColumn: 'span 3' },
          '& [data-launchpad-group-grid] > section:nth-of-type(2)': { gridColumn: 'span 4' },
          '& [data-launchpad-group-grid] > section:nth-of-type(3)': { gridColumn: 'span 2' },
          '& [data-launchpad-group-grid] > section:nth-of-type(4)': { gridColumn: 'span 3' },
        },
        '@container dwp-home-workspace (min-width: 1100px)': {
          '& [data-launchpad-group-grid]': {
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr)) !important',
          },
        },
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          color: 'CanvasText',
          '&, & *': {
            color: 'CanvasText !important',
            borderColor: 'CanvasText !important',
            boxShadow: 'none !important',
            textShadow: 'none !important',
          },
          '& a, & button, & [role="button"]': {
            color: 'LinkText !important',
          },
          '& :disabled, & [aria-disabled="true"]': {
            color: 'GrayText !important',
          },
        },
      }}
    >
      <HomeDayRail
        audience={audience}
        currentDate={currentDate}
        headline={headline}
        subheadline={subheadline}
        backgroundUrl={backgroundUrl}
        usesDefaultBackground={usesDefaultBackground}
        backgroundPosition={backgroundPosition}
        overlayOpacity={overlayOpacity}
        featuredStory={featuredStory}
        requiredStory={requiredStory}
        communicationState={communicationState}
        assignedAppCount={apps.length}
        onBrowseAll={onBrowseAllApps}
        onOpenOrganizationUpdates={onOpenOrganizationUpdates}
        onStartEditing={onStartEditing}
        onOpenStudio={onOpenStudio}
        workspaceTools={
          <AppLaunchpad
            apps={apps}
            groups={appGroups}
            layout={appLayout}
            editing={editing}
            reorderable={customizationEnabled}
            title={t('page.appsTitle')}
            customizationBusy={customizationBusy}
            onLayoutChange={onAppLayoutChange}
            onLaunch={onLaunchApp}
            onManage={onManageApp}
            onStartEditing={onStartEditing}
            disabledAppIds={disabledAppIds}
          />
        }
        personalizationBusy={personalizationLoading || customizationBusy}
      />
      <Box
        sx={{
          width: 1,
          maxWidth: 1192,
          mx: 'auto',
          px: { xs: 1.5, sm: 2, md: 3 },
          py: { xs: 1.5, md: 2.5 },
        }}
      >
        {!editing && governedWidgets.length > 0 && (
          <Box
            component="section"
            aria-labelledby="classic-secondary-news-title"
            data-classic-secondary-news
            sx={{ mb: { xs: 2, md: 4 } }}
          >
            <ClassicSectionHeading
              id="classic-secondary-news-title"
              title={t('classic.resources.secondaryTitle')}
              description={t('classic.resources.secondaryDescription')}
            />
            <Box data-classic-secondary-news-widget={governedWidgets[0]?.widgetKey}>
              <ClassicSecondaryNews
                overview={overview}
                state={communicationState}
                onRetry={onRetryOverview}
              />
            </Box>
          </Box>
        )}

        {!editing && <ClassicOrganizationResources resourceState={organizationResourceState} />}

        {!editing && ownerWidgetRegion}

        <Box
          data-testid="home-workspace-grid"
          component="section"
          aria-labelledby="classic-personal-flow-title"
          sx={{
            mt: { xs: 2, md: 4 },
            '& [data-workspace-widget-surface="card"] :is([data-workspace-widget-content], [data-workspace-widget-transparent]) > section':
              {
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: foundationTokens.workplace.radius.badge,
                overflow: 'hidden',
                px: { xs: 1.75, md: 2 },
                py: { xs: 1.75, md: 2 },
              },
          }}
        >
          <ClassicSectionHeading
            id="classic-personal-flow-title"
            title={t('classic.resources.personalTitle')}
            description={t('classic.resources.personalDescription')}
          />
          {editing ? (
            <WorkspaceWidgetCanvas
              registry={HOME_WIDGET_REGISTRY}
              widgets={widgets}
              editing={customizationEnabled}
              busy={customizationBusy}
              presentation={presentation}
              scrollMode="document"
              getLabel={(widgetKey) => t(`widgets.registry.${widgetKey}.label`)}
              onChange={onWidgetsChange}
              onStartEditing={onStartEditing}
              renderWidgetBoundary={(widgetKey, content) => (
                <HomeWidgetErrorBoundary widgetKey={widgetKey} resetKey={overview?.generatedAt}>
                  {content}
                </HomeWidgetErrorBoundary>
              )}
              renderWidget={(widgetKey, size, height) => (
                <HomeOverviewWidget
                  widgetKey={widgetKey}
                  size={size}
                  height={height}
                  runtimeDecision={widgetRuntimeDecisions[widgetKey]}
                  label={t(`widgets.registry.${widgetKey}.label`)}
                  overview={overview}
                  loading={overviewLoading}
                  fetching={overviewFetching}
                  requestFailed={overviewFailed}
                  onRetry={onRetryOverview}
                  feedbackBusy={feedbackBusy}
                  onRecommendationFeedback={onRecommendationFeedback}
                />
              )}
            />
          ) : (
            <ClassicPersonalSummary
              overview={overview}
              loading={overviewLoading}
              fetching={overviewFetching}
              requestFailed={overviewFailed}
              onRetry={onRetryOverview}
            />
          )}
        </Box>
        {editing && <Box aria-hidden="true" sx={{ height: { xs: 196, sm: 88 } }} />}
      </Box>
    </Box>
  );
}
