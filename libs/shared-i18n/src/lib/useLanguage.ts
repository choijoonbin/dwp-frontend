/**
 * 언어 get/set 훅 — Shell↔Remote 공통
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { getCurrentLanguage, setLanguage } from './i18n';

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
