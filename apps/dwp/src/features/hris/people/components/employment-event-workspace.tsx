import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  DatePickerField,
  FormDialog,
  FormField,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useProductSurfaceGovernedMutation } from '../../../../components/use-product-surface-governed-mutation';
import {
  EMPLOYMENT_EVENT_ROUTE_BINDINGS,
  buildConcurrentEmploymentEventCommand,
  buildHireEmploymentEventCommand,
  createEmploymentEvent,
  employmentEventFailure,
  employmentEventReceiptDisposition,
  getEmploymentEvent,
  getEmploymentEventCommandReceipt,
  submitEmploymentEvent,
  validateEmploymentEvent,
} from '../../employment/assignment-proposal-model';

import type { AssignmentProposalWorkspacePortProps } from '../../../../components/assignment-proposal-port';
import type {
  AssignmentProposalSelection,
  EmploymentEventCommandResult,
  EmploymentEventFailure,
  EmploymentEventImpact,
  EmploymentEventLifecycle,
  EmploymentEventCommandReceiptStatus,
  EmploymentType,
  EmploymentOwnerRef,
} from '../../employment/assignment-proposal-model';
import { getEmploymentAssignmentsWorkbench } from '../api/employment-workbench-api';

const OWNER_FIELDS = [
  ['legalEmployerRef', 'Legal employer', 'HRM.LegalEmployer.v1'],
  ['organizationRef', 'Organization', 'HRM.Organization.v1'],
  ['positionRef', 'Position', 'HRM.Position.v1'],
  ['jobRef', 'Job', 'HRM.Job.v1'],
  ['workLocationRef', 'Work location', 'HRM.WorkLocation.v1'],
] as const;
type OwnerField = (typeof OWNER_FIELDS)[number][0];
type OwnerDraft = Readonly<{ publicId: string; revision: string; contentHash: string }>;
type Stage = Readonly<{
  eventPublicId: string;
  lifecycleState: EmploymentEventLifecycle;
  version: number;
  receiptId: string | null;
  receiptStatus: EmploymentEventCommandReceiptStatus | null;
}>;

export type EmploymentEventPublish = (
  command: Readonly<{
    eventPublicId: string;
    expectedVersion: 3;
    idempotencyKey: string;
    correlationId: string;
  }>
) => Promise<EmploymentEventCommandResult>;

export type EmploymentEventWorkspaceProps = Pick<
  AssignmentProposalWorkspacePortProps,
  'requestScope' | 'onClose'
> &
  Readonly<{
    selection: Extract<AssignmentProposalSelection, { kind: 'employment-create' }>;
    publishEvent?: EmploymentEventPublish;
  }>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankOwners(): Record<OwnerField, OwnerDraft> {
  return Object.fromEntries(
    OWNER_FIELDS.map(([field]) => [field, { publicId: '', revision: '', contentHash: '' }])
  ) as Record<OwnerField, OwnerDraft>;
}

function ownerRef(draft: OwnerDraft, schemaId: string): EmploymentOwnerRef {
  return {
    owner: 'HRM',
    schemaId,
    publicId: draft.publicId.trim(),
    revision: Number(draft.revision),
    contentHash: draft.contentHash.trim(),
  };
}

function ownerDraft(ref: EmploymentOwnerRef): OwnerDraft {
  return { publicId: ref.publicId, revision: String(ref.revision), contentHash: ref.contentHash };
}

function failureMessage(failure: EmploymentEventFailure): string {
  if (failure.kind === 'PRIMARY_OVERLAP') {
    return 'A primary assignment already overlaps this effective period. Change the period or make this assignment non-primary.';
  }
  if (failure.kind === 'STALE_VERSION') {
    return `The worker or owner reference changed. Refresh before continuing${failure.currentVersion === null ? '.' : ` (current version ${failure.currentVersion}).`}`;
  }
  if (failure.kind === 'DENIED') {
    return 'This employment event is not available in the current tenant, population, or permission scope.';
  }
  if (failure.kind === 'IDEMPOTENCY_CONFLICT') {
    return 'That command key belongs to different request bytes. The command was not submitted again.';
  }
  if (failure.kind === 'RESULT_UNKNOWN') {
    return 'The result is unknown. Do not submit a duplicate command; reconcile the original receipt.';
  }
  return failure.kind === 'INVALID'
    ? 'The event did not pass the effective-date or employment rules.'
    : 'The employment service is unavailable. No protected result is shown.';
}

