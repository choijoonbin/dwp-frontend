import './work-explorer.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Clock3, FolderClock, RefreshCw, Search, Star, StarOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionButton, InlineFeedback, PageCanvas } from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  useProductSurfaceGovernedMutation,
  type ProductSurfaceMutationBinding,
} from '../../../components/use-product-surface-governed-mutation';
import { useProductSurfaceRequestScope } from '../../../components/use-product-surface-request-scope';
import {
  queryWorkExplorerActivityReceipt,
  queryWorkExplorer,
  queryWorkExplorerReceipt,
  recordWorkExplorerRecent,
  replaceWorkExplorerPreferences,
  WORK_EXPLORER_PREFERENCES_ACTION,
  WORK_EXPLORER_RECENT_ACTION,
} from './work-explorer-api';
import {
  EXPLORER_MODULES,
  EXPLORER_WORKBENCHES,
  explorerReceiptNeedsReconciliation,
  explorerTargetHref,
  hrisReceiptProjectionsShareImmutableContext,
  nextExplorerFavoriteRouteKeys,
} from './work-explorer-contract';
import {
  mergeWorkExplorerQueryState,
  parseWorkExplorerQueryState,
} from './work-explorer-query-state';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  ExplorerActivity,
  ExplorerRoute,
  ExplorerTarget,
  HrisReceiptProjection,
} from './work-explorer-contract';
import type { WorkExplorerQueryState } from './work-explorer-query-state';

const WORK_EXPLORER_QUERY_KEY = 'hris-work-explorer';
const WORK_EXPLORER_PREFERENCES_MUTATION: ProductSurfaceMutationBinding = Object.freeze({
  productKey: 'hcm',
  surfaceKey: 'hcm.utility',
  routeContractKey: WORK_EXPLORER_PREFERENCES_ACTION,
  taskKind: 'WORK',
});
const WORK_EXPLORER_RECENT_MUTATION: ProductSurfaceMutationBinding = Object.freeze({
  productKey: 'hcm',
  surfaceKey: 'hcm.utility',
  routeContractKey: WORK_EXPLORER_RECENT_ACTION,
  taskKind: 'WORK',
});

type PreferenceCommand = Readonly<{
  kind: 'preferences';
  orderedFavoriteRouteKeys: readonly string[];
  favoritePreferenceRevision: number;
  idempotencyKey: string;
}>;

type RecentCommand = Readonly<{
  kind: 'recent';
  route: ExplorerRoute;
  idempotencyKey: string;
}>;

type ExplorerCommand = PreferenceCommand | RecentCommand;

type CommandCompletion =
  | Readonly<{ kind: 'preferences'; command: PreferenceCommand }>
  | Readonly<{ kind: 'recent' | 'activity'; target: ExplorerTarget; command?: RecentCommand }>;

type CommandMessage =
  | Readonly<{ kind: 'conflict' | 'error'; text: string }>
  | Readonly<{ kind: 'retry'; text: string; command: ExplorerCommand }>
  | Readonly<{ kind: 'activity-retry'; text: string; activity: ExplorerActivity }>
  | Readonly<{
      kind: 'reconcile';
      receipt: HrisReceiptProjection;
      completion: CommandCompletion;
      reconcileError?: boolean;
    }>;

function idempotencyKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `explorer-${Date.now()}-${Math.random().toString(36)}`
  );
}

function errorStatus(error: unknown): number | undefined {
  if (error instanceof HttpError) return error.status;
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function LoadingWorkspace() {
  const { t } = useTranslation('hcm');
  return (
    <Stack aria-label={t('hris.explorer.states.loading')} aria-busy="true" gap={2}>
      <Skeleton variant="rounded" height={58} />
      <Box className="work-explorer-card-grid">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} variant="rounded" height={150} />
        ))}
      </Box>
    </Stack>
  );
}

