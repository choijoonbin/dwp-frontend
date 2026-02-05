/**
 * Intl 기반 날짜/숫자/통화 포맷 유틸
 * lang에 따라 ko-KR / en-US locale 적용
 */

import { getCurrentLanguage } from './i18n';

// ----------------------------------------------------------------------

const getLocale = (): string => {
  const lang = getCurrentLanguage();
  return lang === 'ko' ? 'ko-KR' : 'en-US';
};

/**
 * 숫자 포맷 (천 단위 구분)
 */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '';
  }
  return new Intl.NumberFormat(getLocale()).format(Number(value));
}

/**
 * 통화 포맷
 * @param currency ISO 4217 코드 (예: 'KRW', 'USD')
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currency = 'KRW'
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '';
  }
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
  }).format(Number(value));
}

/**
 * 날짜 포맷 (날짜만)
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (value === null || value === undefined) {
    return '';
  }
  const date = typeof value === 'object' ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(date);
}

/**
 * 날짜+시간 포맷
 */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (value === null || value === undefined) {
    return '';
  }
  const date = typeof value === 'object' ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}
