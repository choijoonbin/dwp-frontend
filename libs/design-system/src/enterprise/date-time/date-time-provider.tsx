import { createContext, useContext, useMemo } from 'react';

import { resolveProductDateLocale, resolveProductTimeZone } from './date-time-policy';

import type { ProductDateLocale } from './date-time-policy';

export type DateTimePolicy = {
  locale: ProductDateLocale;
  timeZone: string;
};

const DateTimePolicyContext = createContext<DateTimePolicy>({ locale: 'en', timeZone: 'UTC' });

export type DwpDateTimeProviderProps = {
  locale?: string;
  timeZone?: string | null;
  children: React.ReactNode;
};

export function DwpDateTimeProvider({ locale, timeZone, children }: DwpDateTimeProviderProps) {
  const resolvedLocale = resolveProductDateLocale(locale);
  const value = useMemo<DateTimePolicy>(
    () => ({ locale: resolvedLocale, timeZone: resolveProductTimeZone(timeZone ?? undefined) }),
    [resolvedLocale, timeZone]
  );

  return <DateTimePolicyContext.Provider value={value}>{children}</DateTimePolicyContext.Provider>;
}

export function useDateTimePolicy(): DateTimePolicy {
  return useContext(DateTimePolicyContext);
}
