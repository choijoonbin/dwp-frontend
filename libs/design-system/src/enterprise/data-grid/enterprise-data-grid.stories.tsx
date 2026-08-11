import { useState } from 'react';
import { expect, within } from 'storybook/test';
import { Archive } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton } from '../../components/actions';
import { EnterpriseDataGrid } from './enterprise-data-grid';

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';

type WorkRow = {
  id: number;
  workId: string;
  title: string;
  owner: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In review' | 'Blocked';
  due: string;
};

const rows: WorkRow[] = [
  {
    id: 1,
    workId: 'WK-1042',
    title: 'Review access request',
    owner: 'J. Kim',
    priority: 'High',
    status: 'In review',
    due: '2026-08-08',
  },
  {
    id: 2,
    workId: 'WK-1043',
    title: 'Confirm service owner',
    owner: 'M. Lee',
    priority: 'Medium',
    status: 'Open',
    due: '2026-08-09',
  },
  {
    id: 3,
    workId: 'WK-1044',
    title: 'Resolve source permission',
    owner: 'A. Park',
    priority: 'High',
    status: 'Blocked',
    due: '2026-08-09',
  },
  {
    id: 4,
    workId: 'WK-1045',
    title: 'Validate retention policy',
    owner: 'S. Choi',
    priority: 'Low',
    status: 'Open',
    due: '2026-08-12',
  },
  {
    id: 5,
    workId: 'WK-1046',
    title: 'Approve connector scope',
    owner: 'D. Han',
    priority: 'Medium',
    status: 'In review',
    due: '2026-08-13',
  },
];

const columns: GridColDef<WorkRow>[] = [
  { field: 'workId', headerName: 'Work ID', width: 112 },
  { field: 'title', headerName: 'Title', minWidth: 240, flex: 1 },
  { field: 'owner', headerName: 'Owner', width: 120 },
  { field: 'priority', headerName: 'Priority', width: 110 },
  { field: 'status', headerName: 'Status', width: 120 },
  { field: 'due', headerName: 'Due date', width: 130 },
];

const meta = {
  title: 'DWP Enterprise/Data Grid',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkQueue: Story = {
  render: () => (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography component="h1" variant="h5">
            Work queue
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Cross-system work requiring attention
          </Typography>
        </Box>
        <Chip label={`${rows.length} items`} variant="outlined" />
      </Stack>
      <EnterpriseDataGrid
        ariaLabel="Work queue"
        rows={rows}
        columns={columns}
        checkboxSelection
        initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
      />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByRole('grid', { name: 'Work queue' });

    await expect(grid).toBeVisible();
    await expect(within(grid).getByRole('columnheader', { name: /Work ID/ })).toBeVisible();
    await expect(within(grid).getAllByRole('row').length).toBeGreaterThan(1);
  },
};

export const SingleRow: Story = {
  render: () => (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
        Single-row queue
      </Typography>
      <EnterpriseDataGrid
        ariaLabel="Single-row queue"
        rows={rows.slice(0, 1)}
        columns={columns}
        hideFooter
      />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByRole('grid', { name: 'Single-row queue' });

    await expect(within(grid).getAllByRole('row')).toHaveLength(2);
  },
};

export const Empty: Story = {
  render: () => (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
        Work queue
      </Typography>
      <EnterpriseDataGrid ariaLabel="Empty work queue" rows={[]} columns={columns} />
    </Box>
  ),
};

export const Loading: Story = {
  render: () => (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
        Work queue
      </Typography>
      <EnterpriseDataGrid ariaLabel="Loading work queue" rows={[]} columns={columns} loading />
    </Box>
  ),
};

function ServerGridStory() {
  const [selection, setSelection] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set([1]),
  });
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 5 });

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
        Governed work queue
      </Typography>
      <EnterpriseDataGrid
        ariaLabel="Governed work queue"
        mode="server"
        rows={rows}
        rowCount={250}
        columns={columns}
        checkboxSelection
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
        pageSizeOptions={[5, 25, 50]}
        toolbar={{
          ariaLabel: 'Work queue tools',
          columnsLabel: 'Choose columns',
          filtersLabel: 'Filter work',
          quickFilterLabel: 'Search work',
          quickFilterPlaceholder: 'Search work',
          onExport: () => undefined,
          exportLabel: 'Export work as CSV',
          onRefresh: () => undefined,
          refreshLabel: 'Refresh work',
          selectedCountLabel: (count) => `${count} selected`,
          bulkActions: (
            <ActionButton intent="quiet" size="small" startIcon={<Archive size={16} />}>
              Archive
            </ActionButton>
          ),
        }}
      />
    </Box>
  );
}

export const ServerToolbarAndSelection: Story = {
  render: () => <ServerGridStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('toolbar', { name: 'Work queue tools' })).toBeVisible();
    await expect(canvas.getByRole('searchbox', { name: 'Search work' })).toBeVisible();
    await expect(canvas.getByText('1 selected')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Archive' })).toBeEnabled();
  },
};