export function employmentEventActionLabel(
  lifecycleState: EmploymentEventLifecycle | null,
  publishAvailable: boolean
): 'Create event' | 'Validate impact' | 'Submit for approval' | 'Refresh status' | 'Publish' {
  if (!lifecycleState) return 'Create event';
  if (lifecycleState === 'DRAFT') return 'Validate impact';
  if (lifecycleState === 'VALIDATED') return 'Submit for approval';
  if (lifecycleState === 'APPROVED' && publishAvailable) return 'Publish';
  return 'Refresh status';
}

export function EmploymentEventWorkspace({
  selection,
  requestScope,
  onClose,
  publishEvent,
}: EmploymentEventWorkspaceProps) {
  const { t } = useTranslation('workforce');
  const [relationshipStart, setRelationshipStart] = useState(today());
  const [validToExclusive, setValidToExclusive] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('EMPLOYEE');
  const [primary, setPrimary] = useState(selection.eventType === 'HIRE');
  const [fte, setFte] = useState('1.0');
  const [owners, setOwners] = useState(blankOwners);
  const [stage, setStage] = useState<Stage | null>(null);
  const [impact, setImpact] = useState<EmploymentEventImpact | null>(null);
  const [failure, setFailure] = useState<EmploymentEventFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const createDispatch = useProductSurfaceGovernedMutation(EMPLOYMENT_EVENT_ROUTE_BINDINGS.create);
  const validateDispatch = useProductSurfaceGovernedMutation(
    EMPLOYMENT_EVENT_ROUTE_BINDINGS.validate
  );
  const submitDispatch = useProductSurfaceGovernedMutation(EMPLOYMENT_EVENT_ROUTE_BINDINGS.submit);
  const assignments = useQuery({
    queryKey: [
      'hris',
      'employment',
      'assignment-workbench',
      relationshipStart,
      ...requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      getEmploymentAssignmentsWorkbench(
        requestScope.contextScopeKey,
        `${relationshipStart}T00:00:00Z`,
        signal
      ),
    enabled:
      selection.eventType === 'CONCURRENT_EMPLOYMENT' &&
      requestScope.ready &&
      Boolean(relationshipStart) &&
      !stage,
    meta: requestScope.queryMeta,
    retry: false,
  });
  const sourceAssignment = useMemo(
    () =>
      assignments.data?.assignments.find(
        (assignment) => assignment.workerPublicId === selection.subjectPublicId
      ) ?? null,
    [assignments.data, selection.subjectPublicId]
  );
  const workbenchStale = Boolean(
    sourceAssignment && sourceAssignment.workerVersion !== selection.expectedVersion
  );
  const receiptDisposition = stage?.receiptStatus
    ? employmentEventReceiptDisposition({ status: stage.receiptStatus })
    : null;
  const receiptUnsettled =
    receiptDisposition === 'PENDING' || receiptDisposition === 'RESULT_UNKNOWN';
  useEffect(() => {
    if (!sourceAssignment) return;
    setOwners({
      legalEmployerRef: ownerDraft(sourceAssignment.legalEmployerRef),
      organizationRef: ownerDraft(sourceAssignment.organizationRef),
      positionRef: ownerDraft(sourceAssignment.positionRef),
      jobRef: ownerDraft(sourceAssignment.jobRef),
      workLocationRef: ownerDraft(sourceAssignment.workLocationRef),
    });
  }, [sourceAssignment]);
  const draftComplete = useMemo(
    () =>
      Boolean(relationshipStart && fte.trim()) &&
      Object.values(owners).every(
        (owner) => owner.publicId.trim() && owner.revision.trim() && owner.contentHash.trim()
      ),
    [fte, owners, relationshipStart]
  );
  const locked =
    failure?.kind === 'DENIED' ||
    failure?.kind === 'IDEMPOTENCY_CONFLICT' ||
    failure?.kind === 'RESULT_UNKNOWN' ||
    failure?.kind === 'UNAVAILABLE';
  const stale = failure?.kind === 'STALE_VERSION';
  const validationBlocked = Boolean(impact?.blockingIssues.length);
  const primaryDisabled =
    busy ||
    !requestScope.ready ||
    locked ||
    (stale && !stage) ||
    Boolean(receiptDisposition && receiptDisposition !== 'SUCCEEDED') ||
    (!stage &&
      selection.eventType === 'CONCURRENT_EMPLOYMENT' &&
      (assignments.isLoading || assignments.isError || !sourceAssignment || workbenchStale)) ||
    (!stage && !draftComplete) ||
    (stage?.lifecycleState === 'VALIDATED' && validationBlocked) ||
    stage?.lifecycleState === 'PUBLISHED';

  const updateOwner = (field: OwnerField, key: keyof OwnerDraft, value: string) => {
    setOwners((current) => ({ ...current, [field]: { ...current[field], [key]: value } }));
    setFailure(null);
  };
  const saveResult = (result: EmploymentEventCommandResult) => {
    setStage({
      eventPublicId: result.eventPublicId,
      lifecycleState: result.lifecycleState,
      version: result.version,
      receiptId: result.receipt.receiptId,
      receiptStatus: result.receipt.status,
    });
    setFailure(null);
  };
  const refresh = async () => {
    if (!stage) return;
    const result = await getEmploymentEvent(
      stage.eventPublicId,
      requestScope.contextScopeKey
    );
    setStage({ ...stage, lifecycleState: result.lifecycleState, version: result.version });
    setFailure(null);
  };
  const reconcile = async () => {
    const receiptId = failure?.receiptId ?? (receiptUnsettled ? stage?.receiptId : null);
    if (!receiptId) return;
    setBusy(true);
    try {
      const receipt = await getEmploymentEventCommandReceipt(
        receiptId,
        requestScope.contextScopeKey
      );
      if (!stage) return;
      const disposition = employmentEventReceiptDisposition(receipt);
      if (disposition === 'SUCCEEDED') {
        const snapshot = await getEmploymentEvent(
          stage.eventPublicId,
          requestScope.contextScopeKey
        );
        setStage({
          ...stage,
          lifecycleState: snapshot.lifecycleState,
          version: snapshot.version,
          receiptId,
          receiptStatus: receipt.status,
        });
      } else {
        setStage({ ...stage, receiptId, receiptStatus: receipt.status });
      }
      setFailure(null);
    } catch (error) {
      setFailure(employmentEventFailure(error));
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    setBusy(true);
    try {
      if (stale && stage) {
        await refresh();
        return;
      }
      if (receiptUnsettled) {
        await reconcile();
        return;
      }
      setFailure(null);
      if (!stage) {
        const idempotencyKey = crypto.randomUUID();
        const correlationId = crypto.randomUUID();
        const ref = (field: OwnerField) =>
          ownerRef(owners[field], OWNER_FIELDS.find(([name]) => name === field)![2]);
        const assignment = {
          organizationRef: ref('organizationRef'),
          positionRef: ref('positionRef'),
          jobRef: ref('jobRef'),
          workLocationRef: ref('workLocationRef'),
          validFrom: relationshipStart,
          validToExclusive: validToExclusive || null,
          primary,
          fte: fte.trim(),
        } as const;
        const common = {
          idempotencyKey,
          effectiveAt: `${relationshipStart}T00:00:00Z`,
          legalEmployerRef: ref('legalEmployerRef'),
          relationshipStart,
          assignment,
        };
        const command =
          selection.eventType === 'HIRE'
            ? buildHireEmploymentEventCommand({
                ...common,
                personPublicId: selection.subjectPublicId,
                employmentType,
              })
            : buildConcurrentEmploymentEventCommand({
                ...common,
                workerPublicId: selection.subjectPublicId,
                expectedWorkerVersion: selection.expectedVersion,
              });
        saveResult(
          await createDispatch((authority) =>
            createEmploymentEvent(command, correlationId, authority)
          )
        );
      } else if (stage.lifecycleState === 'DRAFT') {
        const result = await validateDispatch((authority) =>
          validateEmploymentEvent(
            {
              eventPublicId: stage.eventPublicId,
              expectedVersion: 0,
              idempotencyKey: crypto.randomUUID(),
              correlationId: crypto.randomUUID(),
            },
            authority
          )
        );
        setImpact(result.impact);
        setStage({ ...stage, lifecycleState: 'VALIDATED', version: 1 });
      } else if (stage.lifecycleState === 'VALIDATED') {
        saveResult(
          await submitDispatch((authority) =>
            submitEmploymentEvent(
              {
                eventPublicId: stage.eventPublicId,
                expectedVersion: 1,
                idempotencyKey: crypto.randomUUID(),
                correlationId: crypto.randomUUID(),
              },
              authority
            )
          )
        );
      } else if (stage.lifecycleState === 'APPROVED' && publishEvent) {
        saveResult(
          await publishEvent({
            eventPublicId: stage.eventPublicId,
            expectedVersion: 3,
            idempotencyKey: crypto.randomUUID(),
            correlationId: crypto.randomUUID(),
          })
        );
      } else {
        await refresh();
      }
    } catch (error) {
      setFailure(employmentEventFailure(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open
      title={t('assignments.employmentEvent.title', { defaultValue: 'Employment lifecycle event' })}
      description={t('assignments.employmentEvent.description', {
        defaultValue: 'Create an effective-dated assignment, validate it, and submit it for approval.',
      })}
      cancelLabel={t('common.actions.close')}
      submitLabel={
        stale && stage
          ? 'Refresh status'
          : employmentEventActionLabel(stage?.lifecycleState ?? null, Boolean(publishEvent))
      }
      submittingLabel="Working…"
      onClose={onClose}
      onSubmit={run}
      busy={busy}
      submitDisabled={primaryDisabled}
      showSubmit={stage?.lifecycleState !== 'PUBLISHED'}
      maxWidth="md"
      desktopMaxWidth={760}
      mobileFullScreen
    >
      <Stack gap={2} divider={<Divider flexItem />} data-testid="employment-event-workspace">
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip label={selection.eventType} size="small" />
          <Chip label={`owner v${selection.expectedVersion}`} size="small" variant="outlined" />
          {stage ? <Chip label={`${stage.lifecycleState} · v${stage.version}`} size="small" /> : null}
        </Stack>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          Subject: {selection.subjectPublicId}
        </Typography>

        {failure ? (
          <Alert
            severity={failure.kind === 'DENIED' ? 'warning' : 'error'}
            action={
              failure.receiptId ? (
                <ActionButton intent="quiet" size="small" onClick={() => void reconcile()}>
                  Reconcile receipt
                </ActionButton>
              ) : undefined
            }
          >
            {failureMessage(failure)}
          </Alert>
        ) : null}
        {receiptUnsettled ? (
          <Alert
            severity="warning"
            action={
              <ActionButton intent="quiet" size="small" onClick={() => void reconcile()}>
                Reconcile receipt
              </ActionButton>
            }
          >
            {receiptDisposition === 'RESULT_UNKNOWN'
              ? 'The command result is unknown. Reconcile this receipt; do not submit a duplicate.'
              : 'The command is still processing. Refresh this receipt before continuing.'}
          </Alert>
        ) : null}
        {receiptDisposition === 'REJECTED' ? (
          <Alert severity="error">The command receipt was rejected. No later action is enabled.</Alert>
        ) : null}
        {stage?.lifecycleState === 'PENDING_APPROVAL' ? (
          <Alert severity="info">
            Approval is pending. Refresh the same event; do not create or submit a duplicate.
          </Alert>
        ) : null}
        {stage?.lifecycleState === 'APPROVED' && !publishEvent ? (
          <Alert severity="warning">
            Approval is complete. Publishing remains unavailable until a current step-up authority is supplied.
          </Alert>
        ) : null}
        {stage?.lifecycleState === 'PUBLISHED' ? (
          <Alert severity="success">The employment event was published to the assignment ledger.</Alert>
        ) : null}

        {!stage && selection.eventType === 'CONCURRENT_EMPLOYMENT' ? (
          assignments.isLoading ? (
            <LoadingState label="Loading current worker ownership…" size="compact" />
          ) : assignments.isError ? (
            <Alert severity="warning">
              Current assignment ownership is unavailable in this scope. The command is disabled.
            </Alert>
          ) : !sourceAssignment ? (
            <Alert severity="warning">
              No disclosed worker assignment matches this event. The command is disabled.
            </Alert>
          ) : workbenchStale ? (
            <Alert severity="warning">
              The worker is now version {sourceAssignment.workerVersion}. Reopen the event from the current workbench row.
            </Alert>
          ) : null
        ) : null}

        {!stage ? (
          <Stack gap={2}>
            <DatePickerField
              required
              label="Relationship and assignment start"
              value={relationshipStart}
              onValueChange={(value) => setRelationshipStart(value ?? '')}
            />
            <DatePickerField
              label="Assignment end (exclusive)"
              value={validToExclusive}
              minDate={relationshipStart}
              onValueChange={(value) => setValidToExclusive(value ?? '')}
            />
            {selection.eventType === 'HIRE' ? (
              <SelectField
                label="Employment type"
                value={employmentType}
                onValueChange={(value) => setEmploymentType(value as EmploymentType)}
                options={['EMPLOYEE', 'CONTINGENT', 'INTERN', 'APPRENTICE'].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            ) : null}
            <SelectField
              label="Primary assignment"
              value={String(primary)}
              onValueChange={(value) => setPrimary(value === 'true')}
              options={[
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
              ]}
            />
            <FormField
              required
              label="Full-time equivalent"
              value={fte}
              inputProps={{ inputMode: 'decimal' }}
              onChange={(event) => setFte(event.target.value)}
            />
            {OWNER_FIELDS.map(([field, label]) => (
              <Stack key={field} gap={1}>
                <Typography component="h3" variant="subtitle2">
                  {label} owner reference
                </Typography>
                <FormField
                  required
                  label={`${label} public ID`}
                  value={owners[field].publicId}
                  onChange={(event) => updateOwner(field, 'publicId', event.target.value)}
                />
                <FormField
                  required
                  label={`${label} revision`}
                  value={owners[field].revision}
                  inputProps={{ inputMode: 'numeric' }}
                  onChange={(event) => updateOwner(field, 'revision', event.target.value)}
                />
                <FormField
                  required
                  label={`${label} content hash`}
                  value={owners[field].contentHash}
                  inputProps={{ maxLength: 64 }}
                  onChange={(event) => updateOwner(field, 'contentHash', event.target.value)}
                />
              </Stack>
            ))}
          </Stack>
        ) : impact ? (
          <Stack gap={1}>
            <Typography variant="subtitle2">Validation impact</Typography>
            {impact.blockingIssues.map((issue) => (
              <Alert severity="error" key={issue}>
                {issue}
              </Alert>
            ))}
            {impact.warnings.map((warning) => (
              <Alert severity="warning" key={warning}>
                {warning}
              </Alert>
            ))}
            {!impact.blockingIssues.length && !impact.warnings.length ? (
              <Alert severity="success">No blocking assignment impact was found.</Alert>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </FormDialog>
  );
}
