import type { Meta, StoryObj } from '@storybook/react-vite';
import { Activity, CalendarDays, ListChecks, Newspaper, Sparkles } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import { SectionHeader, SectionHeaderMetaText } from './section-header';

const meta = {
  title: 'DWP Foundation/Section header',
  component: SectionHeader,
  tags: ['autodocs'],
} satisfies Meta<typeof SectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkspaceSections: Story = {
  args: {
    icon: Newspaper,
    title: 'Fresh from the newsroom',
    divider: true,
  },
  render: () => (
    <Stack gap={3} sx={{ width: 720, maxWidth: '100%' }}>
      <SectionHeader icon={Newspaper} title="Fresh from the newsroom" divider meta="5 stories" />
      <SectionHeader icon={ListChecks} title="Command rail" divider />
      <SectionHeader
        icon={Activity}
        title="Live activity"
        divider
        meta={<Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'success.main' }} />}
      />
      <SectionHeader icon={CalendarDays} title="Schedule" divider />
      <SectionHeader
        icon={Sparkles}
        title="Workday insights"
        divider
        meta={<Chip size="small" variant="outlined" label="3 sources" />}
      />
      <SectionHeader
        icon={ListChecks}
        title="Command rail"
        divider
        meta={<SectionHeaderMetaText>Next work, schedule, and guidance</SectionHeaderMetaText>}
      />
    </Stack>
  ),
};
