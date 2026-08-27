import { describe, expect, it } from 'vitest';

import {
  resolveHomeBootstrapState,
  resolveHomeDeviceClass,
  resolveHomePageCopy,
} from './home-page-runtime-state';

describe('Home page runtime state', () => {
  it('keeps the bootstrap visible until the experience and selected layout are ready', () => {
    expect(
      resolveHomeBootstrapState({
        experiencePending: true,
        experienceReady: false,
        layoutPending: true,
        deviceLayoutPending: true,
      })
    ).toBe('experience');
    expect(
      resolveHomeBootstrapState({
        experiencePending: false,
        experienceReady: true,
        layoutPending: true,
        deviceLayoutPending: false,
      })
    ).toBe('layout');
    expect(
      resolveHomeBootstrapState({
        experiencePending: false,
        experienceReady: true,
        layoutPending: false,
        deviceLayoutPending: true,
      })
    ).toBe('layout');
  });

  it('does not report a layout bootstrap before experience readiness or after completion', () => {
    expect(
      resolveHomeBootstrapState({
        experiencePending: false,
        experienceReady: false,
        layoutPending: true,
        deviceLayoutPending: true,
      })
    ).toBeNull();
    expect(
      resolveHomeBootstrapState({
        experiencePending: false,
        experienceReady: true,
        layoutPending: false,
        deviceLayoutPending: false,
      })
    ).toBeNull();
  });

  it('uses the preview device only while an edit preview is active', () => {
    expect(
      resolveHomeDeviceClass({
        editPreviewActive: true,
        previewDevice: 'mobile',
        runtimeMobile: false,
      })
    ).toBe('MOBILE');
    expect(
      resolveHomeDeviceClass({
        editPreviewActive: false,
        previewDevice: 'desktop',
        runtimeMobile: true,
      })
    ).toBe('MOBILE');
  });

  it('resolves localized copy through exact, language, default, and global fallbacks', () => {
    const experience = {
      defaultLocale: 'en',
      headline: 'Global headline',
      subheadline: 'Global subheadline',
      localizedContent: {
        ko: { headline: '한국어 제목' },
        en: { headline: 'English headline', subheadline: 'English subheadline' },
      },
    };

    expect(
      resolveHomePageCopy({
        experience,
        locale: 'KO-KR',
        fallbackHeadline: 'Fallback headline',
        fallbackSubheadline: 'Fallback subheadline',
      })
    ).toEqual({ headline: '한국어 제목', subheadline: 'Global subheadline' });
    expect(
      resolveHomePageCopy({
        experience: { ...experience, localizedContent: {} },
        locale: 'fr-FR',
        fallbackHeadline: 'Fallback headline',
        fallbackSubheadline: 'Fallback subheadline',
      })
    ).toEqual({ headline: 'Global headline', subheadline: 'Global subheadline' });
    expect(
      resolveHomePageCopy({
        experience: null,
        locale: 'ko-KR',
        fallbackHeadline: 'Fallback headline',
        fallbackSubheadline: 'Fallback subheadline',
      })
    ).toEqual({ headline: 'Fallback headline', subheadline: 'Fallback subheadline' });
  });
});
