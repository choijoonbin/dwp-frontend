import { describe, expect, it } from 'vitest';

import { isSupportedLocale, PRODUCT_DEFAULT_LOCALE, resolveSupportedLocale } from './locales';

describe('product locale resolution', () => {
  it('maps regional language tags to a supported product language', () => {
    expect(resolveSupportedLocale('ko-KR')).toBe('ko');
    expect(resolveSupportedLocale('en-US')).toBe('en');
  });

  it('evaluates candidates in user, tenant, and product fallback order', () => {
    expect(resolveSupportedLocale('fr-CA', 'ko-KR', 'en')).toBe('ko');
    expect(resolveSupportedLocale('fr-CA', 'de-DE')).toBe(PRODUCT_DEFAULT_LOCALE);
  });

  it('rejects malformed or unavailable language tags as supported locales', () => {
    expect(isSupportedLocale('not a locale')).toBe(false);
    expect(isSupportedLocale('fr-FR')).toBe(false);
    expect(isSupportedLocale('ko-KR')).toBe(true);
  });
});
