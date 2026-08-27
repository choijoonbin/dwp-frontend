import { useTranslation } from 'react-i18next';
import { ActionButton, FormDialog } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalHighRiskCommandController } from './use-product-surface-high-risk-command';

const TERMINAL_ERRORS = new Set([
  'authority-unavailable',
  'revision-conflict',
  'command-rejected',
  'command-uncertain',
]);

export function ApprovalHighRiskCommandDialog({
  controller,
}: {
  controller: ApprovalHighRiskCommandController;
}) {
  const { t } = useTranslation('approvals');
  const { attempt, error } = controller;
  const continuation = attempt?.continuation;
  const selectingProvider = continuation?.type === 'OIDC_PROVIDER_SELECTION';
  const continuingOidc = continuation?.type === 'OIDC';
  const awaitingPopup = attempt?.phase === 'RESUME_REQUIRED';
  const reconfirming = attempt?.phase === 'RECONFIRM_COMMAND' || attempt?.phase === 'COMMAND_RETRY';
  const canConfirm =
    Boolean(attempt) &&
    !awaitingPopup &&
    !selectingProvider &&
    !continuingOidc &&
    !TERMINAL_ERRORS.has(error ?? '');
  const submitLabel = continuingOidc
    ? t('admin.highRisk.openIdentityProvider')
    : t(reconfirming ? 'admin.highRisk.execute' : 'admin.highRisk.verify');
  const submitDisabled = selectingProvider || awaitingPopup || (!continuingOidc && !canConfirm);
  const submit = () => {
    if (continuingOidc) controller.continueWithIdentityProvider();
    else return controller.confirm();
  };

  return (
    <FormDialog
      open={controller.open}
      title={t('admin.highRisk.title')}
      description={t(reconfirming ? 'admin.highRisk.reconfirm' : 'admin.highRisk.description')}
      cancelLabel={t('actions.close')}
      submitLabel={submitLabel}
      submittingLabel={submitLabel}
      onClose={controller.close}
      onSubmit={submit}
      busy={controller.busy}
      submitDisabled={submitDisabled}
      maxWidth="sm"
    >
      <Stack gap={2} sx={{ pt: 0.5 }}>
        {error ? (
          <Alert severity={error === 'command-retry' ? 'warning' : 'error'}>
            {t(`admin.highRisk.errors.${error}`)}
          </Alert>
        ) : null}
        {selectingProvider ? (
          <Stack gap={1} aria-label={t('admin.highRisk.providerSelection')}>
            <Typography variant="body2" fontWeight={700}>
              {t('admin.highRisk.providerSelection')}
            </Typography>
            {continuation.providerKeys.map((providerKey) => (
              <ActionButton
                key={providerKey}
                intent="secondary"
                disabled={controller.busy}
                onClick={() => void controller.selectIdentityProvider(providerKey)}
              >
                {providerKey}
              </ActionButton>
            ))}
          </Stack>
        ) : null}
        {awaitingPopup ? (
          <Alert severity="info" role="status">
            {t('admin.highRisk.popupWaiting')}
          </Alert>
        ) : null}
      </Stack>
    </FormDialog>
  );
}
