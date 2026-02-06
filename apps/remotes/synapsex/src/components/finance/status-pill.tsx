import type { Theme, SxProps } from '@mui/material/styles';
import type { LabelColor } from '@dwp-frontend/design-system';

import { useCodes } from '@dwp-frontend/shared-utils';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';

// ----------------------------------------------------------------------

export type Status =
  | 'open'
  | 'in_progress'
  | 'pending_approval'
  | 'resolved'
  | 'dismissed'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed'
  | 'completed'
  | 'triage'
  | 'review';

export type StatusPillProps = {
  status?: Status | string | null;
  size?: 'sm' | 'md' | 'lg';
  sx?: SxProps<Theme>;
};

const statusConfig: Record<string, { label: string; icon: string; color: LabelColor }> = {
  open: { label: 'Open', icon: 'solar:record-circle-bold', color: 'default' },
  in_progress: { label: 'In Progress', icon: 'solar:refresh-circle-bold-duotone', color: 'info' },
  pending_approval: { label: 'Pending Approval', icon: 'solar:clock-circle-bold', color: 'warning' },
  pending: { label: 'Pending', icon: 'solar:clock-circle-bold', color: 'warning' },
  resolved: { label: 'Resolved', icon: 'solar:check-circle-bold-duotone', color: 'success' },
  approved: { label: 'Approved', icon: 'solar:check-circle-bold-duotone', color: 'success' },
  dismissed: { label: 'Dismissed', icon: 'solar:close-circle-bold', color: 'default' },
  rejected: { label: 'Rejected', icon: 'solar:close-circle-bold', color: 'error' },
  executed: { label: 'Executed', icon: 'solar:check-circle-bold-duotone', color: 'success' },
  failed: { label: 'Failed', icon: 'solar:close-circle-bold', color: 'error' },
  completed: { label: 'Completed', icon: 'solar:check-circle-bold-duotone', color: 'success' },
  triage: { label: 'Triage', icon: 'solar:document-medicine-bold', color: 'info' },
  triaged: { label: 'Triaged', icon: 'solar:document-medicine-bold', color: 'info' },
  review: { label: 'Review', icon: 'solar:eye-bold', color: 'warning' },
};

const sizeMap = {
  sm: { fontSize: '0.75rem', iconSize: 14 },
  md: { fontSize: '0.8125rem', iconSize: 16 },
  lg: { fontSize: '0.875rem', iconSize: 18 },
};

const defaultConfig = { label: 'Unknown', icon: 'solar:info-circle-bold', color: 'default' as LabelColor };

export const StatusPill = ({ status, size = 'md', sx }: StatusPillProps) => {
  const { getLabel } = useCodes('CASE_STATUS');
  const normalized = (status ?? '').toLowerCase().replace(/-/g, '_');
  const config = statusConfig[normalized] ?? defaultConfig;
  const { fontSize, iconSize } = sizeMap[size];
  const isAnimated = normalized === 'in_progress';
  const codeKey = (status ?? '').toUpperCase().replace(/-/g, '_');
  const label = getLabel(codeKey) || config.label;

  return (
    <Label
      color={config.color}
      variant="soft"
      startIcon={
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            animation: isAnimated ? 'spin 1s linear infinite' : undefined,
            '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
          }}
        >
          <Iconify icon={config.icon} width={iconSize} />
        </Box>
      }
      sx={{
        fontWeight: 600,
        fontSize,
        borderRadius: '9999px',
        ...sx,
      }}
    >
      {label}
    </Label>
  );
};
