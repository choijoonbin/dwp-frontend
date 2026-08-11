import { useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { LocalErrorState } from '../../components/states';
import { DetailInspector } from './detail-inspector';
import { FilterBar } from './filter-bar';
import { LiveStatus } from './live-status';
import { OperationalKpiStrip } from './operational-kpi-strip';
import { ResourcePageHeader } from './resource-page-header';
import { SavedViewMenu } from './saved-view-menu';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'DWP Enterprise/Resource Patterns',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function ResourcePatternStory() {
  const [query, setQuery] = useState('');
  const [selectedView, setSelectedView] = useState('attention');

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '100vh' }}>
      <ResourcePageHeader
        eyebrow="Unified operations"
        title="Work"
        description="Decisions and tasks ordered by governed impact."
        status={<LiveStatus state="live" label="Live" detail="Updated just now" />}
      />
      <Stack gap={3} sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel="Work summary"
          items={[
            { key: 'all', label: 'All work', value: 42, detail: 'Across 5 sources' },
            { key: 'due', label: 'Due soon', value: 4, detail: 'Within 2 hours', tone: 'critical' },
            {
              key: 'risk',
              label: 'Policy risk',
              value: 2,
              detail: 'Needs review',
              tone: 'warning',
            },
          ]}
        />
        <FilterBar
          ariaLabel="Work filters"
          searchLabel="Search work"
          searchValue={query}
          onSearchChange={setQuery}
          resultLabel="42 results"
          savedViews={
            <SavedViewMenu
              label="Saved views"
              personalLabel="Personal"
              sharedLabel="Shared"
              defaultLabel="Default"
              selectedViewId={selectedView}
              views={[
                { id: 'attention', name: 'Needs attention', scope: 'personal', isDefault: true },
                { id: 'team', name: 'Team queue', scope: 'shared', owner: 'Operations' },
              ]}
              onSelect={(view) => setSelectedView(view.id)}
            />
          }
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 360px' },
            border: 1,
            borderColor: 'divider',
          }}
        >
          <LocalErrorState
            title="One region could not be loaded"
            description="Results from other regions remain available."
            lastSuccessfulLabel="Last successful sync 2 minutes ago"
            requestIdLabel="Request ID req-1042"
            retryLabel="Try region again"
            onRetry={() => undefined}
          />
          <DetailInspector
            open
            title="Access request"
            subtitle="WK-1042"
            closeLabel="Close details"
            onClose={() => undefined}
          >
            The request is within the user&apos;s current organization scope.
          </DetailInspector>
        </Box>
      </Stack>
    </Box>
  );
}

export const CompleteContract: Story = {
  render: () => <ResourcePatternStory />,
};
