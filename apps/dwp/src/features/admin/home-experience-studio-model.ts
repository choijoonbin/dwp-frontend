import type {
  HomeBackgroundPosition,
  HomeContentAlignment,
  HomeExperience,
  LocalizedHomeCopy,
  UpdateHomeExperienceRequest,
} from '@dwp-frontend/shared-utils';

export const REQUIRED_STUDIO_LOCALES = ['ko', 'en'] as const;

export type HomeExperienceStudioForm = {
  localizedContent: Record<string, LocalizedHomeCopy>;
  defaultLocale: string;
  backgroundPosition: HomeBackgroundPosition;
  backgroundFocalX: number;
  backgroundFocalY: number;
  mobileBackgroundFocalX: number;
  mobileBackgroundFocalY: number;
  contentAlignment: HomeContentAlignment;
  overlayOpacity: number;
};

export type ResolvedPreviewCopy = {
  headline: string;
  subheadline: string;
  sourceLocale?: string;
  fallbackFields: Array<'headline' | 'subheadline'>;
  builtInFallbackFields: Array<'headline' | 'subheadline'>;
  usedBuiltInFallback: boolean;
};

const emptyCopy = (): LocalizedHomeCopy => ({ headline: '', subheadline: '' });

function normalizedCopy(copy?: LocalizedHomeCopy | null): LocalizedHomeCopy {
  return { headline: copy?.headline ?? '', subheadline: copy?.subheadline ?? '' };
}

function boundedPercent(value: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value!)));
}

export function createHomeExperienceStudioForm(
  experience: HomeExperience
): HomeExperienceStudioForm {
  const configured = Object.fromEntries(
    Object.entries(experience.localizedContent ?? {}).map(([locale, copy]) => [
      locale,
      normalizedCopy(copy),
    ])
  );
  const defaultLocale = experience.defaultLocale || 'ko';
  const fallback = normalizedCopy({
    headline: experience.headline,
    subheadline: experience.subheadline,
  });
  if (Object.keys(configured).length === 0 && (fallback.headline || fallback.subheadline)) {
    configured[defaultLocale] = fallback;
  }
  REQUIRED_STUDIO_LOCALES.forEach((locale) => {
    configured[locale] ??= emptyCopy();
  });
  configured[defaultLocale] ??= emptyCopy();

  const legacyFocalX =
    experience.backgroundPosition === 'LEFT'
      ? 0
      : experience.backgroundPosition === 'RIGHT'
        ? 100
        : 50;
  const desktopFocalX = boundedPercent(experience.backgroundFocalX, legacyFocalX);
  const desktopFocalY = boundedPercent(experience.backgroundFocalY, 50);
  const legacyContentAlignment: HomeContentAlignment =
    experience.backgroundPosition === 'LEFT'
      ? 'RIGHT'
      : experience.backgroundPosition === 'CENTER'
        ? 'CENTER'
        : 'LEFT';

  return {
    localizedContent: configured,
    defaultLocale,
    backgroundPosition: experience.backgroundPosition ?? 'CENTER',
    backgroundFocalX: desktopFocalX,
    backgroundFocalY: desktopFocalY,
    mobileBackgroundFocalX: boundedPercent(experience.mobileBackgroundFocalX, desktopFocalX),
    mobileBackgroundFocalY: boundedPercent(experience.mobileBackgroundFocalY, desktopFocalY),
    contentAlignment: experience.contentAlignment ?? legacyContentAlignment,
    overlayOpacity: Math.min(70, Math.max(0, experience.overlayOpacity ?? 18)),
  };
}

