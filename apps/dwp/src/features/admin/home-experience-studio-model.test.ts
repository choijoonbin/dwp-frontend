import { describe, expect, it } from 'vitest';

import {
  createHomeExperienceStudioForm,
  homeExperienceDraftVersion,
  resolveHomeExperiencePreviewCopy,
  shouldHydrateHomeExperienceDraft,
  toHomeExperienceUpdateRequest,
} from './home-experience-studio-model';

import type { HomeExperience } from '@dwp-frontend/shared-utils';

function experience(overrides: Partial<HomeExperience> = {}): HomeExperience {
  return {
    localizedContent: {},
    defaultLocale: 'ko',
    backgroundPosition: 'CENTER',
    overlayOpacity: 18,
    launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
    compositionPolicy: {
      schemaVersion: 3,
      experienceVariant: 'FLOW_V1',
      personalCustomizationEnabled: true,
      governedZones: [],
    },
    version: 4,
    ...overrides,
  };
}

describe('home experience studio model', () => {
  it('preserves every server locale while adding the required editor locales', () => {
    const form = createHomeExperienceStudioForm(
      experience({
        defaultLocale: 'ja',
        localizedContent: {
          ja: { headline: 'ようこそ', subheadline: '仕事を始めましょう' },
          fr: { headline: 'Bienvenue', subheadline: 'Commencez votre journée' },
        },
      })
    );

    expect(Object.keys(form.localizedContent)).toEqual(
      expect.arrayContaining(['ko', 'en', 'ja', 'fr'])
    );
    expect(toHomeExperienceUpdateRequest(form, 5).localizedContent.fr?.headline).toBe('Bienvenue');
  });

  it('resolves preview copy from the selected locale, then the default locale', () => {
    const form = createHomeExperienceStudioForm(
      experience({
        defaultLocale: 'en',
        localizedContent: {
          en: { headline: 'Welcome', subheadline: 'Start here' },
          ko: { headline: '', subheadline: '' },
        },
      })
    );

    expect(
      resolveHomeExperiencePreviewCopy(form, 'ko', {
        headline: 'Built in',
        subheadline: 'Fallback',
      })
    ).toMatchObject({ headline: 'Welcome', sourceLocale: 'en', usedBuiltInFallback: false });
  });

  it('matches runtime field-by-field fallback for partially translated copy', () => {
    const form = createHomeExperienceStudioForm(
      experience({
        defaultLocale: 'en',
        localizedContent: {
          en: { headline: 'Welcome', subheadline: 'Start here' },
          ko: { headline: '다시 오신 것을 환영합니다', subheadline: '' },
        },
      })
    );

    expect(
      resolveHomeExperiencePreviewCopy(form, 'ko', {
        headline: 'Built in',
        subheadline: 'Fallback',
      })
    ).toMatchObject({
      headline: '다시 오신 것을 환영합니다',
      subheadline: 'Start here',
      sourceLocale: 'en',
      fallbackFields: ['subheadline'],
      builtInFallbackFields: [],
      usedBuiltInFallback: false,
    });
  });

  it('reports built-in fallback per field when selected and default copy are incomplete', () => {
    const form = createHomeExperienceStudioForm(
      experience({
        defaultLocale: 'en',
        localizedContent: {
          en: { headline: 'Welcome', subheadline: '' },
          ko: { headline: '', subheadline: '' },
        },
      })
    );

    expect(
      resolveHomeExperiencePreviewCopy(form, 'ko', {
        headline: 'Built in',
        subheadline: 'Fallback',
      })
    ).toMatchObject({
      headline: 'Welcome',
      subheadline: 'Fallback',
      fallbackFields: ['headline'],
      builtInFallbackFields: ['subheadline'],
      usedBuiltInFallback: true,
    });
  });

  it('derives backward-compatible v2 fields from the legacy image position', () => {
    expect(
      createHomeExperienceStudioForm(experience({ backgroundPosition: 'RIGHT' }))
    ).toMatchObject({
      backgroundFocalX: 100,
      backgroundFocalY: 50,
      mobileBackgroundFocalX: 100,
      mobileBackgroundFocalY: 50,
      contentAlignment: 'LEFT',
    });
    expect(
      createHomeExperienceStudioForm(experience({ backgroundPosition: 'LEFT' }))
    ).toMatchObject({ backgroundFocalX: 0, mobileBackgroundFocalX: 0, contentAlignment: 'RIGHT' });
    expect(createHomeExperienceStudioForm(experience())).toMatchObject({
      backgroundFocalX: 50,
      contentAlignment: 'CENTER',
    });
  });

  it('keeps a dirty draft bound to its hydrated version after a background refetch', () => {
    expect(homeExperienceDraftVersion(7, 8)).toBe(7);
    expect(homeExperienceDraftVersion(null, 8)).toBe(8);
  });

  it('does not overwrite a dirty draft when a newer query result arrives', () => {
    expect(shouldHydrateHomeExperienceDraft(null, 1, false)).toBe(true);
    expect(shouldHydrateHomeExperienceDraft(1, 1, false)).toBe(false);
    expect(shouldHydrateHomeExperienceDraft(1, 2, true)).toBe(false);
    expect(shouldHydrateHomeExperienceDraft(1, 2, false)).toBe(true);
  });
});
