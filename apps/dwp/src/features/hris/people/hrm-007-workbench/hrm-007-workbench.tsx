import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, RefreshCw, Settings2, UsersRound } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  GlyphSurface,
  GuidedEmptyState,
  InlineFeedback,
  LocalErrorState,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  HRM007_ADAPTER_KIND,
  HRM007_FEATURE,
  HRM007_QUERY_CONTRACTS,
  Hrm007ContractError,
  assertHrm007TrustedScope,
} from './hrm-007-contract';
import { hrm007QueryKey, useHrm007WorkbenchQuery } from './use-hrm-007-workbench';

import type { Hrm007QueryAdapter } from './hrm-007-api';
import type {
  Hrm007Action,
  Hrm007FieldDecision,
  Hrm007FieldValue,
  Hrm007Item,
  Hrm007Projection,
  Hrm007QueryId,
  Hrm007QueryOptions,
  Hrm007TrustedScope,
} from './hrm-007-contract';

export type Hrm007RuntimeGate = Readonly<{
  feature: typeof HRM007_FEATURE;
  enabled: boolean;
  tenantEnrolled: boolean;
}>;

export const HRM007_DEFAULT_GATE: Hrm007RuntimeGate = Object.freeze({
  feature: HRM007_FEATURE,
  enabled: false,
  tenantEnrolled: false,
});

export type Hrm007TrustedAdmission = Hrm007TrustedScope &
  Readonly<{
    kind: 'TRUSTED_PRODUCT_SURFACE_PAGE';
    feature: typeof HRM007_FEATURE;
    queryId: Hrm007QueryId;
  }>;

export type Hrm007ActionDelegate = (
  queryId: Hrm007QueryId,
  item: Hrm007Item,
  action: Hrm007Action
) => void;

type PageCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}>;

const PAGE_COPY: Readonly<Record<Hrm007QueryId, PageCopy>> = Object.freeze({
  'IAQ-005': Object.freeze({
    eyebrow: 'Team · governed people changes',
    title: 'Team people changes',
    description:
      'Review disclosed employee-change summaries and continue work in the existing employee-change lifecycle.',
    emptyTitle: 'No disclosed people changes',
    emptyDescription: 'No people-change items are available in this governed team scope.',
  }),
  'IAQ-007': Object.freeze({
    eyebrow: 'HR operations · governed appointments',
    title: 'HR appointments',
    description:
      'Review effective-dated appointments and delegate authorized work to the existing assignment-event lifecycle.',
    emptyTitle: 'No disclosed appointments',
    emptyDescription: 'No appointment items are available in this governed operations scope.',
  }),
  'IAQ-013': Object.freeze({
    eyebrow: 'Settings · governed employment policy',
    title: 'People and employment configuration',
    description:
      'Inspect disclosed employment policies and impact summaries without creating a second configuration lifecycle.',
    emptyTitle: 'No disclosed employment configuration',
    emptyDescription: 'No configuration items are available in this governed settings scope.',
  }),
});

function pageIcon(queryId: Hrm007QueryId) {
  if (queryId === 'IAQ-005') return <UsersRound size={22} aria-hidden="true" />;
  if (queryId === 'IAQ-007') return <BriefcaseBusiness size={22} aria-hidden="true" />;
  return <Settings2 size={22} aria-hidden="true" />;
}

