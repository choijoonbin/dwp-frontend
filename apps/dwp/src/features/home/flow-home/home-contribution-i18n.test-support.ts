import { createInstance } from 'i18next';

import enHome from '../../../../../../libs/shared-i18n/src/locales/en/home.json';
import koHome from '../../../../../../libs/shared-i18n/src/locales/ko/home.json';

import type { HomeContributionTranslator } from '../contributions';

const contributionI18n = createInstance();

export const homeContributionI18nReady = contributionI18n.init({
  lng: 'ko',
  fallbackLng: 'en',
  defaultNS: 'home',
  ns: ['home'],
  resources: {
    ko: { home: koHome },
    en: { home: enHome },
  },
  interpolation: { escapeValue: false },
});

function translator(language: 'ko' | 'en'): HomeContributionTranslator {
  return (key, values) => contributionI18n.t(key, { lng: language, ns: 'home', ...(values ?? {}) });
}

export const translateHomeContributionKo = translator('ko');
export const translateHomeContributionEn = translator('en');
