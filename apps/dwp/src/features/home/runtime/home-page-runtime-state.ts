import type { HomeExperience } from '@dwp-frontend/shared-utils';

type HomeCopyExperience = Pick<
  HomeExperience,
  'defaultLocale' | 'headline' | 'localizedContent' | 'subheadline'
>;

export type HomeBootstrapState = 'experience' | 'layout' | null;

export function resolveHomeBootstrapState({
  experiencePending,
  experienceReady,
  layoutPending,
  deviceLayoutPending,
}: Readonly<{
  experiencePending: boolean;
  experienceReady: boolean;
  layoutPending: boolean;
  deviceLayoutPending: boolean;
}>): HomeBootstrapState {
  if (experiencePending) return 'experience';
  if (experienceReady && (layoutPending || deviceLayoutPending)) return 'layout';
  return null;
}

export function resolveHomeDeviceClass({
  editPreviewActive,
  previewDevice,
  runtimeMobile,
}: Readonly<{
  editPreviewActive: boolean;
  previewDevice: 'desktop' | 'mobile';
  runtimeMobile: boolean;
}>): 'DESKTOP' | 'MOBILE' {
  if (editPreviewActive) return previewDevice === 'mobile' ? 'MOBILE' : 'DESKTOP';
  return runtimeMobile ? 'MOBILE' : 'DESKTOP';
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
