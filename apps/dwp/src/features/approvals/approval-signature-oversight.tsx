import { useTranslation } from 'react-i18next';
import { KeyRound, RefreshCcw, ShieldCheck } from 'lucide-react';
import { ActionIconButton, EmptyState, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import type { ApprovalSignatureMetadataProjection } from './approval-signature-read-projection';
import { ApprovalSurface, StatusChip } from './approval-ui';

export function ApprovalSignatureOversight({
  providers,
  stale,
  refreshing,
  dataUpdatedAt,
  projection = 'OVERSIGHT',
  onRefresh,
}: {
  providers: readonly ApprovalSignatureMetadataProjection[];
  stale: boolean;
  refreshing: boolean;
  dataUpdatedAt: number;
  projection?: 'OVERSIGHT' | 'STALE_FULL';
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const formatTimestamp = (value?: string | null) =>
    value
      ? formatDate(
          value,
          { dateStyle: 'medium', timeStyle: 'short' },
          resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
        )
      : t('admin.integrations.notAvailable');

  return (
    <Stack gap={2} data-approval-signature-projection={projection}>
      <InlineFeedback severity="info" icon={<ShieldCheck size={18} />}>
        {t('pages.signatures.description')}
      </InlineFeedback>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
          {t('admin.metricDetail')} ·{' '}
          {formatTimestamp(dataUpdatedAt > 0 ? new Date(dataUpdatedAt).toISOString() : null)}
        </Box>
        <ActionIconButton
          label={t('actions.refresh')}
          size="small"
          tooltipDisablePortal
          loading={refreshing}
          onClick={onRefresh}
        >
          <RefreshCcw size={16} />
        </ActionIconButton>
      </Stack>
      <InlineFeedback severity="warning" icon={<ShieldCheck size={18} />}>
        {t('admin.signatures.gate')}
      </InlineFeedback>
      {stale ? (
        <InlineFeedback severity="warning">{t('admin.signatures.sourceStale')}</InlineFeedback>
      ) : null}
      {providers.length === 0 ? (
        <EmptyState
          title={t('admin.signatures.notConfigured')}
          description={t('admin.signatures.gate')}
          icon={<KeyRound size={24} />}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'repeat(3,minmax(0,1fr))' },
            gap: 2,
            '& h2, & h2 + .MuiTypography-root': { overflowWrap: 'anywhere' },
          }}
        >
          {providers.map((provider) => (
            <ApprovalSurface
              key={provider.providerId}
              title={provider.displayName}
              meta={`${provider.providerType} · ${provider.providerKey}`}
            >
              <Stack gap={1.5} sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
                  <StatusChip status={provider.lifecycleState} />
                  <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                    {t('admin.version', { version: provider.version })}
                  </Box>
                </Stack>
                <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {formatTimestamp(provider.lastHealthCheckedAt)}
                </Box>
                <Box sx={{ typography: 'body2', color: 'text.secondary' }}>
                  {t(
                    provider.credentialConfigured
                      ? 'admin.signatures.credentialReferenceRegistered'
                      : 'admin.signatures.credentialReferenceMissing'
                  )}
                </Box>
                <Divider />
                <Stack direction="row" alignItems="center" gap={1}>
                  <KeyRound size={16} />
                  <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                    {t('admin.signatures.verificationNotReported')}
                  </Box>
                </Stack>
              </Stack>
            </ApprovalSurface>
          ))}
        </Box>
      )}
    </Stack>
  );
}
