import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { ProductMark } from '../components';
import { foundationTokens } from './tokens';

const meta = {
  title: 'DWP Foundation/Overview',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const swatches = [
  ['Product', foundationTokens.color.product.primary],
  ['Secondary', foundationTokens.color.product.secondary],
  ['Information', foundationTokens.color.status.info],
  ['Success', foundationTokens.color.status.success],
  ['Warning', foundationTokens.color.status.warning],
  ['Error', foundationTokens.color.status.error],
] as const;

export const Foundation: Story = {
  render: () => (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          px: { xs: 3, md: 5 },
          py: 2.5,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <ProductMark />
      </Box>
      <Box sx={{ width: 1, maxWidth: 1120, mx: 'auto', px: { xs: 3, md: 5 }, py: 5 }}>
        <Typography component="h1" variant="h3">
          Foundation states
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Korean·English operational UI with semantic status and stable control density.
        </Typography>

        <Typography component="h2" variant="h6" sx={{ mt: 5, mb: 2 }}>
          Semantic color
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' },
            gap: 1.5,
          }}
        >
          {swatches.map(([label, color]) => (
            <Box key={label} sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  height: 48,
                  bgcolor: color,
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                }}
              />
              <Typography variant="caption" sx={{ display: 'block', mt: 0.75 }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 5 }} />

        <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
          Controls and feedback
        </Typography>
        <Stack spacing={2.5} sx={{ maxWidth: 680 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap>
            <Button variant="contained">Create request</Button>
            <Button variant="outlined">Review details</Button>
            <Button disabled>Unavailable</Button>
          </Stack>
          <TextField label="Request title" placeholder="업무 요청 제목을 입력하세요" />
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label="In progress" color="info" />
            <Chip label="Approved" color="success" />
            <Chip label="Attention" color="warning" />
          </Stack>
          <Alert severity="info">변경 사항은 검토 후 원본 시스템에 반영됩니다.</Alert>
        </Stack>
      </Box>
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole('textbox', { name: 'Request title' });

    await expect(canvas.getByRole('button', { name: 'Create request' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
    await userEvent.type(title, 'Access review');
    await expect(title).toHaveValue('Access review');
  },
};

export const Dark: Story = {
  ...Foundation,
  globals: { theme: 'dark' },
};

export const HighContrast: Story = {
  ...Foundation,
  globals: { contrast: 'high' },
};

export const Compact: Story = {
  ...Foundation,
  globals: { density: 'compact' },
};
