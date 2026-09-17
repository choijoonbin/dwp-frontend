import type {
  EffectiveWidgetCatalog,
  HomeExperienceVariant,
  HomeOverview,
  HomePreference,
  HomePreferenceLayout,
  HomeRecommendation,
  HomeView,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { HomeWidgetRuntimeDecisions } from '../../components/home-widget-runtime-contract';
import type { HomeModeStudioPreset } from './home-mode-studio-preset';
import type { HomeStudioSection } from './home-personalization-model';

export type ActiveHomeStudioSection = HomeStudioSection | 'mode' | 'overview';
export type HomeStudioWidgetPreference = PersonalHomeWidgetPreference<string>;

export const LEGACY_HOME_STUDIO_SECTIONS: readonly ActiveHomeStudioSection[] = [
  'overview',
  'mode',
  'layout',
  'appearance',
];

export type HomePersonalizationStudioProps = {
  open: boolean;
  composerEnabled: boolean;
  modeKey: HomeExperienceVariant;
  modeScopedViews: boolean;
  preferenceStore?: 'LEGACY' | 'VIEWS';
  legacyPreference?: HomePreference<string>;
  fourDeviceLayoutsSupported: boolean;
  tenantId?: number | null;
  userId?: number | null;
  seedLayout: HomePreferenceLayout<string> | null;
  overview?: HomeOverview;
  overviewLoading: boolean;
  overviewFetching: boolean;
  overviewFailed: boolean;
  widgetRuntimeDecisions: HomeWidgetRuntimeDecisions;
  effectiveWidgetCatalog?: EffectiveWidgetCatalog;
  feedbackBusy: boolean;
  onRetryOverview: () => void;
  onRecommendationFeedback?: (recommendation: HomeRecommendation) => void;
  onClose: () => void;
  onExited?: () => void;
  onEditView: (view: HomeView) => void;
  onActiveViewChanged?: (view: HomeView) => void;
  modePreset?: HomeModeStudioPreset;
  presentation?: 'dialog' | 'page';
  initialSection?: ActiveHomeStudioSection;
  onSectionChange?: (section: ActiveHomeStudioSection) => void;
};
