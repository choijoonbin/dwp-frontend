import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getSystemCodeSet } from '@dwp-frontend/shared-utils/api/system-code-catalog-api';

export function useSystemCodeOptions<T extends string>(
  codeSetKey: string,
  fallback: readonly T[]
): readonly T[] {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
  const query = useQuery({
    queryKey: ['system-code-set', codeSetKey, locale],
    queryFn: () => getSystemCodeSet(codeSetKey, locale),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return useMemo(() => {
    const registered = query.data?.values.map((value) => value.code);
    if (!registered) return fallback;

    const supported = new Set<string>(fallback);
    if (registered.length !== fallback.length || registered.some((code) => !supported.has(code))) {
      return fallback;
    }
    return registered as T[];
  }, [fallback, query.data]);
}