function actionLabel(action: Hrm007Action): string {
  return action.actionKey
    .replace('hris.action.hrm.', '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function valueText(value: Hrm007FieldValue): string {
  if ('itemCount' in value) return `${value.itemCount} items · revision ${value.revision}`;
  if ('policyKey' in value) {
    return `${value.policyKey} · ${value.status} · revision ${value.revision}`;
  }
  if ('durationMinutes' in value) {
    return `${value.startAt} – ${value.endAt ?? 'ongoing'} · ${value.durationMinutes} min`;
  }
  if ('publicId' in value) return `${value.label} · ${value.code} · revision ${value.revision}`;
  if ('effectiveFrom' in value) {
    return `${value.effectiveFrom} – ${value.effectiveTo ?? 'current'} · revision ${value.revision}`;
  }
  return `${value.code} · revision ${value.revision}`;
}

function FieldDecisionView({
  label,
  decision,
}: Readonly<{ label: string; decision: Hrm007FieldDecision | undefined }>) {
  const value = !decision
    ? 'Not disclosed'
    : decision.decision === 'MASK'
      ? 'Restricted by field policy'
      : valueText(decision.value);
  return (
    <Box component="div" sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label.replaceAll('_', ' ')}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        fontWeight="subtitle2.fontWeight"
        sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function WorkbenchList({
  items,
  selected,
  onSelect,
}: Readonly<{
  items: readonly Hrm007Item[];
  selected: Hrm007Item;
  onSelect: (item: Hrm007Item) => void;
}>) {
  const { t } = useTranslation('workforce');
  return (
    <Paper component="section" variant="outlined" sx={{ p: 1.25, minWidth: 0 }}>
      <Typography component="h2" variant="subtitle1" sx={{ px: 0.5, mb: 1 }}>
        {t('governedPeople.hrm007.list.title')}
      </Typography>
      <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {items.map((item) => {
          const active = item.itemPublicId === selected.itemPublicId;
          return (
            <Box component="li" key={item.itemPublicId} sx={{ '& + &': { mt: 0.75 } }}>
              <Box
                component="button"
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(item)}
                sx={{
                  width: '100%',
                  minHeight: 48,
                  p: 1.25,
                  border: 1,
                  borderColor: active ? 'primary.main' : 'divider',
                  borderRadius: foundationTokens.radius.control + 'px',
                  bgcolor: active ? 'action.selected' : 'background.paper',
                  color: 'text.primary',
                  textAlign: 'left',
                  cursor: 'pointer',
                  '@media (forced-colors: active)': { borderColor: 'ButtonText' },
                  '@media (prefers-reduced-motion: reduce)': { scrollBehavior: 'auto' },
                  '&:focus-visible': { outline: '2px solid', outlineOffset: 2 },
                }}
              >
                <Typography
                  component="span"
                  variant="body2"
                  fontWeight="fontWeightBold"
                  display="block"
                >
                  {item.title}
                </Typography>
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {item.statusCode.replaceAll('_', ' ')}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

function WorkbenchDetail({
  queryId,
  item,
  deepLink,
  actionsEnabled,
  onDelegateAction,
}: Readonly<{
  queryId: Hrm007QueryId;
  item: Hrm007Item;
  deepLink: string;
  actionsEnabled: boolean;
  onDelegateAction?: Hrm007ActionDelegate;
}>) {
  const { t } = useTranslation('workforce');
  const contract = HRM007_QUERY_CONTRACTS[queryId];
  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
        <Box minWidth={0} flex={1}>
          <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {item.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {item.itemPublicId}
          </Typography>
        </Box>
        <Chip size="small" variant="outlined" label={item.statusCode.replaceAll('_', ' ')} />
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {contract.fieldGroups.map((group) => (
          <FieldDecisionView key={group} label={group} decision={item.fieldGroups[group]} />
        ))}
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 2 }} flexWrap="wrap">
        <Link component={RouterLink} to={deepLink} underline="hover" sx={{ alignSelf: 'center' }}>
          {t('governedPeople.hrm007.detail.open')}
        </Link>
        {item.availableActions.map((action) => (
          <ActionButton
            key={action.actionKey}
            intent="secondary"
            size="small"
            disabled={!actionsEnabled || !onDelegateAction}
            onClick={() => {
              if (actionsEnabled) onDelegateAction?.(queryId, item, action);
            }}
          >
            {actionLabel(action)}
          </ActionButton>
        ))}
      </Stack>
      {item.availableActions.length > 0 && !onDelegateAction && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {t('governedPeople.hrm007.detail.actionsUnavailable')}
        </Typography>
      )}
    </Paper>
  );
}

function mustConcealProjection(error: unknown) {
  return (
    error instanceof Hrm007ContractError ||
    (error instanceof HttpError && [400, 401, 403, 404, 409].includes(error.status))
  );
}

function mayRetainCachedProjection(error: unknown) {
  return (
    (error instanceof HttpError && [429, 503].includes(error.status)) ||
    (error instanceof HttpTransportError && error.reason === 'NETWORK')
  );
}

const HRM007_FILTER_SEARCH_KEYS: Readonly<Record<Hrm007QueryId, readonly string[]>> = Object.freeze(
  {
    'IAQ-005': Object.freeze([
      'filter[changeRequestSummary][minimumItemCount]',
      'filter[changeRequestSummary][maximumItemCount]',
      'filter[limitedEmployment][codes]',
      'filter[limitedEmployment][minimumRevision]',
      'filter[approvalStatus][codes]',
      'filter[approvalStatus][minimumRevision]',
      'filter[effectiveOn]',
    ]),
    'IAQ-007': Object.freeze([
      'filter[appointment][startFrom]',
      'filter[appointment][startTo]',
      'filter[appointment][endFrom]',
      'filter[appointment][endTo]',
      'filter[assignment][codes]',
      'filter[assignment][publicIds]',
      'filter[employment][activeOn]',
      'filter[employment][from]',
      'filter[employment][to]',
      'filter[effectiveOn]',
    ]),
    'IAQ-013': Object.freeze([
      'filter[policyMetadata][policyKeys]',
      'filter[policyMetadata][minimumRevision]',
      'filter[employmentRule][policyKeys]',
      'filter[employmentRule][minimumRevision]',
      'filter[impactSummary][minimumItemCount]',
      'filter[impactSummary][maximumItemCount]',
      'filter[effectiveOn]',
    ]),
  }
);

const REPEATABLE_FILTER_SEARCH_KEY = /\]\[(?:codes|publicIds|policyKeys)\]$/u;
const HRM007_AS_OF = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const LEGAL_ENTITY_PUBLIC_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function appendSingleSearchValue(
  target: URLSearchParams,
  source: URLSearchParams,
  key: string,
  validate: (value: string) => boolean = (value) =>
    Boolean(value) && value === value.trim() && value.length <= 1024
) {
  const values = source.getAll(key);
  if (values.length === 1 && validate(values[0]!)) target.append(key, values[0]!);
}

function governedSearchParams(
  queryId: Hrm007QueryId,
  current: URLSearchParams,
  focus: string
): URLSearchParams {
  const next = new URLSearchParams({ tab: 'overview', focus });
  appendSingleSearchValue(
    next,
    current,
    'scope',
    (value) => Boolean(value) && value === value.trim() && value.length <= 256
  );
  const navigationScopes = current.getAll('navigationScope');
  const legalEntityPublicIds = current.getAll('legalEntityPublicId');
  if (
    navigationScopes.length === 1 &&
    navigationScopes[0] === 'TENANT' &&
    legalEntityPublicIds.length === 0
  ) {
    next.set('navigationScope', 'TENANT');
  }
  if (
    navigationScopes.length === 1 &&
    navigationScopes[0] === 'LEGAL_ENTITY' &&
    legalEntityPublicIds.length === 1 &&
    LEGAL_ENTITY_PUBLIC_ID.test(legalEntityPublicIds[0]!)
  ) {
    next.set('navigationScope', 'LEGAL_ENTITY');
    next.set('legalEntityPublicId', legalEntityPublicIds[0]!);
  }
  appendSingleSearchValue(next, current, 'asOf', (value) => HRM007_AS_OF.test(value));

  const requestedSort = current.getAll('sort');
  const canonicalSort = [...requestedSort];
  if (canonicalSort.length && !canonicalSort.some((value) => value.startsWith('itemPublicId:'))) {
    canonicalSort.push('itemPublicId:ASC');
  }
  if (
    canonicalSort.length <= 3 &&
    new Set(canonicalSort).size === canonicalSort.length &&
    canonicalSort.every((value) =>
      (HRM007_QUERY_CONTRACTS[queryId].sorts as readonly string[]).includes(value)
    ) &&
    (canonicalSort.length === 0 || canonicalSort.at(-1)?.startsWith('itemPublicId:'))
  ) {
    requestedSort.forEach((value) => next.append('sort', value));
  }

  HRM007_FILTER_SEARCH_KEYS[queryId].forEach((key) => {
    const values = current.getAll(key);
    const repeatable = REPEATABLE_FILTER_SEARCH_KEY.test(key);
    if (
      values.length === 0 ||
      (!repeatable && values.length !== 1) ||
      (repeatable && (values.length > 50 || new Set(values).size !== values.length)) ||
      values.some((value) => !value || value !== value.trim() || value.length > 1024)
    ) {
      return;
    }
    values.forEach((value) => next.append(key, value));
  });
  return next;
}

function ProjectionWorkspace({
  queryId,
  projection,
  staleByRefreshFailure,
  fetching,
  onRefresh,
  onNext,
  onPrevious,
  canPrevious,
  onDelegateAction,
}: Readonly<{
  queryId: Hrm007QueryId;
  projection: Hrm007Projection;
  staleByRefreshFailure: boolean;
  fetching: boolean;
  onRefresh: () => void;
  onNext: () => void;
  onPrevious: () => void;
  canPrevious: boolean;
  onDelegateAction?: Hrm007ActionDelegate;
}>) {
  const { t } = useTranslation('workforce');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFocus = searchParams.get('focus');
  const selected =
    projection.items.find((item) => item.deepLink.resourcePublicId === requestedFocus) ??
    projection.items[0] ??
    null;
  const stale = staleByRefreshFailure || projection.queryState.freshness === 'STALE';
  const runtimeState = stale ? 'stale' : projection.queryState.state.toLowerCase();
  const copy = PAGE_COPY[queryId];
  const select = (item: Hrm007Item) => {
    setSearchParams(governedSearchParams(queryId, searchParams, item.deepLink.resourcePublicId), {
      replace: true,
    });
  };
  return (
    <Stack
      gap={2}
      data-testid="hrm-007-workbench"
      data-query-id={queryId}
      data-variant={projection.variantKey}
      data-runtime-state={runtimeState}
      sx={{ minWidth: 0 }}
    >
      <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ md: 'center' }}>
          <GlyphSurface size={44} variant="soft">
            {pageIcon(queryId)}
          </GlyphSurface>
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              {copy.eyebrow}
            </Typography>
            <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.description}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              size="small"
              color={stale ? 'warning' : 'success'}
              label={stale ? 'STALE' : projection.queryState.freshness}
            />
            <Chip size="small" variant="outlined" label={`${projection.items.length} items`} />
            <ActionButton
              intent="quiet"
              size="small"
              loading={fetching}
              startIcon={<RefreshCw size={15} aria-hidden="true" />}
              onClick={onRefresh}
            >
              {t('governedPeople.common.refresh')}
            </ActionButton>
          </Stack>
        </Stack>
      </Paper>

      {stale && (
        <InlineFeedback severity="warning" title={t('governedPeople.hrm007.states.staleTitle')}>
          {t('governedPeople.hrm007.states.staleDescription')}
        </InlineFeedback>
      )}
      {projection.queryState.state === 'PARTIAL' && (
        <InlineFeedback severity="warning" title={t('governedPeople.hrm007.states.partialTitle')}>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {projection.queryState.partialFailures.map((failure) => (
              <li key={`${failure.componentKey}:${failure.correlationId}`}>
                {failure.componentKey} · {failure.errorCode}
              </li>
            ))}
          </Box>
        </InlineFeedback>
      )}

      {projection.items.length === 0 ? (
        <GuidedEmptyState
          kind="no-results"
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          size="page"
        />
      ) : selected ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(260px, 340px) minmax(0, 1fr)',
            },
            gap: 2,
            alignItems: 'start',
            minWidth: 0,
          }}
        >
          <WorkbenchList items={projection.items} selected={selected} onSelect={select} />
          <WorkbenchDetail
            queryId={queryId}
            item={selected}
            deepLink={`${selected.deepLink.route}?${governedSearchParams(
              queryId,
              searchParams,
              selected.deepLink.resourcePublicId
            ).toString()}`}
            actionsEnabled={
              !fetching &&
              !stale &&
              projection.queryState.freshness === 'CURRENT' &&
              projection.queryState.state === 'COMPLETE'
            }
            onDelegateAction={onDelegateAction}
          />
        </Box>
      ) : null}

      <Stack direction="row" gap={1} justifyContent="flex-end">
        <ActionButton intent="quiet" disabled={!canPrevious || fetching} onClick={onPrevious}>
          {t('governedPeople.common.previous')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          disabled={!projection.queryState.nextCursor || fetching}
          onClick={onNext}
        >
          {t('governedPeople.common.next')}
        </ActionButton>
      </Stack>
    </Stack>
  );
}

