import './compensation-planning-workspace.css';

import { useMemo, useState } from 'react';
import {
  ActionButton,
  FormDialog,
  InlineFeedback,
  LiveStatus,
  OperationalContextBar,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { getCompensationPlanningCopy } from './compensation-planning-copy';
import {
  COMPENSATION_PLANNING_ROUTE,
  parseCompensationCycleAuthoringContext,
} from './compensation-planning-contract';

import type { CompensationPlanningCopy } from './compensation-planning-copy';

import type {
  ApproveCompensationPlanBody,
  CompensationBudgetBody,
  CompensationCommandResult,
  CompensationCycle,
  CompensationCycleAuthoringContext,
  CompensationCycleDetail,
  CompensationProposal,
  CompensationProposalCollection,
  CompensationProposalDetail,
  CreateCompensationCycleBody,
  PublishCompensationSnapshotBody,
  ReviseCompensationCycleBody,
  SubmitCompensationProposalBody,
  UpsertCompensationProposalBody,
} from './compensation-planning-contract';
import type { PendingCompensationCommand } from './compensation-planning-command';

export type CompensationPlanningWorkspaceStatus =
  | 'LOADING'
  | 'EMPTY'
  | 'READY'
  | 'DENIED'
  | 'STEP_UP_REQUIRED'
  | 'STALE_VERSION'
  | 'RESULT_UNKNOWN'
  | 'ERROR';

type ActionResult = void | Promise<unknown>;

export type CompensationPlanningWorkspaceActions = Readonly<{
  canCreate: boolean;
  canRevise: boolean;
  canAllocate: boolean;
  canDraftProposal: boolean;
  canSubmitProposal: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canCancel: boolean;
  onCreate?: (body: CreateCompensationCycleBody) => ActionResult;
  onRevise?: (body: ReviseCompensationCycleBody) => ActionResult;
  onAllocate?: (body: CompensationBudgetBody) => ActionResult;
  onDraftProposal?: (proposalId: string, body: UpsertCompensationProposalBody) => ActionResult;
  onSubmitProposal?: (
    proposal: CompensationProposal,
    body: SubmitCompensationProposalBody
  ) => ActionResult;
  onApprove?: (body: ApproveCompensationPlanBody) => ActionResult;
  onPublish?: (body: PublishCompensationSnapshotBody) => ActionResult;
  onCancel?: () => ActionResult;
}>;

export type CompensationPlanningWorkspaceProps = Readonly<{
  status: CompensationPlanningWorkspaceStatus;
  cycles: readonly CompensationCycle[];
  selectedCycleId: string | null;
  cycleDetail: CompensationCycleDetail | null;
  proposals: CompensationProposalCollection | null;
  proposalDetail?: CompensationProposalDetail | null;
  selectedProposalId?: string | null;
  actions: CompensationPlanningWorkspaceActions;
  cycleAuthoringContext?: CompensationCycleAuthoringContext | null;
  pendingCommand?: PendingCompensationCommand | null;
  lastResult?: CompensationCommandResult | null;
  commandBusy?: boolean;
  errorMessage?: string | null;
  proposalsError?: string | null;
  proposalDetailError?: string | null;
  proposalLoading?: boolean;
  freshnessWatermark?: string | null;
  lastRefreshedAt?: number;
  actorId?: string | null;
  locale?: string;
  showPageHeader?: boolean;
  filter?: string;
  onFilterChange?: (value: string) => void;
  onSelectCycle: (cycleId: string) => void;
  onSelectProposal?: (proposalId: string) => void;
  onRefresh: () => void;
  onRetryProposals?: () => void;
  onRetryProposalDetail?: () => void;
  onRetryPending?: () => void;
}>;

type DialogKind =
  | 'CREATE'
  | 'REVISE'
  | 'BUDGET'
  | 'PROPOSAL'
  | 'SUBMIT'
  | 'APPROVE'
  | 'PUBLISH'
  | 'CANCEL';

type DialogState = Readonly<{ kind: DialogKind; proposal?: CompensationProposal }>;
type Fields = Record<string, string>;

const stateCopy: Record<CompensationPlanningWorkspaceStatus, readonly [string, string]> = {
  LOADING: ['Loading compensation plans', 'Revalidating scope and owner data.'],
  EMPTY: ['No compensation cycles yet', 'Create a governed cycle to begin planning.'],
  READY: ['', ''],
  DENIED: ['Access unavailable', 'Your current duty or population scope does not allow this view.'],
  STEP_UP_REQUIRED: ['Verification required', 'Complete fresh verification to continue this high-risk action.'],
  STALE_VERSION: ['This plan changed', 'Refresh the plan before making another change.'],
  RESULT_UNKNOWN: ['Result needs reconciliation', 'Retry the same sealed command to learn its durable result.'],
  ERROR: ['Compensation planning is unavailable', 'Refresh this governed projection or use the correlation reference with support.'],
};

function newProposalId() {
  return globalThis.crypto?.randomUUID() ?? '';
}

function StatePanel({
  status,
  errorMessage,
  onRefresh,
  onRetryPending,
}: Pick<
  CompensationPlanningWorkspaceProps,
  'status' | 'errorMessage' | 'onRefresh' | 'onRetryPending'
>) {
  const [title, description] = stateCopy[status];
  return (
    <Paper variant="outlined" className="compplan-semantic-panel" sx={{ p: 4, textAlign: 'center' }}>
      <Typography component="h2" variant="h6">{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>{errorMessage || description}</Typography>
      <Stack direction="row" justifyContent="center" gap={1} sx={{ mt: 2 }}>
        {status === 'RESULT_UNKNOWN' && onRetryPending ? (
          <ActionButton intent="primary" onClick={onRetryPending}>Reconcile result</ActionButton>
        ) : null}
        {status !== 'LOADING' ? (
          <ActionButton intent="secondary" onClick={onRefresh}>Refresh</ActionButton>
        ) : null}
      </Stack>
    </Paper>
  );
}

function statusLabel(status: string, copy: CompensationPlanningCopy) {
  return ({
    DRAFT: copy.statusDraft,
    OPEN: copy.statusOpen,
    PROPOSAL_REVIEW: copy.statusProposalReview,
    APPROVED: copy.statusApproved,
    PUBLISHED: copy.statusPublished,
    CANCELLED: copy.statusCancelled,
    SUBMITTED: copy.statusSubmitted,
    FROZEN: copy.statusFrozen,
  } as Record<string, string>)[status] ?? status.replaceAll('_', ' ');
}

function StatusChip({ status, copy }: { status: string; copy: CompensationPlanningCopy }) {
  const color = status === 'APPROVED' || status === 'PUBLISHED'
    ? 'success'
    : status === 'PROPOSAL_REVIEW'
      ? 'warning'
      : 'default';
  return <Chip size="small" color={color} label={statusLabel(status, copy)} />;
}

function ResultEvidence({ result }: { result: CompensationCommandResult }) {
  const receipt = 'receiptId' in result
    ? result.receiptId
    : 'commandReceiptId' in result
      ? result.commandReceiptId
      : result.approvalReceiptId;
  const digest = 'resultDigest' in result ? result.resultDigest : result.payloadDigest;
  return (
    <InlineFeedback severity="success" title="Durable audit evidence">
      <Stack gap={0.5} sx={{ overflowWrap: 'anywhere' }}>
        <Typography variant="body2">Receipt: {receipt}</Typography>
        <Typography variant="body2">Aggregate version: {result.aggregateVersion ?? '—'}</Typography>
        <Typography variant="body2">Digest: {digest}</Typography>
        {'snapshotId' in result ? (
          <>
            <Typography variant="body2">Snapshot: {result.snapshotId} · revision {result.snapshotRevision}</Typography>
            <Typography variant="body2">Source version: {result.sourceVersion} · lines {result.lineCount}</Typography>
            <Typography variant="body2">Published: {result.publishedAt}</Typography>
          </>
        ) : null}
      </Stack>
    </InlineFeedback>
  );
}

function field(
  fields: Fields,
  setFields: React.Dispatch<React.SetStateAction<Fields>>,
  name: string,
  label: string,
  options: Record<string, unknown> = {}
) {
  return (
    <TextField
      {...options}
      name={name}
      label={label}
      value={fields[name] ?? ''}
      onChange={(event) => setFields((current) => ({ ...current, [name]: event.target.value }))}
      fullWidth
    />
  );
}

export function CompensationPlanningWorkspace({
  status,
  cycles,
  selectedCycleId,
  cycleDetail,
  proposals,
  proposalDetail,
  selectedProposalId,
  actions,
  cycleAuthoringContext: providedCycleAuthoringContext,
  pendingCommand,
  lastResult,
  commandBusy = false,
  errorMessage,
  proposalsError,
  proposalDetailError,
  proposalLoading = false,
  freshnessWatermark,
  lastRefreshedAt = 0,
  actorId,
  locale = 'en',
  showPageHeader = true,
  filter = '',
  onFilterChange,
  onSelectCycle,
  onSelectProposal,
  onRefresh,
  onRetryProposals,
  onRetryProposalDetail,
  onRetryPending,
}: CompensationPlanningWorkspaceProps) {
  const copy = getCompensationPlanningCopy(locale);
  const cycleAuthoringContext = useMemo(() => {
    if (!providedCycleAuthoringContext) return null;
    try {
      return parseCompensationCycleAuthoringContext(providedCycleAuthoringContext);
    } catch {
      return null;
    }
  }, [providedCycleAuthoringContext]);
  const selected = cycleDetail?.item ?? cycles.find((item) => item.cycleId === selectedCycleId);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [fields, setFields] = useState<Fields>({});
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const filterValue = filter.trim().toLowerCase();
  const visibleCycles = cycles.filter((item) =>
    !filterValue || `${item.cycleCode} ${item.status}`.toLowerCase().includes(filterValue)
  );
  const visibleProposals = (proposals?.items ?? []).filter((item) =>
    !filterValue || `${item.componentCode} ${item.workerId} ${item.assignmentId} ${item.status}`
      .toLowerCase().includes(filterValue)
  );
  const budgets = selected?.budgetAggregates ?? [];
  const population = selected?.population;
  const eligibleAssignments = population?.lines.length ?? 0;
  const eligibleComponents = population?.lines.reduce(
    (count, line) => count + line.eligibleComponentCodes.length,
    0
  ) ?? 0;
  const submittedCount = proposals?.items.filter((item) => item.status === 'SUBMITTED').length ?? 0;
  const approvalReady = Boolean(
    proposals && proposals.items.length > 0 && submittedCount === proposals.items.length && !proposalsError
  );
  const authoringAssignments = cycleAuthoringContext?.population.lines.length ?? 0;
  const authoringComponentLinks = cycleAuthoringContext?.population.lines.reduce(
    (count, line) => count + line.eligibleComponentCodes.length,
    0
  ) ?? 0;
  const selectedAuthoringGuideline = cycleAuthoringContext?.guidelines.components.find(
    (item) => item.componentCode === fields.guidelineComponentCode
  );
  const blocking = status !== 'READY' && status !== 'EMPTY';

  const openDialog = (kind: DialogKind, proposal?: CompensationProposal) => {
    if ((kind === 'CREATE' || kind === 'REVISE') && !cycleAuthoringContext) return;
    const firstPopulation = selected?.population?.lines[0];
    const firstGuideline = selected?.guidelines?.components[0];
    const authoringGuideline = cycleAuthoringContext?.guidelines.components[0];
    const authoringEffectiveFrom = kind === 'REVISE'
      ? selected?.effectiveFrom ?? cycleAuthoringContext?.guidelines.effectiveFrom ?? ''
      : cycleAuthoringContext?.guidelines.effectiveFrom ?? '';
    const authoringEffectiveTo = kind === 'REVISE'
      ? selected?.effectiveTo ?? cycleAuthoringContext?.guidelines.effectiveTo ?? ''
      : cycleAuthoringContext?.guidelines.effectiveTo ?? '';
    setFields({
      cycleCode: kind === 'REVISE' ? selected?.cycleCode ?? '' : '',
      effectiveFrom: authoringEffectiveFrom,
      effectiveTo: authoringEffectiveTo ?? '',
      guidelineComponentCode: authoringGuideline?.componentCode ?? '',
      guidelineMinimumAmount: authoringGuideline?.minimumAmount ?? '',
      guidelineMaximumAmount: authoringGuideline?.maximumAmount ?? '',
      ledgerEntryType: 'ALLOCATE', organizationPublicId: firstPopulation?.organizationPublicId ?? '',
      currency: firstGuideline?.currency ?? '', amount: '', reversesEntryPublicId: '',
      proposalId: proposal?.proposalId ?? newProposalId(),
      workerPublicId: proposal?.workerId ?? firstPopulation?.workerPublicId ?? '',
      assignmentPublicId: proposal?.assignmentId ?? firstPopulation?.assignmentPublicId ?? '',
      componentCode: proposal?.componentCode ?? firstGuideline?.componentCode ?? '',
      proposalCurrency: proposal?.currency ?? firstGuideline?.currency ?? '',
      proposalAmount: proposal && proposalDetail?.item.proposalId === proposal.proposalId
        ? proposalDetail.item.amount ?? '' : '',
      proposalFrom: proposal?.effectiveFrom ?? selected?.effectiveFrom ?? '',
      proposalTo: proposal?.effectiveTo ?? '', supersedesProposalPublicId: '',
      submissionDigest: proposal?.contentDigest ?? '',
      submissionDate: proposal?.effectiveFrom ?? '', reasonCode: '', approvalReceiptId: '',
    });
    setConfirmed(false);
    setFormError(null);
    setDialog({ kind, proposal });
  };

  const submitDialog = async () => {
    if (!dialog) return;
    setFormError(null);
    try {
      if (dialog.kind === 'CREATE' || dialog.kind === 'REVISE') {
        if (!cycleAuthoringContext) {
          throw new Error(copy.authoringContextRequiredTitle);
        }
        const editedComponent = cycleAuthoringContext.guidelines.components.find(
          (item) => item.componentCode === fields.guidelineComponentCode
        );
        if (!editedComponent) {
          throw new Error(copy.authoringContextRequiredTitle);
        }
        const common = {
          guidelines: Object.freeze({
            components: Object.freeze(cycleAuthoringContext.guidelines.components.map((item) =>
              item.componentCode === editedComponent.componentCode
                ? Object.freeze({
                    ...item,
                    minimumAmount: fields.guidelineMinimumAmount,
                    maximumAmount: fields.guidelineMaximumAmount,
                  })
                : item
            )),
            budgetMode: 'HARD_CAP' as const,
            effectiveFrom: fields.effectiveFrom,
            effectiveTo: fields.effectiveTo || null,
          }),
          population: cycleAuthoringContext.population,
          effectiveFrom: fields.effectiveFrom,
          effectiveTo: fields.effectiveTo || null,
          populationSourceRef: cycleAuthoringContext.populationSourceRef,
        };
        if (dialog.kind === 'CREATE') await actions.onCreate?.({ ...common, cycleCode: fields.cycleCode });
        else await actions.onRevise?.(common);
      } else if (dialog.kind === 'BUDGET') {
        await actions.onAllocate?.({
          organizationPublicId: fields.organizationPublicId,
          amount: fields.amount,
          currency: fields.currency,
          ledgerEntryType: fields.ledgerEntryType as 'ALLOCATE' | 'REVERSE',
          reversesEntryPublicId:
            fields.ledgerEntryType === 'REVERSE' ? fields.reversesEntryPublicId : null,
        });
      } else if (dialog.kind === 'PROPOSAL') {
        await actions.onDraftProposal?.(fields.proposalId, {
          content: {
            cyclePublicId: selected!.cycleId,
            workerPublicId: fields.workerPublicId,
            assignmentPublicId: fields.assignmentPublicId,
            componentCode: fields.componentCode,
            currency: fields.proposalCurrency,
            amount: fields.proposalAmount,
            effectiveFrom: fields.proposalFrom,
            effectiveTo: fields.proposalTo || null,
            exceptionReasonCode: null,
            supersedesProposalPublicId: fields.supersedesProposalPublicId || null,
          },
        });
      } else if (dialog.kind === 'SUBMIT' && dialog.proposal) {
        await actions.onSubmitProposal?.(dialog.proposal, {
          submissionDigest: fields.submissionDigest,
          effectiveDate: fields.submissionDate || null,
        });
      } else if (dialog.kind === 'APPROVE') {
        await actions.onApprove?.({ decision: 'APPROVE', reasonCode: fields.reasonCode });
      } else if (dialog.kind === 'PUBLISH') {
        await actions.onPublish?.({ approvalReceiptId: fields.approvalReceiptId });
      } else if (dialog.kind === 'CANCEL') {
        await actions.onCancel?.();
      }
      setDialog(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The governed command failed.');
    }
  };

  const dialogTitle = dialog ? {
    CREATE: copy.newCycle, REVISE: copy.revise, BUDGET: copy.budget,
    PROPOSAL: copy.proposal, SUBMIT: copy.submit, APPROVE: copy.approve,
    PUBLISH: copy.publish, CANCEL: copy.cancelCycle,
  }[dialog.kind] : '';
  const highRisk = dialog?.kind === 'APPROVE' || dialog?.kind === 'PUBLISH';
  const requiredMissing = Boolean(
    (dialog?.kind === 'CREATE' && (!cycleAuthoringContext || !fields.cycleCode ||
      !fields.effectiveFrom || !fields.guidelineComponentCode ||
      !fields.guidelineMinimumAmount || !fields.guidelineMaximumAmount)) ||
    (dialog?.kind === 'REVISE' && (!cycleAuthoringContext || !fields.effectiveFrom ||
      !fields.guidelineComponentCode || !fields.guidelineMinimumAmount ||
      !fields.guidelineMaximumAmount)) ||
    (dialog?.kind === 'BUDGET' && (!fields.organizationPublicId || !fields.currency || !fields.amount ||
      (fields.ledgerEntryType === 'REVERSE' && !fields.reversesEntryPublicId))) ||
    (dialog?.kind === 'PROPOSAL' && (!fields.proposalId || !fields.workerPublicId ||
      !fields.assignmentPublicId || !fields.componentCode || !fields.proposalCurrency ||
      !fields.proposalAmount || !fields.proposalFrom)) ||
    (dialog?.kind === 'SUBMIT' && !fields.submissionDigest)
  );
  const submitDisabled = Boolean(
    requiredMissing ||
    (highRisk && !confirmed) ||
    (dialog?.kind === 'APPROVE' && (!approvalReady || !/^[A-Z0-9][A-Z0-9._-]{0,79}$/.test(fields.reasonCode ?? ''))) ||
    (dialog?.kind === 'PUBLISH' && !fields.approvalReceiptId) ||
    (dialog?.kind === 'CANCEL' && !confirmed)
  );

  return (
    <Box
      component="main"
      data-route={COMPENSATION_PLANNING_ROUTE}
      sx={{ minHeight: 1, bgcolor: 'background.default', color: 'text.primary', p: { xs: 2, md: 3 } }}
    >
      <Stack gap={2.5}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent={showPageHeader ? 'space-between' : 'flex-end'}
          gap={2}
        >
          {showPageHeader ? (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="primary.main">{copy.eyebrow}</Typography>
              <Typography component="h1" variant="h4" sx={{ wordBreak: 'keep-all' }}>{copy.title}</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>{copy.subtitle}</Typography>
            </Box>
          ) : null}
          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
            <ActionButton intent="secondary" onClick={onRefresh}>{copy.refresh}</ActionButton>
            <ActionButton intent="primary" disabled={!cycleAuthoringContext || !actions.canCreate || !actions.onCreate} onClick={() => openDialog('CREATE')}>
              {copy.newCycle}
            </ActionButton>
          </Stack>
        </Stack>

        <OperationalContextBar
          label={copy.contextLabel}
          items={[
            { label: copy.cycleLabel, value: selected ? `${selected.cycleCode} · v${selected.aggregateVersion}` : copy.noneSelected },
            { label: copy.checkerLabel, value: actorId || copy.currentActor },
            { label: copy.fieldPolicyLabel, value: cycleDetail ? `r${cycleDetail.fieldPolicyRevision}` : '—' },
          ]}
          status={
            <LiveStatus
              state={proposalsError || proposalDetailError ? 'degraded' : proposalLoading ? 'syncing' : 'live'}
              label={proposalsError || proposalDetailError ? copy.partialDataUnavailable : proposalLoading ? copy.refreshing : copy.current}
              detail={freshnessWatermark
                ? `${copy.serverPrefix} ${freshnessWatermark}`
                : lastRefreshedAt ? `${copy.refreshedPrefix} ${new Date(lastRefreshedAt).toLocaleString(locale)}` : copy.awaitingWatermark}
              refreshLabel={copy.refresh}
              onRefresh={onRefresh}
              refreshing={proposalLoading}
            />
          }
        />

        {!cycleAuthoringContext ? (
          <InlineFeedback severity="warning" title={copy.authoringContextRequiredTitle}>
            {copy.authoringContextRequiredBody}
          </InlineFeedback>
        ) : null}

        {blocking ? (
          <StatePanel status={status} errorMessage={errorMessage} onRefresh={onRefresh} onRetryPending={onRetryPending} />
        ) : status === 'EMPTY' ? (
          <StatePanel status={status} onRefresh={onRefresh} />
        ) : (
          <>
            {errorMessage ? <InlineFeedback severity="error" title="Command feedback">{errorMessage}</InlineFeedback> : null}
            {pendingCommand ? (
              <InlineFeedback severity="warning" title="Command awaiting a durable result">
                {pendingCommand.command} will be replayed with the same sealed idempotency identity.
              </InlineFeedback>
            ) : null}
            {lastResult ? <ResultEvidence result={lastResult} /> : null}
            <TextField size="small" label={copy.search} value={filter} onChange={(event) => onFilterChange?.(event.target.value)} sx={{ maxWidth: 420 }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(220px,.7fr) minmax(0,1.6fr) minmax(230px,.75fr)' }, gap: 2 }}>
              <Paper variant="outlined" className="compplan-semantic-panel" sx={{ minWidth: 0 }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography component="h2" variant="h6">{copy.cycles} · {visibleCycles.length}</Typography>
                </Box>
                <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 1 }}>
                  {visibleCycles.map((cycle) => (
                    <Box component="li" key={cycle.cycleId}>
                      <ActionButton
                        intent={cycle.cycleId === selectedCycleId ? 'secondary' : 'quiet'}
                        aria-current={cycle.cycleId === selectedCycleId ? 'true' : undefined}
                        onClick={() => onSelectCycle(cycle.cycleId)}
                        sx={{ width: 1, minHeight: 52, justifyContent: 'space-between', textAlign: 'left', whiteSpace: 'normal' }}
                      >
                        <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                          <strong>{cycle.cycleCode}</strong><br />
                          <Typography component="span" variant="caption" color="text.secondary">{cycle.effectiveFrom} · v{cycle.aggregateVersion}</Typography>
                        </Box>
                        <StatusChip status={cycle.status} copy={copy} />
                      </ActionButton>
                    </Box>
                  ))}
                </Stack>
              </Paper>

              <Paper variant="outlined" className="compplan-semantic-panel" sx={{ minWidth: 0, p: 2 }}>
                <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                  <Typography component="h2" variant="h6">{copy.planReadiness}</Typography>
                  {selected ? <StatusChip status={selected.status} copy={copy} /> : null}
                </Stack>
                {!selected ? (
                  <Typography color="text.secondary" sx={{ py: 4 }}>{copy.selectCyclePrompt}</Typography>
                ) : (
                  <Stack gap={2} sx={{ mt: 2 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' }, gap: 1 }}>
                      {[
                        [copy.eligibleAssignments, String(eligibleAssignments)],
                        [copy.eligibleComponentLinks, String(eligibleComponents)],
                        [copy.exceptions, '0 · HARD_CAP'],
                        [copy.submitted, `${submittedCount}/${proposals?.items.length ?? '—'}`],
                        [copy.approvalReadiness, approvalReady ? copy.serverRevalidationRequired : copy.notReady],
                        [copy.makerChecker, copy.serverLineageEnforced],
                      ].map(([label, value]) => (
                        <Paper key={label} variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography
                            fontWeight={700}
                            className={value.includes('SERVER_REVALIDATION_REQUIRED')
                              ? 'compplan-machine-status'
                              : undefined}
                          >
                            {value}
                          </Typography>
                        </Paper>
                      ))}
                    </Box>

                    <Box>
                      <Typography component="h3" variant="subtitle1">{copy.budgetBuckets}</Typography>
                      {selected.budgetMasked ? (
                        <Typography color="text.secondary">{copy.restricted}</Typography>
                      ) : selected.budgetAggregates === undefined ? (
                        <InlineFeedback
                          severity="warning"
                          title={copy.budgetProjectionUnavailableTitle}
                        >
                          {copy.budgetProjectionUnavailableBody}
                        </InlineFeedback>
                      ) : budgets.length ? (
                        <>
                          <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
                            <Table size="small" aria-label={`${copy.budgetBuckets}: ${copy.used}, ${copy.remaining}`}>
                              <TableHead><TableRow><TableCell>{copy.organizationCurrency}</TableCell><TableCell>{copy.total}</TableCell><TableCell>{copy.used}</TableCell><TableCell>{copy.remaining}</TableCell></TableRow></TableHead>
                              <TableBody>{budgets.map((row) => (
                                <TableRow key={`${row.organizationPublicId}:${row.currency}`}>
                                  <TableCell><span className="compplan-identifier">{row.organizationPublicId}</span><br />{row.currency}</TableCell>
                                  <TableCell>{row.allocatedAmount}</TableCell><TableCell>{row.committedAmount}</TableCell><TableCell>{row.remainingAmount}</TableCell>
                                </TableRow>
                              ))}</TableBody>
                            </Table>
                          </TableContainer>
                          <Stack gap={1} sx={{ display: { xs: 'flex', md: 'none' }, mt: 1 }}>
                            {budgets.map((row) => (
                              <Paper key={`${row.organizationPublicId}:${row.currency}`} variant="outlined" sx={{ p: 1.5 }}>
                                <Typography variant="caption" color="text.secondary">{copy.organizationCurrency}</Typography>
                                <Typography variant="body2" fontWeight={700}><span className="compplan-identifier">{row.organizationPublicId}</span> · {row.currency}</Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' }, gap: 1, mt: 1 }}>
                                  <Box><Typography variant="caption" color="text.secondary">{copy.total}</Typography><Typography variant="body2">{row.allocatedAmount}</Typography></Box>
                                  <Box><Typography variant="caption" color="text.secondary">{copy.used}</Typography><Typography variant="body2">{row.committedAmount}</Typography></Box>
                                  <Box><Typography variant="caption" color="text.secondary">{copy.remaining}</Typography><Typography variant="body2">{row.remainingAmount}</Typography></Box>
                                </Box>
                              </Paper>
                            ))}
                          </Stack>
                        </>
                      ) : <Typography color="text.secondary">{copy.noLedgerEntries}</Typography>}
                    </Box>

                    <Divider />
                    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                      <Typography component="h3" variant="subtitle1">{copy.proposals}</Typography>
                      <Typography variant="caption" color="text.secondary">{visibleProposals.length}</Typography>
                    </Stack>
                    {proposalsError ? (
                      <InlineFeedback
                        severity="error"
                        title={copy.proposalPanelUnavailable}
                        action={onRetryProposals ? <ActionButton size="small" intent="secondary" onClick={onRetryProposals}>{copy.retry}</ActionButton> : undefined}
                      >
                        {proposalsError}. {copy.proposalPanelContext}
                      </InlineFeedback>
                    ) : proposalLoading && !proposals ? (
                      <Typography color="text.secondary">{copy.loadingProposals}</Typography>
                    ) : visibleProposals.length === 0 ? (
                      <Typography color="text.secondary">{copy.noProposals}</Typography>
                    ) : (
                      <>
                        <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
                          <Table size="small" aria-label={copy.proposals}>
                            <TableHead><TableRow><TableCell sx={{ whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>{copy.component}</TableCell><TableCell>{copy.workerAssignment}</TableCell><TableCell>{copy.amount}</TableCell><TableCell>{copy.status}</TableCell><TableCell>{copy.action}</TableCell></TableRow></TableHead>
                            <TableBody>{visibleProposals.map((proposal) => {
                              const detail = proposalDetail?.item.proposalId === proposal.proposalId ? proposalDetail.item : null;
                              return (
                                <TableRow key={proposal.proposalId} selected={proposal.proposalId === selectedProposalId}>
                                  <TableCell>{proposal.componentCode}</TableCell>
                                  <TableCell><span className="compplan-identifier">{proposal.workerId}</span><br /><span className="compplan-identifier">{proposal.assignmentId}</span></TableCell>
                                  <TableCell>{detail?.amountMasked ? copy.restricted : detail?.amount ? `${detail.amount} ${detail.currency}` : (
                                    <ActionButton size="small" intent="quiet" onClick={() => onSelectProposal?.(proposal.proposalId)}>{copy.viewAmount}</ActionButton>
                                  )}</TableCell>
                                  <TableCell><StatusChip status={proposal.status} copy={copy} /></TableCell>
                                  <TableCell>
                                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                                      <ActionButton size="small" intent="quiet" disabled={!actions.canDraftProposal} onClick={() => openDialog('PROPOSAL', proposal)}>{copy.edit}</ActionButton>
                                      <ActionButton size="small" intent="secondary" disabled={!actions.canSubmitProposal || proposal.status !== 'DRAFT'} onClick={() => openDialog('SUBMIT', proposal)}>{copy.submit}</ActionButton>
                                    </Stack>
                                  </TableCell>
                                </TableRow>
                              );
                            })}</TableBody>
                          </Table>
                        </TableContainer>
                        <Stack gap={1} sx={{ display: { xs: 'flex', md: 'none' } }}>
                          {visibleProposals.map((proposal) => {
                            const detail = proposalDetail?.item.proposalId === proposal.proposalId ? proposalDetail.item : null;
                            return (
                              <Paper key={proposal.proposalId} variant="outlined" sx={{ p: 1.5, bgcolor: proposal.proposalId === selectedProposalId ? 'action.selected' : 'background.paper' }}>
                                <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                                  <Typography fontWeight={700}>{proposal.componentCode}</Typography>
                                  <StatusChip status={proposal.status} copy={copy} />
                                </Stack>
                                <Typography variant="caption" color="text.secondary">{copy.workerAssignment}</Typography>
                                <Typography variant="body2"><span className="compplan-identifier">{proposal.workerId}</span><br /><span className="compplan-identifier">{proposal.assignmentId}</span></Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  {copy.amount}: {detail?.amountMasked ? copy.restricted : detail?.amount ? `${detail.amount} ${detail.currency}` : copy.restricted}
                                </Typography>
                                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                                  <ActionButton size="small" intent="quiet" onClick={() => onSelectProposal?.(proposal.proposalId)}>{copy.viewAmount}</ActionButton>
                                  <ActionButton size="small" intent="quiet" disabled={!actions.canDraftProposal} onClick={() => openDialog('PROPOSAL', proposal)}>{copy.edit}</ActionButton>
                                  <ActionButton size="small" intent="secondary" disabled={!actions.canSubmitProposal || proposal.status !== 'DRAFT'} onClick={() => openDialog('SUBMIT', proposal)}>{copy.submit}</ActionButton>
                                </Stack>
                              </Paper>
                            );
                          })}
                        </Stack>
                      </>
                    )}
                    {proposalDetailError ? (
                      <InlineFeedback severity="error" title={copy.proposalDetailUnavailable} action={onRetryProposalDetail ? <ActionButton size="small" intent="secondary" onClick={onRetryProposalDetail}>{copy.retry}</ActionButton> : undefined}>
                        {proposalDetailError}. {copy.staleAmountHidden}
                      </InlineFeedback>
                    ) : null}
                  </Stack>
                )}
              </Paper>

              <Paper variant="outlined" className="compplan-semantic-panel" sx={{ minWidth: 0, p: 2 }}>
                <Typography component="h2" variant="h6">{copy.actions}</Typography>
                <Stack gap={1} sx={{ mt: 2, '& button': { minHeight: 44, whiteSpace: 'normal' } }}>
                  <ActionButton disabled={!cycleAuthoringContext || !actions.canRevise} onClick={() => openDialog('REVISE')}>{copy.revise}</ActionButton>
                  <ActionButton disabled={!actions.canAllocate} onClick={() => openDialog('BUDGET')}>{copy.budget}</ActionButton>
                  <ActionButton disabled={!actions.canDraftProposal} onClick={() => openDialog('PROPOSAL')}>{copy.proposal}</ActionButton>
                  <ActionButton intent="primary" disabled={!actions.canApprove} onClick={() => openDialog('APPROVE')}>{copy.approve}</ActionButton>
                  <ActionButton intent="primary" disabled={!actions.canPublish} onClick={() => openDialog('PUBLISH')}>{copy.publish}</ActionButton>
                  <ActionButton intent="danger" disabled={!actions.canCancel} onClick={() => openDialog('CANCEL')}>{copy.cancelCycle}</ActionButton>
                </Stack>
                <InlineFeedback severity="info" title={copy.hardCapPolicy} sx={{ mt: 2 }}>
                  {copy.hardCapDescription}
                </InlineFeedback>
              </Paper>
            </Box>
          </>
        )}
      </Stack>

      <FormDialog
        open={Boolean(dialog)}
        title={dialogTitle}
        description={highRisk ? copy.highRiskDescription : undefined}
        cancelLabel={copy.close}
        submitLabel={copy.confirm}
        submittingLabel={copy.recordingCommand}
        busy={commandBusy}
        submitDisabled={submitDisabled}
        submitIntent={dialog?.kind === 'CANCEL' ? 'danger' : 'primary'}
        onClose={() => !commandBusy && setDialog(null)}
        onSubmit={submitDialog}
        maxWidth="md"
        mobileFullScreen
      >
        <Stack gap={2}>
          {formError ? <InlineFeedback severity="error" title={copy.commandNotSubmitted}>{formError}</InlineFeedback> : null}
          {dialog?.kind === 'CREATE' || dialog?.kind === 'REVISE' ? (
            <>
              {dialog.kind === 'CREATE' ? field(fields, setFields, 'cycleCode', copy.cycleCode, { required: true }) : null}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {field(fields, setFields, 'effectiveFrom', copy.effectiveFrom, { required: true, type: 'date', InputLabelProps: { shrink: true } })}
                {field(fields, setFields, 'effectiveTo', copy.effectiveTo, { type: 'date', InputLabelProps: { shrink: true } })}
              </Box>
              <TextField label={copy.budgetMode} value="HARD_CAP" disabled fullWidth />
              <TextField
                select
                required
                label={copy.guidelineComponent}
                value={fields.guidelineComponentCode ?? ''}
                onChange={(event) => {
                  const component = cycleAuthoringContext?.guidelines.components.find(
                    (item) => item.componentCode === event.target.value
                  );
                  setFields((current) => ({
                    ...current,
                    guidelineComponentCode: event.target.value,
                    guidelineMinimumAmount: component?.minimumAmount ?? '',
                    guidelineMaximumAmount: component?.maximumAmount ?? '',
                  }));
                }}
                fullWidth
              >
                {(cycleAuthoringContext?.guidelines.components ?? []).map((item) => (
                  <MenuItem key={item.componentCode} value={item.componentCode}>
                    {item.componentCode} · {item.currency}
                  </MenuItem>
                ))}
              </TextField>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {field(fields, setFields, 'guidelineMinimumAmount', copy.minimumAmount, { required: true })}
                {field(fields, setFields, 'guidelineMaximumAmount', copy.maximumAmount, { required: true })}
              </Box>
              {selectedAuthoringGuideline ? (
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' }, gap: 1 }}>
                    <Box><Typography variant="caption" color="text.secondary">{copy.currency}</Typography><Typography>{selectedAuthoringGuideline.currency}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">{copy.exceptionPolicy}</Typography><Typography>{selectedAuthoringGuideline.exceptionPolicyCode}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">{copy.roundingPolicy}</Typography><Typography className="compplan-identifier">{selectedAuthoringGuideline.roundingPolicyVersionPublicId}</Typography></Box>
                  </Box>
                </Paper>
              ) : null}
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography component="h3" variant="subtitle2">{copy.authoritativePopulationSource}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mt: 1 }}>
                  <Box><Typography variant="caption" color="text.secondary">{copy.snapshotId}</Typography><Typography className="compplan-identifier">{cycleAuthoringContext?.populationSourceRef.snapshotPublicId}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">{copy.ownerRevision}</Typography><Typography>{cycleAuthoringContext?.populationSourceRef.ownerRevision}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">{copy.sourceAsOf}</Typography><Typography className="compplan-identifier">{cycleAuthoringContext?.populationSourceRef.asOf}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">{copy.sourceDigest}</Typography><Typography className="compplan-identifier">{cycleAuthoringContext?.populationSourceRef.sha256}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">{copy.eligiblePopulationSummary}</Typography><Typography>{authoringAssignments} / {authoringComponentLinks}</Typography></Box>
                </Box>
              </Paper>
            </>
          ) : null}
          {dialog?.kind === 'BUDGET' ? (
            <>
              <TextField select label={copy.ledgerOperation} value={fields.ledgerEntryType ?? 'ALLOCATE'} onChange={(event) => setFields((current) => ({ ...current, ledgerEntryType: event.target.value }))} fullWidth>
                <MenuItem value="ALLOCATE">ALLOCATE</MenuItem><MenuItem value="REVERSE">REVERSE</MenuItem>
              </TextField>
              {field(fields, setFields, 'organizationPublicId', copy.organizationId, { required: true })}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {field(fields, setFields, 'currency', copy.currency, { required: true })}
                {field(fields, setFields, 'amount', copy.canonicalAmount, { required: true, helperText: copy.canonicalAmountHelp })}
              </Box>
              {fields.ledgerEntryType === 'REVERSE' ? field(fields, setFields, 'reversesEntryPublicId', copy.reverseSourceEntryId, { required: true }) : null}
            </>
          ) : null}
          {dialog?.kind === 'PROPOSAL' ? (
            <>
              {field(fields, setFields, 'proposalId', copy.proposalId, { required: true, disabled: Boolean(dialog.proposal) })}
              {field(fields, setFields, 'workerPublicId', copy.workerId, { required: true })}
              {field(fields, setFields, 'assignmentPublicId', copy.assignmentId, { required: true })}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' }, gap: 1.5 }}>
                {field(fields, setFields, 'componentCode', copy.component, { required: true })}
                {field(fields, setFields, 'proposalCurrency', copy.currency, { required: true })}
                {field(fields, setFields, 'proposalAmount', copy.canonicalAmount, { required: true })}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {field(fields, setFields, 'proposalFrom', copy.effectiveFrom, { required: true, type: 'date', InputLabelProps: { shrink: true } })}
                {field(fields, setFields, 'proposalTo', copy.effectiveTo, { type: 'date', InputLabelProps: { shrink: true } })}
              </Box>
              {field(fields, setFields, 'supersedesProposalPublicId', copy.supersedesProposalId)}
            </>
          ) : null}
          {dialog?.kind === 'SUBMIT' ? (
            <>
              <InlineFeedback severity="info" title={copy.boundProposal}>
                <span className="compplan-identifier">{dialog.proposal?.proposalId}</span> · v{dialog.proposal?.aggregateVersion}<br />{copy.sourceDigest} <span className="compplan-identifier">{dialog.proposal?.contentDigest}</span>
              </InlineFeedback>
              {field(fields, setFields, 'submissionDigest', copy.submissionDigest, { required: true, disabled: true })}
              {field(fields, setFields, 'submissionDate', copy.effectiveDate, { type: 'date', InputLabelProps: { shrink: true } })}
            </>
          ) : null}
          {dialog?.kind === 'APPROVE' || dialog?.kind === 'PUBLISH' ? (
            <>
              <InlineFeedback severity={approvalReady || dialog.kind === 'PUBLISH' ? 'warning' : 'error'} title={copy.impactPreview}>
                {copy.cycleLabel} {selected?.cycleCode} · {copy.sourceVersion} v{selected?.aggregateVersion}; {submittedCount} {copy.submittedProposalsSuffix}.{' '}
                {copy.impactRevalidation}
              </InlineFeedback>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">{copy.makerCheckerContext}</Typography>
                <Typography variant="body2">{copy.checkerLabel}: <span className="compplan-identifier">{actorId || copy.currentActor}</span></Typography>
                <Typography variant="body2">{copy.lineageDescription}</Typography>
              </Paper>
              {dialog.kind === 'APPROVE'
                ? field(fields, setFields, 'reasonCode', copy.approvalReasonCode, { required: true, helperText: copy.approvalReasonHelp })
                : field(fields, setFields, 'approvalReceiptId', copy.approvalReceiptId, { required: true })}
              <FormControlLabel control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />} label={copy.immutable} sx={{ alignItems: 'flex-start' }} />
            </>
          ) : null}
          {dialog?.kind === 'CANCEL' ? (
            <>
              <InlineFeedback severity="warning" title={copy.cycleImpact}>{copy.cancelDescription}</InlineFeedback>
              <FormControlLabel control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />} label={copy.cancelConfirmation} />
            </>
          ) : null}
        </Stack>
      </FormDialog>
    </Box>
  );
}

export default CompensationPlanningWorkspace;
