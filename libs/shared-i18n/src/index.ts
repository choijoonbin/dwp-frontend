export { useLanguage } from './lib/useLanguage';
export { I18nProvider } from './lib/I18nProvider';
export {
  productLocales,
  isSupportedLocale,
  resolveSupportedLocale,
  PRODUCT_DEFAULT_LOCALE,
  type SupportedLocale,
} from './lib/locales';
export { formatDate, formatList, formatNumber, formatRelativeTime } from './lib/formatters';
export {
  DISPLAY_DOMAINS,
  displayDictionaryKey,
  humanizeDisplayCode,
  resolveDisplayCode,
  useDisplayDictionary,
  type DisplayDomain,
} from './lib/display-dictionary';
