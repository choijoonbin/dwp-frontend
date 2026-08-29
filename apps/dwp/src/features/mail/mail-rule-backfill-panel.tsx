import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, RefreshCw } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getMailRuleBackfillPreview,
  HttpError,
  runMailRuleBackfill,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailAccount, MailRuleBackfillResult } from '@dwp-frontend/shared-utils';

type BackfillAttempt = {
  accountId: string;
  previewFingerprint: string;
  requestId: string;
};

export function MailRuleBackfillPanel({
  accounts,
  onCompleted,
}: {
  accounts: MailAccount[];
  onCompleted: () => void | Promise<void>;
}) {
  const { t } = useTranslation('mail');
  const personalAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.accountKind === 'PERSONAL' && account.connectionState === 'ACTIVE'
      ),
    [accounts]
  );
  const [accountId, setAccountId] = useState('');
  const [attempt, setAttempt] = useState<BackfillAttempt | null>(null);
  const [result, setResult] = useState<MailRuleBackfillResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (personalAccounts.some((account) => account.accountId === accountId)) return;
    const nextAccount =
      personalAccounts.find((account) => account.defaultAccount) ?? personalAccounts[0];
    setAccountId(nextAccount?.accountId ?? '');
    setAttempt(null);
    setResult(null);
    setConfirmOpen(false);
  }, [accountId, personalAccounts]);

  const preview = useQuery({
    queryKey: ['mail', 'organization', 'rule-backfill-preview', accountId],
    queryFn: () => getMailRuleBackfillPreview(accountId),
    enabled: Boolean(accountId),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: (command: BackfillAttempt) =>
      runMailRuleBackfill(command.accountId, {
        requestId: command.requestId,
        previewFingerprint: command.previewFingerprint,
      }),
    onSuccess: async (nextResult) => {
      setConfirmOpen(false);
      setAttempt(null);
      setResult(nextResult);
      await onCompleted();
    },
    onError: () => setConfirmOpen(false),
  });

  const selectAccount = (nextAccountId: string) => {
    if (nextAccountId === accountId || mutation.isPending) return;
    setAccountId(nextAccountId);
    setAttempt(null);
    setResult(null);
    setConfirmOpen(false);
    mutation.reset();
  };
  const refreshPreview = async () => {
    if (!accountId || mutation.isPending) return;
    setAttempt(null);
    setResult(null);
    mutation.reset();
    await preview.refetch();
  };
  const runBackfill = () => {
    const currentPreview = preview.data;
    if (!currentPreview || preview.isFetching || mutation.isPending) return;
    const command =
      attempt?.accountId === accountId &&
      attempt.previewFingerprint === currentPreview.previewFingerprint
        ? attempt
        : {
            accountId,
            previewFingerprint: currentPreview.previewFingerprint,
            requestId: crypto.randomUUID(),
          };
    setAttempt(command);
    setResult(null);
    mutation.mutate(command);
  };
  const conflict = mutation.error instanceof HttpError && mutation.error.status === 409;
  const rejected =
    mutation.error instanceof HttpError &&
    mutation.error.status >= 400 &&
    mutation.error.status < 500;
  const retryable = mutation.isError && !rejected;
  const canRun =
    Boolean(preview.data) &&
    !preview.data?.truncated &&
    !preview.isFetching &&
    !mutation.isPending &&
    !rejected &&
    (preview.data?.plannedApplicationCount ?? 0) > 0;

  return (
    <Box
      component="section"
      aria-labelledby="mail-rule-backfill-title"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        p: { xs: 1.5, sm: 2 },
        mb: 2,
      }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography
            id="mail-rule-backfill-title"
            component="h3"
            variant="subtitle1"
            fontWeight={850}
          >
            {t('organization.backfill.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('organization.backfill.description')}
          </Typography>
        </Box>

        {!personalAccounts.length ? (
          <Alert severity="info">{t('organization.backfill.noPersonalAccount')}</Alert>
        ) : (
          <>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ sm: 'flex-end' }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <SelectField<string>
                  label={t('organization.backfill.account')}
                  value={accountId}
                  disabled={mutation.isPending}
                  options={personalAccounts.map((account) => ({
                    value: account.accountId,
                    label: `${account.displayName} · ${account.emailAddress}`,
                  }))}
                  onValueChange={selectAccount}
                />
              </Box>
              <ActionButton
                intent="secondary"
                startIcon={<RefreshCw size={16} />}
                disabled={mutation.isPending}
                loading={preview.isFetching}
                onClick={() => void refreshPreview()}
              >
                {t('organization.backfill.refresh')}
              </ActionButton>
            </Stack>

            {preview.isError && (
              <Alert severity="error" aria-live="polite">
                {t('organization.backfill.loadError')}
              </Alert>
            )}

            {preview.data && (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, minmax(0, 1fr))',
                      md: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 1,
                  }}
                >
                  <BackfillMetric
                    label={t('organization.backfill.enabledRules')}
                    value={preview.data.enabledRuleCount}
                  />
                  <BackfillMetric
                    label={t('organization.backfill.scanned')}
                    value={preview.data.scannedCount}
                  />
                  <BackfillMetric
                    label={t('organization.backfill.matched')}
                    value={preview.data.matchedThreadCount}
                  />
                  <BackfillMetric
                    label={t('organization.backfill.planned')}
                    value={preview.data.plannedApplicationCount}
                  />
                </Box>
                {preview.data.truncated && (
                  <Alert severity="warning">{t('organization.backfill.truncated')}</Alert>
                )}
              </>
            )}

            {mutation.isError && (
              <Alert severity={conflict ? 'warning' : 'error'} aria-live="assertive">
                {t(
                  conflict
                    ? 'organization.backfill.refreshRequired'
                    : rejected
                      ? 'organization.backfill.runRejected'
                      : 'organization.backfill.runError'
                )}
              </Alert>
            )}
            {result && (
              <Alert severity="success" aria-live="polite">
                {t(
                  result.replayed
                    ? 'organization.backfill.replayed'
                    : 'organization.backfill.completed',
                  { count: result.changedCount }
                )}
              </Alert>
            )}

            <Stack direction="row" spacing={1} justifyContent="flex-end" useFlexGap flexWrap="wrap">
              {retryable && attempt && (
                <ActionButton intent="secondary" onClick={runBackfill}>
                  {t('organization.backfill.retryCommand')}
                </ActionButton>
              )}
              {conflict && (
                <ActionButton intent="secondary" onClick={() => void refreshPreview()}>
                  {t('organization.backfill.refresh')}
                </ActionButton>
              )}
              <ActionButton
                intent="primary"
                startIcon={<Play size={16} />}
                loading={mutation.isPending}
                disabled={!canRun}
                onClick={() => setConfirmOpen(true)}
              >
                {t('organization.backfill.run')}
              </ActionButton>
            </Stack>
          </>
        )}
      </Stack>
      <ConfirmDialog
        open={confirmOpen}
        title={t('organization.backfill.confirmTitle')}
        description={t('organization.backfill.confirmDescription', {
          account:
            personalAccounts.find((account) => account.accountId === accountId)?.emailAddress ?? '',
          count: preview.data?.plannedApplicationCount ?? 0,
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('organization.backfill.confirm')}
        confirmingLabel={t('organization.backfill.running')}
        busy={mutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={runBackfill}
      />
    </Box>
  );
}

function BackfillMetric({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={850}>
        {value}
      </Typography>
    </Box>
  );
}
