import type { Theme, SxProps } from '@mui/material/styles';
import type { LabelColor } from '@dwp-frontend/design-system';

import { useCodes } from '@dwp-frontend/shared-utils';
import { Label, Iconify } from '@dwp-frontend/design-system';

// ----------------------------------------------------------------------

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type SeverityBadgeProps = {
  severity: Severity;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  sx?: SxProps<Theme>;
};

const severityConfig: Record<
  Severity,
  { label: string; icon: string; color: LabelColor }
> = {
  critical: {
    label: 'Critical',
    icon: 'solar:danger-triangle-bold-duotone',
    color: 'error',
  },
  high: {
    label: 'High',
    icon: 'solar:info-circle-bold-duotone',
    color: 'warning',
  },
  medium: {
    label: 'Medium',
    icon: 'solar:info-circle-bold',
    color: 'info',
  },
  low: {
    label: 'Low',
    icon: 'solar:check-circle-bold-duotone',
    color: 'success',
  },
};

const sizeMap = {
  sm: { fontSize: '0.75rem', iconSize: 14 },
  md: { fontSize: '0.8125rem', iconSize: 16 },
  lg: { fontSize: '0.875rem', iconSize: 18 },
};

export const SeverityBadge = ({ severity, showIcon = true, size = 'md', sx }: SeverityBadgeProps) => {
  const { getLabel } = useCodes('SEVERITY');
  const config = severityConfig[severity];
  const { fontSize, iconSize } = sizeMap[size];
  const codeKey = severity.toUpperCase();
  const label = getLabel(codeKey) || config.label;

  return (
    <Label
      color={config.color}
      variant="soft"
      startIcon={
        showIcon ? <Iconify icon={config.icon} width={iconSize} /> : undefined
      }
      sx={{ fontWeight: 600, fontSize, ...sx }}
    >
      {label}
    </Label>
  );
};
