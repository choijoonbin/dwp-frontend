import { useTranslation } from 'react-i18next';
import { Clock3, Info, Infinity as InfinityIcon, ShieldCheck, ShieldOff } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { GroupRoleAssignment } from '@dwp-frontend/shared-utils';

import { resolveRoleAssignmentPresentationState } from './role-assignment-model';

const EXPIRING_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

export type RoleAssignmentSummaryValue = {
  active: number;
  expiringSoon: number;
  noExpiry: number;
  revoked: number;
};

export function summarizeRoleAssignments(
  assignments: readonly GroupRoleAssignment[],
  now = Date.now()
): RoleAssignmentSummaryValue {
  return assignments.reduce<RoleAssignmentSummaryValue>(
    (summary, assignment) => {
      if (assignment.lifecycleState === 'REVOKED') summary.revoked += 1;
      if (resolveRoleAssignmentPresentationState(assignment, now) !== 'ACTIVE') return summary;
      summary.active += 1;
      if (!assignment.validTo) {
        summary.noExpiry += 1;
        return summary;
      }
      const remaining = new Date(assignment.validTo).getTime() - now;
      if (remaining > 0 && remaining <= EXPIRING_WINDOW_MS) summary.expiringSoon += 1;
      return summary;
    },
    { active: 0, expiringSoon: 0, noExpiry: 0, revoked: 0 }
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'info' | 'neutral';
}) {
  const color = tone === 'neutral' ? 'text.secondary' : `${tone}.main`;
  return (
    <Box sx={{ minWidth: 0, px: 2, py: 1.5, borderRight: { md: 1 }, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        <Icon size={17} aria-hidden="true" />
      </Stack>
      <Typography
        component="p"
        variant="h5"
        color={color}
        sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export function RoleAssignmentSummary({
  assignments,
}: {
  assignments: readonly GroupRoleAssignment[];
}) {
  const { t } = useTranslation('admin');
  const summary = summarizeRoleAssignments(assignments);
  return (
    <Box
      component="section"
      aria-label={t('roleGovernance.assignmentSummary.label')}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <SummaryMetric
        icon={ShieldCheck}
        label={t('roleGovernance.assignmentSummary.active')}
        value={summary.active}
        tone="success"
      />
      <SummaryMetric
        icon={Clock3}
        label={t('roleGovernance.assignmentSummary.expiringSoon')}
        value={summary.expiringSoon}
        tone="warning"
      />
      <SummaryMetric
        icon={InfinityIcon}
        label={t('roleGovernance.assignmentSummary.noExpiry')}
        value={summary.noExpiry}
        tone="info"
      />
      <SummaryMetric
        icon={ShieldOff}
        label={t('roleGovernance.assignmentSummary.revoked')}
        value={summary.revoked}
        tone="neutral"
      />
      <Stack
        direction="row"
        alignItems="flex-start"
        gap={1}
        sx={{ gridColumn: '1 / -1', px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}
      >
        <Info size={15} aria-hidden="true" />
        <Typography variant="caption" color="text.secondary">
          {t('roleGovernance.assignmentSummary.notice')}
        </Typography>
      </Stack>
    </Box>
  );
}
