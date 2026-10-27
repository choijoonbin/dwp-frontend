import { DateTimePickerField } from './date-picker-field';
import { civilDateTimeToPickerIso, pickerIsoToCivilDateTime } from './date-time-policy';
import { DwpDateTimeProvider, useDateTimePolicy } from './date-time-provider';

import type { DateTimePickerFieldProps } from './date-picker-field';

export type LocalDateTimePickerFieldProps = Omit<
  DateTimePickerFieldProps,
  'value' | 'onValueChange'
> & {
  /** Unzoned, minute-precision YYYY-MM-DDTHH:mm; the owning command converts it to an instant. */
  value: string | null;
  onValueChange: (localDateTime: string | null) => void;
};

/** Preserves civil draft values without introducing a timezone conversion into command payloads. */
export function LocalDateTimePickerField({
  value,
  onValueChange,
  ...props
}: LocalDateTimePickerFieldProps) {
  const { locale } = useDateTimePolicy();
  return (
    <DwpDateTimeProvider locale={locale} timeZone="UTC">
      <DateTimePickerField
        {...props}
        value={civilDateTimeToPickerIso(value)}
        onValueChange={(next) => onValueChange(pickerIsoToCivilDateTime(next))}
      />
    </DwpDateTimeProvider>
  );
}
