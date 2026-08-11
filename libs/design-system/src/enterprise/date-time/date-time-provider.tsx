import { createContext, useContext, useMemo } from 'react';
import 'dayjs/locale/en';
import 'dayjs/locale/ko';

import { enUS, koKR } from '@mui/x-date-pickers/locales';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

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
  const localeText =
    resolvedLocale === 'ko'
      ? koKR.components.MuiLocalizationProvider.defaultProps.localeText
      : enUS.components.MuiLocalizationProvider.defaultProps.localeText;

  return (
    <DateTimePolicyContext.Provider value={value}>
      <LocalizationProvider
        dateAdapter={AdapterDayjs}
        adapterLocale={resolvedLocale}
        localeText={localeText}
      >
        {children}
      </LocalizationProvider>
    </DateTimePolicyContext.Provider>
  );
}

export function useDateTimePolicy(): DateTimePolicy {
  return useContext(DateTimePolicyContext);
}
