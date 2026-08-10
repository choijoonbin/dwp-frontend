import { canonicalizeLocale } from '@dwp-frontend/shared-utils';

export const PRODUCT_DEFAULT_LOCALE = 'en';

export const productLocales = [
  { code: 'ko', nativeName: '한국어', englishName: 'Korean' },
  { code: 'en', nativeName: 'English', englishName: 'English' },
] as const;

export type SupportedLocale = (typeof productLocales)[number]['code'];

const supportedLocaleSet = new Set<string>(productLocales.map(({ code }) => code));

export function resolveSupportedLocale(
  ...candidates: Array<string | null | undefined>
): SupportedLocale {
  for (const candidate of candidates) {
    const canonical = canonicalizeLocale(candidate);
    if (!canonical) continue;
    if (supportedLocaleSet.has(canonical)) return canonical as SupportedLocale;
    const baseLanguage = canonical.split('-')[0];
    if (supportedLocaleSet.has(baseLanguage)) return baseLanguage as SupportedLocale;
  }
  return PRODUCT_DEFAULT_LOCALE;
}

export function isSupportedLocale(locale?: string | null): boolean {
  const canonical = canonicalizeLocale(locale);
  if (!canonical) return false;
  return supportedLocaleSet.has(canonical) || supportedLocaleSet.has(canonical.split('-')[0]);
}
