import { expect, fn, userEvent, within } from 'storybook/test';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AgentPlanPreview } from './agent-plan-preview';
import { AgentExecutionTimeline } from './agent-execution-timeline';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'DWP AI/Trust Patterns',
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const approve = fn();
const reject = fn();

export const PlanReview: Story = {
  render: () => (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 820, mx: 'auto' }}>
        <AgentPlanPreview
          title="Grant project workspace access"
          summary="The plan updates one access group after checking the request and manager approval."
          riskLevel="high"
          steps={[
            {
              id: 'verify-request',
              title: 'Verify the approved access request',
              description: 'Confirm requester, target workspace and approval version.',
              tool: 'Request API',
            },
            {
              id: 'check-policy',
              title: 'Evaluate separation-of-duty policy',
              description: 'Stop when an incompatible role is found.',
              tool: 'Policy engine',
            },
            {
              id: 'update-group',
              title: 'Add the user to the access group',
              description: 'Apply one reversible membership change.',
              tool: 'Directory connector',
            },
          ]}
          sources={[
            {
              id: 'request',
              title: 'Access request AR-2048',
              sourceType: 'Service request',
              detail: 'Approved 2026-08-08 07:42 KST',
              href: '#request',
            },
            {
              id: 'policy',
              title: 'Privileged access policy',
              sourceType: 'Policy',
              detail: 'Version 12',
              href: '#policy',
            },
          ]}
          onApprove={approve}
          onReject={reject}
        />
      </Box>
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('list', { name: 'Plan steps' })).toBeVisible();
    await expect(canvas.getByRole('list', { name: 'Plan sources' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Approve plan' }));
    await expect(approve).toHaveBeenCalledOnce();
  },
};

export const Execution: Story = {
  render: () => (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, md: 4 } }}>
      <Stack spacing={2} sx={{ maxWidth: 820, mx: 'auto' }}>
        <Typography component="h1" variant="h5">
          Agent execution
        </Typography>
        <AgentExecutionTimeline
          title="Workspace access update"
          auditId="AUD-20260808-1042"
          liveMessage="Directory update failed and requires review."
          onRetry={fn()}
          onHandoff={fn()}
          steps={[
            {
              id: '1',
              title: 'Read approved request',
              status: 'succeeded',
              tool: 'Request API',
              timestamp: '07:45:02 KST',
            },
            {
              id: '2',
              title: 'Evaluate access policy',
              status: 'succeeded',
              tool: 'Policy engine',
              timestamp: '07:45:03 KST',
            },
            {
              id: '3',
              title: 'Update directory group',
              status: 'failed',
              detail: 'Connector timeout. No membership change was recorded.',
              tool: 'Directory connector',
              timestamp: '07:45:34 KST',
            },
          ]}
        />
      </Stack>
    </Box>
  ),
};
