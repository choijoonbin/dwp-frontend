import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { TFunction } from 'i18next';

export const DISPLAY_DOMAINS = [
  'states',
  'outcomes',
  'severities',
  'entityKinds',
  'eventCategories',
  'auditActions',
  'sourceTypes',
  'connectorTypes',
  'authModes',
  'assignmentTypes',
  'roleNames',
  'roleDescriptions',
  'roleFamilies',
  'roleAssignmentClasses',
  'scopeTypes',
  'targetTypes',
  'relationTypes',
  'riskTiers',
  'objectTypes',
] as const;

export type DisplayDomain = (typeof DISPLAY_DOMAINS)[number];

const MISSING_SENTINEL = '__DWP_DISPLAY_CODE_UNMAPPED__';

export function displayDictionaryKey(code: string): string {
  return code
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function humanizeDisplayCode(code: string): string {
  const normalized = code
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

export function resolveDisplayCode(
  t: TFunction<'display'>,
  domain: DisplayDomain,
  code?: string | null
): string {
  const normalized = code?.trim();
  if (!normalized) return t('empty');

  const key = `${domain}.${displayDictionaryKey(normalized)}`;
  const translated = t(key, { defaultValue: MISSING_SENTINEL });
  if (translated !== MISSING_SENTINEL) return translated;

  if (import.meta.env.DEV) {
    console.warn(`[display-dictionary] Unmapped ${domain} code: ${normalized}`);
  }
  return t('unmapped');
}

export function resolveDisplayCodeWithFallback(
  t: TFunction<'display'>,
  domain: DisplayDomain,
  code: string | null | undefined,
  fallback: string
): string {
  const normalized = code?.trim();
  if (!normalized) return fallback;

  const key = `${domain}.${displayDictionaryKey(normalized)}`;
  const translated = t(key, { defaultValue: MISSING_SENTINEL });
  return translated === MISSING_SENTINEL ? fallback : translated;
}

export function useDisplayDictionary() {
  const { t } = useTranslation('display');
  return useCallback(
    (domain: DisplayDomain, code?: string | null) => resolveDisplayCode(t, domain, code),
    [t]
  );
}
