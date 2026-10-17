import { useState } from 'react';
import {
  ActionButton,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  PAYROLL_COMMAND_CENTER_PATH,
  PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY,
  PAYROLL_RUN_PREPARE_DEFAULT_ROLLOUT,
  payrollPopulationItemIsSafeToPrepare,
  payrollRunPrepareEnabledForTenant,
} from './payroll-population-contract';
import { payrollPopulationCopy } from './payroll-population-copy';
import { usePayrollPopulationWorkspace } from './use-payroll-population-workspace';

import type { FormEvent, ReactNode } from 'react';
import type { PayrollPopulationDataSource } from './payroll-population-api';
import type {
  PayrollPopulationFieldDecision,
  PayrollPopulationItem,
  PayrollPopulationProjection,
  PayrollRunPrepareDraft,
  PayrollRunPrepareRollout,
} from './payroll-population-contract';
import type { PayrollPopulationCopy } from './payroll-population-copy';
import type {
  PayrollPopulationOwnerBinding,
  PayrollPopulationScope,
  PayrollPopulationWorkspaceController,
} from './use-payroll-population-workspace';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RUN_TYPES: readonly PayrollRunPrepareDraft['runType'][] = Object.freeze([
  'REGULAR',
  'OFF_CYCLE',
  'RETRO',
  'CORRECTION',
]);
const EMPTY_PREPARE_DRAFT: PayrollRunPrepareDraft = Object.freeze({
  runType: 'REGULAR',
  payrollEntityId: '',
  payGroupId: '',
  payPeriodId: '',
});

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (current, [key, replacement]) => current.replace(`{{${key}}}`, String(replacement)),
    template
  );
}

function DecisionRow({
  label,
  passed,
  copy,
}: {
  label: string;
  passed: boolean;
  copy: PayrollPopulationCopy;
}) {
  return (
    <Stack
      component="li"
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={1}
      sx={{ py: 0.75 }}
    >
      <Typography variant="body2">{label}</Typography>
      <Chip
        size="small"
        color={passed ? 'success' : 'default'}
        variant={passed ? 'filled' : 'outlined'}
        label={passed ? copy.pass : copy.fail}
      />
    </Stack>
  );
}

function EvidenceField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box component="div" sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

function visibleValue<T>(decision: PayrollPopulationFieldDecision<T> | undefined) {
  return decision?.decision === 'VIEW' ? decision.value : null;
}

function hiddenLabel<T>(
  decision: PayrollPopulationFieldDecision<T> | undefined,
  copy: PayrollPopulationCopy
) {
  return decision?.decision === 'MASK' ? copy.masked : copy.omitted;
}

