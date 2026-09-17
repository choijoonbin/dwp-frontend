import { formatDate } from '@dwp-frontend/shared-i18n';

import type { HomeDeviceClass, HomeExperience, HomeOverview } from '@dwp-frontend/shared-utils';
import { homeDeviceClassForAvailableWidth } from './home-available-width';

type HomeCopyExperience = Pick<
  HomeExperience,
  'defaultLocale' | 'headline' | 'localizedContent' | 'subheadline'
>;

export type HomePageGateState =
  | Readonly<{ kind: 'loading'; source: 'experience' | 'layout' }>
  | Readonly<{ kind: 'error'; source: 'experience' | 'layout' }>
  | Readonly<{ kind: 'ready' }>;

export function resolveHomePageGateState({
  experiencePending,
  experienceReady,
  experienceFailed,
  layoutPending,
  layoutFailed,
  deviceLayoutPending,
}: Readonly<{
  experiencePending: boolean;
  experienceReady: boolean;
  experienceFailed: boolean;
  layoutPending: boolean;
  layoutFailed: boolean;
  deviceLayoutPending: boolean;
}>): HomePageGateState {
  if (experiencePending) return { kind: 'loading', source: 'experience' };
  if (experienceFailed) return { kind: 'error', source: 'experience' };
  if (experienceReady && layoutFailed) return { kind: 'error', source: 'layout' };
  if (experienceReady && (layoutPending || deviceLayoutPending)) {
    return { kind: 'loading', source: 'layout' };
  }
  return { kind: 'ready' };
}

export function canStartHomeEditing({
  customizationEnabled,
  editorOpen,
  gateState,
}: Readonly<{
  customizationEnabled: boolean;
  editorOpen: boolean;
  gateState: HomePageGateState;
}>): boolean {
  return customizationEnabled && !editorOpen && gateState.kind === 'ready';
}

export function resolveHomeDeviceClass({
  editPreviewActive,
  previewDevice,
  availableWidth,
}: Readonly<{
  editPreviewActive: boolean;
  previewDevice: 'desktop' | 'mobile';
  availableWidth: number;
}>): HomeDeviceClass {
  if (editPreviewActive) {
    return previewDevice === 'mobile' ? 'MOBILE_STANDARD' : 'DESKTOP_STANDARD';
  }
  return homeDeviceClassForAvailableWidth(availableWidth);
}

export function resolveHomePageCopy({
  experience,
  locale,
  fallbackHeadline,
  fallbackSubheadline,
}: Readonly<{
  experience?: HomeCopyExperience | null;
  locale: string;
  fallbackHeadline: string;
  fallbackSubheadline: string;
}>): Readonly<{ headline: string; subheadline: string }> {
  const normalizedLocale = locale.toLowerCase();
  const language = normalizedLocale.split('-')[0];
  const localizedCopy = experience
    ? experience.localizedContent?.[normalizedLocale] ||
      experience.localizedContent?.[language] ||
      experience.localizedContent?.[experience.defaultLocale]
    : undefined;

  return {
    headline: localizedCopy?.headline || experience?.headline || fallbackHeadline,
    subheadline: localizedCopy?.subheadline || experience?.subheadline || fallbackSubheadline,
  };
}

export function resolveHomeWorkspaceUpdatedAt(overview?: HomeOverview): string {
  const timestamp = overview?.work.data?.generatedAt || overview?.generatedAt;
  return timestamp ? formatDate(new Date(timestamp), { hour: '2-digit', minute: '2-digit' }) : '-';
}
