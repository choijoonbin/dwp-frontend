import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  GuidedEmptyState,
  InlineFeedback,
  FormField,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { formatCivilDate, formatDate } from '@dwp-frontend/shared-i18n';
import { BriefcaseBusiness, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HcmQueryState } from '../../../../components/hcm-query-state';
import { ProductSurfaceHighRiskCommandDialog } from '../../../../components/product-surface-high-risk-command';
import { useProductSurfaceCapabilityAccess } from '../../../../components/product-surface-capability-access';
import {
  useProductSurfaceRequestScope,
  type ProductSurfaceRequestScope,
} from '../../../../components/use-product-surface-request-scope';
import { AssignmentProposalWorkspace } from '../../employment/assignment-proposal-workspace';
import { employmentEventCreateReference } from '../../employment/assignment-proposal-model';
import {
  getEmploymentAssignmentsWorkbench,
  type EmploymentAssignment,
  type EmploymentAssignmentsWorkbench,
  type EmploymentWorkbenchOwnerRef,
} from '../api/employment-workbench-api';
import { useEmploymentEventPublish } from '../hooks/use-employment-event-publish';
import {
  getEmploymentAssignmentsCopy,
  type EmploymentAssignmentsCopy,
} from '../model/employment-assignments-copy';
import {
  EMPLOYMENT_ASSIGNMENTS_CAPABILITIES,
  EMPLOYMENT_ASSIGNMENTS_PRODUCTION_CONTRACT,
  EMPLOYMENT_ASSIGNMENTS_SURFACE,
  employmentAssignmentsSnapshotIsStale,
} from '../model/employment-assignments-production';

import type { ReactNode } from 'react';
import type { EmploymentEventPublish } from '../components/employment-event-workspace';

export type EmploymentAssignmentsReader = (
  contextScopeKey?: string,
  asOf?: string,
  signal?: AbortSignal
) => Promise<EmploymentAssignmentsWorkbench>;

export type EmploymentAssignmentProposalRenderer = (input: {
  proposalReference: string;
  requestScope: ProductSurfaceRequestScope;
  onClose: () => void;
  employmentEventPublish?: EmploymentEventPublish;
}) => ReactNode;

const OWNER_REF_FIELDS = [
  ['legalEmployerRef', 'legalEmployer'],
  ['organizationRef', 'organization'],
  ['positionRef', 'position'],
  ['jobRef', 'job'],
  ['workLocationRef', 'workLocation'],
] as const;

function civilPeriod(start: string | null, end: string | null, currentLabel: string) {
  const from = start ? formatCivilDate(start) : '—';
  return `${from} — ${end ? formatCivilDate(end) : currentLabel}`;
}

function instantPeriod(start: string | null, end: string | null, currentLabel: string) {
  const options = { dateStyle: 'medium', timeStyle: 'short' } as const;
  const from = start ? formatDate(start, options) : '—';
  return `${from} — ${end ? formatDate(end, options) : currentLabel}`;
}

function assignmentSearchText(assignment: EmploymentAssignment): string {
  return [
    assignment.personPublicId,
    assignment.workerPublicId,
    assignment.relationshipPublicId,
    assignment.assignmentPublicId,
    assignment.relationshipType,
    assignment.workerStatus,
    assignment.assignmentStatus,
    ...OWNER_REF_FIELDS.map(([field]) => assignment[field]?.publicId ?? ''),
  ]
    .join(' ')
    .toLocaleLowerCase();
}

export function employmentAssignmentsScopeIsReady(scope: ProductSurfaceRequestScope): boolean {
  return Boolean(
    scope.governed &&
    scope.ready &&
    scope.contextScopeKey &&
    scope.queryMeta.accessSensitive &&
    scope.queryMeta.productId === EMPLOYMENT_ASSIGNMENTS_SURFACE.productKey &&
    scope.queryMeta.surfaceId === EMPLOYMENT_ASSIGNMENTS_SURFACE.surfaceKey &&
    scope.queryMeta.contextScopeKey === scope.contextScopeKey &&
    scope.queryMeta.decisionRevision.trim()
  );
}

function statusColor(status: string): 'default' | 'success' | 'warning' | 'error' {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'ACTIVE') return 'success';
  if (normalized === 'PENDING' || normalized === 'SUSPENDED') return 'warning';
  if (normalized === 'TERMINATED' || normalized === 'CANCELLED') return 'error';
  return 'default';
}

