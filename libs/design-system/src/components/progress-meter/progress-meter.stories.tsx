import { expect, within } from 'storybook/test';

import Box from '@mui/material/Box';

import { ProgressMeter } from './progress-meter';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'DWP Components/Progress Meter',
  component: ProgressMeter,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Box sx={{ width: 360, p: 3 }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof ProgressMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReviewProgress: Story = {
  args: {
    label: 'Access review decisions',
    value: 62.5,
    valueLabel: '5 of 8 complete',
    tone: 'primary',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('progressbar', { name: 'Access review decisions' })
    ).toHaveAttribute('aria-valuenow', '62.5');
  },
};
