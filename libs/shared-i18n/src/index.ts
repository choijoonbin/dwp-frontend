export { initI18n, getCurrentLanguage, setLanguage, i18n } from './lib/i18n';
export {
  formatNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
} from './lib/format';
export { useLanguage } from './lib/useLanguage';
export { I18nProvider } from './lib/I18nProvider';

// react-i18next re-export (동일 인스턴스 사용)
export { useTranslation, Trans } from 'react-i18next';
