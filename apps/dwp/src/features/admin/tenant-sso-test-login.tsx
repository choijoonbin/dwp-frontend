import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  listTenantSsoTestLoginReceipts,
  requestTenantSsoTestLogin,
  usePermissions,
  useToast,
  type TenantSsoTestLoginReceipt,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormDialog, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  abbreviatedSsoReceiptHash,
  ssoTestLoginBoundaryLabelKey,
  ssoTestLoginReasonLabelKey,
  ssoTestLoginStateLabelKey,
  ssoTestLoginStateTone,
} from './tenant-sso-test-login-model';

const HISTORY_KEY = ['admin', 'tenant-settings', 'sso-test-login-jobs'] as const;
const SNAPSHOT_KEY = ['admin', 'tenant-settings', 'governance-snapshot'] as const;

export function TenantSsoTestLogin() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const canView = permissionsLoaded && hasPermission('ADMIN.IDENTITY_PROVISIONING', 'VIEW');
  const canManage = permissionsLoaded && hasPermission('ADMIN.IDENTITY_PROVISIONING', 'MANAGE');
  const [commandKey, setCommandKey] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const history = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: () => listTenantSsoTestLoginReceipts(20),
    enabled: canView,
    retry: false,
  });
  const request = useMutation({
    mutationFn: requestTenantSsoTestLogin,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: HISTORY_KEY }),
        queryClient.invalidateQueries({ queryKey: SNAPSHOT_KEY }),
      ]);
      setCommandKey(null);
      setJustification('');
      toast.success(t('settingsHome.overview.governance.ssoTest.commandCompleted'));
    },
    onError: () => toast.error(t('settingsHome.overview.governance.ssoTest.commandError')),
  });

  if (!permissionsLoaded) return <Skeleton variant="rounded" height={128} />;
  if (!canView) return null;

  const closeDialog = () => {
    if (request.isPending) return;
    setCommandKey(null);
    setJustification('');
  };

  return (
    <Box component="section" aria-labelledby="tenant-sso-test-login-title">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
      >
        <Box>
          <Typography id="tenant-sso-test-login-title" component="h2" variant="h6">
            {t('settingsHome.overview.governance.ssoTest.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('settingsHome.overview.governance.ssoTest.description')}
          </Typography>
        </Box>
        {canManage && (
          <ActionButton
            intent="primary"
            size="small"
            startIcon={<ShieldCheck size={16} aria-hidden="true" />}
            onClick={() => setCommandKey(crypto.randomUUID())}
          >
            {t('settingsHome.overview.governance.ssoTest.action')}
          </ActionButton>
        )}
      </Stack>

      <InlineFeedback severity="info" sx={{ mt: 1.25 }}>
        {t('settingsHome.overview.governance.ssoTest.executionBoundary')}
      </InlineFeedback>

      {history.isLoading && <Skeleton variant="rounded" height={112} sx={{ mt: 1.25 }} />}
      {history.isError && (
        <InlineFeedback
          severity="error"
          sx={{ mt: 1.25 }}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<RefreshCw size={15} aria-hidden="true" />}
              onClick={() => void history.refetch()}
            >
              {t('settingsHome.overview.governance.ssoTest.retry')}
            </ActionButton>
          }
        >
          {t('settingsHome.overview.governance.ssoTest.loadError')}
        </InlineFeedback>
      )}
      {history.data && history.data.items.length === 0 && !history.data.hasMore && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {t('settingsHome.overview.governance.ssoTest.empty')}
        </Typography>
      )}
      {history.data && history.data.items.length > 0 && (
        <>
          <Stack component="ol" gap={1} sx={{ p: 0, mt: 1.25, mb: 0, listStyle: 'none' }}>
            {history.data.items.map((receipt) => (
              <ReceiptRow key={receipt.testLoginJobId} receipt={receipt} />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t('settingsHome.overview.governance.ssoTest.historySummary', {
              loaded: history.data.items.length,
              limit: history.data.limit,
            })}
          </Typography>
        </>
      )}
      {history.data?.hasMore && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {t('settingsHome.overview.governance.ssoTest.moreAvailable')}
        </Alert>
      )}

      <FormDialog
        open={Boolean(commandKey)}
        title={t('settingsHome.overview.governance.ssoTest.dialog.title')}
        description={t('settingsHome.overview.governance.ssoTest.dialog.description')}
        cancelLabel={t('common.actions.cancel')}
        submitLabel={t('settingsHome.overview.governance.ssoTest.dialog.confirm')}
        busy={request.isPending}
        submitDisabled={!canManage || justification.trim().length < 10}
        onClose={closeDialog}
        onSubmit={async () => {
          if (!canManage || !commandKey || justification.trim().length < 10) return;
          await request.mutateAsync({
            idempotencyKey: commandKey,
            justification: justification.trim(),
          });
        }}
      >
        <Stack gap={1.5}>
          <Alert severity="warning">
            {t('settingsHome.overview.governance.ssoTest.dialog.warning')}
          </Alert>
          <FormField
            required
            multiline
            minRows={3}
            label={t('settingsHome.overview.governance.ssoTest.dialog.justification')}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
          />
        </Stack>
      </FormDialog>
    </Box>
  );
}

function ReceiptRow({ receipt }: Readonly<{ receipt: TenantSsoTestLoginReceipt }>) {
  const { t } = useTranslation('admin');
  const receiptHash = abbreviatedSsoReceiptHash(receipt.receiptSha256);
  return (
    <Box
      component="li"
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, minWidth: 0 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-start' }}
        gap={1}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" variant="subtitle2">
            {receipt.providerKey ||
              t('settingsHome.overview.governance.ssoTest.providerUnavailable')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('settingsHome.overview.governance.ssoTest.requestedMeta', {
              actor: receipt.requestedBy,
              date: formatDate(receipt.requestedAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          color={ssoTestLoginStateTone(receipt.lifecycleState)}
          label={t(ssoTestLoginStateLabelKey(receipt.lifecycleState))}
        />
      </Stack>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          columnGap: 2,
          rowGap: 0.75,
          m: 0,
          mt: 1,
        }}
      >
        <EvidenceValue
          label={t('settingsHome.overview.governance.ssoTest.internalState')}
          value={t(ssoTestLoginStateLabelKey(receipt.internalPrerequisiteState))}
        />
        <EvidenceValue
          label={t('settingsHome.overview.governance.ssoTest.externalState')}
          value={t(ssoTestLoginStateLabelKey(receipt.externalProbeState))}
        />
        <EvidenceValue
          label={t('settingsHome.overview.governance.ssoTest.completedAt')}
          value={formatDate(receipt.completedAt, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        />
        <EvidenceValue
          label={t('settingsHome.overview.governance.ssoTest.receipt')}
          value={receiptHash ?? t('settingsHome.overview.governance.ssoTest.receiptUnavailable')}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {t(ssoTestLoginBoundaryLabelKey(receipt.executionBoundary))}
      </Typography>
      {receipt.blockingReasons.length > 0 && (
        <Stack component="ul" gap={0.25} sx={{ pl: 2.5, mt: 0.75, mb: 0 }}>
          {receipt.blockingReasons.map((reason, index) => (
            <Typography component="li" variant="caption" key={`${reason}:${index}`}>
              {t(ssoTestLoginReasonLabelKey(reason))}
            </Typography>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function EvidenceValue({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}
