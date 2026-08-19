import { ArrowRight, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { SpaceOperationsDashboard } from '@dwp-frontend/shared-utils';

type Finding = SpaceOperationsDashboard['findings'][number];

const severityColor = {
  INFO: 'info',
  WARNING: 'warning',
  HIGH: 'error',
  CRITICAL: 'error',
} as const;

function localizedEvidenceLabel(key: string, translate: (key: string) => string) {
  const knownKeys = new Set([
    'spaceKey',
    'spaceName',
    'reviewType',
    'dueAt',
    'permissionCode',
    'deliveryState',
    'attemptCount',
    'lastError',
    'pendingRevocations',
  ]);
  return knownKeys.has(key) ? translate(`spaces.operations.findings.evidence.${key}`) : key;
}

function evidenceValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function SpaceFindingListItem({
  finding,
  onInspect,
}: {
  finding: Finding;
  onInspect: (finding: Finding) => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1.5}
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
      >
        <Stack direction="row" gap={1.25} sx={{ minWidth: 0 }}>
          <Box sx={{ color: `${severityColor[finding.severity]}.main`, pt: 0.25 }}>
            {finding.severity === 'CRITICAL' || finding.severity === 'HIGH' ? (
              <ShieldAlert size={18} />
            ) : (
              <AlertTriangle size={18} />
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={750}>
              {t(`spaces.operations.findings.types.${finding.findingType}.title`)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t(`spaces.operations.findings.types.${finding.findingType}.detail`)}
            </Typography>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}
            >
              {finding.targetType} · {finding.targetRef}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={1} justifyContent="space-between" alignItems="center">
          <Chip
            size="small"
            variant="outlined"
            color={severityColor[finding.severity]}
            label={t(`spaces.operations.severity.${finding.severity}`)}
          />
          <ActionButton
            intent="quiet"
            size="small"
            endIcon={<ArrowRight size={15} />}
            onClick={() => onInspect(finding)}
          >
            {t('spaces.operations.actions.inspect')}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}

export function SpaceFindingDrawer({
  finding,
  onClose,
  onNavigate,
  onRecoverOwner,
}: {
  finding: Finding | null;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onRecoverOwner: (finding: Finding) => void;
}) {
  const { t } = useTranslation('admin');
  if (!finding) return null;

  const spaceKey = typeof finding.evidence.spaceKey === 'string' ? finding.evidence.spaceKey : null;
  const actionPath =
    finding.findingType === 'LIFECYCLE_REVIEW'
      ? '/admin/spaces/lifecycle'
      : '#space-entitlement-deliveries';
  const actionLabel =
    finding.findingType === 'OWNERLESS_SPACE'
      ? t('spaces.operations.actions.assignOwner')
      : finding.findingType === 'LIFECYCLE_REVIEW'
        ? t('spaces.operations.actions.openLifecycle')
        : t('spaces.operations.actions.openDelivery');

  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 440 },
          maxWidth: '100vw',
          bgcolor: 'background.default',
        },
      }}
    >
      <Stack sx={{ minHeight: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
          <Box>
            <Typography component="h2" variant="h6">
              {t('spaces.operations.findings.detailTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('spaces.operations.findings.detailDescription')}
            </Typography>
          </Box>
          <ActionIconButton label={t('spaces.operations.actions.close')} onClick={onClose}>
            <X size={19} />
          </ActionIconButton>
        </Stack>
        <Divider />
        <Stack gap={2.5} sx={{ p: 2.5, flex: 1 }}>
          <Stack direction="row" justifyContent="space-between" gap={2} alignItems="flex-start">
            <Typography variant="subtitle1" fontWeight={800}>
              {t(`spaces.operations.findings.types.${finding.findingType}.title`)}
            </Typography>
            <Chip
              size="small"
              color={severityColor[finding.severity]}
              label={t(`spaces.operations.severity.${finding.severity}`)}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t(`spaces.operations.findings.types.${finding.findingType}.detail`)}
          </Typography>

          <Box component="section">
            <Typography component="h3" variant="subtitle2">
              {t('spaces.operations.findings.evidenceTitle')}
            </Typography>
            <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
              {Object.entries(finding.evidence).map(([key, value]) => (
                <Stack
                  key={key}
                  direction="row"
                  justifyContent="space-between"
                  gap={2}
                  sx={{ py: 1 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {localizedEvidenceLabel(key, t)}
                  </Typography>
                  <Typography variant="caption" fontWeight={700} sx={{ textAlign: 'right' }}>
                    {evidenceValue(value)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box component="section">
            <Typography component="h3" variant="subtitle2">
              {t('spaces.operations.findings.detectionTitle')}
            </Typography>
            <Stack gap={0.75} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {t('spaces.operations.findings.firstDetected', {
                  value: formatDate(finding.firstDetectedAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('spaces.operations.findings.lastDetected', {
                  value: formatDate(finding.lastDetectedAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ p: 1.5, bgcolor: 'action.hover', border: 1, borderColor: 'divider' }}>
            <Typography variant="caption" fontWeight={800}>
              {t('spaces.operations.findings.recommendedAction')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t(`spaces.operations.findings.types.${finding.findingType}.action`)}
            </Typography>
          </Box>
        </Stack>
        <Divider />
        <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ p: 2 }}>
          <ActionButton intent="quiet" onClick={onClose}>
            {t('spaces.operations.actions.close')}
          </ActionButton>
          <ActionButton
            intent="primary"
            endIcon={<ArrowRight size={16} />}
            disabled={finding.findingType === 'OWNERLESS_SPACE' && !spaceKey}
            onClick={() =>
              finding.findingType === 'OWNERLESS_SPACE'
                ? onRecoverOwner(finding)
                : onNavigate(actionPath)
            }
          >
            {actionLabel}
          </ActionButton>
        </Stack>
      </Stack>
    </Drawer>
  );
}
