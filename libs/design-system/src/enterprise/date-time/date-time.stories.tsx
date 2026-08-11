import { useState } from 'react';
import { expect, within } from 'storybook/test';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DatePickerField, DateTimePickerField } from './date-picker-field';
import { DateRangePickerField } from './date-range-picker-field';

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { DateRangeValue } from './date-time-policy';

function DatePolicyStory() {
  const [date, setDate] = useState<string | null>('2026-08-11');
  const [instant, setInstant] = useState<string | null>('2026-08-11T00:30:00.000Z');
  const [range, setRange] = useState<DateRangeValue>({
    start: '2026-08-11',
    end: '2026-08-15',
  });

  return (
    <Box sx={{ width: { xs: 340, sm: 620 }, p: 3 }}>
      <Typography component="h1" variant="h6" sx={{ mb: 2 }}>
        Date and time policy
      </Typography>
      <Stack gap={2.5}>
        <DatePickerField
          label="Effective date"
          value={date}
          onValueChange={setDate}
          supportingText="Stored as YYYY-MM-DD without time-zone conversion."
        />
        <DateTimePickerField
          label="Publish time"
          value={instant}
          onValueChange={setInstant}
          supportingText="Stored as a UTC instant and shown in the product time zone."
          minutesStep={5}
        />
        <DateRangePickerField
          value={range}
          onValueChange={setRange}
          startLabel="Start date"
          endLabel="End date"
          orderErrorMessage="End date must be on or after start date."
          supportingText="Both dates are inclusive."
        />
      </Stack>
    </Box>
  );
}

const meta = {
  title: 'DWP Enterprise/Date and Time',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProductPolicy: Story = {
  render: () => <DatePolicyStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: 'Start date - End date' })).toBeVisible();
    await expect(canvas.getByRole('group', { name: 'Effective date' })).toBeVisible();
    await expect(canvas.getByRole('group', { name: 'Publish time' })).toBeVisible();
  },
};
