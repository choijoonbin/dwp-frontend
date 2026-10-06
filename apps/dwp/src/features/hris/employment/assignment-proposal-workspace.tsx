import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  DatePickerField,
  FormDialog,
  FormField,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  cancelAssignmentProposal,
  createAssignmentProposal,
  getAssignmentDetail,
  getAssignmentProposal,
  getAssignmentTimeline,
  submitAssignmentProposal,
  useAuth,
  useToast,
  validateAssignmentProposal,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  ProductSurfaceHighRiskCommandDialog,
  productSurfaceHighRiskCommand,
  useProductSurfaceHighRiskCommand,
} from '../../../components/product-surface-high-risk-command';
import { useProductSurfaceCapabilityAccess } from '../../../components/product-surface-capability-access';
import { useProductSurfaceGovernedMutation } from '../../../components/use-product-surface-governed-mutation';
import type { ProductSurfaceRequestScope } from '../../../components/use-product-surface-request-scope';
import {
  ASSIGNMENT_PROPOSAL_ROUTE_BINDINGS,
  assignmentProposalActionAvailable,
  assignmentProposalAllowedChangeTypes,
  assignmentProposalCanCancel,
  assignmentProposalCanSubmit,
  assignmentProposalCanValidate,
  assignmentProposalChangedField,
  assignmentProposalDateBoundary,
  assignmentProposalDraftIsComplete,
  assignmentProposalFailureKind,
  assignmentProposalHasCompletedValidation,
  buildCreateAssignmentProposalRequest,
  resolveAssignmentProposalSelection,
} from './assignment-proposal-model';

import type {
  AssignmentProposal,
  AssignmentProposalCommandResult,
  AssignmentChangeType,
} from '@dwp-frontend/shared-utils';
import type { AssignmentProposalFailureKind } from './assignment-proposal-model';

type Props = Readonly<{
  proposalReference: string | null;
  requestScope: ProductSurfaceRequestScope;
  onProposalReferenceChange: (proposalReference: string) => void;
  onClose: () => void;
}>;

const CAPABILITIES = {
  create: 'hcm.operations.assignment-proposal.create',
  validate: 'hcm.operations.assignment-proposal.validate',
  submit: 'hcm.operations.assignment-proposal.submit',
  cancel: 'hcm.operations.assignment-proposal.cancel',
} as const;

const MOBILE_TOAST_FOOTER_OFFSET = '128px';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function commandId(): string {
  return crypto.randomUUID();
}

function proposalQueryKey(proposalId: string, requestScope: ProductSurfaceRequestScope) {
  return [
    'hris',
    'employment',
    'assignment-proposal',
    proposalId,
    ...requestScope.cacheKey,
  ] as const;
}

function findingSeverity(value: string): 'error' | 'warning' | 'info' {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'ERROR') return 'error';
  if (normalized === 'WARNING') return 'warning';
  return 'info';
}

function isWorkforceKeyChange(changeType: AssignmentChangeType): boolean {
  return (
    changeType === 'PROMOTION' || changeType === 'DEMOTION' || changeType === 'CHANGE_LOCATION'
  );
}

