import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { ActionButton, ErrorState, LoadingState } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import { ApprovalSurface } from './approval-ui';

export function ApprovalRetentionPolicyUnavailable({
  loading,
  busy,
  blocked,
  canInitialize,
  onRefresh,
  onInitialize,
}: {
  loading: boolean;
  busy: boolean;
  blocked: boolean;
  canInitialize: boolean;
  onRefresh: () => void;
  onInitialize: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <ApprovalSurface title={t('admin.retention.policyTitle')}>
      <Stack gap={1.5} sx={{ p: 2 }}>
        {loading ? (
          <LoadingState label={t('admin.retention.policyTitle')} size="compact" />
        ) : (
          <ErrorState
            title={t('admin.retention.sourceChanged')}
            onRetry={blocked ? undefined : onRefresh}
            retryLabel={blocked ? undefined : t('actions.refresh')}
            size="compact"
          />
        )}
        {canInitialize ? (
          <ActionButton startIcon={<ShieldCheck size={16} />} loading={busy} onClick={onInitialize}>
            {t('admin.retention.initialize')}
          </ActionButton>
        ) : null}
      </Stack>
    </ApprovalSurface>
  );
}
