import { useCallback, useMemo, useState } from 'react';
import { BriefcaseBusiness, Building2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  FormField,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useSearchParams } from 'react-router-dom';

import {
  HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND,
  assertOrganizationGraphQuery,
  organizationGraphFailure,
} from './organization-positions-contract';

import type {
  HrisOrganizationPositionsQueryAdapter,
  OrganizationGraphFailure,
  OrganizationGraphWithPositionsV2,
  OrganizationGraphWithPositionsV2Query,
  OrganizationNodeV2,
  OrganizationPositionV2,
} from './organization-positions-contract';

type CanonicalSelection =
  Readonly<{ kind: 'organization'; id: string }> | Readonly<{ kind: 'position'; id: string }>;

type NavigationValues = Readonly<Record<string, string | null | undefined>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DEPTH_OPTIONS = Array.from({ length: 13 }, (_, depth) => ({
  value: depth,
  label: depth === 0 ? 'Root only' : `${depth} level${depth === 1 ? '' : 's'}`,
}));
const ADAPTER_CACHE_IDENTITIES = new WeakMap<HrisOrganizationPositionsQueryAdapter, number>();
let nextAdapterCacheIdentity = 1;

function adapterCacheIdentity(adapter: HrisOrganizationPositionsQueryAdapter): number {
  const existing = ADAPTER_CACHE_IDENTITIES.get(adapter);
  if (existing !== undefined) return existing;
  const identity = nextAdapterCacheIdentity;
  nextAdapterCacheIdentity += 1;
  ADAPTER_CACHE_IDENTITIES.set(adapter, identity);
  return identity;
}

function canonicalNow(now?: string): string {
  const value = now ? new Date(now) : new Date();
  return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
}

function selectedEntity(
  searchParams: URLSearchParams,
  graph?: OrganizationGraphWithPositionsV2
): CanonicalSelection | undefined {
  const position = searchParams.get('position');
  const organization = searchParams.get('organization');
  const focus = searchParams.get('focus');
  const requested = [position, organization, focus].filter(Boolean);
  if (requested.length > 1) return undefined;
  if (position && UUID.test(position)) {
    return { kind: 'position', id: position.toLowerCase() };
  }
  if (organization && UUID.test(organization)) {
    return { kind: 'organization', id: organization.toLowerCase() };
  }
  if (!focus || !UUID.test(focus) || !graph) return undefined;
  const canonicalFocus = focus.toLowerCase();
  const organizationMatch = graph.nodes.some(
    (node) => node.organizationPublicId === canonicalFocus
  );
  const positionMatch = graph.positions.some((item) => item.positionPublicId === canonicalFocus);
  if (organizationMatch === positionMatch) return undefined;
  if (positionMatch) return { kind: 'position', id: canonicalFocus };
  if (organizationMatch) return { kind: 'organization', id: canonicalFocus };
  return undefined;
}

function requestFromSearch(
  searchParams: URLSearchParams,
  defaultAsOf: string
): OrganizationGraphWithPositionsV2Query | undefined {
  const rawDepth = searchParams.get('depth');
  const candidate = {
    asOf: searchParams.get('asOf') ?? defaultAsOf,
    rootPublicId: searchParams.get('root') ?? '',
    depth: rawDepth === null ? 4 : Number(rawDepth),
    relationshipType: 'REPORTING',
    includePositions: searchParams.get('includePositions') !== 'false',
  };
  try {
    return assertOrganizationGraphQuery(candidate);
  } catch {
    return undefined;
  }
}

