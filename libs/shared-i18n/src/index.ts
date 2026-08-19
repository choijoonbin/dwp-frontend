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
  resolveDisplayCodeWithFallback,
  useDisplayDictionary,
  type DisplayDomain,
} from './lib/display-dictionary';
export {
  SYSTEM_ROLE_CODES,
  resolveRoleDisplayCopy,
  useRoleDisplay,
  type RoleDisplayCopy,
  type RoleDisplaySource,
  type SystemRoleCode,
} from './lib/role-display';
