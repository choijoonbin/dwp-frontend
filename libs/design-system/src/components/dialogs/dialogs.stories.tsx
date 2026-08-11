import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { ActionButton } from '../actions';
import { FormField } from '../forms';
import { FormDialog } from './form-dialog';
import { ConfirmDialog } from './confirm-dialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

function DialogContractStory() {
  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [name, setName] = useState('Finance workspace');

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" gap={1.5}>
        <ActionButton intent="primary" onClick={() => setFormOpen(true)}>
          Open form dialog
        </ActionButton>
        <ActionButton intent="danger" onClick={() => setConfirmOpen(true)}>
          Open danger dialog
        </ActionButton>
      </Stack>
      <FormDialog
        open={formOpen}
        title="Edit workspace"
        description="Changes apply to every workspace member."
        cancelLabel="Cancel"
        submitLabel="Save changes"
        submitDisabled={!name.trim()}
        onClose={() => setFormOpen(false)}
        onSubmit={() => setFormOpen(false)}
      >
        <FormField
          autoFocus
          required
          label="Workspace name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </FormDialog>
      <ConfirmDialog
        open={confirmOpen}
        intent="danger"
        title="Delete workspace?"
        description="This action permanently removes the workspace and cannot be undone."
        cancelLabel="Keep workspace"
        confirmLabel="Delete workspace"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
      />
    </Box>
  );
}

const meta = {
  title: 'DWP Components/Dialogs',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const FocusAndIntent: Story = {
  render: () => <DialogContractStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: 'Open danger dialog' }));
    await expect(page.getByRole('alertdialog', { name: 'Delete workspace?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep workspace' })).toHaveFocus();
  },
};