function FailureState({
  failure,
  retrying,
  onRetry,
}: {
  failure: OrganizationGraphFailure;
  retrying: boolean;
  onRetry: () => void;
}) {
  if (failure.kind === 'PERMISSION_DENIED') {
    return (
      <GuidedEmptyState
        kind="permission"
        title="Organization access is unavailable"
        description="This view cannot disclose whether an organization or position exists. Ask an administrator to check your organization-view duty."
        size="page"
      />
    );
  }
  if (failure.kind === 'NOT_FOUND') {
    return (
      <GuidedEmptyState
        kind="empty"
        title="No organization graph is available"
        description="The requested root is not available in your authorized population for this effective time."
        actionLabel="Try again"
        onAction={onRetry}
        size="page"
      />
    );
  }
  const stale = failure.kind === 'STALE';
  const invalid = failure.kind === 'INVALID_QUERY' || failure.kind === 'UNSUPPORTED';
  return (
    <LocalErrorState
      title={
        stale
          ? 'Organization context changed'
          : invalid
            ? 'Organization graph request is not supported'
            : 'Organization graph is temporarily unavailable'
      }
      description={
        stale
          ? 'Refresh before relying on this structure.'
          : invalid
            ? 'Check the effective time, root, depth, and reporting hierarchy.'
            : 'No cached or inferred organization data is shown.'
      }
      requestIdLabel={failure.reference ? `Reference: ${failure.reference}` : undefined}
      retryLabel="Try again"
      retrying={retrying}
      onRetry={onRetry}
      size="page"
    />
  );
}

function OrganizationCard({
  node,
  selected,
  onSelect,
}: {
  node: OrganizationNodeV2;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Paper
      component="li"
      variant="outlined"
      sx={{
        listStyle: 'none',
        minWidth: { xs: 0, md: 240 },
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
        '@media (forced-colors: active)': { border: selected ? '3px solid' : '1px solid' },
      }}
    >
      <ActionButton
        intent="quiet"
        aria-pressed={selected}
        aria-label={`Inspect organization ${node.name}`}
        onClick={onSelect}
        sx={{
          width: 1,
          minHeight: 92,
          px: 1.5,
          py: 1.25,
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          textAlign: 'left',
          textTransform: 'none',
        }}
      >
        <Stack direction="row" gap={1} minWidth={0}>
          <Building2 size={18} aria-hidden="true" />
          <Box minWidth={0}>
            <Typography component="span" variant="subtitle2" display="block">
              {node.name}
            </Typography>
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ overflowWrap: 'anywhere' }}
            >
              Level {node.depth} · {node.organizationPublicId}
            </Typography>
          </Box>
        </Stack>
      </ActionButton>
    </Paper>
  );
}

function PositionCard({
  position,
  selected,
  onSelect,
}: {
  position: OrganizationPositionV2;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Paper
      component="li"
      variant="outlined"
      sx={{
        listStyle: 'none',
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
        '@media (forced-colors: active)': { border: selected ? '3px solid' : '1px solid' },
      }}
    >
      <ActionButton
        intent="quiet"
        aria-pressed={selected}
        aria-label={`Inspect position ${position.title}`}
        onClick={onSelect}
        sx={{
          width: 1,
          minHeight: 104,
          px: 1.5,
          py: 1.25,
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          textAlign: 'left',
          textTransform: 'none',
        }}
      >
        <Stack direction="row" gap={1} minWidth={0}>
          <BriefcaseBusiness size={18} aria-hidden="true" />
          <Box minWidth={0}>
            <Typography component="span" variant="subtitle2" display="block">
              {position.title}
            </Typography>
            <Typography component="span" variant="caption" color="text.secondary" display="block">
              {position.positionKey} · {position.status}
            </Typography>
            <Typography component="span" variant="caption" color="text.secondary" display="block">
              {position.positionType} · {position.budgetedFte} FTE
            </Typography>
          </Box>
        </Stack>
      </ActionButton>
    </Paper>
  );
}

