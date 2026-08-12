import { Building2, Clock3, Globe2, ServerCog } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { foundationTokens } from '../../foundation';
import { LiveStatus } from '../resource';
import { DistributionBar } from './distribution-bar';
import { OperationalContextBar } from './operational-context-bar';
import { SignalMetric } from './signal-metric';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'DWP Enterprise/Operational Signals',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CommandSurface: Story = {
  render: () => (
    <Box sx={{ minHeight: '100vh', p: { xs: 2, md: 4 }, bgcolor: 'background.default' }}>
      <Stack gap={2} sx={{ maxWidth: 1200, mx: 'auto' }}>
        <OperationalContextBar
          label="Operating context"
          items={[
            { label: 'Scope', value: 'All customers', icon: <Globe2 size={16} /> },
            { label: 'Time', value: 'Current snapshot', icon: <Clock3 size={16} /> },
          ]}
          status={<LiveStatus state="live" label="Auto-refreshing" detail="Updated just now" />}
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: 1.5,
          }}
        >
          <SignalMetric
            label="Customer environment readiness"
            value="18 / 20"
            detail="Runtime environments for 12 customer companies"
            icon={<Building2 size={18} />}
            tone="warning"
            progress={90}
            progressLabel="90% of tenants active"
          />
          <SignalMetric
            label="Service readiness"
            value="118 / 120"
            detail="2 degraded instances"
            icon={<ServerCog size={18} />}
            tone="success"
            progress={98.3}
            progressLabel="98.3% of service instances healthy"
          />
        </Box>
        <DistributionBar
          label="Service state: 118 healthy, 1 provisioning, 1 degraded, 0 failed"
          segments={[
            { key: 'healthy', value: 118, color: foundationTokens.color.data.teal },
            { key: 'pending', value: 1, color: foundationTokens.color.data.cyan },
            { key: 'degraded', value: 1, color: foundationTokens.color.data.saffron },
            { key: 'failed', value: 0, color: foundationTokens.color.data.coral },
          ]}
        />
      </Stack>
    </Box>
  ),
};
