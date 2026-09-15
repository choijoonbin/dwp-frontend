import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArchiveRestore,
  Ban,
  ExternalLink,
  FileSearch,
  History,
  RefreshCcw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { useApprovalExternalSignatureController } from './use-approval-external-signature-controller';
import type { ApprovalExternalSignatureControllerProps } from './use-approval-external-signature-controller';
import { ApprovalSurface } from './approval-ui';

export function ApprovalExternalSignaturePanel(
  props: ApprovalExternalSignatureControllerProps & {
    onBlockedChange?: (blocked: boolean, isBlocked: () => boolean) => void;
  }
) {
  const { t } = useTranslation('approvals');
  const controller = useApprovalExternalSignatureController(props);
  const notify = useRef(props.onBlockedChange);
  const closeGuard = useRef(controller.isBlocked);
  const [providerId, setProviderId] = useState('');
  notify.current = props.onBlockedChange;
  closeGuard.current = controller.isBlocked;
  useEffect(() => {
    notify.current?.(controller.blocked, () => closeGuard.current());
    return () => notify.current?.(false, () => false);
  }, [controller.blocked]);
  useEffect(() => {
    if (!providerId && controller.providers[0])
      setProviderId(controller.providers[0].target.providerId);
  }, [controller.providers, providerId]);
  const text = (key: string, fallback: string, values?: Record<string, unknown>) =>
    t(`externalSignature.${key}`, { defaultValue: fallback, ...values });
  const request = controller.currentRequest;
  const stateLabel = request?.state
    ? text(`states.${request.state}`, request.state.split('_').join(' '))
    : null;

  return (
    <Box component="section" sx={{ mt: 2, minWidth: 0 }} data-approval-external-signature-panel>
      <ApprovalSurface
        title={text('title', 'External provider signature')}
        meta={text('kind', 'Provider ceremony and verified retained artifacts')}
        action={
          <ActionIconButton
            label={text('reload', 'Reload external signature source')}
            tooltipDisablePortal
            disabled={controller.busy || Boolean(controller.unknown)}
            loading={controller.context.isFetching || controller.request.isFetching}
            onClick={() => void controller.reload()}
          >
            <RefreshCcw size={16} />
          </ActionIconButton>
        }
      >
        <Stack gap={2} sx={{ p: 2, minWidth: 0 }}>
          <InlineFeedback severity="info" icon={<ShieldCheck size={18} />}>
            {text(
              'trustBoundary',
              'External handover is separate from internal self-attestation and requires current provider, policy, callback, KMS and WORM evidence.'
            )}
          </InlineFeedback>
          {controller.context.isPending && controller.context.isFetching ? (
            <LoadingState
              embedded
              size="compact"
              label={text('checking', 'Checking external signing eligibility')}
            />
          ) : null}
          {controller.context.isError && !controller.context.data ? (
            <InlineFeedback severity="warning">
              {text(
                'unavailable',
                'External signing authority or its current source is unavailable.'
              )}
            </InlineFeedback>
          ) : null}
          {controller.feedback ? (
            <InlineFeedback severity="warning">
              {controller.feedback === 'UNKNOWN'
                ? text(
                    'unknown',
                    'The remote result is unknown. This command is locked and will not be sent again.'
                  )
                : controller.feedback === 'CHANGED'
                  ? text(
                      'changed',
                      'The request, signature session or authority changed. Reload before acting.'
                    )
                  : text('failed', 'The command was rejected. No automatic retry was attempted.')}
            </InlineFeedback>
          ) : null}
          {controller.unknown ? (
            <Box component="dl" sx={{ m: 0, typography: 'caption', overflowWrap: 'anywhere' }}>
              <Box component="dt" color="text.secondary">
                {text('unknownOperation', 'Locked operation')}
              </Box>
              <Box component="dd" sx={{ m: 0, mb: 1 }}>
                {controller.unknown.operation}
              </Box>
              <Box component="dt" color="text.secondary">
                {text('idempotencyKey', 'Idempotency key')}
              </Box>
              <Box component="dd" sx={{ m: 0 }}>
                {controller.unknown.idempotencyKey}
              </Box>
            </Box>
          ) : null}
          {controller.context.data ? (
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Chip
                size="small"
                color={controller.context.data.gateState === 'ELIGIBLE' ? 'success' : 'warning'}
                label={text(
                  `gate.${controller.context.data.gateState}`,
                  controller.context.data.gateState.split('_').join(' ')
                )}
              />
              <Chip
                size="small"
                variant="outlined"
                label={controller.context.data.source.dataClassification}
              />
              <Chip
                size="small"
                variant="outlined"
                label={t('admin.version', {
                  version: controller.context.data.source.requestVersion,
                })}
              />
            </Stack>
          ) : null}
          {!controller.signatureRequestId && controller.context.data ? (
            controller.providers.length ? (
              <Box
                component="ul"
                sx={{
                  listStyle: 'none',
                  m: 0,
                  p: 0,
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
                  gap: 1,
                }}
              >
                {controller.providers.map(({ provider, target }) => (
                  <Box
                    component="li"
                    key={target.providerId}
                    sx={{ border: 1, borderColor: 'divider', p: 1.5, minWidth: 0 }}
                  >
                    <Stack gap={1}>
                      <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                        {provider.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {provider.kind} · {provider.environment} ·{' '}
                        {t('admin.version', { version: target.expectedProviderVersion })}
                      </Typography>
                      <ActionButton
                        data-approval-external-create={target.providerId}
                        intent="primary"
                        size="small"
                        startIcon={<ExternalLink size={16} />}
                        disabled={!controller.canCreate}
                        loading={controller.busy && providerId === target.providerId}
                        onClick={() => {
                          setProviderId(target.providerId);
                          controller.create(target.providerId);
                        }}
                      >
                        {text('create', 'Prepare provider request')}
                      </ActionButton>
                    </Stack>
                  </Box>
                ))}
              </Box>
            ) : (
              <InlineFeedback severity="warning">
                {text(
                  'noProvider',
                  'No policy-required verified production provider is available.'
                )}
              </InlineFeedback>
            )
          ) : null}
          {controller.signatureRequestId &&
          controller.request.isPending &&
          controller.request.isFetching ? (
            <LoadingState
              embedded
              size="compact"
              label={text('loadingSession', 'Loading the external signature session')}
            />
          ) : null}
          {request ? (
            <>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                <Chip
                  size="small"
                  color={request.state === 'COMPLETED_VERIFIED' ? 'success' : 'default'}
                  label={stateLabel}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('admin.version', { version: request.version })}
                />
                <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                  {request.signatureRequestId}
                </Typography>
              </Stack>
              {request.reasonCodes.length ? (
                <InlineFeedback severity="warning">{request.reasonCodes.join(', ')}</InlineFeedback>
              ) : null}
              <Box
                component="dl"
                sx={{
                  m: 0,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0,1fr)',
                    sm: 'minmax(9rem,.35fr) minmax(0,1fr)',
                  },
                  gap: 1,
                  typography: 'caption',
                }}
              >
                {[
                  [
                    text('policy', 'Frozen policy'),
                    `${request.policyId} · ${request.policySha256}`,
                  ],
                  [
                    text('provider', 'Provider binding'),
                    `${request.provider.providerId} · ${t('admin.version', {
                      version: request.provider.expectedProviderVersion,
                    })}`,
                  ],
                  [
                    text('updatedAt', 'Updated'),
                    formatDate(request.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
                  ],
                ].map(([term, value]) => (
                  <Box key={term} sx={{ display: 'contents' }}>
                    <Box component="dt" color="text.secondary">
                      {term}
                    </Box>
                    <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                      {value}
                    </Box>
                  </Box>
                ))}
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
                <ActionButton
                  data-approval-external-handover
                  intent="primary"
                  startIcon={<Send size={16} />}
                  disabled={!controller.canHandover}
                  onClick={controller.handover}
                >
                  {text('handover', 'Verify identity and hand over')}
                </ActionButton>
                <ActionButton
                  data-approval-external-refresh
                  intent="secondary"
                  startIcon={<RefreshCcw size={16} />}
                  disabled={!controller.canRefresh}
                  onClick={controller.refreshProvider}
                >
                  {text('refreshProvider', 'Refresh provider status')}
                </ActionButton>
                <ActionButton
                  data-approval-external-cancel
                  intent="quiet"
                  startIcon={<Ban size={16} />}
                  disabled={!controller.canCancel}
                  onClick={controller.openCancel}
                >
                  {t('actions.cancel')}
                </ActionButton>
                <ActionButton
                  data-approval-external-audit
                  intent="quiet"
                  startIcon={<History size={16} />}
                  disabled={controller.busy}
                  onClick={() => controller.setShowAudit(!controller.showAudit)}
                >
                  {text('audit', 'External signature audit')}
                </ActionButton>
              </Stack>
              {controller.showAudit ? (
                <Stack gap={1}>
                  <Typography component="h3" variant="subtitle2">
                    {text('audit', 'External signature audit')}
                  </Typography>
                  {controller.audit.isFetching ? (
                    <LoadingState
                      embedded
                      size="compact"
                      label={text('checkingAudit', 'Checking audit')}
                    />
                  ) : controller.audit.isError ? (
                    <InlineFeedback severity="warning">
                      {text('auditUnavailable', 'The current audit could not be verified.')}
                    </InlineFeedback>
                  ) : controller.audit.data?.items.length ? (
                    <Box component="ol" sx={{ m: 0, pl: 2 }}>
                      {controller.audit.data.items.map((event) => (
                        <Box component="li" key={event.eventId} sx={{ py: 0.5 }}>
                          <Typography variant="body2">
                            {event.action} · {text(`states.${event.state}`, event.state)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(event.occurredAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                            {' · '}
                            {event.sequence}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {text('auditEmpty', 'No external signature events are recorded.')}
                    </Typography>
                  )}
                  {controller.audit.data?.truncated ? (
                    <InlineFeedback severity="warning">
                      {text('auditTruncated', 'This audit projection is partial.')}
                    </InlineFeedback>
                  ) : null}
                </Stack>
              ) : null}
              <Stack gap={1}>
                <Typography component="h3" variant="subtitle2">
                  {text('artifact', 'Retained artifact evidence')}
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  gap={1}
                  alignItems={{ sm: 'flex-end' }}
                >
                  <FormField
                    label={text('artifactId', 'Artifact ID')}
                    value={controller.artifactInput}
                    disabled={controller.busy}
                    onChange={(event) => controller.setArtifactInput(event.target.value)}
                  />
                  <ActionButton
                    data-approval-external-artifact
                    intent="secondary"
                    startIcon={<FileSearch size={16} />}
                    disabled={controller.busy || controller.artifactInput.trim().length !== 36}
                    onClick={controller.loadArtifact}
                  >
                    {text('inspectArtifact', 'Inspect evidence')}
                  </ActionButton>
                </Stack>
                {controller.artifact.isFetching ? (
                  <LoadingState
                    embedded
                    size="compact"
                    label={text('checkingArtifact', 'Checking artifact')}
                  />
                ) : controller.artifact.isError ? (
                  <InlineFeedback severity="warning">
                    {text(
                      'artifactUnavailable',
                      'Artifact evidence is unavailable or no longer current.'
                    )}
                  </InlineFeedback>
                ) : controller.artifact.data ? (
                  <InlineFeedback severity="success" icon={<ArchiveRestore size={18} />}>
                    {`${controller.artifact.data.kind} · ${controller.artifact.data.sha256} · ${text(
                      'retainUntil',
                      'retain until'
                    )} ${formatDate(controller.artifact.data.retainUntil, { dateStyle: 'medium' })}`}
                  </InlineFeedback>
                ) : null}
              </Stack>
            </>
          ) : null}
        </Stack>
      </ApprovalSurface>

      <FormDialog
        open={controller.cancelOpen}
        title={text('cancelTitle', 'Cancel external signature ceremony')}
        description={text(
          'cancelDescription',
          'The current request and provider state are revalidated immediately before cancellation.'
        )}
        cancelLabel={t('actions.close')}
        submitLabel={t('actions.cancel')}
        busy={controller.busy}
        submitDisabled={!controller.canCancel}
        onClose={controller.closeCancel}
        onSubmit={controller.cancel}
        maxWidth="sm"
        mobileFullScreen
      >
        <InlineFeedback severity="warning">
          {text(
            'cancelWarning',
            'A cancellation request may already be in flight at the provider.'
          )}
        </InlineFeedback>
      </FormDialog>
      <ApprovalHighRiskCommandDialog controller={controller.high} />
    </Box>
  );
}
