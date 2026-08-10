import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ListFilter,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { EnterpriseDataGrid, PageCanvas } from '@dwp-frontend/design-system';
import { useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { PageHeader, ReferenceModeChip, SectionHeading } from '../features/work-hub/workspace-ui';
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

const insightByWork: Record<string, { reason: string; next: string; activity: string }> = {
  'WK-1042': {
    reason: 'A new team member cannot access the project workspace until this request is approved.',
    next: 'Review role and license scope, then approve or return the request.',
    activity: 'Policy engine verified role eligibility at 09:08.',
  },
  'WK-1045': {
    reason: 'The customer meeting starts at 11:00 and three questions remain unresolved.',
    next: 'Review the questions and assign an owner before 10:40.',
    activity: 'Mina Kim added three discovery questions at 08:54.',
  },
  'WK-1043': {
    reason: 'The enrollment window closes at 17:00 today.',
    next: 'Confirm the selected plan and submit the employee acknowledgement.',
    activity: 'People connector confirmed the deadline at 08:41.',
  },
  'WK-1046': {
    reason: 'The acknowledgement is required before tomorrow.',
    next: 'Complete the 15 minute module and record acknowledgement.',
    activity: 'Learning system issued the reminder this morning.',
  },
  'WK-1038': {
    reason: 'Quarterly objectives are ready for your manager review.',
    next: 'Confirm progress notes and submit the review draft.',
    activity: 'Two objective metrics were updated yesterday.',
  },
  'WK-1027': {
    reason: 'Shared Services completed the requested expense follow-up.',
    next: 'No action required. Keep the record for reference.',
    activity: 'The finance case closed on Aug 7.',
  },
};

const columns: GridColDef<ReferenceWorkItem>[] = [
  { field: 'id', headerName: 'Work ID', width: 108 },
  { field: 'title', headerName: 'Work', minWidth: 250, flex: 1 },
  {
    field: 'priority',
    headerName: 'Priority',
    width: 104,
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
    width: 122,
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
  { field: 'due', headerName: 'Due', width: 126 },
  { field: 'sourceSystem', headerName: 'Source', width: 140 },
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
  const selectedInsight = selected ? insightByWork[selected.id] : undefined;

  const changeFilter = (_event: React.MouseEvent<HTMLElement>, value: WorkFilter | null) => {
    if (value) setFilter(value);
  };

  return (
    <PageCanvas>
      <PageHeader
        eyebrow="Unified queue"
        title="Work"
        description="Decisions, tasks, and service requests ordered by impact"
        action={<ReferenceModeChip />}
      />

      <Box
        aria-label="Work summary"
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {[
          ['06', 'All work', 'Across 5 sources', 'text.primary'],
          ['02', 'Due soon', 'First due at 10:30', 'error.main'],
          ['02', 'In progress', '24 min estimated', 'info.main'],
          ['01', 'Waiting', 'Employee confirmation', 'warning.main'],
        ].map(([value, label, detail, color], index) => (
          <Box
            key={label}
            sx={{
              py: 2,
              px: { xs: 1.5, md: 2.5 },
              borderLeft: index % 2 === 0 ? 0 : 1,
              borderTop: { xs: index > 1 ? 1 : 0, md: 0 },
              '&:nth-of-type(3)': { borderLeft: { xs: 0, md: 1 } },
              borderColor: 'divider',
            }}
          >
            <Typography
              component="p"
              variant="h5"
              sx={{ color, fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </Typography>
            <Typography component="p" variant="subtitle2" sx={{ mt: 0.25 }}>
              {label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {detail}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          mt: 3,
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <ListFilter size={15} aria-hidden="true" />
          <Typography variant="body2" color="text.secondary">
            {filteredItems.length} results / impact order
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1.65fr) minmax(320px, 0.75fr)',
          },
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ minWidth: 0, pr: { lg: 3 } }}>
          <EnterpriseDataGrid
            ariaLabel="Work queue"
            rows={filteredItems}
            columns={columns}
            getRowId={(row) => row.id}
            onRowClick={({ row }) => setSelectedId(row.id)}
            rowSelectionModel={
              selected ? { type: 'include', ids: new Set([selected.id]) } : undefined
            }
            height={520}
            hideFooter={filteredItems.length <= 25}
          />
        </Box>

        {selected && selectedInsight && (
          <Box
            component="aside"
            aria-labelledby="selected-work-heading"
            sx={{
              minWidth: 0,
              mt: { xs: 3, lg: 0 },
              pt: { xs: 3, lg: 0 },
              pl: { xs: 0, lg: 3 },
              borderTop: { xs: 1, lg: 0 },
              borderLeft: { xs: 0, lg: 1 },
              borderColor: 'divider',
            }}
          >
            <SectionHeading
              id="selected-work-heading"
              icon={BriefcaseBusiness}
              title="Decision context"
              meta={
                <Chip
                  label={statusLabel[selected.status]}
                  color={statusColor[selected.status]}
                  size="small"
                />
              }
            />

            <Typography component="h3" variant="h6" sx={{ mt: 3 }}>
              {selected.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {selected.id} / {selected.type} / Owner: {selected.owner}
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 2 }}>
              <Chip
                label={selected.priority}
                color={priorityColor[selected.priority]}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<Clock3 size={14} />}
                label={selected.due}
                size="small"
                variant="outlined"
              />
              <Chip label={selected.sourceSystem} size="small" variant="outlined" />
            </Box>

            <Box
              sx={{
                mt: 3,
                p: 2,
                bgcolor: 'action.selected',
                borderLeft: 3,
                borderColor: 'primary.main',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Sparkles size={17} strokeWidth={1.8} aria-hidden="true" />
                <Typography component="h3" variant="subtitle2">
                  Why this is next
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ mt: 0.75 }}>
                {selectedInsight.reason}
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gap: 2.5, mt: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Recommended next step
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35 }}>
                  {selectedInsight.next}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Latest activity
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <UserRound size={16} strokeWidth={1.8} aria-hidden="true" />
                  <Typography variant="body2">{selectedInsight.activity}</Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={
                  selected.status === 'completed' ? (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  ) : (
                    <CircleAlert size={17} aria-hidden="true" />
                  )
                }
                onClick={() => toast.success(`${selected.title} action preview opened.`)}
              >
                {selected.status === 'completed' ? 'View record' : 'Continue work'}
              </Button>
              <Button
                variant="outlined"
                endIcon={<ArrowUpRight size={16} aria-hidden="true" />}
                onClick={() => toast.success(`${selected.sourceSystem} source preview opened.`)}
              >
                Open source
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Reference action only. No external system is changed.
            </Typography>
          </Box>
        )}
      </Box>
    </PageCanvas>
  );
}