export function AssignmentProposalWorkspace({
  proposalReference,
  requestScope,
  onProposalReferenceChange,
  onClose,
}: Props) {
  const { t } = useTranslation('workforce');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const capabilityAccess = useProductSurfaceCapabilityAccess();
  const selection = useMemo(
    () => resolveAssignmentProposalSelection(proposalReference),
    [proposalReference]
  );
  const shortMobileViewport = useMediaQuery(
    '(max-width:599.95px) and (max-height:759.95px)',
    { noSsr: true }
  );
  const [changeType, setChangeType] = useState<AssignmentChangeType>('TRANSFER');
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [reasonCode, setReasonCode] = useState('');
  const [changeValue, setChangeValue] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AssignmentProposalFailureKind | null>(null);

  const can = useCallback(
    (capability: string) =>
      assignmentProposalActionAvailable({
        accessMode: requestScope.queryMeta.accessMode,
        governed: capabilityAccess.governed,
        capabilityGranted: capabilityAccess.hasWritableCapability(capability),
        roles: auth.user?.roles ?? [],
      }),
    [auth.user?.roles, capabilityAccess, requestScope.queryMeta.accessMode]
  );

  const createDispatch = useProductSurfaceGovernedMutation(
    ASSIGNMENT_PROPOSAL_ROUTE_BINDINGS.create
  );
  const validateDispatch = useProductSurfaceGovernedMutation(
    ASSIGNMENT_PROPOSAL_ROUTE_BINDINGS.validate
  );
  const cancelDispatch = useProductSurfaceGovernedMutation(
    ASSIGNMENT_PROPOSAL_ROUTE_BINDINGS.cancel
  );

  const assignmentId = selection?.kind === 'create' ? selection.assignmentId : null;
  const proposalId = selection?.kind === 'proposal' ? selection.proposalId : null;
  const assignment = useQuery({
    queryKey: ['hris', 'employment', 'assignment', assignmentId, ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getAssignmentDetail(assignmentId!, requestScope.contextScopeKey, signal),
    enabled: Boolean(assignmentId) && requestScope.ready,
    meta: requestScope.queryMeta,
    retry: false,
  });
  const timeline = useQuery({
    queryKey: [
      'hris',
      'employment',
      'assignment',
      assignmentId,
      'timeline',
      ...requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      getAssignmentTimeline(assignmentId!, requestScope.contextScopeKey, signal),
    enabled: Boolean(assignmentId) && requestScope.ready,
    meta: requestScope.queryMeta,
    retry: false,
  });
  const proposalQuery = useQuery({
    queryKey: proposalQueryKey(proposalId ?? '', requestScope),
    queryFn: ({ signal }) =>
      getAssignmentProposal(proposalId!, requestScope.contextScopeKey, signal),
    enabled: Boolean(proposalId) && requestScope.ready,
    meta: requestScope.queryMeta,
    retry: false,
  });
  const proposal = proposalQuery.data;
  const currentDate = today();
  const allowedChangeTypes = useMemo(
    () => assignmentProposalAllowedChangeTypes(assignment.data, currentDate),
    [assignment.data, currentDate]
  );
  const secureSubmitAvailable =
    requestScope.queryMeta.accessMode !== 'PROVIDER_SUPPORT' &&
    capabilityAccess.governed &&
    capabilityAccess.hasWritableCapability(CAPABILITIES.submit);

  useEffect(() => {
    setFailure(null);
    setCancellationReason('');
    if (selection?.kind !== 'create') return;
    setChangeType('TRANSFER');
    setEffectiveDate(today());
    setReasonCode('');
    setChangeValue('');
  }, [proposalReference, selection?.kind]);

  useEffect(() => {
    if (!selection || !shortMobileViewport) return undefined;
    const property = '--dwp-mobile-fixed-footer-offset';
    const root = document.documentElement;
    const previous = root.style.getPropertyValue(property);
    root.style.setProperty(property, MOBILE_TOAST_FOOTER_OFFSET);
    return () => {
      if (previous) root.style.setProperty(property, previous);
      else root.style.removeProperty(property);
    };
  }, [selection, shortMobileViewport]);

  useEffect(() => {
    if (selection?.kind !== 'create' || !assignment.data) return;
    const nextChangeType = allowedChangeTypes[0] ?? 'CORRECTION';
    const nextBoundary = assignmentProposalDateBoundary(
      nextChangeType,
      assignment.data,
      currentDate
    );
    setChangeType(nextChangeType);
    setEffectiveDate(
      nextChangeType === 'CORRECTION' ? (nextBoundary.maxDate ?? nextBoundary.minDate) : currentDate
    );
    setChangeValue('');
  }, [allowedChangeTypes, assignment.data, currentDate, proposalReference, selection?.kind]);

  const storeProposal = useCallback(
    (result: AssignmentProposalCommandResult) => {
      queryClient.setQueryData(
        proposalQueryKey(result.proposal.proposalId, requestScope),
        result.proposal
      );
      onProposalReferenceChange(result.proposal.proposalId);
      setFailure(null);
      return result.proposal;
    },
    [onProposalReferenceChange, queryClient, requestScope]
  );

  const recoverFromFailure = useCallback(
    async (error: unknown) => {
      const kind = assignmentProposalFailureKind(error);
      setFailure(kind);
      if (kind === 'CONFLICT') {
        if (proposalId) await proposalQuery.refetch();
        else await assignment.refetch();
      }
    },
    [assignment, proposalId, proposalQuery]
  );

  const execute = useCallback(
    async (operation: () => Promise<AssignmentProposalCommandResult>, successKey: string) => {
      setBusy(true);
      setFailure(null);
      try {
        const next = storeProposal(await operation());
        toast.success(t(successKey));
        return next;
      } catch (error) {
        await recoverFromFailure(error);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [recoverFromFailure, storeProposal, t, toast]
  );

  const submit = useProductSurfaceHighRiskCommand({
    operation: 'HCM_ASSIGNMENT_PROPOSAL_SUBMIT',
    execute: async (descriptor, authority) => {
      try {
        return await submitAssignmentProposal(
          descriptor.targetId,
          {
            commandId: String(descriptor.payload.commandId),
            expectedVersion: Number(descriptor.payload.expectedVersion),
          },
          authority
        );
      } catch (error) {
        await recoverFromFailure(error);
        throw error;
      }
    },
    onSuccess: async (result) => {
      storeProposal(result);
      toast.success(t('assignments.proposal.messages.submitted'));
    },
    onConflict: async () => {
      setFailure('CONFLICT');
      await proposalQuery.refetch();
    },
  });

  const draft = { changeType, effectiveDate, reasonCode, changeValue } as const;
  const dateBoundary = assignmentProposalDateBoundary(changeType, assignment.data, today());
  const createDraft = () => {
    if (!assignment.data) return Promise.resolve();
    const request = buildCreateAssignmentProposalRequest(
      assignment.data,
      draft,
      commandId(),
      currentDate
    );
    return execute(
      () => createDispatch((authority) => createAssignmentProposal(request, authority)),
      'assignments.proposal.messages.created'
    );
  };
  const validateDraft = () => {
    if (!proposal) return Promise.resolve();
    const request = { commandId: commandId(), expectedVersion: proposal.version };
    return execute(
      () =>
        validateDispatch((authority) =>
          validateAssignmentProposal(proposal.proposalId, request, authority)
        ),
      'assignments.proposal.messages.validated'
    );
  };
  const submitDraft = async () => {
    if (!proposal) return;
    const nextCommandId = commandId();
    await submit.begin(
      productSurfaceHighRiskCommand({
        operation: 'HCM_ASSIGNMENT_PROPOSAL_SUBMIT',
        commandMethod: 'POST',
        commandPath: `/api/people/v1/workforce/assignment-proposals/${encodeURIComponent(proposal.proposalId)}/submit`,
        targetType: 'ASSIGNMENT_PROPOSAL',
        targetId: proposal.proposalId,
        expectedObjectVersion: proposal.version,
        idempotencyKey: nextCommandId,
        payload: { commandId: nextCommandId, expectedVersion: proposal.version },
      })
    );
  };
  const cancelDraft = () => {
    if (!proposal || !cancellationReason.trim()) return Promise.resolve();
    const request = {
      commandId: commandId(),
      expectedVersion: proposal.version,
      reason: cancellationReason.trim(),
    };
    return execute(
      () =>
        cancelDispatch((authority) =>
          cancelAssignmentProposal(proposal.proposalId, request, authority)
        ),
      'assignments.proposal.messages.cancelled'
    );
  };

  const isCreate = selection?.kind === 'create';
  const canRunPrimary = isCreate
    ? can(CAPABILITIES.create) && assignmentProposalDraftIsComplete(draft)
    : proposal
      ? (assignmentProposalCanValidate(proposal) && can(CAPABILITIES.validate)) ||
        (assignmentProposalCanSubmit(proposal) && secureSubmitAvailable)
      : false;
  const showPrimary = isCreate
    ? can(CAPABILITIES.create)
    : Boolean(
        proposal &&
        ((assignmentProposalCanValidate(proposal) && can(CAPABILITIES.validate)) ||
          (assignmentProposalCanSubmit(proposal) && secureSubmitAvailable))
      );
  const primaryLabel = isCreate
    ? t('assignments.proposal.actions.create')
    : proposal?.lifecycleState === 'DRAFT'
      ? t('assignments.proposal.actions.validate')
      : t('assignments.proposal.actions.submit');
  const runPrimary = async (): Promise<void> => {
    if (isCreate) {
      await createDraft();
    } else if (proposal?.lifecycleState === 'DRAFT') {
      await validateDraft();
    } else {
      await submitDraft();
    }
  };
  const readLoading = isCreate ? assignment.isLoading : proposalQuery.isLoading;
  const readError = isCreate ? assignment.error : proposalQuery.error;

  return (
    <>
      <FormDialog
        open={Boolean(selection)}
        title={t(isCreate ? 'assignments.proposal.createTitle' : 'assignments.proposal.title')}
        description={t('assignments.proposal.description')}
        cancelLabel={t('common.actions.close')}
        submitLabel={primaryLabel}
        submittingLabel={t('assignments.proposal.actions.working')}
        onClose={onClose}
        onSubmit={runPrimary}
        busy={busy || submit.controller.busy}
        submitDisabled={!canRunPrimary || Boolean(readError)}
        showSubmit={showPrimary}
        maxWidth="md"
        desktopMaxWidth={720}
        paperSx={{ bgcolor: 'background.paper' }}
        mobileFullScreen
        secondaryActions={
          proposal && assignmentProposalCanCancel(proposal) && can(CAPABILITIES.cancel) ? (
            <ActionButton
              intent="danger"
              size="small"
              disabled={!cancellationReason.trim() || busy}
              onClick={() => void cancelDraft()}
            >
              {t('assignments.proposal.actions.cancel')}
            </ActionButton>
          ) : undefined
        }
      >
        {readLoading ? (
          <LoadingState label={t('assignments.proposal.loading')} size="compact" />
        ) : readError ? (
          <Alert
            severity={assignmentProposalFailureKind(readError) === 'DENIED' ? 'warning' : 'error'}
            action={
              <ActionButton
                intent="quiet"
                size="small"
                onClick={() => void (isCreate ? assignment.refetch() : proposalQuery.refetch())}
              >
                {t('assignments.proposal.actions.retry')}
              </ActionButton>
            }
          >
            {t(
              assignmentProposalFailureKind(readError) === 'DENIED'
                ? 'assignments.proposal.errors.denied'
                : 'assignments.proposal.errors.unavailable'
            )}
          </Alert>
        ) : (
          <Stack gap={2} divider={<Divider flexItem />}>
            {failure ? (
              <Alert severity={failure === 'CONFLICT' ? 'warning' : 'error'}>
                {t(`assignments.proposal.errors.${failure.toLowerCase()}`)}
              </Alert>
            ) : null}

            {assignment.data ? (
              <Stack gap={1}>
                <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                  <Typography variant="subtitle1" fontWeight={750}>
                    {assignment.data.personDisplayName}
                  </Typography>
                  <Chip size="small" variant="outlined" label={assignment.data.assignmentStatus} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t('assignments.proposal.assignmentVersion', {
                      version: assignment.data.assignmentVersion,
                    })}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {[
                    assignment.data.assignmentKey,
                    assignment.data.businessTitle,
                    assignment.data.organizationName,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Stack>
            ) : null}

            {isCreate ? (
              <Stack gap={2}>
                <SelectField
                  required
                  label={t('assignments.proposal.fields.changeType')}
                  value={changeType}
                  onValueChange={(value) => {
                    const nextChangeType = value as AssignmentChangeType;
                    const nextBoundary = assignmentProposalDateBoundary(
                      nextChangeType,
                      assignment.data,
                      today()
                    );
                    setChangeType(nextChangeType);
                    setEffectiveDate(
                      nextChangeType === 'CORRECTION'
                        ? (nextBoundary.maxDate ?? nextBoundary.minDate)
                        : effectiveDate < nextBoundary.minDate
                          ? nextBoundary.minDate
                          : effectiveDate
                    );
                    setChangeValue('');
                  }}
                  options={allowedChangeTypes.map((value) => ({
                    value,
                    label: t(`assignments.proposal.changeTypes.${value}`),
                  }))}
                />
                <DatePickerField
                  required
                  label={t('assignments.proposal.fields.effectiveDate')}
                  value={effectiveDate}
                  minDate={dateBoundary.minDate}
                  maxDate={dateBoundary.maxDate}
                  onValueChange={(value) => setEffectiveDate(value ?? '')}
                />
                <FormField
                  required
                  label={t('assignments.proposal.fields.reasonCode')}
                  value={reasonCode}
                  inputProps={{ maxLength: 80 }}
                  onChange={(event) => setReasonCode(event.target.value)}
                />
                <FormField
                  required
                  label={t(
                    `assignments.proposal.changeFields.${assignmentProposalChangedField(changeType)}`
                  )}
                  value={changeValue}
                  inputProps={{
                    maxLength:
                      changeType === 'CORRECTION'
                        ? 240
                        : isWorkforceKeyChange(changeType)
                          ? 100
                          : 36,
                  }}
                  supportingText={t(
                    changeType === 'CORRECTION'
                      ? 'assignments.proposal.fields.titleHelp'
                      : isWorkforceKeyChange(changeType)
                        ? 'assignments.proposal.fields.referenceKeyHelp'
                        : 'assignments.proposal.fields.referenceIdHelp'
                  )}
                  onChange={(event) => setChangeValue(event.target.value)}
                />
              </Stack>
            ) : proposal ? (
              <Stack gap={2}>
                <ProposalSummary proposal={proposal} />
                {assignmentProposalCanCancel(proposal) && can(CAPABILITIES.cancel) ? (
                  <FormField
                    multiline
                    minRows={2}
                    label={t('assignments.proposal.fields.cancellationReason')}
                    value={cancellationReason}
                    inputProps={{ maxLength: 1000 }}
                    onChange={(event) => setCancellationReason(event.target.value)}
                  />
                ) : null}
              </Stack>
            ) : null}

            {isCreate ? (
              <Stack gap={1}>
                <Typography component="h3" variant="subtitle2">
                  {t('assignments.proposal.timeline.title')}
                </Typography>
                {timeline.isLoading ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('assignments.proposal.timeline.loading')}
                  </Typography>
                ) : timeline.isError ? (
                  <Alert
                    severity="warning"
                    action={
                      <ActionButton
                        intent="quiet"
                        size="small"
                        onClick={() => void timeline.refetch()}
                      >
                        {t('assignments.proposal.actions.retry')}
                      </ActionButton>
                    }
                  >
                    {t('assignments.proposal.timeline.partialFailure')}
                  </Alert>
                ) : timeline.data?.length ? (
                  <Stack component="ol" sx={{ m: 0, pl: 2.5 }} gap={0.75}>
                    {timeline.data.map((entry) => (
                      <Box
                        component="li"
                        key={`${entry.assignmentId}-${entry.effectiveStartDate}-${entry.effectiveSequence}`}
                      >
                        <Typography variant="body2">
                          {formatDate(entry.effectiveStartDate, { dateStyle: 'medium' })} ·{' '}
                          {entry.businessTitle || entry.assignmentStatus}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('assignments.proposal.timeline.empty')}
                  </Typography>
                )}
              </Stack>
            ) : null}
          </Stack>
        )}
      </FormDialog>
      <ProductSurfaceHighRiskCommandDialog controller={submit.controller} />
    </>
  );
}

function ProposalSummary({ proposal }: { proposal: AssignmentProposal }) {
  const { t } = useTranslation('workforce');
  return (
    <Stack gap={2}>
      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
        <Chip
          size="small"
          color={proposal.lifecycleState === 'SUBMITTED' ? 'success' : 'default'}
          label={t(`assignments.proposal.lifecycle.${proposal.lifecycleState}`)}
        />
        <Typography variant="caption" color="text.secondary">
          {[proposal.assignmentKey, proposal.personDisplayName].filter(Boolean).join(' · ')}
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('assignments.proposal.fields.changeType')}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {t(`assignments.proposal.changeTypes.${proposal.changeType}`)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('assignments.proposal.fields.effectiveDate')}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {formatDate(proposal.effectiveDate, { dateStyle: 'medium' })}
          </Typography>
        </Box>
      </Box>
      <Stack gap={0.75}>
        <Typography component="h3" variant="subtitle2">
          {t('assignments.proposal.proposedChanges')}
        </Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          {Object.entries(proposal.proposedChanges).map(([key, value]) => (
            <Chip
              key={key}
              size="small"
              variant="outlined"
              label={`${key}: ${String(value)}`}
              sx={{
                maxWidth: 1,
                height: 'auto',
                '& .MuiChip-label': {
                  display: 'block',
                  overflow: 'visible',
                  textOverflow: 'clip',
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                  py: 0.5,
                },
              }}
            />
          ))}
        </Stack>
      </Stack>
      <Stack gap={1}>
        <Typography component="h3" variant="subtitle2">
          {t('assignments.proposal.findings')}
        </Typography>
        {proposal.validationFindings.length ? (
          proposal.validationFindings.map((finding) => (
            <Alert
              key={`${finding.code}-${finding.field}`}
              severity={findingSeverity(finding.severity)}
            >
              <Typography variant="body2" fontWeight={700}>
                {finding.code} · {finding.field}
              </Typography>
              <Typography variant="body2">{finding.message}</Typography>
            </Alert>
          ))
        ) : (
          <Alert severity={assignmentProposalHasCompletedValidation(proposal) ? 'success' : 'info'}>
            {t(
              assignmentProposalHasCompletedValidation(proposal)
                ? 'assignments.proposal.noBlockingFindings'
                : 'assignments.proposal.notValidated'
            )}
          </Alert>
        )}
      </Stack>
      <Stack gap={0.75}>
        <Typography component="h3" variant="subtitle2">
          {t('assignments.proposal.audit.title')}
        </Typography>
        {[
          ['created', proposal.createdAt],
          ['validated', proposal.validatedAt],
          ['submitted', proposal.submittedAt],
          ['cancelled', proposal.cancelledAt],
        ].map(([event, occurredAt]) =>
          occurredAt ? (
            <Stack key={event} direction="row" justifyContent="space-between" gap={2}>
              <Typography variant="body2">{t(`assignments.proposal.audit.${event}`)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}
              </Typography>
            </Stack>
          ) : null
        )}
        {proposal.lifecycleState === 'CANCELLED' && proposal.cancellationReason?.trim() ? (
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t('assignments.proposal.audit.cancellationReason')}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {proposal.cancellationReason}
            </Typography>
          </Box>
        ) : null}
      </Stack>
    </Stack>
  );
}