function StatePanel({
  title,
  description,
  actionLabel,
  onAction,
  severity = 'info',
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  severity?: 'info' | 'warning' | 'error';
}) {
  return (
    <Paper variant="outlined" className="work-explorer-state-panel">
      <InlineFeedback
        severity={severity}
        title={title}
        action={
          actionLabel && onAction ? (
            <ActionButton intent="quiet" size="small" onClick={onAction}>
              {actionLabel}
            </ActionButton>
          ) : undefined
        }
      >
        {description}
      </InlineFeedback>
    </Paper>
  );
}

function WorkCard({
  route,
  label,
  favorite,
  selected,
  busy,
  favoriteLimitReached,
  favoriteLimit,
  onOpen,
  onFavorite,
}: {
  route: ExplorerRoute;
  label: string;
  favorite: boolean;
  selected: boolean;
  busy: boolean;
  favoriteLimitReached: boolean;
  favoriteLimit: number;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  const { t } = useTranslation('hcm');
  return (
    <Paper
      component="article"
      variant="outlined"
      className="work-explorer-card"
      data-route-key={route.routeKey}
      data-selected={selected}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Stack direction="row" gap={0.6} flexWrap="wrap">
          <Chip size="small" label={t(`hris.explorer.modules.${route.module}`)} />
          <Chip
            size="small"
            variant="outlined"
            label={t(`hris.explorer.workbenches.${route.workbench}`)}
          />
        </Stack>
        <ActionButton
          intent="quiet"
          size="small"
          aria-label={t(
            favorite
              ? 'hris.explorer.actions.removeFavorite'
              : favoriteLimitReached
                ? 'hris.explorer.actions.favoriteLimitReached'
                : 'hris.explorer.actions.addFavorite',
            { label, count: favoriteLimit }
          )}
          title={
            favoriteLimitReached && !favorite
              ? t('hris.explorer.actions.favoriteLimitReached', {
                  label,
                  count: favoriteLimit,
                })
              : undefined
          }
          disabled={busy || (favoriteLimitReached && !favorite)}
          onClick={onFavorite}
          sx={{ minWidth: 40, px: 0.75 }}
        >
          {favorite ? (
            <StarOff size={17} aria-hidden="true" />
          ) : (
            <Star size={17} aria-hidden="true" />
          )}
        </ActionButton>
      </Stack>
      <Typography
        component="h3"
        variant="subtitle1"
        fontWeight={780}
        className="work-explorer-label"
      >
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary" className="work-explorer-target">
        {t(
          route.target.kind === 'DWP_CONTROL'
            ? 'hris.explorer.target.governance'
            : 'hris.explorer.target.hris'
        )}
      </Typography>
      <ActionButton
        intent="secondary"
        size="small"
        endIcon={<ArrowRight size={15} aria-hidden="true" />}
        disabled={busy}
        onClick={onOpen}
        aria-label={t('hris.explorer.actions.openRoute', { label })}
        sx={{ mt: 'auto', alignSelf: 'flex-start' }}
      >
        {t('hris.explorer.actions.open')}
      </ActionButton>
    </Paper>
  );
}

function CompactRouteList({
  id,
  title,
  icon,
  routes,
  labels,
  commandStartBlocked,
  onOpen,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  routes: readonly ExplorerRoute[];
  labels: ReadonlyMap<string, string>;
  commandStartBlocked: boolean;
  onOpen: (route: ExplorerRoute) => void;
}) {
  if (!routes.length) return null;
  return (
    <Box component="section" aria-labelledby={id}>
      <Stack direction="row" alignItems="center" gap={0.8} sx={{ mb: 1 }}>
        {icon}
        <Typography id={id} component="h2" variant="subtitle1" fontWeight={780}>
          {title}
        </Typography>
      </Stack>
      <Box component="ul" className="work-explorer-compact-list">
        {routes.map((route) => (
          <Box component="li" key={route.routeKey}>
            <ActionButton
              intent="quiet"
              disabled={commandStartBlocked}
              onClick={() => onOpen(route)}
            >
              <span className="work-explorer-compact-label">{labels.get(route.routeKey)}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </ActionButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ActivityList({
  activities,
  onOpen,
  resultUnknownLabel,
  busy,
}: {
  activities: readonly ExplorerActivity[];
  onOpen: (activity: ExplorerActivity) => void;
  resultUnknownLabel: string;
  busy: boolean;
}) {
  const { t } = useTranslation('hcm');
  if (!activities.length) return null;
  return (
    <Box component="section" aria-labelledby="work-explorer-in-progress-title">
      <Stack direction="row" alignItems="center" gap={0.8} sx={{ mb: 1 }}>
        <FolderClock size={18} aria-hidden="true" />
        <Typography
          id="work-explorer-in-progress-title"
          component="h2"
          variant="subtitle1"
          fontWeight={780}
        >
          {t('hris.explorer.sections.inProgress')}
        </Typography>
      </Stack>
      <Box component="ul" className="work-explorer-activity-list">
        {activities.map((activity) => (
          <Paper component="li" variant="outlined" key={activity.activityId}>
            <Box minWidth={0}>
              <Typography variant="body2" fontWeight={740}>
                {t(`hris.explorer.sourceKinds.${activity.sourceKind}`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`hris.explorer.modules.${activity.module}`)} ·{' '}
                {t(`hris.explorer.activityStates.${activity.state}`)}
                {activity.state === 'RESULT_UNKNOWN' ? ` · ${resultUnknownLabel}` : ''}
              </Typography>
            </Box>
            <ActionButton
              intent="quiet"
              size="small"
              aria-label={t('hris.explorer.actions.resumeActivity', {
                source: t(`hris.explorer.sourceKinds.${activity.sourceKind}`),
              })}
              disabled={busy}
              onClick={() => onOpen(activity)}
            >
              {t('hris.explorer.actions.resume')}
            </ActionButton>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

export function WorkExplorer() {
  const { t, i18n } = useTranslation('hcm');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.utility',
  });
  const replacePreferences = useProductSurfaceGovernedMutation(WORK_EXPLORER_PREFERENCES_MUTATION);
  const recordRecent = useProductSurfaceGovernedMutation(WORK_EXPLORER_RECENT_MUTATION);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryState = useMemo(() => parseWorkExplorerQueryState(searchParams), [searchParams]);
  const [searchDraft, setSearchDraft] = useState(queryState.query);
  const [commandMessage, setCommandMessage] = useState<CommandMessage | null>(null);
  const commandLatch = useRef(false);

  useEffect(() => setSearchDraft(queryState.query), [queryState.query]);
  useEffect(() => {
    if (searchDraft === queryState.query) return;
    const timeout = window.setTimeout(() => {
      setSearchParams(
        mergeWorkExplorerQueryState(searchParams, { query: searchDraft, selected: null }),
        { replace: true }
      );
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [queryState.query, searchDraft, searchParams, setSearchParams]);

  const explorerQuery = useQuery({
    queryKey: [WORK_EXPLORER_QUERY_KEY, ...requestScope.cacheKey],
    meta: requestScope.queryMeta,
    enabled: requestScope.ready,
    queryFn: ({ signal }) =>
      queryWorkExplorer(
        {
          asOf: new Date().toISOString(),
          freshness: 'ALLOW_STALE',
          limit: 100,
        },
        { contextScopeKey: requestScope.contextScopeKey, signal }
      ),
    staleTime: 30_000,
    retry: false,
  });

  const preferencesMutation = useMutation({
    mutationFn: async (command: PreferenceCommand) => {
      return replacePreferences((authority: ProductSurfaceGovernedMutationAuthority) =>
        replaceWorkExplorerPreferences(
          command.orderedFavoriteRouteKeys,
          command.favoritePreferenceRevision,
          {
            authority,
            idempotencyKey: command.idempotencyKey,
          }
        )
      );
    },
    onSuccess: async (receipt, command) => {
      if (explorerReceiptNeedsReconciliation(receipt.status)) {
        setCommandMessage({
          kind: 'reconcile',
          receipt: { profile: 'EXPLORER', receipt },
          completion: { kind: 'preferences', command },
        });
        return;
      }
      if (receipt.status === 'FAILED' || receipt.status === 'REJECTED') {
        setCommandMessage({ kind: 'error', text: t('hris.explorer.states.commandFailed') });
        return;
      }
      setCommandMessage(null);
      await queryClient.invalidateQueries({ queryKey: [WORK_EXPLORER_QUERY_KEY] });
    },
    onError: (error, command) => {
      const status = errorStatus(error);
      if (status === 409) {
        setCommandMessage({
          kind: 'conflict',
          text: t('hris.explorer.states.preferenceConflict'),
        });
        return;
      }
      setCommandMessage(
        status === undefined || status >= 500
          ? { kind: 'retry', text: t('hris.explorer.states.commandError'), command }
          : { kind: 'error', text: t('hris.explorer.states.commandError') }
      );
    },
  });

  const recentMutation = useMutation({
    mutationFn: (command: RecentCommand) =>
      recordRecent((authority: ProductSurfaceGovernedMutationAuthority) =>
        recordWorkExplorerRecent(command.route.routeKey, {
          authority,
          idempotencyKey: command.idempotencyKey,
        })
      ).then((receipt) => ({ receipt, command })),
    onSuccess: ({ receipt, command }) => {
      if (explorerReceiptNeedsReconciliation(receipt.status)) {
        setCommandMessage({
          kind: 'reconcile',
          receipt: { profile: 'EXPLORER', receipt },
          completion: { kind: 'recent', target: command.route.target, command },
        });
        return;
      }
      if (receipt.status === 'FAILED' || receipt.status === 'REJECTED') {
        setCommandMessage({ kind: 'error', text: t('hris.explorer.states.commandFailed') });
        return;
      }
      navigate(explorerTargetHref(command.route.target));
    },
    onError: (error, command) => {
      const status = errorStatus(error);
      setCommandMessage(
        status === undefined || status >= 500
          ? { kind: 'retry', text: t('hris.explorer.states.commandError'), command }
          : { kind: 'error', text: t('hris.explorer.states.commandError') }
      );
    },
  });

  const activityReceiptMutation = useMutation({
    mutationFn: (activity: ExplorerActivity) =>
      queryWorkExplorerActivityReceipt(activity.activityId, {
        contextScopeKey: requestScope.contextScopeKey,
      }),
    onSuccess: (receiptProjection, activity) => {
      if (explorerReceiptNeedsReconciliation(receiptProjection.receipt.status)) {
        setCommandMessage({
          kind: 'reconcile',
          receipt: receiptProjection,
          completion: { kind: 'activity', target: activity.target },
        });
        return;
      }
      if (
        receiptProjection.receipt.status === 'FAILED' ||
        receiptProjection.receipt.status === 'REJECTED'
      ) {
        setCommandMessage({ kind: 'error', text: t('hris.explorer.states.commandFailed') });
        return;
      }
      navigate(explorerTargetHref(activity.target));
    },
    onError: (_error, activity) => {
      setCommandMessage({
        kind: 'activity-retry',
        text: t('hris.explorer.states.reconcileError'),
        activity,
      });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: async (pendingMessage: Extract<CommandMessage, { kind: 'reconcile' }>) => {
      const reconciledReceipt =
        pendingMessage.completion.kind === 'activity'
          ? await queryWorkExplorerActivityReceipt(pendingMessage.receipt.receipt.receiptId, {
              contextScopeKey: requestScope.contextScopeKey,
            })
          : {
              profile: 'EXPLORER' as const,
              receipt: await queryWorkExplorerReceipt(pendingMessage.receipt.receipt.receiptId, {
                contextScopeKey: requestScope.contextScopeKey,
              }),
            };
      return { pendingMessage, reconciledReceipt };
    },
    onSuccess: async ({ pendingMessage: submittedMessage, reconciledReceipt }) => {
      const currentMessage = commandMessage?.kind === 'reconcile' ? commandMessage : undefined;
      if (
        !currentMessage ||
        !hrisReceiptProjectionsShareImmutableContext(
          currentMessage.receipt,
          submittedMessage.receipt
        ) ||
        !hrisReceiptProjectionsShareImmutableContext(submittedMessage.receipt, reconciledReceipt)
      ) {
        setCommandMessage((current) =>
          current?.kind === 'reconcile' ? { ...current, reconcileError: true } : current
        );
        return;
      }
      const pendingCompletion = currentMessage.completion;
      const receipt = reconciledReceipt.receipt;
      if (explorerReceiptNeedsReconciliation(receipt.status)) {
        setCommandMessage({
          kind: 'reconcile',
          receipt: reconciledReceipt,
          completion: pendingCompletion,
          reconcileError: false,
        });
        return;
      }
      if (receipt.status === 'SUCCEEDED') {
        setCommandMessage(null);
        if (pendingCompletion.kind === 'recent' || pendingCompletion.kind === 'activity') {
          navigate(explorerTargetHref(pendingCompletion.target));
          return;
        }
        await queryClient.invalidateQueries({ queryKey: [WORK_EXPLORER_QUERY_KEY] });
        return;
      }
      setCommandMessage({ kind: 'error', text: t('hris.explorer.states.commandFailed') });
    },
    onError: () =>
      setCommandMessage((current) =>
        current?.kind === 'reconcile' ? { ...current, reconcileError: true } : current
      ),
  });

  const updateQuery = (patch: Partial<WorkExplorerQueryState>) => {
    setSearchParams(mergeWorkExplorerQueryState(searchParams, patch), { replace: true });
  };

  const data = explorerQuery.data;
  const labels = useMemo(() => {
    const result = new Map<string, string>();
    const projections = data ? [...data.routes, ...data.favorites, ...data.recents] : [];
    for (const route of projections) {
      if (i18n.exists(route.labelKey, { ns: 'hcm' })) {
        result.set(route.routeKey, t(route.labelKey));
      }
    }
    return result;
  }, [data, i18n, t]);
  const labelContractInvalid = Boolean(
    data &&
    [...data.routes, ...data.favorites, ...data.recents].some(
      (route) => !labels.has(route.routeKey)
    )
  );
  const normalizedQuery = searchDraft.trim().toLocaleLowerCase(i18n.language);
  const visibleRoutes = (data?.routes ?? []).filter((route) => {
    const label = labels.get(route.routeKey);
    if (!label) return false;
    return (
      (queryState.module === 'ALL' || route.module === queryState.module) &&
      (queryState.workbench === 'ALL' || route.workbench === queryState.workbench) &&
      (!normalizedQuery || label.toLocaleLowerCase(i18n.language).includes(normalizedQuery))
    );
  });
  const favorites = (data?.favorites ?? []).filter((route) => labels.has(route.routeKey));
  const recents = (data?.recents ?? []).filter((route) => labels.has(route.routeKey));
  const favoriteKeys = new Set(favorites.map((favorite) => favorite.routeKey));
  const queryHasFilters = Boolean(
    searchDraft.trim() || queryState.module !== 'ALL' || queryState.workbench !== 'ALL'
  );
  const selectedExists = queryState.selected
    ? visibleRoutes.some((route) => route.routeKey === queryState.selected)
    : false;
  const commandLifecycleHeld =
    commandMessage?.kind === 'reconcile' ||
    commandMessage?.kind === 'retry' ||
    commandMessage?.kind === 'activity-retry';
  const commandBusy =
    commandLifecycleHeld ||
    preferencesMutation.isPending ||
    recentMutation.isPending ||
    activityReceiptMutation.isPending ||
    reconcileMutation.isPending;

  useEffect(() => {
    if (!commandBusy) commandLatch.current = false;
  }, [commandBusy]);

  const toggleFavorite = (routeKey: string) => {
    if (commandBusy || commandLatch.current || !data) return;
    const next = nextExplorerFavoriteRouteKeys(
      data.favorites.map((favorite) => favorite.routeKey),
      routeKey,
      data.policy.maxFavorites
    );
    if (!next) return;
    commandLatch.current = true;
    preferencesMutation.mutate({
      kind: 'preferences',
      orderedFavoriteRouteKeys: next,
      favoritePreferenceRevision: data.favoritePreferenceRevision,
      idempotencyKey: idempotencyKey(),
    });
  };

  const openRoute = (route: ExplorerRoute) => {
    if (commandBusy || commandLatch.current) return;
    commandLatch.current = true;
    updateQuery({ selected: route.routeKey });
    recentMutation.mutate({ kind: 'recent', route, idempotencyKey: idempotencyKey() });
  };
  const openActivity = (activity: ExplorerActivity) => {
    if (commandBusy || commandLatch.current) return;
    if (activity.sourceKind !== 'COMMAND_RECEIPT' || activity.state !== 'RESULT_UNKNOWN') {
      navigate(explorerTargetHref(activity.target));
      return;
    }
    commandLatch.current = true;
    activityReceiptMutation.mutate(activity);
  };
  const retryPendingCommand = () => {
    if (commandMessage?.kind === 'retry') {
      commandLatch.current = true;
      if (commandMessage.command.kind === 'preferences') {
        preferencesMutation.mutate(commandMessage.command);
      } else {
        recentMutation.mutate(commandMessage.command);
      }
    } else if (commandMessage?.kind === 'activity-retry') {
      commandLatch.current = true;
      activityReceiptMutation.mutate(commandMessage.activity);
    }
  };

  const retry = () => void explorerQuery.refetch();
  const denied = errorStatus(explorerQuery.error) === 403;
  const retainedAfterRefreshFailure = Boolean(data && explorerQuery.isError && !denied);

  return (
    <PageCanvas>
      <Box
        className="work-explorer"
        data-testid="hris-work-explorer"
        data-projection-state={data?.projectionStatus.state ?? 'LOADING'}
        data-refresh-state={retainedAfterRefreshFailure ? 'FAILED_RETAINED' : 'CURRENT'}
      >
        <Box component="header" className="work-explorer-header">
          <Box minWidth={0}>
            <Typography variant="overline" color="text.secondary" fontWeight={760}>
              {t('hris.explorer.eyebrow')}
            </Typography>
            <Typography component="h1" variant="h4" fontWeight={840}>
              {t('hris.explorer.title')}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.6, maxWidth: 760 }}>
              {t('hris.explorer.description')}
            </Typography>
          </Box>
          {explorerQuery.isFetching && !explorerQuery.isLoading ? (
            <Stack direction="row" alignItems="center" gap={0.8} role="status">
              <CircularProgress size={16} />
              <Typography variant="caption">{t('hris.explorer.states.refreshing')}</Typography>
            </Stack>
          ) : (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<RefreshCw size={15} aria-hidden="true" />}
              onClick={retry}
            >
              {t('common.retry')}
            </ActionButton>
          )}
        </Box>

        <Box
          component="search"
          className="work-explorer-search"
          aria-label={t('hris.explorer.search.label')}
        >
          <TextField
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value.slice(0, 200))}
            label={t('hris.explorer.search.label')}
            placeholder={t('hris.explorer.search.placeholder')}
            fullWidth
            autoComplete="off"
            slotProps={{
              input: { startAdornment: <Search size={19} aria-hidden="true" /> },
              htmlInput: { maxLength: 200 },
            }}
          />
          <TextField
            select
            label={t('hris.explorer.filters.workbench')}
            value={queryState.workbench}
            onChange={(event) =>
              updateQuery({
                workbench: event.target.value as WorkExplorerQueryState['workbench'],
                selected: null,
              })
            }
          >
            <MenuItem value="ALL">{t('hris.explorer.filters.allWorkbenches')}</MenuItem>
            {EXPLORER_WORKBENCHES.map((workbench) => (
              <MenuItem key={workbench} value={workbench}>
                {t(`hris.explorer.workbenches.${workbench}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('hris.explorer.filters.module')}
            value={queryState.module}
            onChange={(event) =>
              updateQuery({
                module: event.target.value as WorkExplorerQueryState['module'],
                selected: null,
              })
            }
          >
            <MenuItem value="ALL">{t('hris.explorer.filters.allModules')}</MenuItem>
            {EXPLORER_MODULES.map((module) => (
              <MenuItem key={module} value={module}>
                {t(`hris.explorer.modules.${module}`)}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {!requestScope.ready || explorerQuery.isLoading ? <LoadingWorkspace /> : null}
        {denied ? (
          <StatePanel
            severity="error"
            title={t('hris.explorer.states.deniedTitle')}
            description={t('hris.explorer.states.deniedDescription')}
          />
        ) : null}
        {explorerQuery.isError && !denied && !data ? (
          <StatePanel
            severity="error"
            title={t('hris.explorer.states.errorTitle')}
            description={t('hris.explorer.states.errorDescription')}
            actionLabel={t('common.retry')}
            onAction={retry}
          />
        ) : null}
        {labelContractInvalid ? (
          <StatePanel
            severity="error"
            title={t('hris.explorer.states.labelErrorTitle')}
            description={t('hris.explorer.states.labelErrorDescription')}
            actionLabel={t('common.retry')}
            onAction={retry}
          />
        ) : null}

        {data && !denied && !labelContractInvalid ? (
          <Stack gap={2.25}>
            {retainedAfterRefreshFailure ? (
              <InlineFeedback
                severity="warning"
                title={t('hris.explorer.states.staleTitle')}
                action={
                  <ActionButton intent="quiet" size="small" onClick={retry}>
                    {t('common.retry')}
                  </ActionButton>
                }
              >
                {t('hris.explorer.states.staleDescription')}
              </InlineFeedback>
            ) : data.projectionStatus.state === 'STALE' ? (
              <InlineFeedback severity="warning" title={t('hris.explorer.states.staleTitle')}>
                {t('hris.explorer.states.staleDescription')}
              </InlineFeedback>
            ) : null}
            {data.projectionStatus.state === 'PARTIAL' ? (
              <InlineFeedback severity="warning" title={t('hris.explorer.states.partialTitle')}>
                {t('hris.explorer.states.partialDescription', {
                  count: data.projectionStatus.degradedSources.length,
                })}
              </InlineFeedback>
            ) : null}
            {commandMessage?.kind === 'conflict' ? (
              <InlineFeedback
                severity="warning"
                title={t('hris.explorer.states.preferenceConflictTitle')}
                action={
                  <ActionButton
                    intent="quiet"
                    size="small"
                    onClick={() => {
                      setCommandMessage(null);
                      retry();
                    }}
                  >
                    {t('hris.explorer.states.reloadPreferences')}
                  </ActionButton>
                }
              >
                {commandMessage.text}
              </InlineFeedback>
            ) : null}
            {commandMessage?.kind === 'error' ? (
              <InlineFeedback severity="error" title={t('hris.explorer.states.commandErrorTitle')}>
                {commandMessage.text}
              </InlineFeedback>
            ) : null}
            {commandMessage?.kind === 'retry' || commandMessage?.kind === 'activity-retry' ? (
              <InlineFeedback
                severity="error"
                title={t('hris.explorer.states.commandErrorTitle')}
                action={
                  <ActionButton
                    intent="quiet"
                    size="small"
                    loading={
                      preferencesMutation.isPending ||
                      recentMutation.isPending ||
                      activityReceiptMutation.isPending
                    }
                    loadingLabel={t('hris.explorer.states.reconciling')}
                    onClick={retryPendingCommand}
                  >
                    {t('common.retry')}
                  </ActionButton>
                }
              >
                {commandMessage.text}
              </InlineFeedback>
            ) : null}
            {commandMessage?.kind === 'reconcile' ? (
              <InlineFeedback
                severity="warning"
                title={t(
                  commandMessage.reconcileError
                    ? 'hris.explorer.states.commandErrorTitle'
                    : commandMessage.receipt.receipt.status === 'RESULT_UNKNOWN'
                      ? 'hris.explorer.states.resultUnknownTitle'
                      : 'hris.explorer.states.commandPendingTitle'
                )}
                action={
                  <ActionButton
                    intent="quiet"
                    size="small"
                    loading={reconcileMutation.isPending}
                    loadingLabel={t('hris.explorer.states.reconciling')}
                    onClick={() => reconcileMutation.mutate(commandMessage)}
                  >
                    {t('hris.explorer.states.reconcile')}
                  </ActionButton>
                }
              >
                {t(
                  commandMessage.reconcileError
                    ? 'hris.explorer.states.reconcileError'
                    : commandMessage.receipt.receipt.status === 'RESULT_UNKNOWN'
                      ? 'hris.explorer.states.resultUnknownDescription'
                      : 'hris.explorer.states.commandPendingDescription'
                )}
              </InlineFeedback>
            ) : null}
            <Box className="work-explorer-resume-grid">
              <CompactRouteList
                id="work-explorer-favorites-title"
                title={t('hris.explorer.sections.favorites')}
                icon={<Star size={18} aria-hidden="true" />}
                routes={favorites}
                labels={labels}
                commandStartBlocked={commandBusy}
                onOpen={openRoute}
              />
              <CompactRouteList
                id="work-explorer-recents-title"
                title={t('hris.explorer.sections.recents')}
                icon={<Clock3 size={18} aria-hidden="true" />}
                routes={recents}
                labels={labels}
                commandStartBlocked={commandBusy}
                onOpen={openRoute}
              />
              <ActivityList
                activities={data.inProgress}
                onOpen={openActivity}
                resultUnknownLabel={t('hris.explorer.states.reconciliationRequired')}
                busy={commandBusy}
              />
            </Box>

            {data.routes.length === 0 ? (
              <StatePanel
                title={t('hris.explorer.states.authorizedEmptyTitle')}
                description={t('hris.explorer.states.authorizedEmptyDescription')}
              />
            ) : visibleRoutes.length === 0 ? (
              <StatePanel
                title={t('hris.explorer.states.searchEmptyTitle')}
                description={t('hris.explorer.states.searchEmptyDescription')}
                actionLabel={queryHasFilters ? t('hris.explorer.filters.clear') : undefined}
                onAction={
                  queryHasFilters
                    ? () => {
                        setSearchDraft('');
                        setSearchParams(
                          mergeWorkExplorerQueryState(searchParams, {
                            query: '',
                            module: 'ALL',
                            workbench: 'ALL',
                            selected: null,
                          }),
                          { replace: true }
                        );
                      }
                    : undefined
                }
              />
            ) : (
              <Box component="section" aria-labelledby="work-explorer-catalog-title">
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                  gap={1}
                  sx={{ mb: 1.2 }}
                >
                  <Typography
                    id="work-explorer-catalog-title"
                    component="h2"
                    variant="h6"
                    fontWeight={800}
                  >
                    {t('hris.explorer.sections.available')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" aria-live="polite">
                    {t('hris.explorer.resultCount', { count: visibleRoutes.length })}
                  </Typography>
                </Stack>
                <Box className="work-explorer-card-grid">
                  {visibleRoutes.map((route) => (
                    <WorkCard
                      key={route.routeKey}
                      route={route}
                      label={labels.get(route.routeKey)!}
                      favorite={favoriteKeys.has(route.routeKey)}
                      selected={queryState.selected === route.routeKey}
                      busy={commandBusy}
                      favoriteLimitReached={favorites.length >= data.policy.maxFavorites}
                      favoriteLimit={data.policy.maxFavorites}
                      onOpen={() => openRoute(route)}
                      onFavorite={() => toggleFavorite(route.routeKey)}
                    />
                  ))}
                </Box>
              </Box>
            )}
            {queryState.selected && !selectedExists ? (
              <Typography variant="caption" color="text.secondary" role="status">
                {t('hris.explorer.states.selectionUnavailable')}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </Box>
    </PageCanvas>
  );
}

export default WorkExplorer;