type AdmittedHrm007WorkbenchProps = Readonly<{
  queryId: Hrm007QueryId;
  scope: Hrm007TrustedScope;
  adapter: Hrm007QueryAdapter;
  options?: Hrm007QueryOptions;
  onDelegateAction?: Hrm007ActionDelegate;
}>;

type Hrm007TerminalFailure = Readonly<{
  kind: 'concealed' | 'unavailable';
  queryKey: readonly unknown[];
}>;

function ActiveHrm007Workbench({
  queryId,
  scope,
  adapter,
  options,
  onDelegateAction,
  onTerminalFailure,
}: AdmittedHrm007WorkbenchProps &
  Readonly<{ onTerminalFailure: (failure: Hrm007TerminalFailure) => void }>) {
  const { t } = useTranslation('workforce');
  const queryClient = useQueryClient();
  const actionFence = useRef(false);
  const initialCursor = options?.cursor ?? null;
  const [cursorHistory, setCursorHistory] = useState<readonly (string | null)[]>([initialCursor]);
  const pageIndex = cursorHistory.length - 1;
  const cursor = cursorHistory[pageIndex] ?? null;
  const activeOptions = { ...options, cursor };
  const queryKey = hrm007QueryKey(adapter, queryId, scope, activeOptions);
  const query = useHrm007WorkbenchQuery({
    adapter,
    queryId,
    scope,
    options: activeOptions,
  });
  const concealError = mustConcealProjection(query.error);
  const discardError = Boolean(query.error && !mayRetainCachedProjection(query.error));
  useEffect(() => {
    if (!query.isFetching && !query.error) actionFence.current = false;
  }, [query.data, query.error, query.isFetching]);
  useEffect(() => {
    if (discardError) {
      onTerminalFailure({ kind: concealError ? 'concealed' : 'unavailable', queryKey });
    }
  }, [concealError, discardError, onTerminalFailure, queryKey]);
  if (concealError) {
    return (
      <div data-testid="hrm-007-denied" data-runtime-state="denied">
        <GuidedEmptyState
          kind="permission"
          title={t('governedPeople.hrm007.states.deniedTitle')}
          description={t('governedPeople.hrm007.states.deniedDescription')}
          size="page"
        />
      </div>
    );
  }
  if (query.isPending && !query.data) {
    return (
      <Typography role="status" aria-live="polite" data-runtime-state="loading">
        {t('governedPeople.hrm007.states.loading')}
      </Typography>
    );
  }
  if (query.error && !mayRetainCachedProjection(query.error)) {
    return (
      <div data-testid="hrm-007-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.hrm007.states.unavailableTitle')}
          description={t('governedPeople.hrm007.states.unavailableDescription')}
          retryLabel="Retry"
          onRetry={() =>
            onTerminalFailure({ kind: concealError ? 'concealed' : 'unavailable', queryKey })
          }
          retrying={query.isFetching}
          size="page"
        />
      </div>
    );
  }
  if (!query.data) {
    return (
      <div data-testid="hrm-007-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.hrm007.states.unavailableTitle')}
          description={t('governedPeople.hrm007.states.unavailableDescription')}
          retryLabel="Retry"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          size="page"
        />
      </div>
    );
  }
  if (query.data.queryState.state === 'UNAVAILABLE') {
    return (
      <div data-testid="hrm-007-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.hrm007.states.unavailableTitle')}
          description={t('governedPeople.hrm007.states.noDisclosableData')}
          retryLabel="Retry"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          requestIdLabel={query.data.queryState.correlationId}
          size="page"
        />
      </div>
    );
  }
  const delegateCurrentAction: Hrm007ActionDelegate | undefined = onDelegateAction
    ? (delegatedQueryId, delegatedItem, delegatedAction) => {
        const liveState = queryClient.getQueryState<Hrm007Projection>(queryKey);
        const liveProjection = liveState?.data;
        if (
          actionFence.current ||
          delegatedQueryId !== queryId ||
          !liveState ||
          liveState.fetchStatus !== 'idle' ||
          liveState.status !== 'success' ||
          liveState.error ||
          liveProjection?.queryState.state !== 'COMPLETE' ||
          liveProjection.queryState.freshness !== 'CURRENT'
        ) {
          return;
        }
        const liveItem = liveProjection.items.find(
          (item) => item.itemPublicId === delegatedItem.itemPublicId
        );
        const liveAction = liveItem?.availableActions.find(
          (action) => action.actionKey === delegatedAction.actionKey
        );
        if (liveItem && liveAction) onDelegateAction(queryId, liveItem, liveAction);
      }
    : undefined;
  return (
    <ProjectionWorkspace
      queryId={queryId}
      projection={query.data}
      staleByRefreshFailure={Boolean(query.error && mayRetainCachedProjection(query.error))}
      fetching={query.isFetching}
      onRefresh={() => {
        actionFence.current = true;
        void query.refetch();
      }}
      canPrevious={pageIndex > 0}
      onPrevious={() => {
        actionFence.current = true;
        setCursorHistory((history) => history.slice(0, -1));
      }}
      onNext={() => {
        const next = query.data.queryState.nextCursor;
        if (next) {
          actionFence.current = true;
          setCursorHistory((history) => [...history, next]);
        }
      }}
      onDelegateAction={delegateCurrentAction}
    />
  );
}

