import 'dayjs/locale/en';
import 'dayjs/locale/ko';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { enUS, koKR } from '@mui/x-date-pickers/locales';

import { useDateTimePolicy } from './date-time-provider';

import type { PropsWithChildren } from 'react';

export function DwpDatePickerProvider({ children }: PropsWithChildren) {
  const { locale } = useDateTimePolicy();
  const localeText =
    locale === 'ko'
      ? koKR.components.MuiLocalizationProvider.defaultProps.localeText
      : enUS.components.MuiLocalizationProvider.defaultProps.localeText;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale} localeText={localeText}>
      {children}
    </LocalizationProvider>
  );
}