export function resolveHomeExperiencePreviewCopy(
  form: HomeExperienceStudioForm,
  selectedLocale: string,
  builtIn: Pick<ResolvedPreviewCopy, 'headline' | 'subheadline'>
): ResolvedPreviewCopy {
  const selected = form.localizedContent[selectedLocale];
  const fallback = form.localizedContent[form.defaultLocale];
  const selectedHeadline = selected?.headline?.trim();
  const selectedSubheadline = selected?.subheadline?.trim();
  const fallbackHeadline = fallback?.headline?.trim();
  const fallbackSubheadline = fallback?.subheadline?.trim();
  const fallbackFields: ResolvedPreviewCopy['fallbackFields'] = [];
  const builtInFallbackFields: ResolvedPreviewCopy['builtInFallbackFields'] = [];
  if (!selectedHeadline) {
    if (fallbackHeadline) fallbackFields.push('headline');
    else builtInFallbackFields.push('headline');
  }
  if (!selectedSubheadline) {
    if (fallbackSubheadline) fallbackFields.push('subheadline');
    else builtInFallbackFields.push('subheadline');
  }
  const headline = selectedHeadline || fallbackHeadline || builtIn.headline;
  const subheadline = selectedSubheadline || fallbackSubheadline || builtIn.subheadline;
  return {
    headline,
    subheadline,
    sourceLocale: fallbackFields.length > 0 ? form.defaultLocale : selectedLocale,
    fallbackFields,
    builtInFallbackFields,
    usedBuiltInFallback: builtInFallbackFields.length > 0,
  };
}

/** Prevents a background refetch from replacing an unpublished draft with a newer server view. */
export function shouldHydrateHomeExperienceDraft(
  hydratedVersion: number | null,
  incomingVersion: number,
  dirty: boolean
): boolean {
  if (hydratedVersion === incomingVersion) return false;
  return hydratedVersion === null || !dirty;
}

export function homeExperienceStudioLocales(form: HomeExperienceStudioForm): string[] {
  return [...new Set([...REQUIRED_STUDIO_LOCALES, ...Object.keys(form.localizedContent)])].sort(
    (left, right) => {
      const leftRequired = REQUIRED_STUDIO_LOCALES.indexOf(
        left as (typeof REQUIRED_STUDIO_LOCALES)[number]
      );
      const rightRequired = REQUIRED_STUDIO_LOCALES.indexOf(
        right as (typeof REQUIRED_STUDIO_LOCALES)[number]
      );
      if (leftRequired >= 0 || rightRequired >= 0) {
        if (leftRequired < 0) return 1;
        if (rightRequired < 0) return -1;
        return leftRequired - rightRequired;
      }
      return left.localeCompare(right);
    }
  );
}

export function toHomeExperienceUpdateRequest(
  form: HomeExperienceStudioForm,
  version: number
): UpdateHomeExperienceRequest {
  const localizedContent = Object.fromEntries(
    Object.entries(form.localizedContent).map(([locale, copy]) => [
      locale,
      {
        headline: copy.headline?.trim() || null,
        subheadline: copy.subheadline?.trim() || null,
      },
    ])
  );
  const fallback = localizedContent[form.defaultLocale] ?? { headline: null, subheadline: null };
  return {
    headline: fallback.headline,
    subheadline: fallback.subheadline,
    localizedContent,
    defaultLocale: form.defaultLocale,
    backgroundPosition: form.backgroundPosition,
    backgroundFocalX: form.backgroundFocalX,
    backgroundFocalY: form.backgroundFocalY,
    mobileBackgroundFocalX: form.mobileBackgroundFocalX,
    mobileBackgroundFocalY: form.mobileBackgroundFocalY,
    contentAlignment: form.contentAlignment,
    overlayOpacity: form.overlayOpacity,
    version,
  };
}

export function isHomeExperienceStudioFormEqual(
  left: HomeExperienceStudioForm,
  right: HomeExperienceStudioForm
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Keeps optimistic concurrency bound to the server version that created this draft. */
export function homeExperienceDraftVersion(
  hydratedVersion: number | null,
  latestQueryVersion: number
): number {
  return hydratedVersion ?? latestQueryVersion;
}