function PopulationNavigation({
  controller,
  copy,
  onSelect,
}: {
  controller: PayrollPopulationWorkspaceController;
  copy: PayrollPopulationCopy;
  onSelect: (item: PayrollPopulationItem) => void;
}) {
  const items = controller.projection?.items ?? [];
  return (
    <Paper component="nav" aria-label={copy.populations} variant="outlined" sx={{ minWidth: 0 }}>
      <Box sx={{ p: 1.5, pb: 0.5 }}>
        <Typography component="h2" variant="subtitle1">
          {copy.populations}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {interpolate(copy.populationCount, { count: items.length })}
        </Typography>
      </Box>
      <List disablePadding>
        {items.map((item) => (
          <ListItem key={item.itemPublicId} disablePadding>
            <ListItemButton
              selected={controller.selected?.itemPublicId === item.itemPublicId}
              aria-pressed={controller.selected?.itemPublicId === item.itemPublicId}
              aria-label={`${copy.populations}: ${item.title}`}
              onClick={() => onSelect(item)}
              sx={{ alignItems: 'flex-start', minWidth: 0 }}
            >
              <ListItemText
                primary={item.title}
                secondary={item.itemPublicId}
                primaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                secondaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
              />
              <Chip size="small" variant="outlined" label={item.statusCode} sx={{ ml: 1 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}

function Preflight({
  projection,
  selected,
  copy,
  prepareAvailable,
}: {
  projection: PayrollPopulationProjection;
  selected: PayrollPopulationItem;
  copy: PayrollPopulationCopy;
  prepareAvailable: boolean;
}) {
  const aggregate = visibleValue(selected.fieldGroups.PAYROLL_POPULATION);
  const complete =
    projection.queryState.state === 'COMPLETE' &&
    projection.queryState.partialFailures.length === 0 &&
    Boolean(aggregate && aggregate.itemCount > 0);
  const current = projection.queryState.freshness === 'CURRENT';
  const safe = prepareAvailable && payrollPopulationItemIsSafeToPrepare(projection, selected);
  return (
    <Box component="section" aria-labelledby="payroll-population-preflight-title">
      <Typography id="payroll-population-preflight-title" component="h3" variant="subtitle2">
        {copy.preflight}
      </Typography>
      <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} divider={<Divider flexItem />}>
        <DecisionRow label={copy.completeness} passed={complete} copy={copy} />
        <DecisionRow label={copy.freshness} passed={current} copy={copy} />
        <DecisionRow label={copy.safeToFreeze} passed={safe} copy={copy} />
      </Stack>
    </Box>
  );
}

function CommandFeedback({
  controller,
  copy,
}: {
  controller: PayrollPopulationWorkspaceController;
  copy: PayrollPopulationCopy;
}) {
  const feedback = controller.feedback;
  if (!feedback) return null;
  if (feedback.kind === 'STEP_UP') {
    return (
      <InlineFeedback severity="info" title={copy.stepUpTitle}>
        {copy.stepUpDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'ACCEPTED' || feedback.kind === 'SUCCEEDED') {
    const succeeded = feedback.kind === 'SUCCEEDED';
    return (
      <InlineFeedback
        severity="success"
        title={succeeded ? copy.preparedTitle : copy.acceptedTitle}
        action={
          <ActionButton intent="secondary" size="small" href={PAYROLL_COMMAND_CENTER_PATH}>
            {copy.commandCenter}
          </ActionButton>
        }
      >
        {succeeded ? copy.preparedDescription : copy.acceptedDescription}{' '}
        {feedback.receipt.receiptId}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'RESULT_UNKNOWN') {
    return (
      <InlineFeedback
        severity="warning"
        title={copy.resultUnknownTitle}
        action={
          <ActionButton
            intent="secondary"
            size="small"
            disabled={controller.busy || !controller.hasPendingExactRetry}
            onClick={controller.retryExact}
          >
            {copy.retryExact}
          </ActionButton>
        }
      >
        {copy.resultUnknownDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'PERMISSION') {
    return (
      <InlineFeedback severity="error" title={copy.permissionCommandTitle}>
        {copy.permissionCommandDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'CONFLICT') {
    return (
      <InlineFeedback severity="warning" title={copy.conflictTitle}>
        {copy.conflictDescription}
      </InlineFeedback>
    );
  }
  return (
    <InlineFeedback severity="error" title={copy.rejectedTitle}>
      {feedback.kind === 'INVALID' ? feedback.message : copy.rejectedDescription}
    </InlineFeedback>
  );
}

function PopulationDetail({
  controller,
  copy,
  draft,
  onDraftChange,
}: {
  controller: PayrollPopulationWorkspaceController;
  copy: PayrollPopulationCopy;
  draft: PayrollRunPrepareDraft;
  onDraftChange: (draft: PayrollRunPrepareDraft) => void;
}) {
  const selected = controller.selected;
  const projection = controller.projection;
  if (!selected || !projection) return null;
  const aggregateDecision = selected.fieldGroups.PAYROLL_POPULATION;
  const metadataDecision = selected.fieldGroups.PROJECTION_VERSION;
  const aggregate = visibleValue(aggregateDecision);
  const metadata = visibleValue(metadataDecision);
  const identifiersValid = [draft.payrollEntityId, draft.payGroupId, draft.payPeriodId].every(
    (value) => UUID.test(value)
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    controller.prepare(draft);
  }

  return (
    <Paper component="article" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
      <Stack gap={2}>
        <Box minWidth={0}>
          <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {selected.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {selected.itemPublicId} · {selected.statusCode}
          </Typography>
        </Box>

        <Preflight
          projection={projection}
          selected={selected}
          copy={copy}
          prepareAvailable={controller.prepareAvailable}
        />
        <Divider />

        <Box
          component="dl"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
            m: 0,
          }}
        >
          <EvidenceField label={copy.aggregate}>
            {aggregate
              ? `${copy.rows}: ${aggregate.itemCount}`
              : hiddenLabel(aggregateDecision, copy)}
          </EvidenceField>
          <EvidenceField label={copy.revision}>
            {aggregate?.revision ?? hiddenLabel(aggregateDecision, copy)}
          </EvidenceField>
          <EvidenceField label={copy.asOf}>
            {aggregate?.asOf ?? hiddenLabel(aggregateDecision, copy)}
          </EvidenceField>
          <EvidenceField label={copy.projectionVersion}>
            {metadata
              ? `${metadata.key} · ${metadata.version}`
              : hiddenLabel(metadataDecision, copy)}
          </EvidenceField>
          <EvidenceField label={copy.digest}>
            {metadata?.digest ?? (metadata ? copy.omitted : hiddenLabel(metadataDecision, copy))}
          </EvidenceField>
        </Box>

        {projection.queryState.partialFailures.length > 0 && (
          <Box component="section" aria-labelledby="payroll-population-failures-title">
            <Typography id="payroll-population-failures-title" component="h3" variant="subtitle2">
              {copy.partialFailures}
            </Typography>
            <Stack component="ul" gap={0.5} sx={{ mt: 0.75, mb: 0, pl: 2.5 }}>
              {projection.queryState.partialFailures.map((failure) => (
                <Typography component="li" variant="body2" key={failure.correlationId}>
                  {failure.componentKey} · {failure.errorCode}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        <Divider />
        <Box component="form" onSubmit={submit} noValidate aria-describedby="prepare-help">
          <Stack gap={1.5}>
            <Typography component="h3" variant="subtitle1">
              {copy.prepare}
            </Typography>
            <Typography id="prepare-help" variant="body2" color="text.secondary">
              {copy.prepareHelp}
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              label={copy.runType}
              value={draft.runType}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  runType: event.target.value as PayrollRunPrepareDraft['runType'],
                })
              }
            >
              {RUN_TYPES.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              label={copy.payrollEntity}
              value={draft.payrollEntityId}
              onChange={(event) => onDraftChange({ ...draft, payrollEntityId: event.target.value })}
              inputProps={{ autoComplete: 'off', spellCheck: false }}
            />
            <TextField
              fullWidth
              size="small"
              label={copy.payrollGroup}
              value={draft.payGroupId}
              onChange={(event) => onDraftChange({ ...draft, payGroupId: event.target.value })}
              inputProps={{ autoComplete: 'off', spellCheck: false }}
            />
            <TextField
              fullWidth
              size="small"
              label={copy.payPeriod}
              value={draft.payPeriodId}
              onChange={(event) => onDraftChange({ ...draft, payPeriodId: event.target.value })}
              inputProps={{ autoComplete: 'off', spellCheck: false }}
            />
            <ActionButton
              type="submit"
              intent="primary"
              disabled={!controller.canPrepare || !identifiersValid || controller.busy}
              sx={{ alignSelf: { sm: 'flex-start' }, width: { xs: '100%', sm: 'auto' } }}
            >
              {copy.prepare}
            </ActionButton>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function ProjectionFeedback({
  controller,
  copy,
}: {
  controller: PayrollPopulationWorkspaceController;
  copy: PayrollPopulationCopy;
}) {
  if (controller.state.kind === 'PARTIAL') {
    return (
      <InlineFeedback severity="warning" title={copy.partialTitle}>
        {copy.partialDescription}
      </InlineFeedback>
    );
  }
  if (controller.state.kind === 'STALE') {
    return (
      <InlineFeedback severity="warning" title={copy.staleTitle}>
        {copy.staleDescription}
      </InlineFeedback>
    );
  }
  if (controller.state.kind === 'COMPLETE') {
    const ready =
      controller.prepareAvailable &&
      payrollPopulationItemIsSafeToPrepare(controller.projection, controller.selected);
    return (
      <InlineFeedback
        severity={ready ? 'success' : 'warning'}
        title={ready ? copy.completeTitle : copy.blockedTitle}
      >
        {ready ? copy.completeDescription : copy.blockedDescription}
      </InlineFeedback>
    );
  }
  return null;
}

export type PayrollPopulationWorkspaceViewProps = Readonly<{
  controller: PayrollPopulationWorkspaceController;
  locale?: string;
  timeZone?: string;
  copy?: PayrollPopulationCopy;
}>;

export function PayrollPopulationWorkspaceView({
  controller,
  locale = 'en-US',
  timeZone = 'UTC',
  copy = payrollPopulationCopy(locale),
}: PayrollPopulationWorkspaceViewProps) {
  const [effectiveOn, setEffectiveOn] = useState('');
  const [minimumItems, setMinimumItems] = useState('');
  const [maximumItems, setMaximumItems] = useState('');
  const [boundDraft, setBoundDraft] = useState<{
    targetId: string | null;
    draft: PayrollRunPrepareDraft;
  }>({
    targetId: null,
    draft: EMPTY_PREPARE_DRAFT,
  });
  const state = controller.state;
  const loadedState =
    state.kind === 'EMPTY' ||
    state.kind === 'PARTIAL' ||
    state.kind === 'STALE' ||
    state.kind === 'COMPLETE'
      ? state
      : null;
  const selectedId = controller.selected?.itemPublicId ?? null;
  const prepareDraft = boundDraft.targetId === selectedId ? boundDraft.draft : EMPTY_PREPARE_DRAFT;

  function changePrepareDraft(draft: PayrollRunPrepareDraft) {
    setBoundDraft({ targetId: selectedId, draft });
  }

  function selectPopulation(item: PayrollPopulationItem) {
    setBoundDraft({ targetId: null, draft: EMPTY_PREPARE_DRAFT });
    controller.select(item);
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minimumItemCount = minimumItems === '' ? undefined : Number(minimumItems);
    const maximumItemCount = maximumItems === '' ? undefined : Number(maximumItems);
    void controller.review({
      limit: 100,
      filter: {
        ...(effectiveOn ? { effectiveOn } : {}),
        ...(minimumItemCount !== undefined || maximumItemCount !== undefined
          ? {
              payrollPopulation: {
                ...(minimumItemCount !== undefined ? { minimumItemCount } : {}),
                ...(maximumItemCount !== undefined ? { maximumItemCount } : {}),
              },
            }
          : {}),
      },
      sort: ['itemPublicId:ASC'],
      locale,
      timeZone,
    });
  }

  return (
    <Stack
      gap={2.5}
      data-testid="payroll-population-workspace"
      data-slice="BASE-TFR-PAY-013"
      data-runtime-state={state.kind.toLowerCase()}
      sx={{
        minWidth: 0,
        '@media (prefers-reduced-motion: reduce)': {
          '&, & *': { animation: 'none !important', transition: 'none !important' },
        },
        '@media (forced-colors: active)': {
          '& .MuiPaper-outlined': { borderColor: 'CanvasText' },
        },
      }}
    >
      <Box component="header" minWidth={0}>
        <Typography variant="overline" color="text.secondary">
          {copy.eyebrow}
        </Typography>
        <Typography component="h1" variant="h4" sx={{ overflowWrap: 'anywhere' }}>
          {copy.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 800 }}>
          {copy.description}
        </Typography>
        {loadedState && (
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ mt: 1.5 }}>
            <Chip
              size="small"
              color={
                loadedState.projection.queryState.freshness === 'CURRENT' ? 'success' : 'warning'
              }
              label={
                loadedState.projection.queryState.freshness === 'CURRENT'
                  ? copy.current
                  : copy.stale
              }
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ alignSelf: { sm: 'center' } }}
            >
              {copy.lastRefresh}: {new Date(loadedState.loadedAt).toISOString()}
            </Typography>
          </Stack>
        )}
      </Box>

      <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <Stack gap={1.5}>
          <Typography component="h2" variant="h6">
            {copy.operationalQuestion}
          </Typography>
          <Box component="form" onSubmit={review} noValidate>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  md: 'repeat(3, minmax(0, 1fr)) auto',
                },
                gap: 1.5,
                alignItems: 'start',
              }}
            >
              <TextField
                fullWidth
                size="small"
                type="date"
                label={`${copy.effectiveOn} (${copy.optional})`}
                value={effectiveOn}
                onChange={(event) => setEffectiveOn(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                size="small"
                type="number"
                label={`${copy.minimumItems} (${copy.optional})`}
                value={minimumItems}
                onChange={(event) => setMinimumItems(event.target.value)}
                inputProps={{ min: 0, step: 1 }}
              />
              <TextField
                fullWidth
                size="small"
                type="number"
                label={`${copy.maximumItems} (${copy.optional})`}
                value={maximumItems}
                onChange={(event) => setMaximumItems(event.target.value)}
                inputProps={{ min: 0, step: 1 }}
              />
              <ActionButton
                type="submit"
                intent="primary"
                disabled={state.kind === 'LOADING'}
                sx={{ width: { xs: '100%', md: 'auto' } }}
              >
                {copy.review}
              </ActionButton>
            </Box>
          </Box>
        </Stack>
      </Paper>

      <Box aria-live="polite" aria-atomic="false">
        <Stack gap={1.5}>
          <ProjectionFeedback controller={controller} copy={copy} />
          <CommandFeedback controller={controller} copy={copy} />
        </Stack>
      </Box>

      {state.kind === 'IDLE' && (
        <GuidedEmptyState
          kind="empty"
          size="page"
          title={copy.idleTitle}
          description={copy.idleDescription}
        />
      )}
      {state.kind === 'LOADING' && (
        <Paper variant="outlined" sx={{ p: 2 }} aria-busy="true" role="status">
          <LoadingState size="page" variant="skeleton" skeletonRows={4} label={copy.loading} />
        </Paper>
      )}
      {state.kind === 'EMPTY' && (
        <GuidedEmptyState
          kind="empty"
          size="page"
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      )}
      {(state.kind === 'DENIED' || state.kind === 'CLOSED') && (
        <GuidedEmptyState
          kind="permission"
          size="page"
          title={copy.permissionTitle}
          description={copy.permissionDescription}
        />
      )}
      {state.kind === 'UNAVAILABLE' && (
        <LocalErrorState
          size="page"
          title={copy.unavailableTitle}
          description={copy.unavailableDescription}
          retryLabel={copy.refresh}
          onRetry={controller.refresh}
        />
      )}
      {(state.kind === 'PARTIAL' || state.kind === 'STALE' || state.kind === 'COMPLETE') && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(240px, 2fr) minmax(0, 3fr)',
            },
            gap: 2,
            alignItems: 'start',
            minWidth: 0,
          }}
        >
          <PopulationNavigation controller={controller} copy={copy} onSelect={selectPopulation} />
          <PopulationDetail
            controller={controller}
            copy={copy}
            draft={prepareDraft}
            onDraftChange={changePrepareDraft}
          />
        </Box>
      )}
    </Stack>
  );
}

const DEFAULT_SCOPE: PayrollPopulationScope = Object.freeze({
  ready: false,
  tenantId: '',
  decisionRevision: '',
});

export type HrisPayrollPopulationWorkspaceProps = Readonly<{
  tenantId?: string;
  scope?: PayrollPopulationScope;
  rollout?: PayrollRunPrepareRollout;
  ownerBinding?: PayrollPopulationOwnerBinding;
  dataSource?: PayrollPopulationDataSource;
  idFactory?: () => string;
  now?: () => number;
  locale?: string;
  timeZone?: string;
  copy?: PayrollPopulationCopy;
}>;

function ActivePayrollPopulationWorkspace({
  scope,
  ownerBinding,
  dataSource,
  idFactory,
  now,
  locale,
  timeZone,
  copy,
}: Required<Pick<HrisPayrollPopulationWorkspaceProps, 'scope' | 'ownerBinding'>> &
  Omit<HrisPayrollPopulationWorkspaceProps, 'scope' | 'ownerBinding' | 'tenantId' | 'rollout'>) {
  const controller = usePayrollPopulationWorkspace({
    scope,
    ownerBinding,
    ...(dataSource ? { dataSource } : {}),
    ...(idFactory ? { idFactory } : {}),
    ...(now ? { now } : {}),
  });
  return (
    <PayrollPopulationWorkspaceView
      controller={controller}
      {...(locale ? { locale } : {})}
      {...(timeZone ? { timeZone } : {})}
      {...(copy ? { copy } : {})}
    />
  );
}

/**
 * PAY-013 route adapter. PAGE authority admits the inner runtime; DATA and ACTION
 * use their own exact owner aliases after mount. The default rollout mounts no hook.
 */
export function HrisPayrollPopulationWorkspace({
  tenantId = '',
  scope = DEFAULT_SCOPE,
  rollout = PAYROLL_RUN_PREPARE_DEFAULT_ROLLOUT,
  ownerBinding,
  dataSource,
  idFactory,
  now,
  locale = 'en-US',
  timeZone = 'UTC',
  copy = payrollPopulationCopy(locale),
}: HrisPayrollPopulationWorkspaceProps = {}) {
  const admitted =
    payrollRunPrepareEnabledForTenant(rollout, tenantId) &&
    scope.ready &&
    scope.tenantId === tenantId &&
    Boolean(scope.contextScopeKey) &&
    Boolean(scope.decisionRevision) &&
    ownerBinding?.page.routeContractKey === PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY;

  if (!admitted || !ownerBinding) {
    return (
      <Box data-testid="payroll-population-closed" data-feature-state="default-off">
        <GuidedEmptyState
          kind="permission"
          size="page"
          title={copy.closedTitle}
          description={copy.closedDescription}
        />
      </Box>
    );
  }

  return (
    <ActivePayrollPopulationWorkspace
      scope={scope}
      ownerBinding={ownerBinding}
      {...(dataSource ? { dataSource } : {})}
      {...(idFactory ? { idFactory } : {})}
      {...(now ? { now } : {})}
      locale={locale}
      timeZone={timeZone}
      copy={copy}
    />
  );
}

export default HrisPayrollPopulationWorkspace;
