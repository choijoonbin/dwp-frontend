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

import type {
  ApproveCompensationPlanBody,
  CompensationBudgetBody,
  CompensationCommandResult,
  CompensationCycle,
  CompensationCycleDetail,
  CompensationGuidelines,
  CompensationPopulation,
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

function newId() {
  return globalThis.crypto?.randomUUID() ?? '00000000-0000-4000-8000-000000000001';
}

function canonicalInstant() {
  return new Date().toISOString();
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

function StatusChip({ status }: { status: string }) {
  const color = status === 'APPROVED' || status === 'PUBLISHED'
    ? 'success'
    : status === 'PROPOSAL_REVIEW'
      ? 'warning'
      : 'default';
  return <Chip size="small" color={color} label={status.replaceAll('_', ' ')} />;
}

function decimalUnits(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10_000n + BigInt((fraction + '0000').slice(0, 4));
}

function moneyText(units: bigint): string {
  const sign = units < 0n ? '-' : '';
  const absolute = units < 0n ? -units : units;
  const whole = absolute / 10_000n;
  const fraction = String(absolute % 10_000n).padStart(4, '0').replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

function budgetRows(cycle: CompensationCycle | undefined) {
  if (!cycle?.budgetEntries) return [];
  const totals = new Map<string, bigint>();
  for (const entry of cycle.budgetEntries) {
    const key = `${entry.organizationPublicId}:${entry.currency}`;
    const amount = decimalUnits(entry.amount) * (entry.entryType === 'REVERSE' ? -1n : 1n);
    totals.set(key, (totals.get(key) ?? 0n) + amount);
  }
  return [...totals].map(([key, units]) => {
    const split = key.lastIndexOf(':');
    return {
      organization: key.slice(0, split),
      currency: key.slice(split + 1),
      allocated: moneyText(units),
    };
  });
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

function jsonValue<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
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
  const budgets = useMemo(() => budgetRows(selected), [selected]);
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
  const blocking = status !== 'READY' && status !== 'EMPTY';

  const openDialog = (kind: DialogKind, proposal?: CompensationProposal) => {
    const firstPopulation = selected?.population?.lines[0];
    const firstGuideline = selected?.guidelines?.components[0];
    const now = freshnessWatermark ?? canonicalInstant();
    const defaultGuidelines: CompensationGuidelines = selected?.guidelines ?? {
      components: [{
        componentCode: 'BASE', currency: 'USD', minimumAmount: '1', maximumAmount: '999999.9999',
        exceptionPolicyCode: 'NONE', roundingPolicyVersionPublicId: newId(),
      }],
      budgetMode: 'HARD_CAP', effectiveFrom: selected?.effectiveFrom ?? '2027-01-01', effectiveTo: null,
    };
    const defaultPopulation: CompensationPopulation = selected?.population ?? {
      asOf: now, hrmOwnerRevision: 1,
      lines: [{
        workerPublicId: newId(), assignmentPublicId: newId(), organizationPublicId: newId(),
        gradePublicId: null, jobProfilePublicId: null, assignmentOwnerRevision: 1,
        eligibleComponentCodes: ['BASE'],
      }],
    };
    setFields({
      cycleCode: selected?.cycleCode ?? '',
      effectiveFrom: selected?.effectiveFrom ?? '2027-01-01',
      effectiveTo: selected?.effectiveTo ?? '',
      guidelines: JSON.stringify(defaultGuidelines, null, 2),
      population: JSON.stringify(defaultPopulation, null, 2),
      snapshotPublicId: newId(), ownerRevision: String(defaultPopulation.hrmOwnerRevision),
      sourceAsOf: defaultPopulation.asOf, sourceSha: '0'.repeat(64),
      ledgerEntryType: 'ALLOCATE', organizationPublicId: firstPopulation?.organizationPublicId ?? '',
      currency: firstGuideline?.currency ?? 'USD', amount: '', reversesEntryPublicId: '',
      proposalId: proposal?.proposalId ?? newId(),
      workerPublicId: proposal?.workerId ?? firstPopulation?.workerPublicId ?? '',
      assignmentPublicId: proposal?.assignmentId ?? firstPopulation?.assignmentPublicId ?? '',
      componentCode: proposal?.componentCode ?? firstGuideline?.componentCode ?? 'BASE',
      proposalCurrency: proposal?.currency ?? firstGuideline?.currency ?? 'USD',
      proposalAmount: proposal && proposalDetail?.item.proposalId === proposal.proposalId
        ? proposalDetail.item.amount ?? '' : '',
      proposalFrom: proposal?.effectiveFrom ?? selected?.effectiveFrom ?? '2027-01-01',
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
        const common = {
          guidelines: jsonValue<CompensationGuidelines>(fields.guidelines, 'Guidelines'),
          population: jsonValue<CompensationPopulation>(fields.population, 'Population'),
          effectiveFrom: fields.effectiveFrom,
          effectiveTo: fields.effectiveTo || null,
          populationSourceRef: {
            snapshotPublicId: fields.snapshotPublicId,
            ownerRevision: Number(fields.ownerRevision),
            projectionSchemaId: 'CompensationPopulationContent.v1' as const,
            asOf: fields.sourceAsOf,
            sha256: fields.sourceSha,
            purposeCode: 'HRIS_PER_COMPENSATION_POPULATION' as const,
          },
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
    (dialog?.kind === 'CREATE' && (!fields.cycleCode || !fields.effectiveFrom || !fields.guidelines || !fields.population)) ||
    (dialog?.kind === 'REVISE' && (!fields.effectiveFrom || !fields.guidelines || !fields.population)) ||
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
      data-route="/hr/operations/performance/compensation-planning"
      sx={{ minHeight: 1, bgcolor: 'background.default', color: 'text.primary', p: { xs: 2, md: 3 } }}
    >
      <Stack gap={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.main">Performance · Compensation</Typography>
            <Typography component="h1" variant="h4" sx={{ overflowWrap: 'anywhere' }}>{copy.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>{copy.subtitle}</Typography>
          </Box>
          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
            <ActionButton intent="secondary" onClick={onRefresh}>{copy.refresh}</ActionButton>
            <ActionButton intent="primary" disabled={!actions.canCreate || !actions.onCreate} onClick={() => openDialog('CREATE')}>
              {copy.newCycle}
            </ActionButton>
          </Stack>
        </Stack>

        <OperationalContextBar
          label="Compensation planning context"
          items={[
            { label: 'Cycle', value: selected ? `${selected.cycleCode} · v${selected.aggregateVersion}` : 'None selected' },
            { label: 'Checker', value: actorId || 'Current governed actor' },
            { label: 'Field policy', value: cycleDetail ? `r${cycleDetail.fieldPolicyRevision}` : '—' },
          ]}
          status={
            <LiveStatus
              state={proposalsError || proposalDetailError ? 'degraded' : proposalLoading ? 'syncing' : 'live'}
              label={proposalsError || proposalDetailError ? 'Partial data unavailable' : proposalLoading ? 'Refreshing' : 'Current'}
              detail={freshnessWatermark
                ? `Server ${freshnessWatermark}`
                : lastRefreshedAt ? `Refreshed ${new Date(lastRefreshedAt).toLocaleString(locale)}` : 'Awaiting server watermark'}
              refreshLabel={copy.refresh}
              onRefresh={onRefresh}
              refreshing={proposalLoading}
            />
          }
        />

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
                        <StatusChip status={cycle.status} />
                      </ActionButton>
                    </Box>
                  ))}
                </Stack>
              </Paper>

              <Paper variant="outlined" className="compplan-semantic-panel" sx={{ minWidth: 0, p: 2 }}>
                <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                  <Typography component="h2" variant="h6">Plan readiness</Typography>
                  {selected ? <StatusChip status={selected.status} /> : null}
                </Stack>
                {!selected ? (
                  <Typography color="text.secondary" sx={{ py: 4 }}>Select a cycle to inspect its readiness.</Typography>
                ) : (
                  <Stack gap={2} sx={{ mt: 2 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' }, gap: 1 }}>
                      {[
                        ['Eligible assignments', String(eligibleAssignments)],
                        ['Eligible component links', String(eligibleComponents)],
                        ['Exceptions', '0 · HARD_CAP'],
                        ['Submitted', `${submittedCount}/${proposals?.items.length ?? '—'}`],
                        ['Approval readiness', approvalReady ? 'Ready for server revalidation' : 'Not ready'],
                        ['Maker/checker', 'Server lineage enforced'],
                      ].map(([label, value]) => (
                        <Paper key={label} variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
                        </Paper>
                      ))}
                    </Box>

                    <Box>
                      <Typography component="h3" variant="subtitle1">Budget buckets</Typography>
                      {selected.budgetMasked ? (
                        <Typography color="text.secondary">{copy.restricted}</Typography>
                      ) : budgets.length ? (
                        <>
                          <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
                            <Table size="small" aria-label="Budget totals used and remaining">
                              <TableHead><TableRow><TableCell>Organization / currency</TableCell><TableCell>Total</TableCell><TableCell>Used</TableCell><TableCell>Remaining</TableCell></TableRow></TableHead>
                              <TableBody>{budgets.map((row) => (
                                <TableRow key={`${row.organization}:${row.currency}`}>
                                  <TableCell sx={{ overflowWrap: 'anywhere' }}>{row.organization}<br />{row.currency}</TableCell>
                                  <TableCell>{row.allocated}</TableCell><TableCell>{copy.restricted}</TableCell><TableCell>{copy.notProjected}</TableCell>
                                </TableRow>
                              ))}</TableBody>
                            </Table>
                          </TableContainer>
                          <Stack gap={1} sx={{ display: { xs: 'flex', md: 'none' }, mt: 1 }}>
                            {budgets.map((row) => (
                              <Paper key={`${row.organization}:${row.currency}`} variant="outlined" sx={{ p: 1.5 }}>
                                <Typography variant="caption" color="text.secondary">Organization / currency</Typography>
                                <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{row.organization} · {row.currency}</Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 1, mt: 1 }}>
                                  <Box><Typography variant="caption" color="text.secondary">Total</Typography><Typography variant="body2">{row.allocated}</Typography></Box>
                                  <Box><Typography variant="caption" color="text.secondary">Used</Typography><Typography variant="body2">{copy.restricted}</Typography></Box>
                                  <Box><Typography variant="caption" color="text.secondary">Remaining</Typography><Typography variant="body2">{copy.notProjected}</Typography></Box>
                                </Box>
                              </Paper>
                            ))}
                          </Stack>
                        </>
                      ) : <Typography color="text.secondary">No visible ledger entries.</Typography>}
                    </Box>

                    <Divider />
                    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                      <Typography component="h3" variant="subtitle1">{copy.proposals}</Typography>
                      <Typography variant="caption" color="text.secondary">{visibleProposals.length}</Typography>
                    </Stack>
                    {proposalsError ? (
                      <InlineFeedback
                        severity="error"
                        title="Proposal panel unavailable"
                        action={onRetryProposals ? <ActionButton size="small" intent="secondary" onClick={onRetryProposals}>{copy.retry}</ActionButton> : undefined}
                      >
                        {proposalsError}. Cycle and budget context remain available.
                      </InlineFeedback>
                    ) : proposalLoading && !proposals ? (
                      <Typography color="text.secondary">Loading proposals…</Typography>
                    ) : visibleProposals.length === 0 ? (
                      <Typography color="text.secondary">No proposals in this cycle.</Typography>
                    ) : (
                      <>
                        <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
                          <Table size="small" aria-label="Compensation proposals">
                            <TableHead><TableRow><TableCell>Component</TableCell><TableCell>Worker / assignment</TableCell><TableCell>Amount</TableCell><TableCell>Status</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
                            <TableBody>{visibleProposals.map((proposal) => {
                              const detail = proposalDetail?.item.proposalId === proposal.proposalId ? proposalDetail.item : null;
                              return (
                                <TableRow key={proposal.proposalId} selected={proposal.proposalId === selectedProposalId}>
                                  <TableCell>{proposal.componentCode}</TableCell>
                                  <TableCell sx={{ overflowWrap: 'anywhere' }}>{proposal.workerId}<br />{proposal.assignmentId}</TableCell>
                                  <TableCell>{detail?.amountMasked ? copy.restricted : detail?.amount ? `${detail.amount} ${detail.currency}` : (
                                    <ActionButton size="small" intent="quiet" onClick={() => onSelectProposal?.(proposal.proposalId)}>View amount</ActionButton>
                                  )}</TableCell>
                                  <TableCell><StatusChip status={proposal.status} /></TableCell>
                                  <TableCell>
                                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                                      <ActionButton size="small" intent="quiet" disabled={!actions.canDraftProposal} onClick={() => openDialog('PROPOSAL', proposal)}>Edit</ActionButton>
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
                                  <StatusChip status={proposal.status} />
                                </Stack>
                                <Typography variant="caption" color="text.secondary">Worker / assignment</Typography>
                                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{proposal.workerId}<br />{proposal.assignmentId}</Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  Amount: {detail?.amountMasked ? copy.restricted : detail?.amount ? `${detail.amount} ${detail.currency}` : copy.restricted}
                                </Typography>
                                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                                  <ActionButton size="small" intent="quiet" onClick={() => onSelectProposal?.(proposal.proposalId)}>View amount</ActionButton>
                                  <ActionButton size="small" intent="quiet" disabled={!actions.canDraftProposal} onClick={() => openDialog('PROPOSAL', proposal)}>Edit</ActionButton>
                                  <ActionButton size="small" intent="secondary" disabled={!actions.canSubmitProposal || proposal.status !== 'DRAFT'} onClick={() => openDialog('SUBMIT', proposal)}>{copy.submit}</ActionButton>
                                </Stack>
                              </Paper>
                            );
                          })}
                        </Stack>
                      </>
                    )}
                    {proposalDetailError ? (
                      <InlineFeedback severity="error" title="Proposal detail unavailable" action={onRetryProposalDetail ? <ActionButton size="small" intent="secondary" onClick={onRetryProposalDetail}>{copy.retry}</ActionButton> : undefined}>
                        {proposalDetailError}. No stale or mismatched amount is rendered.
                      </InlineFeedback>
                    ) : null}
                  </Stack>
                )}
              </Paper>

              <Paper variant="outlined" className="compplan-semantic-panel" sx={{ minWidth: 0, p: 2 }}>
                <Typography component="h2" variant="h6">{copy.actions}</Typography>
                <Stack gap={1} sx={{ mt: 2, '& button': { minHeight: 44, whiteSpace: 'normal' } }}>
                  <ActionButton disabled={!actions.canRevise} onClick={() => openDialog('REVISE')}>{copy.revise}</ActionButton>
                  <ActionButton disabled={!actions.canAllocate} onClick={() => openDialog('BUDGET')}>{copy.budget}</ActionButton>
                  <ActionButton disabled={!actions.canDraftProposal} onClick={() => openDialog('PROPOSAL')}>{copy.proposal}</ActionButton>
                  <ActionButton intent="primary" disabled={!actions.canApprove} onClick={() => openDialog('APPROVE')}>{copy.approve}</ActionButton>
                  <ActionButton intent="primary" disabled={!actions.canPublish} onClick={() => openDialog('PUBLISH')}>{copy.publish}</ActionButton>
                  <ActionButton intent="danger" disabled={!actions.canCancel} onClick={() => openDialog('CANCEL')}>{copy.cancelCycle}</ActionButton>
                </Stack>
                <InlineFeedback severity="info" title="Hard-cap policy" sx={{ mt: 2 }}>
                  Approval performs a fresh population, identity, guideline, and organization/currency budget check.
                </InlineFeedback>
              </Paper>
            </Box>
          </>
        )}
      </Stack>

      <FormDialog
        open={Boolean(dialog)}
        title={dialogTitle}
        description={highRisk ? 'Review impact, checker identity, reason, and immutable evidence before continuing.' : undefined}
        cancelLabel={copy.close}
        submitLabel={copy.confirm}
        submittingLabel="Recording governed command"
        busy={commandBusy}
        submitDisabled={submitDisabled}
        submitIntent={dialog?.kind === 'CANCEL' ? 'danger' : 'primary'}
        onClose={() => !commandBusy && setDialog(null)}
        onSubmit={submitDialog}
        maxWidth="md"
        mobileFullScreen
      >
        <Stack gap={2}>
          {formError ? <InlineFeedback severity="error" title="Command not submitted">{formError}</InlineFeedback> : null}
          {dialog?.kind === 'CREATE' || dialog?.kind === 'REVISE' ? (
            <>
              {dialog.kind === 'CREATE' ? field(fields, setFields, 'cycleCode', 'Cycle code', { required: true }) : null}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {field(fields, setFields, 'effectiveFrom', 'Effective from', { required: true, type: 'date', InputLabelProps: { shrink: true } })}
                {field(fields, setFields, 'effectiveTo', 'Effective to', { type: 'date', InputLabelProps: { shrink: true } })}
              </Box>
              <TextField label="Budget mode" value="HARD_CAP" disabled fullWidth />
              {field(fields, setFields, 'guidelines', 'Guideline rows (closed JSON)', { required: true, multiline: true, minRows: 6 })}
              {field(fields, setFields, 'population', 'Frozen population rows (closed JSON)', { required: true, multiline: true, minRows: 7 })}
              <Typography variant="subtitle2">HRM population source</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {field(fields, setFields, 'snapshotPublicId', 'Snapshot public ID', { required: true })}
                {field(fields, setFields, 'ownerRevision', 'Owner revision', { required: true, type: 'number' })}
                {field(fields, setFields, 'sourceAsOf', 'Source as-of instant', { required: true })}
                {field(fields, setFields, 'sourceSha', 'Source SHA-256', { required: true })}
              </Box>
            </>
          ) : null}
          {dialog?.kind === 'BUDGET' ? (
            <>
              <TextField select label="Ledger operation" value={fields.ledgerEntryType ?? 'ALLOCATE'} onChange={(event) => setFields((current) => ({ ...current, ledgerEntryType: event.target.value }))} fullWidth>
                <MenuItem value="ALLOCATE">ALLOCATE</MenuItem><MenuItem value="REVERSE">REVERSE</MenuItem>
              </TextField>
              {field(fields, setFields, 'organizationPublicId', 'Organization public ID', { required: true })}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {field(fields, setFields, 'currency', 'Currency', { required: true })}
                {field(fields, setFields, 'amount', 'Canonical amount', { required: true, helperText: 'p19/s4 string; no trailing zeros' })}
              </Box>
              {fields.ledgerEntryType === 'REVERSE' ? field(fields, setFields, 'reversesEntryPublicId', 'Source ledger entry ID', { required: true }) : null}
            </>
          ) : null}
          {dialog?.kind === 'PROPOSAL' ? (
            <>
              {field(fields, setFields, 'proposalId', 'Proposal public ID', { required: true, disabled: Boolean(dialog.proposal) })}
              {field(fields, setFields, 'workerPublicId', 'Worker public ID', { required: true })}
              {field(fields, setFields, 'assignmentPublicId', 'Assignment public ID', { required: true })}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' }, gap: 1.5 }}>
                {field(fields, setFields, 'componentCode', 'Component', { required: true })}
                {field(fields, setFields, 'proposalCurrency', 'Currency', { required: true })}
                {field(fields, setFields, 'proposalAmount', 'Canonical amount', { required: true })}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {field(fields, setFields, 'proposalFrom', 'Effective from', { required: true, type: 'date', InputLabelProps: { shrink: true } })}
                {field(fields, setFields, 'proposalTo', 'Effective to', { type: 'date', InputLabelProps: { shrink: true } })}
              </Box>
              {field(fields, setFields, 'supersedesProposalPublicId', 'Supersedes proposal ID (optional)')}
            </>
          ) : null}
          {dialog?.kind === 'SUBMIT' ? (
            <>
              <InlineFeedback severity="info" title="Bound proposal">
                {dialog.proposal?.proposalId} · v{dialog.proposal?.aggregateVersion}<br />Digest {dialog.proposal?.contentDigest}
              </InlineFeedback>
              {field(fields, setFields, 'submissionDigest', 'Submission digest', { required: true, disabled: true })}
              {field(fields, setFields, 'submissionDate', 'Effective date', { type: 'date', InputLabelProps: { shrink: true } })}
            </>
          ) : null}
          {dialog?.kind === 'APPROVE' || dialog?.kind === 'PUBLISH' ? (
            <>
              <InlineFeedback severity={approvalReady || dialog.kind === 'PUBLISH' ? 'warning' : 'error'} title="Impact preview">
                Cycle {selected?.cycleCode} · source v{selected?.aggregateVersion}; {submittedCount} submitted proposals.
                Amounts and scope are revalidated by the server before any receipt, transition, or outbox write.
              </InlineFeedback>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">Maker/checker context</Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>Checker: {actorId || 'current governed actor'}</Typography>
                <Typography variant="body2">All successful maker-side cycle/proposal receipts are included in server lineage. A maker cannot approve or publish.</Typography>
              </Paper>
              {dialog.kind === 'APPROVE'
                ? field(fields, setFields, 'reasonCode', 'Approval reason code', { required: true, helperText: 'Uppercase governed code, for example ANNUAL_REVIEW' })
                : field(fields, setFields, 'approvalReceiptId', 'Approval receipt ID', { required: true })}
              <FormControlLabel control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />} label={copy.immutable} sx={{ alignItems: 'flex-start' }} />
            </>
          ) : null}
          {dialog?.kind === 'CANCEL' ? (
            <>
              <InlineFeedback severity="warning" title="Cycle impact">The selected cycle is cancelled with an immutable empty command body.</InlineFeedback>
              <FormControlLabel control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />} label="I confirm cancellation of this cycle." />
            </>
          ) : null}
        </Stack>
      </FormDialog>
    </Box>
  );
}

export default CompensationPlanningWorkspace;