function DefinitionField({
  label,
  value,
  mono = false,
}: Readonly<{ label: string; value: ReactNode; mono?: boolean }>) {
  return (
    <Box minWidth={0}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        sx={{
          m: 0,
          mt: 0.25,
          overflowWrap: 'anywhere',
          ...(mono ? { fontFamily: foundationTokens.font.mono } : {}),
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function AssignmentChoice({
  assignment,
  index,
  selected,
  copy,
  onSelect,
}: Readonly<{
  assignment: EmploymentAssignment;
  index: number;
  selected: boolean;
  copy: EmploymentAssignmentsCopy;
  onSelect: () => void;
}>) {
  const titleId = `employment-assignment-${assignment.assignmentPublicId}`;
  return (
    <Paper
      component="li"
      variant="outlined"
      sx={{
        listStyle: 'none',
        minWidth: 0,
        overflow: 'hidden',
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
      }}
    >
      <ButtonBase
        aria-label={copy.reviewAssignment(index + 1)}
        aria-pressed={selected}
        aria-labelledby={titleId}
        onClick={onSelect}
        sx={{ width: '100%', p: { xs: 1.5, sm: 2 }, textAlign: 'left', minWidth: 0 }}
      >
        <Stack gap={1} width="100%" minWidth={0}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }}
            gap={0.75}
            minWidth={0}
          >
            <Typography
              id={titleId}
              component="h3"
              variant="subtitle2"
              fontWeight="fontWeightBold"
              flex={1}
              sx={{ overflowWrap: 'anywhere' }}
            >
              {assignment.relationshipType} · {assignment.assignmentPublicId}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              color={statusColor(assignment.assignmentStatus)}
              label={`${copy.assignmentStatus}: ${assignment.assignmentStatus}`}
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {copy.workerReference}: {assignment.workerPublicId}
          </Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`${copy.workerVersion}: ${assignment.workerVersion}`} />
            <Chip
              size="small"
              label={`${copy.assignmentVersion}: ${assignment.assignmentVersion}`}
            />
            {assignment.primary ? <Chip size="small" label={copy.primary} /> : null}
          </Stack>
        </Stack>
      </ButtonBase>
    </Paper>
  );
}

function OwnerEvidence({
  title,
  owner,
  copy,
}: Readonly<{
  title: string;
  owner: EmploymentWorkbenchOwnerRef | null;
  copy: EmploymentAssignmentsCopy;
}>) {
  return (
    <Paper component="article" variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Typography component="h4" variant="subtitle2" fontWeight="fontWeightBold">
        {title}
      </Typography>
      {!owner ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {copy.unavailable}
        </Typography>
      ) : (
        <Box
          component="dl"
          sx={{
            m: 0,
            mt: 1,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
            minWidth: 0,
          }}
        >
          <DefinitionField label={copy.ownerPublicId} value={owner.publicId} mono />
          <DefinitionField label={copy.ownerRevision} value={owner.revision} />
          <DefinitionField
            label={copy.ownerValidity}
            value={instantPeriod(owner.validFrom, owner.validToExclusive, copy.current)}
          />
          <DefinitionField label={copy.ownerContentHash} value={owner.contentHash} mono />
        </Box>
      )}
    </Paper>
  );
}

export function employmentAssignmentHasCompleteEventEvidence(
  assignment: EmploymentAssignment
): boolean {
  return Boolean(
    assignment.fte &&
    assignment.organizationRef &&
    assignment.positionRef &&
    assignment.jobRef &&
    assignment.workLocationRef
  );
}

