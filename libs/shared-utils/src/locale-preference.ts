export const LOCALE_PREFERENCE_STORAGE_KEY = 'dwp.locale';

const LEGACY_LOCALE_STORAGE_KEY = 'lang';

export function canonicalizeLocale(locale?: string | null): string | null {
  const candidate = locale?.trim();
  if (!candidate) return null;
  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? null;
  } catch {
    return null;
  }
}

export function readLocalePreference(): string | null {
  if (typeof window === 'undefined') return null;
  const current = canonicalizeLocale(window.localStorage.getItem(LOCALE_PREFERENCE_STORAGE_KEY));
  if (current) return current;

  const legacy = canonicalizeLocale(window.localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY));
  if (!legacy) return null;

  window.localStorage.setItem(LOCALE_PREFERENCE_STORAGE_KEY, legacy);
  window.localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
  return legacy;
}

export function writeLocalePreference(locale: string): string {
  const canonical = canonicalizeLocale(locale);
  if (!canonical) throw new Error('Locale must be a well-formed BCP 47 language tag.');
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_PREFERENCE_STORAGE_KEY, canonical);
    window.localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
  }
  return canonical;
}

export function resolveRequestLocale(): string {
  const stored = readLocalePreference();
  if (stored) return stored;
  if (typeof navigator !== 'undefined') {
    for (const locale of navigator.languages ?? [navigator.language]) {
      const canonical = canonicalizeLocale(locale);
      if (canonical) return canonical;
    }
  }
  return 'en';
}
