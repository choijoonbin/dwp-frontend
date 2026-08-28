import { describe, expect, it } from 'vitest';

import {
  canStartHomeEditing,
  resolveHomeDeviceClass,
  resolveHomePageGateState,
  resolveHomePageCopy,
} from './home-page-runtime-state';

describe('Home page runtime state', () => {
  it('keeps the bootstrap visible until the experience and selected layout are ready', () => {
    expect(
      resolveHomePageGateState({
        experiencePending: true,
        experienceReady: false,
        experienceFailed: false,
        layoutPending: true,
        layoutFailed: false,
        deviceLayoutPending: true,
      })
    ).toEqual({ kind: 'loading', source: 'experience' });
    expect(
      resolveHomePageGateState({
        experiencePending: false,
        experienceReady: true,
        experienceFailed: false,
        layoutPending: true,
        layoutFailed: false,
        deviceLayoutPending: false,
      })
    ).toEqual({ kind: 'loading', source: 'layout' });
    expect(
      resolveHomePageGateState({
        experiencePending: false,
        experienceReady: true,
        experienceFailed: false,
        layoutPending: false,
        layoutFailed: false,
        deviceLayoutPending: true,
      })
    ).toEqual({ kind: 'loading', source: 'layout' });
  });

  it('surfaces experience and active layout failures instead of silently rendering a fallback', () => {
    expect(
      resolveHomePageGateState({
        experiencePending: false,
        experienceReady: false,
        experienceFailed: true,
        layoutPending: true,
        layoutFailed: false,
        deviceLayoutPending: true,
      })
    ).toEqual({ kind: 'error', source: 'experience' });
    expect(
      resolveHomePageGateState({
        experiencePending: false,
        experienceReady: true,
        experienceFailed: false,
        layoutPending: false,
        layoutFailed: true,
        deviceLayoutPending: false,
      })
    ).toEqual({ kind: 'error', source: 'layout' });
  });

  it('reports ready only after required home sources settle successfully', () => {
    expect(
      resolveHomePageGateState({
        experiencePending: false,
        experienceReady: true,
        experienceFailed: false,
        layoutPending: false,
        layoutFailed: false,
        deviceLayoutPending: false,
      })
    ).toEqual({ kind: 'ready' });
  });

  it('does not expose a dead edit action while home sources are unavailable', () => {
    expect(
      canStartHomeEditing({
        customizationEnabled: true,
        editorOpen: false,
        gateState: { kind: 'error', source: 'layout' },
      })
    ).toBe(false);
    expect(
      canStartHomeEditing({
        customizationEnabled: true,
        editorOpen: false,
        gateState: { kind: 'ready' },
      })
    ).toBe(true);
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