function AssignmentDetail({
  assignment,
  copy,
  actionDisabled,
  actionUnavailable,
  actionPaused,
  evidenceIncomplete,
  onStartEvent,
}: Readonly<{
  assignment: EmploymentAssignment;
  copy: EmploymentAssignmentsCopy;
  actionDisabled: boolean;
  actionUnavailable: boolean;
  actionPaused: boolean;
  evidenceIncomplete: boolean;
  onStartEvent: () => void;
}>) {
  return (
    <Stack gap={2} minWidth={0}>
      <Box>
        <Typography component="h2" variant="h6">
          {copy.detailTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {copy.detailDescription}
        </Typography>
      </Box>

      {actionUnavailable ? (
        <InlineFeedback severity="info" title={copy.eventUnavailableTitle}>
          {copy.eventUnavailableDescription}
        </InlineFeedback>
      ) : null}
      {actionPaused ? (
        <InlineFeedback severity="warning" title={copy.eventPausedTitle}>
          {copy.eventPausedDescription}
        </InlineFeedback>
      ) : null}
      {evidenceIncomplete ? (
        <InlineFeedback severity="warning" title={copy.evidenceIncompleteTitle}>
          {copy.evidenceIncompleteDescription}
        </InlineFeedback>
      ) : null}

      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
          minWidth: 0,
        }}
      >
        <DefinitionField label={copy.personReference} value={assignment.personPublicId} mono />
        <DefinitionField label={copy.workerReference} value={assignment.workerPublicId} mono />
        <DefinitionField
          label={copy.relationshipReference}
          value={assignment.relationshipPublicId}
          mono
        />
        <DefinitionField
          label={copy.assignmentReference}
          value={assignment.assignmentPublicId}
          mono
        />
        <DefinitionField label={copy.workerStatus} value={assignment.workerStatus} />
        <DefinitionField label={copy.assignmentStatus} value={assignment.assignmentStatus} />
        <DefinitionField label={copy.relationshipType} value={assignment.relationshipType} />
        <DefinitionField
          label={copy.effectivePeriod}
          value={civilPeriod(assignment.validFrom, assignment.validToExclusive, copy.current)}
        />
        <DefinitionField label={copy.primary} value={assignment.primary ? copy.yes : copy.no} />
        <DefinitionField label={copy.fte} value={assignment.fte ?? copy.unavailable} />
        <DefinitionField label={copy.workerVersion} value={assignment.workerVersion} />
        <DefinitionField label={copy.relationshipVersion} value={assignment.relationshipVersion} />
        <DefinitionField label={copy.assignmentVersion} value={assignment.assignmentVersion} />
      </Box>

      <Box>
        <ActionButton
          intent="primary"
          disabled={actionDisabled}
          startIcon={<Workflow size={16} aria-hidden="true" />}
          onClick={onStartEvent}
          sx={{ width: { xs: '100%', sm: 'auto' }, whiteSpace: 'normal' }}
        >
          {copy.startEvent}
        </ActionButton>
      </Box>

      <Stack component="section" gap={1} aria-labelledby="employment-owner-evidence-title">
        <Typography id="employment-owner-evidence-title" component="h3" variant="subtitle1">
          {copy.ownerEvidence}
        </Typography>
        {OWNER_REF_FIELDS.map(([field, label]) => (
          <OwnerEvidence key={field} title={copy[label]} owner={assignment[field]} copy={copy} />
        ))}
      </Stack>
    </Stack>
  );
}