function SelectionInspector({
  graph,
  selection,
  onClose,
}: {
  graph: OrganizationGraphWithPositionsV2;
  selection?: CanonicalSelection;
  onClose: () => void;
}) {
  if (!selection) return null;
  const organization =
    selection.kind === 'organization'
      ? graph.nodes.find((item) => item.organizationPublicId === selection.id)
      : undefined;
  const position =
    selection.kind === 'position'
      ? graph.positions.find((item) => item.positionPublicId === selection.id)
      : undefined;
  if (!organization && !position) return null;

  return (
    <Paper
      component="aside"
      variant="outlined"
      aria-label="Selected organization graph item"
      sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0, alignSelf: 'start' }}
    >
      <Stack gap={1.25}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            {organization ? 'Organization' : 'Position'}
          </Typography>
          <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {organization?.name ?? position?.title}
          </Typography>
        </Box>
        {organization ? (
          <>
            <Typography variant="body2">Reporting level: {organization.depth}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {organization.organizationPublicId}
            </Typography>
          </>
        ) : null}
        {position ? (
          <Stack gap={0.5}>
            <Typography variant="body2">Key: {position.positionKey}</Typography>
            <Typography variant="body2">Status: {position.status}</Typography>
            <Typography variant="body2">Criticality: {position.criticality}</Typography>
            <Typography variant="body2">Budgeted FTE: {position.budgetedFte}</Typography>
            <Typography variant="body2">
              Incumbents: {position.incumbentPersonPublicIds.length}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {position.positionPublicId}
            </Typography>
          </Stack>
        ) : null}
        <ActionButton intent="secondary" onClick={onClose}>
          Return to graph
        </ActionButton>
      </Stack>
    </Paper>
  );
}

