import { CalendarDays, Clock3, History, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { TIMECARD_STATES, formatTimecardMinutes } from '../model/timecard-model';

import type { ReactNode } from 'react';
import type { Timecard } from '../model/timecard-model';

const STATE_LABELS = {
  OPEN: 'Open',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CORRECTION_REQUIRED: 'Correction required',
  LOCKED: 'Locked',
  CLOSED: 'Closed',
  SUPERSEDED: 'Superseded',
} as const;

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0, p: 2 }}>
      <Stack direction="row" gap={1} alignItems="center" color="text.secondary">
        {icon}
        <Typography component="dt" variant="caption">
          {label}
        </Typography>
      </Stack>
      <Typography component="dd" variant="h6" sx={{ m: 0, mt: 0.75, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

export function TimecardSummary({ timecard }: { timecard: Timecard }) {
  return (
    <Stack gap={2}>
      <Paper component="section" variant="outlined" aria-labelledby="timecard-summary-title">
        <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: 1, borderColor: 'divider' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            gap={1}
          >
            <Box minWidth={0}>
              <Typography id="timecard-summary-title" component="h2" variant="h6">
                Timecard summary
              </Typography>
              <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {timecard.periodStart} – {timecard.periodEnd}
              </Typography>
            </Box>
            <Chip
              variant="outlined"
              color={
                timecard.state === 'APPROVED' || timecard.state === 'CLOSED'
                  ? 'success'
                  : timecard.state === 'REJECTED' || timecard.state === 'CORRECTION_REQUIRED'
                    ? 'warning'
                    : 'default'
              }
              label={`State: ${STATE_LABELS[timecard.state]}`}
            />
          </Stack>
        </Box>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 13rem), 1fr))',
            '& > * + *': { borderLeft: { sm: 1 }, borderColor: 'divider' },
          }}
        >
          <SummaryItem
            icon={<Clock3 size={17} aria-hidden="true" />}
            label="Recorded total"
            value={formatTimecardMinutes(timecard.totalMinutes)}
          />
          <SummaryItem
            icon={<History size={17} aria-hidden="true" />}
            label="Ledger revision"
            value={String(timecard.ledgerRevision)}
          />
          <SummaryItem
            icon={<ShieldCheck size={17} aria-hidden="true" />}
            label="Aggregate version"
            value={String(timecard.version)}
          />
          <SummaryItem
            icon={<CalendarDays size={17} aria-hidden="true" />}
            label="Worker reference"
            value={timecard.workerId}
          />
        </Box>
      </Paper>

      <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography id="timecard-state-model-title" component="h2" variant="subtitle1">
          Canonical state model
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          Commands are available only for the current server state. Closed and superseded records
          stay read only.
        </Typography>
        <Box
          component="ol"
          aria-labelledby="timecard-state-model-title"
          sx={{
            listStyle: 'none',
            p: 0,
            m: 0,
            mt: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr))',
            gap: 1,
          }}
        >
          {TIMECARD_STATES.map((state) => {
            const current = state === timecard.state;
            return (
              <Box
                component="li"
                key={state}
                aria-current={current ? 'step' : undefined}
                sx={{
                  border: 1,
                  borderColor: current ? 'text.primary' : 'divider',
                  bgcolor: current ? 'action.selected' : 'background.paper',
                  borderRadius: 1,
                  p: 1.25,
                  minWidth: 0,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {current ? 'Current state' : 'State'}
                </Typography>
                <Typography variant="body2" fontWeight={current ? 700 : 500}>
                  {STATE_LABELS[state]}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Paper>
    </Stack>
  );
}
