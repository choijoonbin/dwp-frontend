import { describe, expect, it } from 'vitest';

import { civilDateTimeToPickerIso, pickerIsoToCivilDateTime } from './date-time-policy';

describe('civil date-time editor values', () => {
  it.each(['2026-10-27T00:00', '2026-10-27T23:59', '2028-02-29T12:30', '2026-03-08T02:30'])(
    'round-trips %s without shifting its civil day or hour',
    (value) => {
      expect(pickerIsoToCivilDateTime(civilDateTimeToPickerIso(value))).toBe(value);
    }
  );

  it.each(['2026-02-30T12:00', '2026-10-27T24:00', '2026-10-27T12:00Z', '2026-10-27', ''])(
    'rejects an invalid or zoned civil value %s',
    (value) => expect(civilDateTimeToPickerIso(value)).toBeNull()
  );

  it('leaves empty editors empty', () => {
    expect(civilDateTimeToPickerIso(null)).toBeNull();
    expect(pickerIsoToCivilDateTime(null)).toBeNull();
  });
});
