import type { Meta, StoryObj } from '@storybook/react-vite';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { PageCanvas } from './page-canvas';

const meta = {
  title: 'DWP Foundation/Page canvas',
  component: PageCanvas,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PageCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LayoutModes: Story = {
  render: () => (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <PageCanvas>
        <Typography component="h1" variant="h5">
          Workspace canvas
        </Typography>
        <Typography color="text.secondary">
          Operational content uses all available shell width.
        </Typography>
      </PageCanvas>
      <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
        <PageCanvas mode="focus">
          <Typography component="h2" variant="h5">
            Focus canvas
          </Typography>
          <Typography color="text.secondary">
            Reading and form content keeps a stable maximum width.
          </Typography>
        </PageCanvas>
      </Box>
    </Box>
  ),
};
