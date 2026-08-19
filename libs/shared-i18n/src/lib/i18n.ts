import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { readLocalePreference, writeLocalePreference } from '@dwp-frontend/shared-utils';

import {
  productLocales,
  resolveSupportedLocale,
  PRODUCT_DEFAULT_LOCALE,
  type SupportedLocale,
} from './locales';

export const PRODUCT_NAMESPACES = [
  'common',
  'shell',
  'auth',
  'home',
  'communications',
  'calendar',
  'rooms',
  'mail',
  'services',
  'work',
  'account',
  'admin',
  'hcm',
  'approvals',
  'spaces',
  'composer',
  'workforce',
  'provider',
  'display',
] as const;

function getInitialLanguage(): SupportedLocale {
  if (typeof window === 'undefined') return PRODUCT_DEFAULT_LOCALE;
  return resolveSupportedLocale(readLocalePreference(), ...(navigator.languages ?? []));
}

export function initI18n() {
  if (i18n.isInitialized) return i18n;

  i18n
    .use(
      resourcesToBackend(async (lang: string, ns: string) => {
        try {
          const m = await import(`../locales/${lang}/${ns}.json`);
          return m.default;
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn(`[i18n] Failed to load ns=${ns} lang=${lang}`, err);
          }
          return {};
        }
      })
    )
    .use(initReactI18next)
    .init({
      lng: getInitialLanguage(),
      fallbackLng: PRODUCT_DEFAULT_LOCALE,
      supportedLngs: productLocales.map(({ code }) => code),
      nonExplicitSupportedLngs: true,
      load: 'all',
      defaultNS: 'common',
      fallbackNS: 'common',
      ns: [...PRODUCT_NAMESPACES],
      returnNull: false,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: true,
      },
      saveMissing: import.meta.env.DEV,
      missingKeyHandler: import.meta.env.DEV
        ? (lngs: readonly string[], ns: string, key: string) => {
            console.warn(`[i18n] Missing key: ${key} (ns: ${ns})`);
          }
        : undefined,
    });

  const lang = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  if (typeof document?.documentElement !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = i18n.dir(lang);
  }

  i18n.on('languageChanged', (lng: string) => {
    const resolved = resolveSupportedLocale(lng);
    writeLocalePreference(resolved);
    if (typeof document?.documentElement !== 'undefined') {
      document.documentElement.lang = resolved;
      document.documentElement.dir = i18n.dir(resolved);
    }
  });

  return i18n;
}

export function getCurrentLanguage(): SupportedLocale {
  return resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
}

export async function setLanguage(lng: SupportedLocale): Promise<void> {
  await i18n.changeLanguage(resolveSupportedLocale(lng));
}
