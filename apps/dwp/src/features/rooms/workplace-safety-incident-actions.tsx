import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, MessageSquareText, RefreshCw, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  applyWorkplaceSafetyScopeRevision,
  confirmWorkplaceSafetyAssembly,
  createWorkplaceIdempotencyKey,
  getAdminWorkplaceSafetyCommand,
  getAdminWorkplaceSafetyMessages,
  getWorkplaceSafetyScopeRevisionPreview,
  previewWorkplaceSafetyScopeRevision,
  resendWorkplaceSafetyDispatch,
  resolveIdempotentMutationIntent,
  sendAdminWorkplaceSafetyMessage,
} from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WorkplaceSafetyActionSection } from './workplace-safety-action-section';
import { WorkplaceSafetyClosureReport } from './workplace-safety-closure-report';
import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  WorkplaceSafetyAudienceEvidence,
  WorkplaceSafetyReceiptEvidence,
} from './workplace-safety-evidence';
import {
  workplaceSafetyCanResend,
  workplaceSafetyNeedsGetOnlyRecovery,
} from './workplace-safety-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceSafetyCommandReceipt,
  WorkplaceSafetyIncident,
  WorkplaceSafetyScopeRevisionPreview,
} from '@dwp-frontend/shared-utils';

function split(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function WorkplaceSafetyIncidentActions({
  incident,
  canManage,
  canExport,
  decisionRevision,
  onChanged,
}: {
  incident: WorkplaceSafetyIncident;
  canManage: boolean;
  canExport: boolean;
  decisionRevision: string;
  onChanged: () => void | Promise<void>;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const [lastReceipt, setLastReceipt] = useState<WorkplaceSafetyCommandReceipt | null>(null);
  const [scopePreviewRecovery, setScopePreviewRecovery] = useState(false);
  const [childRecovery, setChildRecovery] = useState(false);
  const [scopeFloorIds, setScopeFloorIds] = useState(incident.floorIds.join(','));
  const [scopeZoneIds, setScopeZoneIds] = useState(incident.zoneIds.join(','));
  const [scopeMessage, setScopeMessage] = useState(incident.message);
  const [scopeReason, setScopeReason] = useState('Revise the verified incident scope');
  const [scopeConfirmed, setScopeConfirmed] = useState(false);
  const [scopePreview, setScopePreview] = useState<WorkplaceSafetyScopeRevisionPreview | null>(
    null
  );
  const [resendReason, setResendReason] = useState('Retry verified failed safety deliveries');
  const [resendConfirmed, setResendConfirmed] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [message, setMessage] = useState('');
  const [messageReason, setMessageReason] = useState('Send a masked safety operations message');
  const [messageConfirmed, setMessageConfirmed] = useState(false);
  const [assemblySubject, setAssemblySubject] = useState(
    incident.audience.members.find((member) => member.included)?.subjectKeySha256 ?? ''
  );
  const [assemblyEvidence, setAssemblyEvidence] = useState('assembly-observation-screen-20');
  const [assemblyReason, setAssemblyReason] = useState('Record verified assembly attendance');
  const [assemblyConfirmed, setAssemblyConfirmed] = useState(false);

  const messagesQuery = useQuery({
    queryKey: ['workplace', 'safety', 'admin', incident.incidentId, 'messages'],
    queryFn: () => getAdminWorkplaceSafetyMessages(incident.incidentId),
    retry: false,
  });
  const ownRecovery = workplaceSafetyNeedsGetOnlyRecovery(incident, lastReceipt);
  const getOnlyRecovery = ownRecovery || childRecovery;
  const commandOptions = (key: string) => ({
    idempotencyKey: key,
    correlationId: crypto.randomUUID(),
    activeAccessMode: 'ELEVATED' as const,
  });
  const commandIntent = (kind: string, fingerprint: unknown) => {
    const next = resolveIdempotentMutationIntent(intentRef.current, fingerprint, () =>
      createWorkplaceIdempotencyKey(`safety-${kind}`)
    );
    intentRef.current = next;
    return next;
  };
  const complete = async (receipt: WorkplaceSafetyCommandReceipt) => {
    intentRef.current = null;
    setLastReceipt(receipt);
    setScopePreviewRecovery(false);
    await onChanged();
  };

  const scopePreviewMutation = useMutation({
    mutationFn: () => {
      if (
        !canManage ||
        getOnlyRecovery ||
        !scopeConfirmed ||
        !scopeReason.trim() ||
        !scopeMessage.trim() ||
        !split(scopeFloorIds).length
      ) {
        throw new Error('SAFETY_SCOPE_PREVIEW_BLOCKED');
      }
      const input = {
        expectedIncidentVersion: incident.version,
        floorIds: split(scopeFloorIds),
        zoneIds: split(scopeZoneIds),
        message: scopeMessage.trim(),
        excludedSubjectKeys: [],
        reason: scopeReason.trim(),
        explicitConfirmation: true as const,
      };
      const next = commandIntent('scope-preview', input);
      return previewWorkplaceSafetyScopeRevision(
        incident.incidentId,
        input,
        commandOptions(next.key)
      );
    },
    retry: false,
    onSuccess: (result) => {
      intentRef.current = null;
      setScopePreview(result.preview);
      setLastReceipt(result.receipt);
      setScopePreviewRecovery(true);
      setScopeConfirmed(false);
    },
  });
  const scopeApplyMutation = useMutation({
    mutationFn: () => {
      if (
        !scopePreview ||
        !canManage ||
        getOnlyRecovery ||
        !scopeConfirmed ||
        !scopeReason.trim()
      ) {
        throw new Error('SAFETY_SCOPE_BLOCKED');
      }
      const input = {
        scopeRevisionId: scopePreview.scopeRevisionId,
        expectedIncidentVersion: incident.version,
        reason: scopeReason.trim(),
        explicitConfirmation: true as const,
      };
      const next = commandIntent('scope', input);
      return applyWorkplaceSafetyScopeRevision(
        incident.incidentId,
        input,
        commandOptions(next.key)
      );
    },
    retry: false,
    onSuccess: async (result) => {
      setScopeConfirmed(false);
      setScopePreview(null);
      await complete(result.receipt);
    },
  });
  const resendMutation = useMutation({
    mutationFn: () => {
      if (
        !canManage ||
        getOnlyRecovery ||
        !workplaceSafetyCanResend(incident) ||
        !resendConfirmed ||
        !resendReason.trim()
      ) {
        throw new Error('SAFETY_RESEND_BLOCKED');
      }
      const input = {
        expectedIncidentVersion: incident.version,
        channels: incident.channels,
        retryStates: ['DELIVERY_FAILED', 'OFFLINE_QUEUED'] as const,
        reason: resendReason.trim(),
        explicitConfirmation: true as const,
      };
      const next = commandIntent('resend', input);
      return resendWorkplaceSafetyDispatch(incident.incidentId, input, commandOptions(next.key));
    },
    retry: false,
    onSuccess: async (result) => {
      setResendConfirmed(false);
      await complete(result.receipt);
    },
  });
  const messageMutation = useMutation({
    mutationFn: () => {
      if (
        !canManage ||
        getOnlyRecovery ||
        !message.trim() ||
        !messageReason.trim() ||
        !messageConfirmed
      ) {
        throw new Error('SAFETY_MESSAGE_BLOCKED');
      }
      const input = {
        expectedIncidentVersion: incident.version,
        targetUserId: targetUserId.trim() ? Number(targetUserId) : null,
        body: message.trim(),
        reason: messageReason.trim(),
        explicitConfirmation: true as const,
      };
      const next = commandIntent('admin-message', input);
      return sendAdminWorkplaceSafetyMessage(incident.incidentId, input, commandOptions(next.key));
    },
    retry: false,
    onSuccess: async (result) => {
      setMessage('');
      setMessageConfirmed(false);
      intentRef.current = null;
      setLastReceipt(result.receipt);
      setScopePreviewRecovery(false);
      await messagesQuery.refetch();
    },
  });
  const assemblyMutation = useMutation({
    mutationFn: () => {
      const member = incident.audience.members.find(
        (candidate) => candidate.subjectKeySha256 === assemblySubject && candidate.included
      );
      if (
        !member ||
        !canManage ||
        getOnlyRecovery ||
        !assemblyConfirmed ||
        !assemblyEvidence.trim() ||
        !assemblyReason.trim()
      ) {
        throw new Error('SAFETY_ASSEMBLY_BLOCKED');
      }
      const input = {
        expectedIncidentVersion: incident.version,
        subjectKeySha256: member.subjectKeySha256,
        subjectUserId: member.subjectUserId,
        confirmed: true,
        observedAt: new Date().toISOString(),
        evidenceReference: assemblyEvidence.trim(),
        expectedAssemblyVersion: 0,
        reason: assemblyReason.trim(),
        explicitConfirmation: true as const,
      };
      const next = commandIntent('assembly', input);
      return confirmWorkplaceSafetyAssembly(incident.incidentId, input, commandOptions(next.key));
    },
    retry: false,
    onSuccess: async (result) => {
      setAssemblyConfirmed(false);
      await complete(result.receipt);
    },
  });

  const recheck = async () => {
    if (lastReceipt?.state === 'RESULT_UNKNOWN' && scopePreviewRecovery && scopePreview) {
      setScopePreview(
        await getWorkplaceSafetyScopeRevisionPreview(
          incident.incidentId,
          scopePreview.scopeRevisionId
        )
      );
      setLastReceipt(null);
      setScopePreviewRecovery(false);
    } else if (lastReceipt) {
      setLastReceipt(
        await getAdminWorkplaceSafetyCommand(incident.incidentId, lastReceipt.commandId)
      );
    }
    await onChanged();
  };
  const onChildRecoveryChange = useCallback((blocked: boolean) => setChildRecovery(blocked), []);
  const operationError =
    scopePreviewMutation.isError ||
    scopeApplyMutation.isError ||
    resendMutation.isError ||
    messageMutation.isError ||
    assemblyMutation.isError;

  return (
    <Stack spacing={1.25} data-testid="safety-incident-actions">
      {ownRecovery && (
        <InlineFeedback severity="warning" icon={<AlertTriangle size={18} />}>
          {t('workplace.safety.recovery.getOnly')}
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<RefreshCw size={15} />}
            onClick={() => void recheck()}
          >
            {t('workplace.safety.actions.recheck')}
          </ActionButton>
        </InlineFeedback>
      )}
      {!canManage && (
        <InlineFeedback severity="info">{t('workplace.safety.admin.readOnly')}</InlineFeedback>
      )}
      {operationError && (
        <InlineFeedback severity="error">{t('workplace.safety.admin.commandError')}</InlineFeedback>
      )}
      {lastReceipt && <WorkplaceSafetyReceiptEvidence receipt={lastReceipt} />}

      <WorkplaceSafetyActionSection
        title={t('workplace.safety.scope.title')}
        description={t('workplace.safety.scope.description')}
      >
        <Stack spacing={1.25}>
          <FormField
            label={t('workplace.safety.fields.floorIds')}
            value={scopeFloorIds}
            onChange={(event) => setScopeFloorIds(event.target.value)}
          />
          <FormField
            label={t('workplace.safety.fields.zoneIds')}
            value={scopeZoneIds}
            onChange={(event) => setScopeZoneIds(event.target.value)}
          />
          <FormField
            label={t('workplace.safety.fields.message')}
            value={scopeMessage}
            onChange={(event) => setScopeMessage(event.target.value)}
          />
          <FormField
            label={t('workplace.safety.fields.reason')}
            value={scopeReason}
            onChange={(event) => setScopeReason(event.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={scopeConfirmed}
                onChange={(event) => setScopeConfirmed(event.target.checked)}
              />
            }
            label={
              scopePreview
                ? t('workplace.safety.confirmation')
                : t('workplace.safety.scope.previewConfirmation')
            }
          />
          {!scopePreview ? (
            <ActionButton
              intent="secondary"
              disabled={
                !canManage ||
                getOnlyRecovery ||
                !scopeMessage.trim() ||
                !split(scopeFloorIds).length ||
                !scopeConfirmed ||
                !scopeReason.trim()
              }
              loading={scopePreviewMutation.isPending}
              onClick={() => scopePreviewMutation.mutate()}
            >
              {t('workplace.safety.actions.previewScope')}
            </ActionButton>
          ) : (
            <>
              <InlineFeedback severity={scopePreview.audience.unknownCount ? 'warning' : 'info'}>
                {t('workplace.safety.scope.impact', {
                  added: scopePreview.newlyIncluded,
                  removed: scopePreview.noLongerIncluded,
                })}
              </InlineFeedback>
              <WorkplaceSafetyAudienceEvidence audience={scopePreview.audience} />
              <ActionButton
                intent="primary"
                disabled={!canManage || getOnlyRecovery || !scopeConfirmed || !scopeReason.trim()}
                loading={scopeApplyMutation.isPending}
                onClick={() => scopeApplyMutation.mutate()}
              >
                {t('workplace.safety.actions.applyScope')}
              </ActionButton>
            </>
          )}
        </Stack>
      </WorkplaceSafetyActionSection>

      <WorkplaceSafetyActionSection
        title={t('workplace.safety.dispatch.title')}
        description={t('workplace.safety.dispatch.description')}
      >
        <Stack spacing={1.25}>
          {incident.dispatches.map((dispatch) => (
            <Box
              key={dispatch.dispatchBatchId}
              sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
            >
              <Typography fontWeight="fontWeightBold">
                {t(`workplace.safety.dispatchStates.${dispatch.state}`)}
              </Typography>
              <Typography variant="body2">
                {t('workplace.safety.dispatch.counts', {
                  delivered: dispatch.deliveredCount,
                  failed: dispatch.failedCount,
                  unknown: dispatch.unknownCount,
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(dispatch.updatedAt, { dateStyle: 'short', timeStyle: 'short' }, locale)}
              </Typography>
            </Box>
          ))}
          <FormField
            label={t('workplace.safety.fields.reason')}
            value={resendReason}
            onChange={(event) => setResendReason(event.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={resendConfirmed}
                onChange={(event) => setResendConfirmed(event.target.checked)}
              />
            }
            label={t('workplace.safety.dispatch.retryConfirmation')}
          />
          <ActionButton
            intent="secondary"
            startIcon={<Send size={16} />}
            disabled={
              !canManage ||
              !workplaceSafetyCanResend(incident) ||
              getOnlyRecovery ||
              !resendConfirmed ||
              !resendReason.trim()
            }
            loading={resendMutation.isPending}
            onClick={() => resendMutation.mutate()}
          >
            {t('workplace.safety.actions.resendFailed')}
          </ActionButton>
        </Stack>
      </WorkplaceSafetyActionSection>

      <WorkplaceSafetyActionSection
        title={t('workplace.safety.assembly.title')}
        description={t('workplace.safety.assembly.description')}
      >
        <Stack spacing={1.25}>
          <SelectField
            label={t('workplace.safety.assembly.member')}
            value={assemblySubject}
            options={incident.audience.members
              .filter((member) => member.included && !member.unknownIdentity)
              .map((member) => ({
                value: member.subjectKeySha256,
                label: member.maskedLabel,
              }))}
            onValueChange={(value) => setAssemblySubject(value)}
          />
          <FormField
            label={t('workplace.safety.assembly.evidence')}
            value={assemblyEvidence}
            onChange={(event) => setAssemblyEvidence(event.target.value)}
          />
          <FormField
            label={t('workplace.safety.fields.reason')}
            value={assemblyReason}
            onChange={(event) => setAssemblyReason(event.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={assemblyConfirmed}
                onChange={(event) => setAssemblyConfirmed(event.target.checked)}
              />
            }
            label={t('workplace.safety.assembly.confirmation')}
          />
          <ActionButton
            intent="primary"
            disabled={
              !canManage ||
              getOnlyRecovery ||
              !assemblySubject ||
              !assemblyEvidence.trim() ||
              !assemblyReason.trim() ||
              !assemblyConfirmed
            }
            loading={assemblyMutation.isPending}
            onClick={() => assemblyMutation.mutate()}
          >
            {t('workplace.safety.actions.confirmAssembly')}
          </ActionButton>
        </Stack>
      </WorkplaceSafetyActionSection>

      <WorkplaceSafetyActionSection
        title={t('workplace.safety.messages.title')}
        description={t('workplace.safety.messages.maskingNotice')}
      >
        <Stack spacing={1.25}>
          {(messagesQuery.data ?? []).map((item) => (
            <Box
              key={item.messageId}
              sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
            >
              <Typography variant="caption" color="text.secondary">
                {t(`workplace.safety.messageDirections.${item.direction}`)}
              </Typography>
              <Typography sx={{ overflowWrap: 'anywhere' }}>{item.maskedBody}</Typography>
            </Box>
          ))}
          <FormField
            label={t('workplace.safety.messages.targetUser')}
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
          />
          <FormField
            label={t('workplace.safety.messages.body')}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <FormField
            label={t('workplace.safety.fields.reason')}
            value={messageReason}
            onChange={(event) => setMessageReason(event.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={messageConfirmed}
                onChange={(event) => setMessageConfirmed(event.target.checked)}
              />
            }
            label={t('workplace.safety.confirmation')}
          />
          <ActionButton
            intent="secondary"
            startIcon={<MessageSquareText size={16} />}
            disabled={
              !canManage ||
              getOnlyRecovery ||
              !message.trim() ||
              !messageReason.trim() ||
              !messageConfirmed
            }
            loading={messageMutation.isPending}
            onClick={() => messageMutation.mutate()}
          >
            {t('workplace.safety.actions.sendMessage')}
          </ActionButton>
        </Stack>
      </WorkplaceSafetyActionSection>

      <WorkplaceSafetyClosureReport
        incident={incident}
        canManage={canManage}
        canExport={canExport}
        decisionRevision={decisionRevision}
        externalRecovery={ownRecovery}
        onRecoveryChange={onChildRecoveryChange}
        onChanged={onChanged}
      />
    </Stack>
  );
}
