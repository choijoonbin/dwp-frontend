import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { setLanguage, getCurrentLanguage } from './i18n';

export type SupportedLanguage = 'ko' | 'en';

export function useLanguage() {
  const { i18n } = useTranslation();

  const currentLang = (i18n.language ?? getCurrentLanguage()) as SupportedLanguage;
  const changeLanguage = useCallback((lng: SupportedLanguage) => {
    setLanguage(lng);
  }, []);

  return {
    language: currentLang,
    setLanguage: changeLanguage,
  };
}
