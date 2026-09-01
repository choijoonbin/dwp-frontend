import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';

import { WorkspaceWidgetCanvas } from '../../../components/workspace-composer/workspace-widget-canvas';
import { AppLaunchpad } from '../app-launchpad';
import { HomeDayRail } from '../home-day-rail';
import { HomeOverviewWidget } from '../home-overview-widget';
import { HOME_WIDGET_REGISTRY } from '../home-widget-registry';

import type {
  HomeAudienceProfile,
  HomeBackgroundPosition,
  HomeOverview,
  HomePresentation,
  HomeRecommendation,
  HomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { GovernedWorkspaceWidget } from '../../../components/workspace-composer/workspace-widget-canvas';
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
  feedbackBusy: boolean;
  onBrowseAllApps: () => void;
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
  feedbackBusy,
  onBrowseAllApps,
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
    <>
      <HomeDayRail
        audience={audience}
        currentDate={currentDate}
        headline={headline}
        subheadline={subheadline}
        backgroundUrl={backgroundUrl}
        usesDefaultBackground={usesDefaultBackground}
        backgroundPosition={backgroundPosition}
        overlayOpacity={overlayOpacity}
        assignedAppCount={apps.length}
        onBrowseAll={onBrowseAllApps}
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
            onImageBackground
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
        <Box
          data-testid="home-workspace-grid"
          sx={{
            '& [data-workspace-widget-content]': {
              overflowY: { xs: 'visible !important', sm: 'hidden !important' },
              scrollbarGutter: 'auto !important',
              '& > section': {
                height: { xs: 'auto !important', sm: '100% !important' },
                minHeight: { xs: 'auto !important', sm: '100% !important' },
                overflowX: { xs: 'visible !important', sm: 'hidden !important' },
                overflowY: { xs: 'visible !important', sm: 'auto !important' },
                overscrollBehaviorY: 'auto',
                scrollbarGutter: { xs: 'auto', sm: 'stable' },
              },
            },
            '& [data-workspace-widget-surface="card"] [data-workspace-widget-content] > section': {
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
          <WorkspaceWidgetCanvas
            registry={HOME_WIDGET_REGISTRY}
            widgets={widgets}
            governedWidgets={governedWidgets}
            editing={editing && customizationEnabled}
            busy={customizationBusy}
            presentation={presentation}
            getLabel={(widgetKey) => t(`widgets.registry.${widgetKey}.label`)}
            onChange={onWidgetsChange}
            onStartEditing={onStartEditing}
            renderWidget={(widgetKey, size, height) => (
              <HomeOverviewWidget
                widgetKey={widgetKey}
                size={size}
                height={height}
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
        </Box>
        {editing && <Box aria-hidden="true" sx={{ height: { xs: 196, sm: 88 } }} />}
      </Box>
    </>
  );
}