function AdmittedHrm007Workbench(props: AdmittedHrm007WorkbenchProps) {
  const { t } = useTranslation('workforce');
  const queryClient = useQueryClient();
  const [terminalFailure, setTerminalFailure] = useState<Hrm007TerminalFailure | null>(null);
  useEffect(() => {
    if (!terminalFailure) return;
    const exactQuery = { queryKey: terminalFailure.queryKey, exact: true } as const;
    let cancellation: Promise<void>;
    try {
      cancellation = queryClient.cancelQueries(exactQuery);
    } catch {
      cancellation = Promise.resolve();
    }
    queryClient.removeQueries(exactQuery);
    void cancellation.catch(() => undefined);
  }, [queryClient, terminalFailure]);
  if (terminalFailure?.kind === 'concealed') {
    return (
      <div data-testid="hrm-007-denied" data-runtime-state="denied">
        <GuidedEmptyState
          kind="permission"
          title={t('governedPeople.hrm007.states.deniedTitle')}
          description={t('governedPeople.hrm007.states.deniedDescription')}
          size="page"
        />
      </div>
    );
  }
  if (terminalFailure?.kind === 'unavailable') {
    return (
      <div data-testid="hrm-007-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.hrm007.states.unavailableTitle')}
          description={t('governedPeople.hrm007.states.unavailableDescription')}
          retryLabel="Retry"
          onRetry={() => setTerminalFailure(null)}
          retrying={false}
          size="page"
        />
      </div>
    );
  }
  return <ActiveHrm007Workbench {...props} onTerminalFailure={setTerminalFailure} />;
}

