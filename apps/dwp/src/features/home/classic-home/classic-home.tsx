import { useTranslation } from 'react-i18next';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';

import { WorkspaceWidgetCanvas } from '../../../components/workspace-composer/workspace-widget-canvas';
import { AppLaunchpad } from '../app-launchpad';
import { HomeDayRail } from '../home-day-rail';
import { HomeOverviewWidget } from '../home-overview-widget';
import { HOME_WIDGET_REGISTRY } from '../home-widget-registry';
import { HomeWidgetErrorBoundary } from '../runtime/home-content-state';
import {
  ClassicOrganizationResources,
  ClassicSectionHeading,
} from './classic-organization-resources';
import { ClassicPersonalSummary } from './classic-personal-summary';

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
  onAppLayoutChange: (layout: LaunchpadLayout) => void;
  onWidgetsChange: (widgets: HomeWidgetPreference[]) => void;
  onLaunchApp: (app: HomeAppDefinition) => void;
  onManageApp?: (app: HomeAppDefinition) => void;
  onRetryOverview: () => void;
  onRecommendationFeedback: (recommendation: HomeRecommendation) => void;
};

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
  onAppLayoutChange,
  onWidgetsChange,
  onLaunchApp,
  onManageApp,
  onRetryOverview,
  onRecommendationFeedback,
}: ClassicHomeProps) {
  const { t } = useTranslation('home');
  return (
    <Box
      data-testid="classic-home"
      data-home-ia="organization-portal"
      data-home-scroll-contract="single-document"
      data-classic-home-available-width={Math.round(availableWidth)}
      sx={{
        width: 1,
        minWidth: 0,
        '& [data-launchpad-group-target]': {
          overflowY: 'hidden !important',
          overscrollBehaviorY: 'auto !important',
          scrollbarGutter: 'auto !important',
        },
        '@container dwp-home-workspace (min-width: 900px)': {
          '& [data-launchpad-group-grid]': {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) !important',
          },
          '& [data-launchpad-group-target]': {
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) !important',
          },
        },
        '@container dwp-home-workspace (min-width: 1100px)': {
          '& [data-launchpad-group-grid]': {
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) !important',
          },
          '& [data-launchpad-group-target]': {
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) !important',
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
        featuredStory={
          overview?.communications.status === 'AVAILABLE'
            ? (overview.communications.data?.featured ?? overview.communications.data?.items[0])
            : undefined
        }
        assignedAppCount={apps.length}
        onBrowseAll={onBrowseAllApps}
        onOpenOrganizationUpdates={onOpenOrganizationUpdates}
        onStartEditing={onStartEditing}
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
          />
        }
        personalizationBusy={personalizationLoading || customizationBusy}
      />
      <Box
        sx={{
          width: 1,
          maxWidth: 2240,
          mx: 'auto',
          px: { xs: 2, md: '50px' },
          py: { xs: 3, md: 4 },
        }}
      >
        {!editing && governedWidgets.length > 0 && (
          <Box
            component="section"
            aria-labelledby="classic-secondary-news-title"
            data-classic-secondary-news
            sx={{ mb: { xs: 3, md: 4 } }}
          >
            <ClassicSectionHeading
              id="classic-secondary-news-title"
              title={t('classic.resources.secondaryTitle')}
              description={t('classic.resources.secondaryDescription')}
            />
            <Box
              sx={{
                '& > *': { minWidth: 0 },
                '& section': {
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: foundationTokens.home.radius.control,
                },
              }}
            >
              {governedWidgets.map((widget) => (
                <Box key={widget.widgetKey} data-classic-secondary-news-widget={widget.widgetKey}>
                  {widget.content}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {!editing && <ClassicOrganizationResources />}

        <Box
          data-testid="home-workspace-grid"
          component="section"
          aria-labelledby="classic-personal-flow-title"
          sx={{
            mt: { xs: 3, md: 4 },
            '& [data-workspace-widget-surface="card"] :is([data-workspace-widget-content], [data-workspace-widget-transparent]) > section':
              {
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 0.5,
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
