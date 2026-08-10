import { beforeEach, describe, expect, it } from 'vitest';

import {
  canonicalizeLocale,
  LOCALE_PREFERENCE_STORAGE_KEY,
  readLocalePreference,
  resolveRequestLocale,
  writeLocalePreference,
} from './locale-preference';

describe('locale preference contract', () => {
  beforeEach(() => window.localStorage.clear());

  it('canonicalizes well-formed BCP 47 language tags', () => {
    expect(canonicalizeLocale('zh-hant-hk')).toBe('zh-Hant-HK');
    expect(canonicalizeLocale('not a locale')).toBeNull();
  });

  it('migrates the legacy language key without losing the preference', () => {
    window.localStorage.setItem('lang', 'ko-KR');

    expect(readLocalePreference()).toBe('ko-KR');
    expect(window.localStorage.getItem(LOCALE_PREFERENCE_STORAGE_KEY)).toBe('ko-KR');
    expect(window.localStorage.getItem('lang')).toBeNull();
  });

  it('uses the persisted preference for API language negotiation', () => {
    writeLocalePreference('en-US');
    expect(resolveRequestLocale()).toBe('en-US');
  });

  it('does not persist malformed locale identifiers', () => {
    expect(() => writeLocalePreference('not a locale')).toThrow();
    expect(readLocalePreference()).toBeNull();
  });
});