export function EmploymentAssignmentsRuntime({
  requestScope,
  reader = getEmploymentAssignmentsWorkbench,
  canManageEvents,
  employmentEventPublish,
  renderProposalWorkspace,
  nowMs = Date.now(),
}: Readonly<{
  requestScope: ProductSurfaceRequestScope;
  reader?: EmploymentAssignmentsReader;
  canManageEvents: boolean;
  employmentEventPublish?: EmploymentEventPublish;
  renderProposalWorkspace?: EmploymentAssignmentProposalRenderer;
  nowMs?: number;
}>) {
  const { i18n } = useTranslation();
  const copy = getEmploymentAssignmentsCopy(i18n.resolvedLanguage, i18n.language);
  const exactScopeReady = employmentAssignmentsScopeIsReady(requestScope);
  const [search, setSearch] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [proposalReference, setProposalReference] = useState<string | null>(null);
  const query = useQuery({
    queryKey: [
      'hris',
      'employment',
      'operations-assignments',
      EMPLOYMENT_ASSIGNMENTS_PRODUCTION_CONTRACT.page.contractId,
      ...requestScope.cacheKey,
    ],
    queryFn: ({ signal }) => reader(requestScope.contextScopeKey, undefined, signal),
    enabled: exactScopeReady,
    meta: requestScope.queryMeta,
    retry: false,
  });
  const workbench = query.data;
  const assignments = useMemo(() => workbench?.assignments ?? [], [workbench?.assignments]);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleAssignments = useMemo(
    () =>
      normalizedSearch
        ? assignments.filter((assignment) =>
            assignmentSearchText(assignment).includes(normalizedSearch)
          )
        : assignments,
    [assignments, normalizedSearch]
  );
  useEffect(() => {
    if (!visibleAssignments.length) {
      setSelectedAssignmentId(null);
      return;
    }
    if (
      !selectedAssignmentId ||
      !visibleAssignments.some(
        (assignment) => assignment.assignmentPublicId === selectedAssignmentId
      )
    ) {
      setSelectedAssignmentId(visibleAssignments[0]!.assignmentPublicId);
    }
  }, [selectedAssignmentId, visibleAssignments]);
  const selectedAssignment =
    visibleAssignments.find(
      (assignment) => assignment.assignmentPublicId === selectedAssignmentId
    ) ??
    visibleAssignments[0] ??
    null;
  const partial = Boolean(workbench && query.isRefetchError);
  const stale = Boolean(workbench && employmentAssignmentsSnapshotIsStale(workbench.asOf, nowMs));
  const loading = !exactScopeReady || (!workbench && query.isLoading);
  const failed = exactScopeReady && !workbench && query.error;
  const actionPaused = partial || stale;
  const actionUnavailable = !canManageEvents;
  const evidenceIncomplete = Boolean(
    selectedAssignment && !employmentAssignmentHasCompleteEventEvidence(selectedAssignment)
  );
  const actionDisabled = actionUnavailable || actionPaused || evidenceIncomplete;

  const startEvent = () => {
    if (!selectedAssignment || actionDisabled) return;
    setProposalReference(
      employmentEventCreateReference(
        'CONCURRENT_EMPLOYMENT',
        selectedAssignment.workerPublicId,
        selectedAssignment.workerVersion
      )
    );
  };
  const closeProposal = () => setProposalReference(null);

  return (
    <Stack
      gap={1.5}
      data-slice="BASE-TFR-HRM-008"
      data-workspace="employment-assignments"
      data-route="/hr/operations/people/employment-assignments"
      data-state={partial ? 'partial' : loading ? 'loading' : failed ? 'error' : 'ready'}
      data-stale={stale ? 'true' : 'false'}
      minWidth={0}
      width="100%"
      maxWidth={1280}
      mx="auto"
    >
      <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          gap={1.5}
          minWidth={0}
        >
          <BriefcaseBusiness size={24} aria-hidden="true" />
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              {copy.persona}
            </Typography>
            <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.description}
            </Typography>
          </Box>
          <ActionButton
            intent="primary"
            aria-label={copy.refresh}
            loading={query.isFetching}
            loadingLabel={copy.refreshing}
            disabled={!exactScopeReady}
            startIcon={<RefreshCw size={16} aria-hidden="true" />}
            onClick={() => void query.refetch()}
            sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, whiteSpace: 'normal' }}
          >
            {copy.refresh}
          </ActionButton>
        </Stack>
      </Paper>

      <Paper
        component="section"
        variant="outlined"
        aria-labelledby="employment-assignments-question"
        sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}
      >
        <Stack gap={1.25} minWidth={0}>
          <Stack direction="row" gap={1} alignItems="flex-start" minWidth={0}>
            <ShieldCheck size={20} aria-hidden="true" />
            <Box minWidth={0}>
              <Typography
                id="employment-assignments-question"
                component="h2"
                variant="subtitle1"
                fontWeight="fontWeightBold"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {copy.question}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {copy.guidance}
              </Typography>
            </Box>
          </Stack>
          {workbench ? (
            <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                variant="outlined"
                label={`${copy.asOf}: ${formatDate(workbench.asOf, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}`}
              />
              <Chip
                size="small"
                variant="outlined"
                label={copy.assignmentCount(assignments.length)}
              />
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {partial ? (
        <InlineFeedback severity="warning" title={copy.partialTitle}>
          {copy.partialDescription}
        </InlineFeedback>
      ) : null}
      {stale && !partial ? (
        <InlineFeedback severity="warning" title={copy.staleTitle}>
          {copy.staleDescription}
        </InlineFeedback>
      ) : null}

      {loading ? <HcmQueryState loading size="page" /> : null}
      {failed ? (
        <HcmQueryState
          error={query.error}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
          size="page"
        />
      ) : null}
      {workbench && assignments.length === 0 ? (
        <GuidedEmptyState
          kind="empty"
          size="page"
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          actionLabel={copy.refresh}
          onAction={() => void query.refetch()}
        />
      ) : null}

      {assignments.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(280px, 0.8fr) minmax(0, 1.2fr)',
            },
            gap: 1.5,
            minWidth: 0,
            alignItems: 'start',
          }}
        >
          <Paper
            component="section"
            variant="outlined"
            aria-labelledby="employment-assignments-list-title"
            sx={{ p: { xs: 1, sm: 1.5 }, minWidth: 0 }}
          >
            <Stack gap={1.25} minWidth={0}>
              <Box>
                <Typography id="employment-assignments-list-title" component="h2" variant="h6">
                  {copy.listTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {copy.listDescription}
                </Typography>
              </Box>
              <FormField
                label={copy.searchLabel}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                supportingText={copy.searchHelp}
                fullWidth
                size="small"
                inputProps={{ spellCheck: false }}
              />
              {visibleAssignments.length ? (
                <Stack component="ul" gap={1} sx={{ p: 0, m: 0, minWidth: 0 }}>
                  {visibleAssignments.map((assignment, index) => (
                    <AssignmentChoice
                      key={`${assignment.assignmentPublicId}:${assignment.assignmentVersion}`}
                      assignment={assignment}
                      index={index}
                      selected={
                        assignment.assignmentPublicId === selectedAssignment?.assignmentPublicId
                      }
                      copy={copy}
                      onSelect={() => setSelectedAssignmentId(assignment.assignmentPublicId)}
                    />
                  ))}
                </Stack>
              ) : (
                <GuidedEmptyState
                  kind="empty"
                  size="compact"
                  title={copy.noMatchesTitle}
                  description={copy.noMatchesDescription}
                  actionLabel={copy.clearSearch}
                  onAction={() => setSearch('')}
                />
              )}
            </Stack>
          </Paper>

          <Paper
            component="section"
            variant="outlined"
            aria-label={copy.detailTitle}
            sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}
          >
            {selectedAssignment ? (
              <AssignmentDetail
                assignment={selectedAssignment}
                copy={copy}
                actionDisabled={actionDisabled}
                actionUnavailable={actionUnavailable}
                actionPaused={actionPaused}
                evidenceIncomplete={evidenceIncomplete}
                onStartEvent={startEvent}
              />
            ) : (
              <GuidedEmptyState
                kind="empty"
                size="standard"
                title={copy.chooseTitle}
                description={copy.chooseDescription}
              />
            )}
          </Paper>
        </Box>
      ) : null}

      {proposalReference
        ? (renderProposalWorkspace?.({
            proposalReference,
            requestScope,
            onClose: closeProposal,
            employmentEventPublish,
          }) ?? (
            <AssignmentProposalWorkspace
              proposalReference={proposalReference}
              requestScope={requestScope}
              onProposalReferenceChange={setProposalReference}
              onClose={closeProposal}
              employmentEventPublish={employmentEventPublish}
            />
          ))
        : null}
    </Stack>
  );
}

