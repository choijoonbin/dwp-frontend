/**
 * Case status badge — OPEN: Info(파란색), IN_PROGRESS: Warning(노란색/진행중)
 * SeverityBadge와 함께 큐/리스트에서 상태 시각화용
 */

import type { Theme, SxProps } from '@mui/material/styles';
import type { LabelColor } from '@dwp-frontend/design-system';

import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';

// ----------------------------------------------------------------------

export type StatusBadgeStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED' | 'TRIAGED' | string;

export type StatusBadgeProps = {
  status: StatusBadgeStatus;
  /** API 코드명이 있으면 우선 표시 (예: useCodes('CASE_STATUS').getLabel(code)) */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  sx?: SxProps<Theme>;
};

const sizeMap = {
  sm: { fontSize: '0.75rem', iconSize: 14 },
  md: { fontSize: '0.8125rem', iconSize: 16 },
  lg: { fontSize: '0.875rem', iconSize: 18 },
};

/** OPEN: Info(파란색), IN_PROGRESS: Warning(노란색/Processing), new: 신규 */
const statusConfig: Record<string, { icon: string; color: LabelColor }> = {
  open: { icon: 'solar:record-circle-bold', color: 'info' },
  OPEN: { icon: 'solar:record-circle-bold', color: 'info' },
  new: { icon: 'solar:star-bold', color: 'info' },
  NEW: { icon: 'solar:star-bold', color: 'info' },
  in_progress: { icon: 'solar:refresh-circle-bold-duotone', color: 'warning' },
  IN_PROGRESS: { icon: 'solar:refresh-circle-bold-duotone', color: 'warning' },
  resolved: { icon: 'solar:check-circle-bold-duotone', color: 'success' },
  RESOLVED: { icon: 'solar:check-circle-bold-duotone', color: 'success' },
  dismissed: { icon: 'solar:close-circle-bold', color: 'default' },
  DISMISSED: { icon: 'solar:close-circle-bold', color: 'default' },
  triage: { icon: 'solar:document-medicine-bold', color: 'info' },
  triaged: { icon: 'solar:document-medicine-bold', color: 'info' },
  TRIAGED: { icon: 'solar:document-medicine-bold', color: 'info' },
};

const defaultConfig = { icon: 'solar:info-circle-bold', color: 'default' as LabelColor };

export const StatusBadge = ({ status, label: labelOverride, size = 'md', showIcon = true, sx }: StatusBadgeProps) => {
  const { t } = useTranslation('common');
  const normalized = (status ?? '').trim();
  const key = normalized.toLowerCase().replace(/-/g, '_');
  const config = statusConfig[normalized] ?? statusConfig[key] ?? defaultConfig;
  const { fontSize, iconSize } = sizeMap[size];
  const label = labelOverride ?? t(`statusLabels.${key || 'unknown'}`);

  return (
    <Label
      color={config.color}
      variant="soft"
      startIcon={showIcon ? <Iconify icon={config.icon} width={iconSize} /> : undefined}
      sx={{ fontWeight: 600, fontSize, ...sx }}
    >
      {label}
    </Label>
  );
};
