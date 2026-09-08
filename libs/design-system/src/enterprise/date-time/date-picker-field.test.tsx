import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatePickerField, DateTimePickerField, TimePickerField } from './date-picker-field';

import type { SxProps, Theme } from '@mui/material/styles';

type CapturedPickerProps = {
  slotProps?: {
    openPickerButton?: {
      sx?: SxProps<Theme>;
    };
  };
};

const captured = vi.hoisted(() => ({
  date: undefined as CapturedPickerProps | undefined,
  dateTime: undefined as CapturedPickerProps | undefined,
  time: undefined as CapturedPickerProps | undefined,
}));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: (props: CapturedPickerProps) => {
    captured.date = props;
    return <div data-testid="date-picker" />;
  },
}));

vi.mock('@mui/x-date-pickers/DateTimePicker', () => ({
  DateTimePicker: (props: CapturedPickerProps) => {
    captured.dateTime = props;
    return <div data-testid="date-time-picker" />;
  },
}));

vi.mock('@mui/x-date-pickers/TimePicker', () => ({
  TimePicker: (props: CapturedPickerProps) => {
    captured.time = props;
    return <div data-testid="time-picker" />;
  },
}));

function renderFields() {
  renderToStaticMarkup(
    <>
      <DatePickerField label="Date" value={null} onValueChange={() => undefined} />
      <DateTimePickerField label="Date and time" value={null} onValueChange={() => undefined} />
      <TimePickerField label="Time" value={null} onValueChange={() => undefined} />
    </>
  );
}

describe('date and time picker touch-target contract', () => {
  beforeEach(() => {
    captured.date = undefined;
    captured.dateTime = undefined;
    captured.time = undefined;
  });

  it('keeps desktop density while expanding every picker trigger to 44px on mobile or touch', () => {
    renderFields();

    for (const props of [captured.date, captured.dateTime, captured.time]) {
      const sx = props?.slotProps?.openPickerButton?.sx;
      expect(sx).toEqual({
        '@media (max-width:599.95px), (pointer: coarse)': {
          width: 44,
          minWidth: 44,
          height: 44,
          minHeight: 44,
          flex: '0 0 44px',
        },
      });
      expect(sx).not.toHaveProperty('width');
      expect(sx).not.toHaveProperty('height');
    }
  });
});