function GraphContent({
  graph,
  mode,
  selection,
  onModeChange,
  onSelect,
  onClearSelection,
}: {
  graph: OrganizationGraphWithPositionsV2;
  mode: 'organizations' | 'positions';
  selection?: CanonicalSelection;
  onModeChange: (mode: 'organizations' | 'positions') => void;
  onSelect: (selection: CanonicalSelection) => void;
  onClearSelection: () => void;
}) {
  const depths = [...new Set(graph.nodes.map((node) => node.depth))];
  const partial = !graph.positionsIncluded;
  return (
    <Stack gap={1.5} data-graph-state={partial ? 'partial' : 'complete'}>
      {partial ? (
        <InlineFeedback title="Organization-only projection" severity="info">
          Position details were not requested. Turn on positions to request the authorized position
          projection.
        </InlineFeedback>
      ) : null}
      <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
        <ActionButton
          intent={mode === 'organizations' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'organizations'}
          onClick={() => onModeChange('organizations')}
        >
          Organizations
        </ActionButton>
        <ActionButton
          intent={mode === 'positions' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'positions'}
          disabled={!graph.positionsIncluded}
          onClick={() => onModeChange('positions')}
        >
          Positions
        </ActionButton>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(260px, 0.32fr)' },
          gap: 1.5,
          minWidth: 0,
        }}
      >
        <Paper
          component="section"
          variant="outlined"
          aria-label={mode === 'organizations' ? 'Organization reporting graph' : 'Position graph'}
          sx={{ p: { xs: 1, sm: 1.5 }, minWidth: 0, overflow: 'hidden' }}
        >
          {mode === 'organizations' ? (
            <Stack
              component="ol"
              direction={{ xs: 'column', md: 'row' }}
              gap={1.5}
              sx={{ m: 0, p: 0, overflowX: 'auto', minHeight: 160 }}
            >
              {depths.map((depth) => (
                <Stack
                  component="li"
                  key={depth}
                  gap={0.75}
                  sx={{ listStyle: 'none', minWidth: { xs: 0, md: 240 } }}
                >
                  <Typography variant="overline" color="text.secondary">
                    Reporting level {depth}
                  </Typography>
                  <Stack component="ul" gap={1} sx={{ m: 0, p: 0 }}>
                    {graph.nodes
                      .filter((node) => node.depth === depth)
                      .map((node) => (
                        <OrganizationCard
                          key={node.organizationPublicId}
                          node={node}
                          selected={
                            selection?.kind === 'organization' &&
                            selection.id === node.organizationPublicId
                          }
                          onSelect={() =>
                            onSelect({ kind: 'organization', id: node.organizationPublicId })
                          }
                        />
                      ))}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          ) : graph.positions.length > 0 ? (
            <Box
              component="ul"
              sx={{
                m: 0,
                p: 0,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 1,
              }}
            >
              {graph.positions.map((position) => (
                <PositionCard
                  key={position.positionPublicId}
                  position={position}
                  selected={
                    selection?.kind === 'position' && selection.id === position.positionPublicId
                  }
                  onSelect={() => onSelect({ kind: 'position', id: position.positionPublicId })}
                />
              ))}
            </Box>
          ) : (
            <GuidedEmptyState
              kind="empty"
              title="No positions at this effective time"
              description="The authorized reporting graph is available, but it has no effective positions in this scope."
              size="standard"
            />
          )}
        </Paper>
        <SelectionInspector graph={graph} selection={selection} onClose={onClearSelection} />
      </Box>
    </Stack>
  );
}

export function HrisOrganizationPositionsBranch({
  adapter,
  now,
}: {
  adapter: HrisOrganizationPositionsQueryAdapter;
  now?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [defaultAsOf] = useState(() => canonicalNow(now));
  const serializedSearch = searchParams.toString();
  const request = useMemo(
    () => requestFromSearch(new URLSearchParams(serializedSearch), defaultAsOf),
    [defaultAsOf, serializedSearch]
  );
  const root = searchParams.get('root') ?? '';
  const asOf = searchParams.get('asOf') ?? defaultAsOf;
  const rawDepth = searchParams.get('depth');
  const depth = rawDepth === null ? 4 : Number(rawDepth);
  const includePositions = searchParams.get('includePositions') !== 'false';
  const validAdapter = adapter.kind === HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND;
  const queryAdapterIdentity = useMemo(() => adapterCacheIdentity(adapter), [adapter]);
  const updateNavigation = useCallback(
    (values: NavigationValues, replace = true) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(values).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') next.delete(key);
            else next.set(key, value);
          });
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  const graphQuery = useQuery({
    queryKey: ['hris', adapter.kind, queryAdapterIdentity, 'organization-graph', request],
    queryFn: ({ signal }) => adapter.query(request!, signal),
    enabled: validAdapter && Boolean(request),
    retry: false,
  });
  const graphFailure = graphQuery.error ? organizationGraphFailure(graphQuery.error) : undefined;
  const concealCachedGraph =
    graphFailure?.kind === 'PERMISSION_DENIED' || graphFailure?.kind === 'NOT_FOUND';
  const visibleGraph = concealCachedGraph ? undefined : graphQuery.data;
  const selection = selectedEntity(searchParams, visibleGraph);
  const requestedMode = searchParams.get('mode') === 'positions' ? 'positions' : 'organizations';
  const mode = selection?.kind === 'position' ? 'positions' : requestedMode;

  const controls = (
    <Paper
      component="section"
      variant="outlined"
      aria-label="Organization graph controls"
      sx={{ p: 1.5 }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.25} alignItems={{ md: 'center' }}>
        <FormField
          size="small"
          label="Root organization UUID"
          value={root}
          errorMessage={
            root && !UUID.test(root) ? 'Enter a canonical organization UUID.' : undefined
          }
          onChange={(event) =>
            updateNavigation({
              root: event.target.value.toLowerCase(),
              focus: null,
              organization: null,
              position: null,
            })
          }
          inputProps={{ 'data-testid': 'hris-organization-root' }}
          sx={{ minWidth: 0, flex: { md: 1.4 } }}
        />
        <FormField
          size="small"
          label="Effective instant"
          value={asOf}
          errorMessage={
            root && !request ? 'Use an RFC 3339 instant with an explicit offset.' : undefined
          }
          onChange={(event) =>
            updateNavigation({
              asOf: event.target.value,
              focus: null,
              organization: null,
              position: null,
            })
          }
          inputProps={{ 'data-testid': 'hris-organization-as-of' }}
          sx={{ minWidth: 0, flex: { md: 1 } }}
        />
        <SelectField<number>
          size="small"
          label="Reporting depth"
          value={Number.isInteger(depth) && depth >= 0 && depth <= 12 ? depth : ''}
          options={DEPTH_OPTIONS}
          onValueChange={(value) =>
            updateNavigation({
              depth: value === '' || value === 4 ? null : String(value),
              focus: null,
              organization: null,
              position: null,
            })
          }
          sx={{ width: { xs: 1, md: 160 } }}
        />
        <FormControlLabel
          sx={{ m: 0, minHeight: 44 }}
          control={
            <Switch
              checked={includePositions}
              onChange={(event) =>
                updateNavigation({
                  includePositions: event.target.checked ? null : 'false',
                  mode: event.target.checked ? undefined : 'organizations',
                  focus: null,
                  position: null,
                })
              }
              inputProps={{ 'aria-label': 'Include authorized positions' }}
            />
          }
          label="Include positions"
        />
        <ActionButton
          intent="secondary"
          loading={graphQuery.isFetching}
          loadingLabel="Refreshing organization graph"
          startIcon={<RefreshCw size={16} aria-hidden="true" />}
          onClick={() => void graphQuery.refetch()}
          disabled={!request || !validAdapter}
        >
          Refresh
        </ActionButton>
      </Stack>
    </Paper>
  );

  let content;
  if (!validAdapter) {
    content = (
      <LocalErrorState
        title="Organization graph adapter is unavailable"
        description="The canonical read adapter did not pass its sealed contract."
        size="page"
      />
    );
  } else if (!root) {
    content = (
      <GuidedEmptyState
        kind="first-use"
        title="Choose a root organization"
        description="Enter an authorized organization UUID to inspect its reporting structure at an effective time."
        size="page"
      />
    );
  } else if (!request) {
    content = (
      <LocalErrorState
        title="Check the organization graph filters"
        description="Use a canonical organization UUID, an RFC 3339 instant with an explicit offset, and a depth from 0 through 12."
        size="page"
      />
    );
  } else if (graphQuery.isPending) {
    content = (
      <LoadingState
        label="Loading authorized organization structure"
        description="Checking reporting organizations and explicitly requested positions."
        variant="skeleton"
        skeletonRows={4}
        size="page"
      />
    );
  } else if (graphFailure && !visibleGraph) {
    content = (
      <FailureState
        failure={graphFailure}
        retrying={graphQuery.isFetching}
        onRetry={() => void graphQuery.refetch()}
      />
    );
  } else if (!visibleGraph || visibleGraph.nodes.length === 0) {
    content = (
      <GuidedEmptyState
        kind="empty"
        title="No organization structure at this effective time"
        description="No authorized reporting nodes were returned. Change the effective time or root organization."
        actionLabel="Try again"
        onAction={() => void graphQuery.refetch()}
        size="page"
      />
    );
  } else {
    content = (
      <Stack gap={1.25}>
        {graphFailure ? (
          <InlineFeedback
            title="Showing the last authorized snapshot"
            severity="warning"
            action={
              <ActionButton
                intent="quiet"
                size="small"
                loading={graphQuery.isFetching}
                onClick={() => void graphQuery.refetch()}
              >
                Refresh
              </ActionButton>
            }
          >
            The refresh failed, so this structure may be stale.
          </InlineFeedback>
        ) : null}
        <GraphContent
          graph={visibleGraph}
          mode={mode}
          selection={selection}
          onModeChange={(nextMode) =>
            updateNavigation({ mode: nextMode === 'organizations' ? null : nextMode })
          }
          onSelect={(nextSelection) =>
            updateNavigation(
              {
                organization: null,
                position: null,
                focus: nextSelection.id,
              },
              false
            )
          }
          onClearSelection={() =>
            updateNavigation({ focus: null, organization: null, position: null }, false)
          }
        />
      </Stack>
    );
  }

  return (
    <Stack gap={1.5} minWidth={0} data-slice="BASE-TFR-HRM-005">
      <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} alignItems={{ sm: 'center' }}>
          <ShieldCheck size={22} aria-hidden="true" />
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              HR operations · reporting hierarchy
            </Typography>
            <Typography component="h2" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              Organization and positions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Inspect the authorized effective-dated reporting graph. This view is read-only.
            </Typography>
          </Box>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" label="Reporting" />
            {visibleGraph ? (
              <Chip size="small" variant="outlined" label={visibleGraph.effectiveDate} />
            ) : null}
          </Stack>
        </Stack>
      </Paper>
      {controls}
      {content}
    </Stack>
  );
}
