import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { AuditEvent, AuditFinding, AuditSeverity } from '@dwp-frontend/shared-utils';
import type { ChipProps } from '@mui/material/Chip';

export function severityColor(
  severity: Exclude<AuditSeverity, 'ALL'> | AuditFinding['severity']
): ChipProps['color'] {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'error';
  if (severity === 'MEDIUM') return 'warning';
  if (severity === 'LOW') return 'info';
  return 'default';
}

export function SeverityChip({ severity }: { severity: Exclude<AuditSeverity, 'ALL'> }) {
  const { t } = useTranslation('admin');
  return (
    <Chip
      size="small"
      color={severityColor(severity)}
      variant="outlined"
      label={t(`auditControl.severity.${severity}`)}
    />
  );
}

export function OutcomeChip({ outcome }: { outcome: AuditEvent['outcome'] }) {
  const { t } = useTranslation('admin');
  return (
    <Chip
      size="small"
      variant="outlined"
      color={outcome === 'SUCCESS' ? 'success' : outcome === 'DENIED' ? 'warning' : 'error'}
      label={t(`auditControl.outcome.${outcome}`)}
    />
  );
}

export function RiskScore({ value }: { value: number }) {
  const color = value >= 70 ? 'error.main' : value >= 45 ? 'warning.main' : 'success.main';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 88 }}>
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          position: 'relative',
          width: 42,
          height: 5,
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.text.primary, 0.09),
          borderRadius: 0.5,
          '&::after': {
            position: 'absolute',
            inset: 0,
            width: `${Math.min(100, Math.max(0, value))}%`,
            bgcolor: color,
            content: '""',
          },
        })}
      />
      <Typography variant="caption" fontWeight={750} sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

export function actorLabel(event: AuditEvent): string {
  return event.actorDisplayName || event.actorPrincipal || event.actorId || event.actorType;
}

export function targetLabel(event: AuditEvent): string {
  return event.targetDisplayName || event.targetId;
}

export function useAuditActionLabel() {
  const display = useDisplayDictionary();
  return useCallback((action: string) => display('auditActions', action), [display]);
}
