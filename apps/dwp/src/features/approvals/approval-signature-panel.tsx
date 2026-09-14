import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  FileCheck2,
  History,
  PenLine,
  RefreshCcw,
  SearchCheck,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ApprovalSurface } from './approval-ui';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { ApprovalSignatureConsentDialog } from './approval-signature-consent-dialog';
import { ApprovalSignatureEvidence } from './approval-signature-evidence';
import { useApprovalSignatureController } from './approval-signature-controller';
import type { ApprovalSignatureControllerProps } from './approval-signature-controller';

export function ApprovalSignaturePanel(
  props: ApprovalSignatureControllerProps & {
    onBlockedChange?: (blocked: boolean, isBlocked: () => boolean) => void;
  }
) {
  const { t } = useTranslation('approvals');
  const model = useApprovalSignatureController(props);
  const notify = useRef(props.onBlockedChange);
  const closeGuard = useRef(model.isBlocked);
  notify.current = props.onBlockedChange;
  closeGuard.current = model.isBlocked;
  useEffect(() => {
    notify.current?.(model.blocked, () => closeGuard.current());
    return () => notify.current?.(false, () => false);
  }, [model.blocked]);
  const document = model.visible;
  const state = document && 'state' in document ? document.state : undefined;
  const disabled = !model.ready || model.busy || model.high.open || Boolean(model.uncertain);
  const originalFields = document
    ? ([
        ['requestId', document.source.requestId],
        ['artifactSha', document.artifact.sha256],
        ['sourceDigest', document.sourceDigest],
        ['rendererVersion', document.artifact.rendererVersion],
      ] as const)
    : [];
  return (
    <Box component="section" sx={{ mt: 2 }} data-approval-signature-panel>
      <ApprovalSurface
        title={t('signatureCeremony.title')}
        meta={t('signatureCeremony.kind')}
        action={
          <ActionIconButton
            label={t('signatureCeremony.reload')}
            tooltipDisablePortal
            disabled={model.busy || model.high.open || Boolean(model.uncertain)}
            loading={model.loading}
            onClick={() => void model.refresh()}
          >
            <RefreshCcw size={16} />
          </ActionIconButton>
        }
      >
        <Stack gap={2} sx={{ p: 2 }}>
          <InlineFeedback severity="info" icon={<ShieldCheck size={18} />}>
            {t('signatureCeremony.selfOnly')}
          </InlineFeedback>
          <Typography variant="caption" color="text.secondary">
            {t('signatureCeremony.notExternal')}
          </Typography>
          {model.loading ? (
            <LoadingState label={t('signatureCeremony.checking')} embedded size="compact" />
          ) : null}
          {!document && !model.loading && !model.metadata ? (
            <InlineFeedback severity="warning">{t('signatureCeremony.unavailable')}</InlineFeedback>
          ) : null}
          {model.feedback ? (
            <InlineFeedback severity="warning">
              {t(
                model.feedback === 'UNKNOWN'
                  ? 'signatureCeremony.unknown'
                  : model.feedback === 'CHANGED'
                    ? 'signatureCeremony.stale'
                    : 'signatureCeremony.unavailable'
              )}
            </InlineFeedback>
          ) : null}
          {model.uncertain ? (
            <Stack gap={1.5}>
              <Box component="dl" sx={{ m: 0, typography: 'caption', overflowWrap: 'anywhere' }}>
                <Box component="dt" color="text.secondary">
                  {t('signatureCeremony.commandKey')}
                </Box>
                <Box component="dd" sx={{ m: 0, mb: 1 }}>
                  {model.uncertain.query.idempotencyKey}
                </Box>
                <Box component="dt" color="text.secondary">
                  {t('signatureCeremony.commandBodySha')}
                </Box>
                <Box component="dd" sx={{ m: 0, mb: 1 }}>
                  {model.uncertain.query.bodySha256}
                </Box>
                <Box component="dt" color="text.secondary">
                  {t('signatureCeremony.originalOperation')}
                </Box>
                <Box component="dd" sx={{ m: 0 }}>
                  {t(
                    `signatureCeremony.${({ CREATE: 'create', CONSENT: 'consent', SIGN: 'sign', CANCEL: 'cancel' } as const)[model.uncertain.query.originalOperation]}`
                  )}
                </Box>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <ActionButton
                  intent="secondary"
                  startIcon={<SearchCheck size={16} />}
                  loading={model.busy}
                  disabled={model.busy || model.high.busy}
                  onClick={() => void model.lookup()}
                >
                  {t('signatureCeremony.receiptLookup')}
                </ActionButton>
                {model.canRetry ? (
                  <ActionButton
                    intent="quiet"
                    startIcon={<RefreshCcw size={16} />}
                    disabled={model.busy}
                    onClick={() => void model.retryOriginal()}
                  >
                    {t('signatureCeremony.retryOriginal')}
                  </ActionButton>
                ) : null}
              </Stack>
            </Stack>
          ) : null}
          {model.metadata ? (
            <Stack gap={1}>
              <InlineFeedback severity="info">{t('signatureCeremony.metadataOnly')}</InlineFeedback>
              <Typography variant="body2">
                {t(`signatureCeremony.states.${model.metadata.resultState}`)} ·{' '}
                {t('admin.version', { version: model.metadata.resultVersion })}
              </Typography>
              <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                {model.metadata.receiptId} ·{' '}
                {formatDate(model.metadata.committedAt, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Typography>
              {!model.metadata.sourceCurrent ? (
                <InlineFeedback severity="warning">
                  {t('signatureCeremony.sourceChanged')}
                </InlineFeedback>
              ) : null}
            </Stack>
          ) : null}
          {document ? (
            <>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                flexWrap="wrap"
              >
                <Typography component="h3" variant="subtitle2">
                  {t('signatureCeremony.originalDocument')}
                </Typography>
                {state ? (
                  <Chip
                    size="small"
                    label={t(`signatureCeremony.states.${state}`)}
                    color={state === 'ATTESTED' ? 'success' : 'default'}
                  />
                ) : null}
              </Stack>
              <Box
                component="dl"
                sx={{
                  m: 0,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(100px,.32fr) minmax(0,1fr)',
                  gap: 1,
                  typography: 'caption',
                }}
              >
                {originalFields.map(([key, value]) => (
                  <Box key={key} sx={{ display: 'contents' }}>
                    <Box component="dt" color="text.secondary">
                      {t(`signatureCeremony.${key}`)}
                    </Box>
                    <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                      {value}
                    </Box>
                  </Box>
                ))}
              </Box>
              <Box
                component="pre"
                tabIndex={0}
                aria-label={t('signatureCeremony.originalDocument')}
                sx={{
                  m: 0,
                  p: 1.5,
                  maxHeight: 320,
                  overflow: 'auto',
                  bgcolor: 'background.default',
                  border: 1,
                  borderColor: 'divider',
                  typography: 'caption',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {document.artifact.content}
              </Box>
              <Divider />
              {'signingReadiness' in document &&
              document.signingReadiness !== 'VERIFIED_INTERNAL_KEY' ? (
                <InlineFeedback severity="warning">
                  {t('signatureCeremony.unverified')}
                </InlineFeedback>
              ) : null}
              {'evidence' in document && document.evidence ? (
                <ApprovalSignatureEvidence evidence={document.evidence} />
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
                {!state ? (
                  <ActionButton
                    intent="primary"
                    startIcon={<FileCheck2 size={16} />}
                    loading={model.busy}
                    disabled={disabled || !model.canUpdate || !model.createAvailable}
                    onClick={() => void model.create()}
                  >
                    {t('signatureCeremony.create')}
                  </ActionButton>
                ) : null}
                {state === 'AWAITING_CONSENT' ? (
                  <ActionButton
                    intent="primary"
                    startIcon={<Check size={16} />}
                    disabled={disabled || !model.canUpdate || !model.consentAvailable}
                    onClick={model.openConsent}
                  >
                    {t('signatureCeremony.consent')}
                  </ActionButton>
                ) : null}
                {state === 'CONSENTED' ? (
                  <ActionButton
                    intent="primary"
                    startIcon={<PenLine size={16} />}
                    disabled={
                      disabled ||
                      !model.canSign ||
                      !model.signAvailable ||
                      !document.source.signingKeySha256
                    }
                    onClick={() => void model.sign()}
                  >
                    {t('signatureCeremony.sign')}
                  </ActionButton>
                ) : null}
                {state && ['AWAITING_CONSENT', 'CONSENTED'].includes(state) ? (
                  <ActionButton
                    intent="quiet"
                    startIcon={<X size={16} />}
                    disabled={disabled || !model.canUpdate || !model.cancelAvailable}
                    onClick={() => void model.cancel()}
                  >
                    {t('signatureCeremony.cancel')}
                  </ActionButton>
                ) : null}
                {state ? (
                  <ActionButton
                    intent="quiet"
                    startIcon={<History size={16} />}
                    disabled={model.busy}
                    onClick={() => model.setShowAudit(!model.showAudit)}
                  >
                    {t('signatureCeremony.audit')}
                  </ActionButton>
                ) : null}
              </Stack>
              {model.showAudit ? (
                <Stack gap={1}>
                  <Typography component="h3" variant="subtitle2">
                    {t('signatureCeremony.audit')}
                  </Typography>
                  {model.audit.isFetching ? (
                    <LoadingState embedded size="compact" label={t('signatureCeremony.checking')} />
                  ) : model.audit.isError ? (
                    <InlineFeedback severity="warning">
                      {t('signatureCeremony.unavailable')}
                    </InlineFeedback>
                  ) : !model.audit.data?.items.length ? (
                    <Typography variant="body2" color="text.secondary">
                      {t('signatureCeremony.auditEmpty')}
                    </Typography>
                  ) : (
                    <Box component="ol" sx={{ m: 0, pl: 2 }}>
                      {model.audit.data.items.map((event) => (
                        <Box component="li" key={event.eventId} sx={{ py: 0.5 }}>
                          <Typography variant="body2">
                            {t(
                              `signatureCeremony.${
                                (
                                  {
                                    CREATE: 'create',
                                    CONSENT: 'consent',
                                    SIGN: 'sign',
                                    CANCEL: 'cancel',
                                  } as Readonly<Record<string, string>>
                                )[event.action] ?? 'audit'
                              }`
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(event.occurredAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}{' '}
                            · {event.sequence}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {model.audit.data?.truncated && !model.audit.isError ? (
                    <InlineFeedback severity="warning">
                      {t('signatureCeremony.auditTruncated')}
                    </InlineFeedback>
                  ) : null}
                </Stack>
              ) : null}
            </>
          ) : null}
        </Stack>
      </ApprovalSurface>
      <ApprovalSignatureConsentDialog
        document={model.denied ? undefined : model.consentDocument}
        ready={model.consentReady && !model.uncertain}
        accepted={model.accepted}
        busy={model.busy}
        onAccepted={model.setAccepted}
        onClose={model.closeConsent}
        onSubmit={() => void model.consent()}
      />
      <ApprovalHighRiskCommandDialog controller={model.high} />
    </Box>
  );
}
