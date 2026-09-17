import { useTranslation } from 'react-i18next';
import { ActionButton, FormDialog, InlineFeedback } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalAdminV2CommandError } from './use-approval-admin-v2-command';
import type { useApprovalAdminV2Command } from './use-approval-admin-v2-command';

type Controller = ReturnType<typeof useApprovalAdminV2Command>['controller'];

const ERROR_COPY: Record<Exclude<ApprovalAdminV2CommandError, null>, string> = {
  authorityUnavailable: 'authority-unavailable',
  issuerUnavailable: 'issuer-retry',
  providerUnavailable: 'provider-unavailable',
  popupBlocked: 'popup-blocked',
  commandConflict: 'revision-conflict',
  commandUncertain: 'command-retry',
  commandRejected: 'command-rejected',
};

export function ApprovalAdminV2CommandDialog({ controller }: { controller: Controller }) {
  const { t } = useTranslation('approvals');
  const { attempt, error } = controller;
  const continuation = attempt?.continuation;
  const selectingProvider = continuation?.type === 'OIDC_PROVIDER_SELECTION';
  const continuingOidc = continuation?.type === 'OIDC';
  const waitingForPopup = attempt?.phase === 'RESUME_REQUIRED';
  const reconfirming = attempt?.phase === 'RECONFIRM_COMMAND';
  const submitLabel = continuingOidc
    ? t('admin.highRisk.openIdentityProvider')
    : t(reconfirming ? 'admin.highRisk.execute' : 'admin.highRisk.verify');

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
      submitDisabled={selectingProvider || waitingForPopup}
      maxWidth="sm"
    >
      <Stack gap={2} sx={{ pt: 0.5 }}>
        {error ? (
          <InlineFeedback severity="error">
            {t(`admin.highRisk.errors.${ERROR_COPY[error]}`)}
          </InlineFeedback>
        ) : null}
        {attempt ? (
          <Stack
            gap={0.5}
            sx={{
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: (theme) => `${Number(theme.shape.borderRadius)}px`,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {attempt.command.targetType}
            </Typography>
            <Typography
              variant="body2"
              fontWeight="fontWeightBold"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {attempt.command.targetId}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {`v${attempt.command.expectedObjectVersion} · ${attempt.command.commandMethod} ${attempt.command.commandPath}`}
            </Typography>
          </Stack>
        ) : null}
        {selectingProvider ? (
          <Stack gap={1} aria-label={t('admin.highRisk.providerSelection')}>
            <Typography variant="body2" fontWeight="fontWeightBold">
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
        {waitingForPopup ? (
          <InlineFeedback severity="info">{t('admin.highRisk.popupWaiting')}</InlineFeedback>
        ) : null}
      </Stack>
    </FormDialog>
  );
}
