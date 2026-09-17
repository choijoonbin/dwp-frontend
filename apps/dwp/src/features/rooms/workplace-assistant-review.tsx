import { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { useTranslation } from 'react-i18next';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { useWorkplaceAssistantCopy } from './workplace-assistant-copy';
import {
  workplaceAssistantActions,
  workplaceAssistantExecutionCounts,
  workplaceAssistantRequestTone,
} from './workplace-assistant-ui-model';

import type {
  WorkplaceAssistantCommandReceipt,
  WorkplaceAssistantConfirmInput,
  WorkplaceAssistantExecution,
  WorkplaceAssistantFeedbackInput,
  WorkplaceAssistantFeedbackReceipt,
  WorkplaceAssistantRequest,
  WorkplaceAssistantValidateInput,
} from '@dwp-frontend/shared-utils/api/workplace-assistant-contract';

function TextEvidence({ title, values }: { title: string; values: readonly string[] }) {
  if (!values.length) return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        {values.join(' · ')}
      </Typography>
    </Box>
  );
}

export function WorkplaceAssistantReview({
  request,
  execution,
  selectedIds,
  canUpdate,
  online,
  loading,
  lastReceipt,
  feedbackReceipt,
  onSelectionChange,
  onValidate,
  onConfirm,
  onFeedback,
  onRecheck,
  onRefresh,
}: {
  request: WorkplaceAssistantRequest;
  execution: WorkplaceAssistantExecution | null;
  selectedIds: ReadonlySet<string>;
  canUpdate: boolean;
  online: boolean;
  loading: boolean;
  lastReceipt: WorkplaceAssistantCommandReceipt | null;
  feedbackReceipt: WorkplaceAssistantFeedbackReceipt | null;
  onSelectionChange: (next: ReadonlySet<string>) => void;
  onValidate: (input: WorkplaceAssistantValidateInput) => void;
  onConfirm: (input: WorkplaceAssistantConfirmInput) => void;
  onFeedback: (input: WorkplaceAssistantFeedbackInput) => void;
  onRecheck: () => void;
  onRefresh: () => void;
}) {
  const copy = useWorkplaceAssistantCopy();
  const { i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const [validationReason, setValidationReason] = useState('');
  const [holdTtl, setHoldTtl] = useState('120');
  const [allowAlternatives, setAllowAlternatives] = useState(true);
  const [confirmReason, setConfirmReason] = useState('');
  const [failurePolicy, setFailurePolicy] = useState<'KEEP_SUCCEEDED' | 'COMPENSATE_ALL'>(
    'KEEP_SUCCEEDED'
  );
  const [confirmed, setConfirmed] = useState(false);
  const [rating, setRating] = useState<'HELPFUL' | 'NOT_HELPFUL'>('HELPFUL');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackReason, setFeedbackReason] = useState('');
  const [feedbackImprove, setFeedbackImprove] = useState(false);
  const [feedbackConfirmed, setFeedbackConfirmed] = useState(false);
  const actions = workplaceAssistantActions({
    request,
    canUpdate,
    online,
    selectedCount: selectedIds.size,
    receipt: lastReceipt,
    feedbackReceipt,
  });
  const counts = useMemo(
    () =>
      execution
        ? workplaceAssistantExecutionCounts(
            request,
            execution.authoritativeBatch.items.map((item) => item.state)
          )
        : null,
    [execution, request]
  );
  const receiptEvidence = lastReceipt
    ? [
        copy.text(copy.receipt, { state: lastReceipt.state, id: lastReceipt.commandId }),
        lastReceipt.resultCode
          ? copy.text(copy.receiptResult, {
              code: lastReceipt.resultCode,
              date: lastReceipt.completedAt
                ? formatDate(
                    lastReceipt.completedAt,
                    {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    },
                    locale
                  )
                : copy.unknown,
            })
          : null,
        lastReceipt.replayed ? copy.receiptReplayed : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;
  const toggle = (proposalItemId: string) => {
    const next = new Set(selectedIds);
    if (next.has(proposalItemId)) next.delete(proposalItemId);
    else next.add(proposalItemId);
    onSelectionChange(next);
  };
  const submitValidation = () =>
    onValidate({
      expectedVersion: request.version,
      selectionMode: 'SELECTED',
      selectedProposalItemIds: [...selectedIds],
      requestedHoldTtlSeconds: Number(holdTtl),
      allowAlternatives,
      reason: validationReason.trim(),
    });
  const submitConfirmation = () =>
    onConfirm({
      expectedVersion: request.version,
      selectionMode: 'SELECTED',
      selectedProposalItemIds: [...selectedIds],
      failurePolicy,
      explicitConfirmation: true,
      reason: confirmReason.trim(),
    });
  const submitFeedback = () =>
    onFeedback({
      expectedVersion: request.version,
      rating,
      comment: feedbackComment.trim() || null,
      allowModelImprovementUse: feedbackImprove,
      explicitConfirmation: true,
      reason: feedbackReason.trim(),
    });

  return (
    <Stack spacing={2} data-testid="workplace-assistant-review">
      {actions.recoverOnly && (
        <InlineFeedback severity="warning">
          {copy.getOnly}
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<RefreshCw size={15} />}
            disabled={!online}
            loading={loading}
            onClick={onRecheck}
          >
            {copy.recheck}
          </ActionButton>
        </InlineFeedback>
      )}
      {!actions.recoverOnly && request.requeryRequired && (
        <InlineFeedback severity="warning">
          {copy.lastResult.replace('{{code}}', request.lastResultCode ?? copy.unknown)}
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<RefreshCw size={15} />}
            disabled={!online}
            loading={loading}
            onClick={onRecheck}
          >
            {copy.recheck}
          </ActionButton>
        </InlineFeedback>
      )}
      <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                {copy.redactedRequest}
              </Typography>
              <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
                {request.redactedRequestText ?? copy.retainedContentDeleted}
              </Typography>
            </Box>
            <Chip
              color={workplaceAssistantRequestTone(request)}
              label={copy.requestStates[request.state]}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {copy.text(copy.retainedUntil, {
              date: formatDate(request.retentionExpiresAt, { dateStyle: 'medium' }, locale),
            })}
          </Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Chip size="small" variant="outlined" label={copy.suggestionBoundary} />
            <Chip size="small" color="info" variant="outlined" label={copy.authorityBoundary} />
            <Chip size="small" variant="outlined" label={request.redactionState} />
          </Stack>
          {request.limitations.map((limitation) => (
            <InlineFeedback key={limitation} severity="info">
              {limitation}
            </InlineFeedback>
          ))}
          {request.redactionState === 'RETAINED_CONTENT_DELETED' && (
            <InlineFeedback severity="info">{copy.retainedContentDeleted}</InlineFeedback>
          )}
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<RefreshCw size={15} />}
            disabled={!actions.canRefresh}
            onClick={onRefresh}
          >
            {copy.refreshRequest}
          </ActionButton>
        </Stack>
      </Box>

      <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
        <Stack spacing={2}>
          <Box>
            <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
              {copy.proposalsTitle}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {copy.proposalsDescription}
            </Typography>
          </Box>
          {request.proposals.map((proposal) => (
            <Box
              key={proposal.proposalItemId}
              sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}
            >
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  gap={1}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedIds.has(proposal.proposalItemId)}
                        disabled={request.state !== 'SUGGESTED'}
                        onChange={() => toggle(proposal.proposalItemId)}
                      />
                    }
                    label={copy.proposalSelected}
                  />
                  <Chip
                    size="small"
                    color={
                      proposal.policyResult === 'ALLOWED'
                        ? 'success'
                        : proposal.policyResult === 'UNVALIDATED'
                          ? 'default'
                          : 'warning'
                    }
                    label={copy.policyResults[proposal.policyResult]}
                  />
                </Stack>
                <Typography fontWeight="fontWeightBold">
                  {proposal.selectedResourceName ??
                    copy.resourceTypes[proposal.requestedItem.resourceType]}
                </Typography>
                <Typography variant="body2">{proposal.rationale}</Typography>
                <TextEvidence title={copy.constraints} values={proposal.constraintsUsed} />
                <TextEvidence title={copy.exclusions} values={proposal.exclusions} />
                <TextEvidence title={copy.conflicts} values={proposal.conflicts} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {copy.alternatives}
                  </Typography>
                  {proposal.alternatives.length ? (
                    proposal.alternatives.map((alternative) => (
                      <Typography key={alternative.resourceId} variant="body2">
                        {alternative.displayName} · {alternative.rationale}
                        {alternative.waitlistEligible ? ` · ${copy.waitlistEligible}` : ''}
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2">{copy.noAlternatives}</Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          ))}

          {request.state === 'SUGGESTED' && (
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 1.5 }}
            >
              <FormField
                label={copy.validateReason}
                value={validationReason}
                inputProps={{ maxLength: 500 }}
                onChange={(event) => setValidationReason(event.target.value)}
              />
              <FormField
                type="number"
                label={copy.holdTtl}
                value={holdTtl}
                inputProps={{ min: 30, max: 300 }}
                onChange={(event) => setHoldTtl(event.target.value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={allowAlternatives}
                    onChange={(event) => setAllowAlternatives(event.target.checked)}
                  />
                }
                label={copy.allowAlternatives}
              />
              <ActionButton
                intent="secondary"
                startIcon={<ShieldCheck size={16} />}
                disabled={
                  !actions.canValidate ||
                  !validationReason.trim() ||
                  Number(holdTtl) < 30 ||
                  Number(holdTtl) > 300
                }
                loading={loading}
                onClick={submitValidation}
              >
                {copy.validate}
              </ActionButton>
            </Box>
          )}

          {request.validation && (
            <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
              <Stack spacing={1}>
                <Typography fontWeight="fontWeightBold">{copy.validationTitle}</Typography>
                <InlineFeedback
                  severity={request.validation.allSelectedItemsValid ? 'success' : 'warning'}
                >
                  {request.validation.allSelectedItemsValid
                    ? copy.validationValid
                    : copy.validationInvalid}
                </InlineFeedback>
                <Typography variant="caption" color="text.secondary">
                  {copy.text(copy.validationTime, {
                    date: formatDate(
                      request.validation.validatedAt,
                      {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      },
                      locale
                    ),
                  })}
                </Typography>
                <TextEvidence title={copy.exclusions} values={request.validation.limitations} />
              </Stack>
            </Box>
          )}

          {(request.state === 'VALIDATED' || request.state === 'AWAITING_CONFIRMATION') && (
            <Stack spacing={1.25}>
              <FormField
                label={copy.confirmReason}
                value={confirmReason}
                inputProps={{ maxLength: 500 }}
                onChange={(event) => setConfirmReason(event.target.value)}
              />
              <SelectField
                label={copy.failurePolicy}
                value={failurePolicy}
                options={[
                  { value: 'KEEP_SUCCEEDED', label: copy.keepSucceeded },
                  { value: 'COMPENSATE_ALL', label: copy.compensateAll },
                ]}
                onValueChange={(value) => value && setFailurePolicy(value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                }
                label={copy.explicitConfirmation}
              />
              <ActionButton
                intent="primary"
                startIcon={<CheckCircle2 size={16} />}
                disabled={!actions.canConfirm || !confirmed || !confirmReason.trim()}
                loading={loading}
                onClick={submitConfirmation}
              >
                {copy.confirm}
              </ActionButton>
            </Stack>
          )}
        </Stack>
      </Box>

      {execution && counts && (
        <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
          <Stack spacing={1.5}>
            <Box>
              <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
                {copy.resultTitle}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {copy.resultDescription}
              </Typography>
            </Box>
            <InlineFeedback severity={execution.state === 'SUCCEEDED' ? 'success' : 'warning'}>
              {copy.text(copy.batchSummary, {
                success: counts.succeeded,
                failed: counts.failed,
                unknown: counts.unknown,
                pending: counts.pending,
              })}
            </InlineFeedback>
            <TableContainer tabIndex={0} aria-label={copy.resultTitle} sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{copy.resourceType}</TableCell>
                    <TableCell>{copy.authority}</TableCell>
                    <TableCell>{copy.requestState}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {execution.authoritativeBatch.items.map((item) => (
                    <TableRow key={item.batchItemId}>
                      <TableCell>{item.resourceDisplayName}</TableCell>
                      <TableCell>{item.authority}</TableCell>
                      <TableCell>
                        <Chip size="small" label={copy.batchStates[item.state]} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Box>
      )}

      {lastReceipt && (
        <InlineFeedback severity={lastReceipt.state === 'FAILED' ? 'error' : 'info'}>
          {receiptEvidence}
        </InlineFeedback>
      )}

      {feedbackReceipt && <InlineFeedback severity="success">{copy.feedbackSaved}</InlineFeedback>}

      {actions.canFeedback && (
        <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
          <Stack spacing={1.25}>
            <Box>
              <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
                {copy.feedbackTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {copy.feedbackDescription}
              </Typography>
            </Box>
            <SelectField
              label={copy.feedbackRating}
              value={rating}
              options={[
                { value: 'HELPFUL', label: copy.helpful },
                { value: 'NOT_HELPFUL', label: copy.notHelpful },
              ]}
              onValueChange={(value) => value && setRating(value)}
            />
            <FormField
              multiline
              minRows={2}
              label={copy.feedbackComment}
              value={feedbackComment}
              inputProps={{ maxLength: 2000 }}
              onChange={(event) => setFeedbackComment(event.target.value)}
            />
            <FormField
              label={copy.reason}
              value={feedbackReason}
              inputProps={{ maxLength: 500 }}
              onChange={(event) => setFeedbackReason(event.target.value)}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={feedbackImprove}
                  disabled={
                    !request.consent.tenantOptIn ||
                    !request.consent.feedbackUseConsent ||
                    !request.consent.feedbackUseEnabled
                  }
                  onChange={(event) => setFeedbackImprove(event.target.checked)}
                />
              }
              label={copy.feedbackImprove}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={feedbackConfirmed}
                  onChange={(event) => setFeedbackConfirmed(event.target.checked)}
                />
              }
              label={copy.feedbackConfirmation}
            />
            <ActionButton
              intent="secondary"
              startIcon={<Send size={16} />}
              disabled={!feedbackConfirmed || !feedbackReason.trim() || !canUpdate || !online}
              loading={loading}
              onClick={submitFeedback}
            >
              {copy.sendFeedback}
            </ActionButton>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
