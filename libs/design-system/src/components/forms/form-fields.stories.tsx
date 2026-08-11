import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { FormField } from './form-field';
import { SelectField } from './select-field';
import { AutocompleteField } from './autocomplete-field';

import type { Meta, StoryObj } from '@storybook/react-vite';

type PersonOption = { id: string; label: string };

const people: PersonOption[] = [
  { id: 'EMP-1001', label: '김민준 / AI Platform' },
  { id: 'EMP-1002', label: '이서연 / Product Design' },
  { id: 'EMP-1003', label: '박지훈 / Security' },
];

function ProductContractStory() {
  const [email, setEmail] = useState('admin@skax.co.kr');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [owner, setOwner] = useState<PersonOption | null>(people[0]);

  return (
    <Box sx={{ width: { xs: 320, sm: 440 }, p: 3 }}>
      <Typography component="h1" variant="h6" sx={{ mb: 2 }}>
        Shared field contract
      </Typography>
      <Stack gap={2}>
        <FormField
          label="Company email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          supportingText="Use the email synchronized from HR."
          required
        />
        <SelectField
          label="Account status"
          value={status}
          onValueChange={(value) => setStatus(value as 'ACTIVE' | 'INACTIVE')}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
        />
        <AutocompleteField
          label="Owner"
          value={owner}
          onChange={(_, value) => setOwner(value)}
          options={people}
          supportingText="Search by employee or organization."
        />
        <FormField
          label="Invalid example"
          value="external.example.com"
          errorMessage="Enter an approved company domain."
          reserveFeedbackSpace
        />
      </Stack>
    </Box>
  );
}

const meta = {
  title: 'DWP Components/Form Fields',
  component: FormField,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProductContract: Story = {
  render: () => <ProductContractStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByRole('textbox', { name: /Company email/ });
    await userEvent.clear(email);
    await userEvent.type(email, 'employee@skax.co.kr');
    await expect(email).toHaveValue('employee@skax.co.kr');
    await expect(canvas.getByText('Enter an approved company domain.')).toBeVisible();
  },
};