export type Hrm007WorkbenchProps = Readonly<{
  queryId: Hrm007QueryId;
  gate?: Hrm007RuntimeGate;
  admission?: Hrm007TrustedAdmission;
  /** Test/source-completion seam only. Production admission supplies its own trusted scope. */
  scope?: Hrm007TrustedScope;
  adapter?: Hrm007QueryAdapter;
  options?: Hrm007QueryOptions;
  onDelegateAction?: Hrm007ActionDelegate;
}>;

export function Hrm007Workbench({
  queryId,
  gate = HRM007_DEFAULT_GATE,
  admission,
  scope,
  adapter,
  options,
  onDelegateAction,
}: Hrm007WorkbenchProps) {
  const { t } = useTranslation('workforce');
  const trustedAdmission = Boolean(
    admission?.kind === 'TRUSTED_PRODUCT_SURFACE_PAGE' &&
    admission.feature === HRM007_FEATURE &&
    admission.queryId === queryId
  );
  const rolloutAdmitted = gate.feature === HRM007_FEATURE && gate.enabled && gate.tenantEnrolled;
  if (!rolloutAdmitted) {
    return (
      <div data-testid="hrm-007-disabled" data-runtime-state="disabled">
        <GuidedEmptyState
          kind="permission"
          title={t('governedPeople.hrm007.states.notEnabledTitle')}
          description={t('governedPeople.hrm007.states.notEnabledDescription')}
          titleComponent="h1"
          size="page"
        />
      </div>
    );
  }
  let trustedScope: Hrm007TrustedScope;
  try {
    trustedScope = assertHrm007TrustedScope(
      trustedAdmission && admission
        ? {
            tenantId: admission.tenantId,
            actorId: admission.actorId,
            accessMode: admission.accessMode,
            contextScopeKey: admission.contextScopeKey,
            decisionRevision: admission.decisionRevision,
            locale: admission.locale,
            timeZone: admission.timeZone,
            correlationId: admission.correlationId,
          }
        : scope
    );
  } catch {
    return (
      <div data-testid="hrm-007-denied" data-runtime-state="denied">
        <GuidedEmptyState
          kind="permission"
          title={t('governedPeople.hrm007.states.deniedTitle')}
          description={t('governedPeople.hrm007.states.deniedDescription')}
          size="page"
        />
      </div>
    );
  }
  if (!adapter || adapter.kind !== HRM007_ADAPTER_KIND) {
    return (
      <div data-testid="hrm-007-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.hrm007.states.unavailableTitle')}
          description={t('governedPeople.hrm007.states.adapterNotMounted')}
          size="page"
        />
      </div>
    );
  }
  const paginationIdentity = JSON.stringify(
    hrm007QueryKey(adapter, queryId, trustedScope, options)
  );
  return (
    <AdmittedHrm007Workbench
      key={paginationIdentity}
      queryId={queryId}
      scope={trustedScope}
      adapter={adapter}
      options={options}
      onDelegateAction={onDelegateAction}
    />
  );
}

type PageProps = Omit<Hrm007WorkbenchProps, 'queryId'>;

export function Hrm007TeamPeopleChangesPage(props: PageProps) {
  return <Hrm007Workbench {...props} queryId="IAQ-005" />;
}

export function Hrm007AppointmentsPage(props: PageProps) {
  return <Hrm007Workbench {...props} queryId="IAQ-007" />;
}

export function Hrm007PeopleEmploymentPage(props: PageProps) {
  return <Hrm007Workbench {...props} queryId="IAQ-013" />;
}
