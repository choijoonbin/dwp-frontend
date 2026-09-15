import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalBatchPreflight } from './approval-batch-preflight';

export function ApprovalBatchPreflightSummary({
  preflight,
  refreshing,
  onRefresh,
}: {
  preflight: ApprovalBatchPreflight;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('approvals');
  const unresolved = preflight.entries.filter(({ outcome }) => outcome !== 'ELIGIBLE');
  const metrics = [
    { key: 'selected', value: preflight.selectedCount, color: 'default' as const },
    { key: 'eligible', value: preflight.eligibleCount, color: 'success' as const },
    { key: 'excluded', value: preflight.excludedCount, color: 'warning' as const },
    { key: 'recheck', value: preflight.recheckCount, color: 'error' as const },
  ];

  return (
    <Box component="section" aria-labelledby="approval-batch-preflight-title" sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
        <Box>
          <Typography id="approval-batch-preflight-title" component="h3" variant="subtitle2">
            {t('home.commandCenter.batchPreflight.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('home.commandCenter.batchPreflight.description')}
          </Typography>
        </Box>
        {preflight.recheckCount > 0 && (
          <ActionButton
            type="button"
            intent="quiet"
            size="small"
            startIcon={<RefreshCw size={16} />}
            loading={refreshing}
            onClick={onRefresh}
          >
            {t('home.commandCenter.batchPreflight.refresh')}
          </ActionButton>
        )}
      </Stack>

      <Box
        role="status"
        aria-live="polite"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          mt: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {metrics.map(({ key, value, color }, index) => (
          <Stack
            key={key}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{
              minWidth: 0,
              px: 1.25,
              py: 1,
              borderRight: index % 2 === 0 ? 1 : 0,
              borderBottom: index < 2 ? 1 : 0,
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {t(`home.commandCenter.batchPreflight.metrics.${key}`)}
            </Typography>
            <Chip size="small" color={color} label={value} />
          </Stack>
        ))}
      </Box>

      {unresolved.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography component="h4" variant="caption" color="text.secondary">
            {t('home.commandCenter.batchPreflight.attentionTitle')}
          </Typography>
          <Stack component="ul" gap={0.75} sx={{ m: 0, mt: 0.75, p: 0, listStyle: 'none' }}>
            {unresolved.map((entry) => (
              <Stack
                component="li"
                key={entry.taskId}
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                gap={1}
                sx={{ py: 0.75, borderTop: 1, borderColor: 'divider' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {entry.requestNumber} · {entry.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`home.commandCenter.batchPreflight.reasons.${entry.reason}`)}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={entry.outcome === 'EXCLUDED' ? 'warning' : 'error'}
                  variant="outlined"
                  label={t(`home.commandCenter.batchPreflight.outcomes.${entry.outcome}`)}
                />
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        {t('home.commandCenter.batchDialogEvidence')}
      </Typography>
    </Box>
  );
}