/** Production adapter for the canonical `/hr/operations/people/employment-assignments` route. */
export function HrisEmploymentAssignmentsWorkspace() {
  const requestScope = useProductSurfaceRequestScope(EMPLOYMENT_ASSIGNMENTS_SURFACE);
  const capabilityAccess = useProductSurfaceCapabilityAccess();
  const publisher = useEmploymentEventPublish();
  const exactScopeReady = employmentAssignmentsScopeIsReady(requestScope);
  const writableOperationsScope = Boolean(
    exactScopeReady &&
    capabilityAccess.governed &&
    capabilityAccess.contextScopeKey === requestScope.contextScopeKey &&
    requestScope.queryMeta.accessMode !== 'PROVIDER_SUPPORT'
  );
  const canManageEvents = Boolean(
    writableOperationsScope &&
    capabilityAccess.hasWritableCapability(EMPLOYMENT_ASSIGNMENTS_CAPABILITIES.manage)
  );
  const canPublishEvents = Boolean(
    writableOperationsScope &&
    capabilityAccess.hasWritableCapability(EMPLOYMENT_ASSIGNMENTS_CAPABILITIES.publish)
  );
  return (
    <>
      <EmploymentAssignmentsRuntime
        requestScope={requestScope}
        canManageEvents={canManageEvents}
        employmentEventPublish={canPublishEvents ? publisher.publishEvent : undefined}
      />
      <ProductSurfaceHighRiskCommandDialog controller={publisher.controller} />
    </>
  );
}

export default HrisEmploymentAssignmentsWorkspace;
