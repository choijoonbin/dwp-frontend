import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  approveWorkplaceSafetyClosure,
  createWorkplaceIdempotencyKey,
  createWorkplaceSafetyExport,
  downloadWorkplaceSafetyExport,
  getAdminWorkplaceSafetyCommand,
  getWorkplaceSafetyClosurePreview,
  getWorkplaceSafetyReport,
  previewWorkplaceSafetyClosure,
  requestWorkplaceSafetyClosure,
  resolveIdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WorkplaceSafetyActionSection } from './workplace-safety-action-section';
import { WorkplaceSafetyReceiptEvidence } from './workplace-safety-evidence';

import type {
  IdempotentMutationIntent,
  WorkplaceSafetyClosureCommandResult,
  WorkplaceSafetyClosurePreview,
  WorkplaceSafetyCommandReceipt,
  WorkplaceSafetyExportCommandResult,
  WorkplaceSafetyIncident,
} from '@dwp-frontend/shared-utils';

function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

export function WorkplaceSafetyClosureReport({
  incident,
  canManage,
  canExport,
  decisionRevision,
  externalRecovery,
  onRecoveryChange,
  onChanged,
}: {
  incident: WorkplaceSafetyIncident;
  canManage: boolean;
  canExport: boolean;
  decisionRevision: string;
  externalRecovery: boolean;
  onRecoveryChange: (blocked: boolean) => void;
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useTranslation('rooms');
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const [lastReceipt, setLastReceipt] = useState<WorkplaceSafetyCommandReceipt | null>(null);
  const [previewRecovery, setPreviewRecovery] = useState(false);
  const [closurePreview, setClosurePreview] = useState<WorkplaceSafetyClosurePreview | null>(null);
  const [closureResult, setClosureResult] = useState<WorkplaceSafetyClosureCommandResult | null>(
    null
  );
  const [approverId, setApproverId] = useState('');
  const [closureReason, setClosureReason] = useState('The verified safety response is complete');
  const [followUp, setFollowUp] = useState('Complete follow-up actions and post-incident review');
  const [closureAuditReason, setClosureAuditReason] = useState(
    'Request two-person incident closure'
  );
  const [closureConfirmed, setClosureConfirmed] = useState(false);
  const [approvalReason, setApprovalReason] = useState('Independently reviewed closure evidence');
  const [approvalAuditReason, setApprovalAuditReason] = useState('Decide the closure request');
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'CSV'>('PDF');
  const [exportPurpose, setExportPurpose] = useState('Post-incident operational review');
  const [exportReason, setExportReason] = useState('Export the governed incident report');
  const [exportConfirmed, setExportConfirmed] = useState(false);
  const [exportResult, setExportResult] = useState<WorkplaceSafetyExportCommandResult | null>(null);
  const internalRecovery = lastReceipt?.state === 'RESULT_UNKNOWN';
  const getOnlyRecovery = externalRecovery || internalRecovery;

  useEffect(() => onRecoveryChange(internalRecovery), [internalRecovery, onRecoveryChange]);

  const reportQuery = useQuery({
    queryKey: ['workplace', 'safety', 'admin', incident.incidentId, 'report'],
    queryFn: () => getWorkplaceSafetyReport(incident.incidentId),
    enabled: incident.state === 'CLOSED',
    retry: false,
  });
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
    setPreviewRecovery(false);
    await onChanged();
  };

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!canManage || getOnlyRecovery || !closureConfirmed || !closureAuditReason.trim()) {
        throw new Error('SAFETY_CLOSURE_PREVIEW_BLOCKED');
      }
      const input = {
        expectedIncidentVersion: incident.version,
        reason: closureAuditReason.trim(),
        explicitConfirmation: true as const,
      };
      const next = commandIntent('closure-preview', input);
      return previewWorkplaceSafetyClosure(incident.incidentId, input, commandOptions(next.key));
    },
    retry: false,
    onSuccess: (result) => {
      intentRef.current = null;
      setClosurePreview(result.preview);
      setLastReceipt(result.receipt);
      setPreviewRecovery(true);
      setClosureConfirmed(false);
    },
  });
  const requestMutation = useMutation({
    mutationFn: () => {
      if (
        !closurePreview ||
        !canManage ||
        getOnlyRecovery ||
        !closureConfirmed ||
        !closurePreview.eligible ||
        Number(approverId) < 1 ||
        !closureReason.trim() ||
        !followUp.trim()
      ) {
        throw new Error('SAFETY_CLOSURE_BLOCKED');
      }
      const input = {
        closurePreviewId: closurePreview.closurePreviewId,
        expectedIncidentVersion: incident.version,
        designatedApproverId: Number(approverId),
        closureReason: closureReason.trim(),
        followUpActions: followUp.trim(),
        reason: closureAuditReason.trim(),
        explicitConfirmation: true as const,
      };
      const next = commandIntent('closure-request', input);
      return requestWorkplaceSafetyClosure(incident.incidentId, input, commandOptions(next.key));
    },
    retry: false,
    onSuccess: async (result) => {
      setClosureResult(result);
      setClosureConfirmed(false);
      await complete(result.receipt);
    },
  });
  const approvalMutation = useMutation({
    mutationFn: (approved: boolean) => {
      if (
        !closureResult ||
        !canManage ||
        getOnlyRecovery ||
        !approvalConfirmed ||
        !approvalReason.trim() ||
        !approvalAuditReason.trim()
      ) {
        throw new Error('SAFETY_APPROVAL_BLOCKED');
      }
      const input = {
        expectedIncidentVersion: incident.version,
        expectedClosureVersion: closureResult.closure.version,
        approved,
        approvalReason: approvalReason.trim(),
        reason: approvalAuditReason.trim(),
        explicitConfirmation: true as const,
      };
      const next = commandIntent('closure-approval', input);
      return approveWorkplaceSafetyClosure(
        incident.incidentId,
        closureResult.closure.closureRequestId,
        input,
        commandOptions(next.key)
      );
    },
    retry: false,
    onSuccess: async (result) => {
      setApprovalConfirmed(false);
      await complete(result.receipt);
    },
  });
  const exportMutation = useMutation({
    mutationFn: () => {
      if (
        !canExport ||
        getOnlyRecovery ||
        !exportConfirmed ||
        !exportPurpose.trim() ||
        !exportReason.trim()
      ) {
        throw new Error('SAFETY_EXPORT_BLOCKED');
      }
      const input = {
        expectedIncidentVersion: incident.version,
        format: exportFormat,
        purpose: exportPurpose.trim(),
        reason: exportReason.trim(),
        explicitConfirmation: true as const,
      };
      const next = commandIntent('export', input);
      return createWorkplaceSafetyExport(incident.incidentId, input, {
        ...commandOptions(next.key),
        decisionRevision,
      });
    },
    retry: false,
    onSuccess: (result) => {
      intentRef.current = null;
      setExportResult(result);
      setLastReceipt(result.receipt);
      setPreviewRecovery(false);
      setExportConfirmed(false);
    },
  });
  const downloadMutation = useMutation({
    mutationFn: async () => {
      if (!exportResult || !canExport || exportResult.receipt.state === 'RESULT_UNKNOWN') {
        throw new Error('SAFETY_DOWNLOAD_BLOCKED');
      }
      const blob = await downloadWorkplaceSafetyExport(
        exportResult.export.exportId,
        crypto.randomUUID()
      );
      saveBlob(
        blob,
        `safety-${incident.incidentNumber}.${exportResult.export.format.toLowerCase()}`
      );
    },
    retry: false,
  });

  const recheck = async () => {
    if (!lastReceipt) return;
    if (previewRecovery && closurePreview) {
      setClosurePreview(
        await getWorkplaceSafetyClosurePreview(incident.incidentId, closurePreview.closurePreviewId)
      );
      setLastReceipt(null);
      setPreviewRecovery(false);
    } else {
      setLastReceipt(
        await getAdminWorkplaceSafetyCommand(incident.incidentId, lastReceipt.commandId)
      );
    }
    await onChanged();
  };
  const operationError =
    previewMutation.isError ||
    requestMutation.isError ||
    approvalMutation.isError ||
    exportMutation.isError ||
    downloadMutation.isError;

  return (
    <>
      {internalRecovery && (
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
      {operationError && (
        <InlineFeedback severity="error">{t('workplace.safety.admin.commandError')}</InlineFeedback>
      )}
      {lastReceipt && <WorkplaceSafetyReceiptEvidence receipt={lastReceipt} />}

      <WorkplaceSafetyActionSection
        title={t('workplace.safety.closure.title')}
        description={t('workplace.safety.closure.description')}
      >
        <Stack spacing={1.25}>
          {!closurePreview ? (
            <>
              <FormField
                label={t('workplace.safety.fields.reason')}
                value={closureAuditReason}
                onChange={(event) => setClosureAuditReason(event.target.value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={closureConfirmed}
                    onChange={(event) => setClosureConfirmed(event.target.checked)}
                  />
                }
                label={t('workplace.safety.closure.previewConfirmation')}
              />
              <ActionButton
                intent="secondary"
                disabled={
                  !canManage ||
                  getOnlyRecovery ||
                  incident.state !== 'ACTIVE' ||
                  !closureConfirmed ||
                  !closureAuditReason.trim()
                }
                loading={previewMutation.isPending}
                onClick={() => previewMutation.mutate()}
              >
                {t('workplace.safety.actions.previewClosure')}
              </ActionButton>
            </>
          ) : !closureResult ? (
            <>
              <InlineFeedback severity={closurePreview.eligible ? 'info' : 'warning'}>
                {t('workplace.safety.closure.impact', {
                  help: closurePreview.needsHelpCount,
                  noResponse: closurePreview.noResponseCount,
                  failed: closurePreview.failedOrUnknownCount,
                })}
                {closurePreview.warnings.length ? ` · ${closurePreview.warnings.join(' · ')}` : ''}
              </InlineFeedback>
              <FormField
                label={t('workplace.safety.closure.approver')}
                value={approverId}
                onChange={(event) => setApproverId(event.target.value)}
              />
              <FormField
                label={t('workplace.safety.closure.reason')}
                value={closureReason}
                onChange={(event) => setClosureReason(event.target.value)}
              />
              <FormField
                label={t('workplace.safety.closure.followUp')}
                value={followUp}
                onChange={(event) => setFollowUp(event.target.value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={closureConfirmed}
                    onChange={(event) => setClosureConfirmed(event.target.checked)}
                  />
                }
                label={t('workplace.safety.closure.requestConfirmation')}
              />
              <ActionButton
                intent="danger"
                disabled={
                  !canManage ||
                  getOnlyRecovery ||
                  !closurePreview.eligible ||
                  !closureConfirmed ||
                  Number(approverId) < 1 ||
                  !closureReason.trim() ||
                  !followUp.trim()
                }
                loading={requestMutation.isPending}
                onClick={() => requestMutation.mutate()}
              >
                {t('workplace.safety.actions.requestClosure')}
              </ActionButton>
            </>
          ) : (
            <>
              <InlineFeedback severity="warning" icon={<ShieldCheck size={18} />}>
                {t('workplace.safety.closure.twoPerson', {
                  requester: closureResult.closure.requestedBy,
                  approver: closureResult.closure.designatedApproverId,
                })}
              </InlineFeedback>
              <FormField
                label={t('workplace.safety.closure.approvalReason')}
                value={approvalReason}
                onChange={(event) => setApprovalReason(event.target.value)}
              />
              <FormField
                label={t('workplace.safety.fields.reason')}
                value={approvalAuditReason}
                onChange={(event) => setApprovalAuditReason(event.target.value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={approvalConfirmed}
                    onChange={(event) => setApprovalConfirmed(event.target.checked)}
                  />
                }
                label={t('workplace.safety.closure.approvalConfirmation')}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <ActionButton
                  intent="secondary"
                  disabled={!canManage || getOnlyRecovery || !approvalConfirmed}
                  loading={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate(false)}
                >
                  {t('workplace.safety.actions.rejectClosure')}
                </ActionButton>
                <ActionButton
                  intent="danger"
                  disabled={!canManage || getOnlyRecovery || !approvalConfirmed}
                  loading={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate(true)}
                >
                  {t('workplace.safety.actions.approveClosure')}
                </ActionButton>
              </Stack>
            </>
          )}
        </Stack>
      </WorkplaceSafetyActionSection>

      <WorkplaceSafetyActionSection
        title={t('workplace.safety.report.title')}
        description={t('workplace.safety.report.description')}
      >
        <Stack spacing={1.25}>
          {incident.state === 'CLOSED' && reportQuery.data && (
            <Box
              component="dl"
              sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 1 }}
            >
              {Object.entries(reportQuery.data.summary).map(([key, value]) => (
                <Box key={key} sx={{ display: 'contents' }}>
                  <Typography component="dt" variant="caption" color="text.secondary">
                    {key}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, overflowWrap: 'anywhere' }}
                  >
                    {String(value)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          <SelectField
            label={t('workplace.safety.report.format')}
            value={exportFormat}
            options={(['PDF', 'CSV'] as const).map((value) => ({
              value,
              label: t(`workplace.safety.report.formats.${value}`),
            }))}
            onValueChange={(value) => value && setExportFormat(value)}
          />
          <FormField
            label={t('workplace.safety.report.purpose')}
            value={exportPurpose}
            onChange={(event) => setExportPurpose(event.target.value)}
          />
          <FormField
            label={t('workplace.safety.fields.reason')}
            value={exportReason}
            onChange={(event) => setExportReason(event.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={exportConfirmed}
                onChange={(event) => setExportConfirmed(event.target.checked)}
              />
            }
            label={t('workplace.safety.report.confirmation')}
          />
          {!canExport && (
            <InlineFeedback severity="warning">
              {t('workplace.safety.report.permissionRequired')}
            </InlineFeedback>
          )}
          <ActionButton
            intent="secondary"
            startIcon={<Download size={16} />}
            disabled={
              !canExport ||
              getOnlyRecovery ||
              incident.state !== 'CLOSED' ||
              !exportConfirmed ||
              !exportPurpose.trim() ||
              !exportReason.trim()
            }
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            {t('workplace.safety.actions.createExport')}
          </ActionButton>
          {exportResult && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {t('workplace.safety.report.evidence', {
                  sha: exportResult.export.sha256,
                  size: exportResult.export.sizeBytes,
                })}
              </Typography>
              <ActionButton
                intent="primary"
                startIcon={<Download size={16} />}
                disabled={exportResult.receipt.state === 'RESULT_UNKNOWN'}
                loading={downloadMutation.isPending}
                onClick={() => downloadMutation.mutate()}
              >
                {t('workplace.safety.actions.downloadExport')}
              </ActionButton>
            </>
          )}
        </Stack>
      </WorkplaceSafetyActionSection>
    </>
  );
}
