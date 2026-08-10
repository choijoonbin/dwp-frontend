import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { setLanguage, getCurrentLanguage } from './i18n';
import { productLocales, resolveSupportedLocale, type SupportedLocale } from './locales';

export function useLanguage() {
  const { i18n } = useTranslation();

  const currentLang = resolveSupportedLocale(
    i18n.resolvedLanguage,
    i18n.language,
    getCurrentLanguage()
  );
  const changeLanguage = useCallback(async (lng: SupportedLocale) => {
    await setLanguage(lng);
  }, []);

  return {
    language: currentLang,
    locales: productLocales,
    setLanguage: changeLanguage,
  };
}
