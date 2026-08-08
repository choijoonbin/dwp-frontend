import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, BriefcaseBusiness } from 'lucide-react';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';
import { useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { workItems } from '../features/work-hub/reference-data';

import type { GridColDef } from '@mui/x-data-grid';
import type { Priority, ReferenceWorkItem, WorkStatus } from '../features/work-hub/reference-data';

type WorkFilter = 'all' | WorkStatus;

const statusLabel: Record<WorkStatus, string> = {
  'due-soon': 'Due soon',
  'in-progress': 'In progress',
  waiting: 'Waiting',
  completed: 'Completed',
};

const statusColor: Record<WorkStatus, 'error' | 'info' | 'warning' | 'success'> = {
  'due-soon': 'error',
  'in-progress': 'info',
  waiting: 'warning',
  completed: 'success',
};

const priorityColor: Record<Priority, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
};

const columns: GridColDef<ReferenceWorkItem>[] = [
  { field: 'id', headerName: 'Work ID', width: 110 },
  { field: 'title', headerName: 'Work', minWidth: 260, flex: 1 },
  { field: 'type', headerName: 'Type', width: 110 },
  {
    field: 'priority',
    headerName: 'Priority',
    width: 112,
    renderCell: ({ value }) => {
      const priority = value as Priority;
      return (
        <Chip label={priority} color={priorityColor[priority]} size="small" variant="outlined" />
      );
    },
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 126,
    renderCell: ({ value }) => {
      const status = value as WorkStatus;
      return (
        <Chip
          label={statusLabel[status]}
          color={statusColor[status]}
          size="small"
          variant="outlined"
        />
      );
    },
  },
  { field: 'due', headerName: 'Due', width: 132 },
  { field: 'sourceSystem', headerName: 'Source', width: 150 },
];

export default function WorkPage() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<WorkFilter>('all');
  const [selectedId, setSelectedId] = useState(
    () => searchParams.get('item') || workItems[0]?.id || ''
  );
  const filteredItems = useMemo(
    () => (filter === 'all' ? workItems : workItems.filter((item) => item.status === filter)),
    [filter]
  );
  const selected = workItems.find((item) => item.id === selectedId) || filteredItems[0];

  const changeFilter = (_event: React.MouseEvent<HTMLElement>, value: WorkFilter | null) => {
    if (value) setFilter(value);
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
        }}
      >
        <Box>
          <Typography component="h1" variant="h4">
            Work
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Assigned work and approvals
          </Typography>
        </Box>
        <Chip label="Reference data" variant="outlined" size="small" />
      </Box>

      <Box
        sx={{
          mt: 4,
          display: 'flex',
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 1.5,
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={changeFilter}
          aria-label="Work status"
          sx={{ overflowX: 'auto', maxWidth: 1 }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="due-soon">Due soon</ToggleButton>
          <ToggleButton value="in-progress">In progress</ToggleButton>
          <ToggleButton value="waiting">Waiting</ToggleButton>
          <ToggleButton value="completed">Completed</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">
          {filteredItems.length} results
        </Typography>
      </Box>

      <Box sx={{ mt: 2 }}>
        <EnterpriseDataGrid
          ariaLabel="Work queue"
          rows={filteredItems}
          columns={columns}
          getRowId={(row) => row.id}
          onRowClick={({ row }) => setSelectedId(row.id)}
          height={430}
          hideFooter={filteredItems.length <= 25}
        />
      </Box>

      {selected && (
        <Box component="section" aria-labelledby="selected-work-heading" sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BriefcaseBusiness size={19} strokeWidth={1.8} aria-hidden="true" />
            <Typography id="selected-work-heading" component="h2" variant="h6">
              Selected work
            </Typography>
          </Box>
          <Divider sx={{ mt: 1, mb: 2.5 }} />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) 1fr auto' },
              gap: 2,
              alignItems: { md: 'center' },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography component="p" variant="subtitle1">
                {selected.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selected.id} / {selected.type} / Owner: {selected.owner}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={selected.priority}
                color={priorityColor[selected.priority]}
                size="small"
                variant="outlined"
              />
              <Chip
                label={statusLabel[selected.status]}
                color={statusColor[selected.status]}
                size="small"
                variant="outlined"
              />
              <Chip label={selected.due} size="small" variant="outlined" />
            </Box>
            <Button
              variant="outlined"
              endIcon={<ArrowUpRight size={16} aria-hidden="true" />}
              onClick={() => toast.success(`${selected.sourceSystem} source preview opened.`)}
            >
              Open source
            </Button>
          </Box>
        </Box>
      )}
    </Container>
  );
}
