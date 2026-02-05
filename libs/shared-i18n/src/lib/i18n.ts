/**
 * i18next 초기화 — Shell이 단일 인스턴스 제공, Remote 공유
 * ko/en 2개 언어, 기본 ko
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

const STORAGE_KEY = 'lang';

function getInitialLanguage(): 'ko' | 'en' {
  if (typeof window === 'undefined') return 'ko';
  const stored = localStorage.getItem(STORAGE_KEY) as 'ko' | 'en' | null;
  if (stored === 'ko' || stored === 'en') return stored;
  const browser = navigator.language?.toLowerCase();
  if (browser?.startsWith('ko')) return 'ko';
  return 'en';
}

export function initI18n() {
  if (i18n.isInitialized) return i18n;

  i18n
    .use(
      resourcesToBackend(
        async (lang: string, ns: string) => {
          try {
            const m = await import(`../locales/${lang}/${ns}.json`);
            return m.default;
          } catch (err) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[i18n] Failed to load ns=${ns} lang=${lang}`, err);
            }
            return {};
          }
        }
      )
    )
    .use(initReactI18next)
    .init({
      lng: getInitialLanguage(),
      fallbackLng: 'ko',
      defaultNS: 'common',
      ns: ['common'],
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: true,
      },
      saveMissing: process.env.NODE_ENV === 'development',
      missingKeyHandler:
        process.env.NODE_ENV === 'development'
          ? (lngs: string[], ns: string, key: string) => {
              console.warn(`[i18n] Missing key: ${key} (ns: ${ns})`);
            }
          : undefined,
    });

  const lang = i18n.language;
  if (typeof document?.documentElement !== 'undefined') {
    document.documentElement.lang = lang;
  }

  i18n.on('languageChanged', (lng: string) => {
    localStorage.setItem(STORAGE_KEY, lng);
    if (typeof document?.documentElement !== 'undefined') {
      document.documentElement.lang = lng;
    }
  });

  return i18n;
}

export function getCurrentLanguage(): string {
  return i18n.language ?? 'ko';
}

export function setLanguage(lng: 'ko' | 'en'): void {
  i18n.changeLanguage(lng);
}

export { i18n };
