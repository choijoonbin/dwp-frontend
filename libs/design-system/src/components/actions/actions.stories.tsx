import { Save, Settings, Trash2 } from 'lucide-react';
import { expect, within } from 'storybook/test';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton } from './action-button';
import { ActionIconButton } from './action-icon-button';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'DWP Components/Actions',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const IntentAndState: Story = {
  render: () => (
    <Box sx={{ width: { xs: 300, sm: 560 }, p: 3 }}>
      <Typography component="h1" variant="h6" sx={{ mb: 2 }}>
        Product actions
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
        <ActionButton intent="primary" startIcon={<Save size={17} />}>
          Save changes
        </ActionButton>
        <ActionButton intent="secondary">Preview</ActionButton>
        <ActionButton intent="quiet">Cancel</ActionButton>
        <ActionButton intent="danger" startIcon={<Trash2 size={17} />}>
          Delete
        </ActionButton>
        <ActionIconButton label="Open settings">
          <Settings size={18} />
        </ActionIconButton>
      </Stack>
      <Stack direction="row" gap={1.5} sx={{ mt: 3 }}>
        <ActionButton loading loadingLabel="Saving changes">
          Save changes
        </ActionButton>
        <ActionButton disabled>Unavailable</ActionButton>
      </Stack>
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Saving changes' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Open settings' })).toBeVisible();
  },
};
