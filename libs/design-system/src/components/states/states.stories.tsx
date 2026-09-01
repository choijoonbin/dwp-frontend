import { RotateCcw } from 'lucide-react';
import { expect, within } from 'storybook/test';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';

import { ActionButton } from '../actions';
import { EmptyState, ErrorState, LoadingState } from './state-panels';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'DWP Components/Async States',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompleteSet: Story = {
  render: () => (
    <Box sx={{ p: 3 }}>
      <LoadingState label="Loading members" variant="skeleton" size="compact" />
      <Divider />
      <Box sx={{ p: 2 }}>
        <LoadingState
          label="Loading calendar workspace"
          variant="skeleton"
          embedded
          skeletonHeights={[126, 360]}
          skeletonGap={2}
        />
      </Box>
      <Divider />
      <EmptyState
        title="No members found"
        description="Try changing the organization or status filters."
        actionLabel="Clear filters"
        onAction={() => undefined}
        size="compact"
      />
      <Divider />
      <ErrorState
        title="Members could not be loaded"
        description="The request timed out. Existing filters are preserved."
        size="compact"
        retryLabel="Try again"
        onRetry={() => undefined}
      />
      <Divider />
      <EmptyState
        title="No policies yet"
        action={
          <ActionButton intent="secondary" startIcon={<RotateCcw size={17} />}>
            Restore defaults
          </ActionButton>
        }
        size="compact"
      />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status', { name: 'Loading members' })).toBeVisible();
    await expect(canvas.getByRole('status', { name: 'Loading calendar workspace' })).toBeVisible();
    await expect(canvas.getByRole('alert')).toHaveTextContent('Members could not be loaded');
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeEnabled();
  },
};
