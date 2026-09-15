import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, RefreshCcw, RotateCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  FormDialog,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import { ApprovalAdminAttachmentPolicyController } from './approval-admin-attachment-policy-controller';
import { SignatureDiagnosticsHistory } from './approval-signature-diagnostics-history';
import { SignatureDiagnosticsInspector } from './approval-signature-diagnostics-inspector';
import { SignatureDiagnosticsOverview } from './approval-signature-diagnostics-overview';
import { SignatureDiagnosticsPolicyInspector } from './approval-signature-diagnostics-policy-inspector';
import { ApprovalSignaturePolicyWorkspace } from './approval-signature-policy-workspace';
import { approvalTone, ApprovalSurface } from './approval-ui';
import { useApprovalSignatureProviderDiagnostics } from './use-approval-signature-provider-diagnostics';

export function ApprovalSignatureAdmin() {
  const { t } = useTranslation('approvals');
  const controller = useApprovalSignatureProviderDiagnostics();
  const [now, setNow] = useState(() => Date.now());
  const label = (key: string) => t(`admin.signatureDiagnostics.labels.${key}`);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!controller.contractAvailable) {
    return (
      <Stack gap={3} data-approval-signature-contract="UNAVAILABLE">
        <ErrorState
          title={label('title')}
          description={t('admin.signatureDiagnostics.nativeUnavailable')}
          size="compact"
        />
        <ApprovalAdminAttachmentPolicyController />
      </Stack>
    );
  }

  const selectedProvider = controller.overview.data?.providers.find(
    (provider) => provider.providerId === controller.selectedProviderId
  );
  const hasProbeTargets = Boolean(
    controller.overview.data?.providers.some(
      (provider) => provider.kind !== 'INTERNAL' && provider.providerId !== null
    )
  );

  return (
    <Stack
      gap={3}
      minWidth={0}
      data-approval-signature-contract="AVAILABLE"
      data-approval-signature-runtime-readiness={controller.installed ? 'READY' : 'BLOCKED'}
    >
      <InlineFeedback
        severity={controller.installed ? 'info' : 'error'}
        icon={controller.installed ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
      >
        <Box sx={{ typography: 'subtitle2' }}>{t('admin.signatureDiagnostics.directiveTitle')}</Box>
        <Box sx={{ mt: 0.5 }}>{t('admin.signatureDiagnostics.directiveBody')}</Box>
      </InlineFeedback>

      {controller.probeFeedback ? (
        <InlineFeedback severity="warning">
          {t(
            controller.probeFeedback === 'UNKNOWN'
              ? 'admin.signatureDiagnostics.probeUnknown'
              : 'admin.signatureDiagnostics.sourceChanged'
          )}
        </InlineFeedback>
      ) : null}

      <ApprovalSurface
        title={t('admin.signatureDiagnostics.separationTitle')}
        meta={t('admin.signatureDiagnostics.separationBody')}
        appearance="executive"
      >
        <Box
          sx={(theme) => ({
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(3,minmax(0,1fr))' },
            gap: 1,
            p: 2,
            bgcolor: alpha(approvalTone.primary, theme.palette.mode === 'dark' ? 0.08 : 0.025),
          })}
        >
          {(['internalDecision', 'externalGate', 'verifiedArchive'] as const).map(
            (phase, index) => (
              <Stack
                key={phase}
                gap={0.75}
                sx={{
                  minWidth: 0,
                  p: 1.5,
                  border: 1,
                  borderColor: index === 1 ? 'error.main' : 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Box
                  sx={{
                    typography: 'overline',
                    color: index === 1 ? 'error.main' : 'primary.main',
                  }}
                >
                  {t('admin.signatureDiagnostics.phaseNumber', { number: index + 1 })}
                </Box>
                <Box sx={{ typography: 'subtitle2' }}>
                  {t(`admin.signatureDiagnostics.separation.${phase}.title`)}
                </Box>
                <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {t(`admin.signatureDiagnostics.separation.${phase}.description`)}
                </Box>
              </Stack>
            )
          )}
        </Box>
      </ApprovalSurface>

      <SignatureDiagnosticsOverview
        data={controller.overview.data ?? null}
        readState={controller.overviewState}
        now={now}
        action={
          <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
            <ActionButton
              intent="secondary"
              startIcon={<History size={16} />}
              disabled={controller.overviewState !== 'CURRENT'}
              onClick={controller.openHistory}
            >
              {label('historyAction')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<RotateCw size={16} />}
              loading={controller.probeBusy}
              disabled={!controller.canProbe || !hasProbeTargets}
              onClick={() => void controller.runProbe(null)}
            >
              {label(
                controller.probeFeedback === 'UNKNOWN' &&
                  controller.uncertainOperation === 'PROVIDER'
                  ? 'reconcileProbe'
                  : 'runAllProbes'
              )}
            </ActionButton>
            <ActionIconButton
              label={t('actions.refresh')}
              tooltipDisablePortal
              loading={controller.overview.isFetching}
              onClick={() => void controller.refresh()}
            >
              <RefreshCcw size={16} />
            </ActionIconButton>
          </Stack>
        }
        providerAction={(provider) =>
          provider.providerId ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <ActionButton
                intent="secondary"
                onClick={() => controller.openProvider(provider.providerId!)}
              >
                {label('viewConfiguration')}
              </ActionButton>
              {provider.kind !== 'INTERNAL' ? (
                <ActionButton
                  intent="quiet"
                  startIcon={<RotateCw size={15} />}
                  loading={controller.probeBusy}
                  disabled={!controller.canProbe || controller.probeFeedback === 'UNKNOWN'}
                  onClick={() => void controller.runProbe(provider.providerId)}
                >
                  {label('runProviderProbe')}
                </ActionButton>
              ) : null}
            </Stack>
          ) : null
        }
        kmsAction={
          <ActionButton
            intent="secondary"
            startIcon={<RotateCw size={15} />}
            loading={controller.probeBusy}
            disabled={!controller.canKmsProbe}
            onClick={() => void controller.runKmsProbe()}
          >
            {label(
              controller.probeFeedback === 'UNKNOWN' && controller.uncertainOperation === 'KMS'
                ? 'reconcileKmsProbe'
                : 'runKmsProbe'
            )}
          </ActionButton>
        }
        wormAction={
          <ActionButton
            intent="secondary"
            disabled={controller.policyState !== 'CURRENT'}
            onClick={() =>
              document.getElementById('approval-signature-policy')?.scrollIntoView({
                block: 'start',
              })
            }
          >
            {label('viewRetentionPolicy')}
          </ActionButton>
        }
        onRetry={() => void controller.refresh()}
      />

      <InlineFeedback severity="info" icon={<ShieldCheck size={18} />}>
        {t('admin.signatureDiagnostics.secretBoundary')}
      </InlineFeedback>

      <Box id="approval-signature-policy" sx={{ scrollMarginTop: 16 }}>
        <ApprovalSurface
          title={label('policy')}
          meta={t('admin.signaturePolicy.currentPolicyDescription')}
        >
          <Box sx={{ p: 2 }}>
            <SignatureDiagnosticsPolicyInspector
              policy={controller.policy.data ?? null}
              readState={controller.policyState}
              now={now}
            />
          </Box>
        </ApprovalSurface>
      </Box>

      <ApprovalSignaturePolicyWorkspace />

      <ApprovalAdminAttachmentPolicyController />

      <FormDialog
        open={controller.selectedProviderId !== null}
        title={selectedProvider?.displayName ?? label('settings')}
        description={t('admin.signatureDiagnostics.providerDialogDescription')}
        cancelLabel={t('actions.close')}
        submitLabel={t('actions.close')}
        showSubmit={false}
        maxWidth="lg"
        mobileFullScreen
        onClose={controller.closeProvider}
        onSubmit={controller.closeProvider}
      >
        <SignatureDiagnosticsInspector
          details={controller.details.data ?? null}
          policy={controller.policy.data ?? null}
          readState={controller.detailsState}
          policyReadState={controller.policyState}
          now={now}
        />
      </FormDialog>

      <FormDialog
        open={controller.historyOpen}
        title={label('historyAction')}
        description={t('admin.signatureDiagnostics.historyDescription')}
        cancelLabel={t('actions.close')}
        submitLabel={t('actions.close')}
        showSubmit={false}
        maxWidth="lg"
        mobileFullScreen
        onClose={controller.closeHistory}
        onSubmit={controller.closeHistory}
      >
        <SignatureDiagnosticsHistory
          diagnosticHistory={controller.diagnosticHistory.data ?? null}
          policyHistory={controller.policyHistory.data ?? null}
          readState={controller.diagnosticHistoryState}
          policyReadState={controller.policyHistoryState}
          onNextDiagnostic={controller.nextDiagnosticHistory}
          onNextPolicy={controller.nextPolicyHistory}
        />
      </FormDialog>
    </Stack>
  );
}
