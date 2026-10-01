import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getSystemCodeSet } from '@dwp-frontend/shared-utils/api/system-code-catalog-api';

type SystemCodeOptionsRequest = Readonly<{
  enabled?: boolean;
  contextScopeKey?: string;
  cacheKey?: readonly unknown[];
  queryMeta?: Readonly<Record<string, unknown>>;
}>;

export type SystemCodeOptionsState<T extends string> = Readonly<{
  options: readonly T[];
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  usingFallback: boolean;
}>;

export function useSystemCodeOptionsState<T extends string>(
  codeSetKey: string,
  fallback: readonly T[],
  request: SystemCodeOptionsRequest = {}
): SystemCodeOptionsState<T> {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
  const query = useQuery({
    queryKey: [
      'system-code-set',
      codeSetKey,
      locale,
      request.contextScopeKey ?? '',
      ...(request.cacheKey ?? []),
    ],
    queryFn: ({ signal }) => getSystemCodeSet(codeSetKey, locale, request.contextScopeKey, signal),
    enabled: request.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    meta: request.queryMeta,
  });

  const resolved = useMemo(() => {
    const registered = query.data?.values.map((value) => value.code);
    if (!registered) return { options: fallback, usingFallback: true } as const;

    const registeredSet = new Set(registered);
    if (
      registered.length !== fallback.length ||
      registeredSet.size !== fallback.length ||
      fallback.some((code) => !registeredSet.has(code))
    ) {
      return { options: fallback, usingFallback: true } as const;
    }
    return { options: registered as T[], usingFallback: false } as const;
  }, [fallback, query.data]);

  return {
    options: resolved.options,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    usingFallback: resolved.usingFallback,
  };
}

export function useSystemCodeOptions<T extends string>(
  codeSetKey: string,
  fallback: readonly T[],
  enabled = true
): readonly T[] {
  return useSystemCodeOptionsState(codeSetKey, fallback, { enabled }).options;
}
