import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Search, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import {
  getTenantWidgetCatalog,
  getTenantWidgetPolicy,
  getWidgetRegistryReadiness,
  listTenantPolicyHistory,
  previewTenantPolicyImpact,
  resolveWidgetRegistryConnection,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  EffectiveWidgetCatalog,
  EffectiveWidgetCatalogItem,
  WidgetPlacementContext,
  WidgetPublicReasonCode,
} from '@dwp-frontend/shared-utils';

type TenantCatalogRow = EffectiveWidgetCatalogItem &
  Readonly<{
    placementContexts: readonly WidgetPlacementContext[];
    reasonCodes: readonly WidgetPublicReasonCode[];
  }>;

const STATE_PRIORITY: Record<EffectiveWidgetCatalogItem['effectiveState'], number> = {
  DENY: 4,
  DEPRECATED: 3,
  ALREADY_ADDED: 2,
  AVAILABLE: 1,
};

const CATALOG_ROW_HEIGHT = 76;
const CATALOG_VIEWPORT_HEIGHT = CATALOG_ROW_HEIGHT * 8;
const CATALOG_OVERSCAN = 3;

export function tenantCatalogRows(catalog: EffectiveWidgetCatalog | undefined): TenantCatalogRow[] {
  const rows = new Map<string, TenantCatalogRow>();
  catalog?.contexts.forEach((context) => {
    context.items.forEach((item) => {
      const current = rows.get(item.definitionId);
      if (!current) {
        rows.set(item.definitionId, { ...item, placementContexts: [context.placementContext] });
        return;
      }
      const selected =
        STATE_PRIORITY[item.effectiveState] > STATE_PRIORITY[current.effectiveState]
          ? item
          : current;
      rows.set(item.definitionId, {
        ...selected,
        reasonCodes: [...new Set([...current.reasonCodes, ...item.reasonCodes])],
        placementContexts: [...new Set([...current.placementContexts, context.placementContext])],
      });
    });
  });
  return [...rows.values()].sort((left, right) =>
    left.definitionKey.localeCompare(right.definitionKey)
  );
}

function revealDetail(detailId: string, headingId: string) {
  if (!window.matchMedia('(max-width: 899.95px)').matches) return;
  window.requestAnimationFrame(() => {
    document.getElementById(headingId)?.focus({ preventScroll: true });
    document.getElementById(detailId)?.scrollIntoView({ block: 'start' });
  });
}

export function TenantWidgetRegistryPanel({ onOpenPolicy }: { onOpenPolicy: () => void }) {
  const { t } = useTranslation('admin');
  const detailId = useId();
  const headingId = `${detailId}-heading`;
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const [selectedId, setSelectedId] = useState('');
  const [catalogScrollTop, setCatalogScrollTop] = useState(0);
  const catalogViewportRef = useRef<HTMLDivElement | null>(null);
  const readinessQuery = useQuery({
    queryKey: ['widget-registry', 'readiness', 'tenant-admin'],
    queryFn: getWidgetRegistryReadiness,
    staleTime: 30_000,
    retry: 1,
  });
  const connection = resolveWidgetRegistryConnection(readinessQuery.data);
  const catalogQuery = useQuery({
    queryKey: ['widget-registry', 'tenant-catalog', 'workspace-home'],
    queryFn: () => getTenantWidgetCatalog({ surfaceKey: 'workspace-home' }),
    enabled: connection.reason === 'SHADOW',
    staleTime: 30_000,
    retry: 1,
  });
  const catalogItems = useMemo(() => tenantCatalogRows(catalogQuery.data), [catalogQuery.data]);
  const items = useMemo(
    () =>
      catalogItems.filter((item) => {
        if (!deferredQuery) return true;
        return `${item.definitionKey} ${item.semanticVersion} ${item.reasonCodes.join(' ')}`
          .toLocaleLowerCase()
          .includes(deferredQuery);
      }),
    [catalogItems, deferredQuery]
  );
  const firstRenderedIndex = Math.max(
    0,
    Math.floor(catalogScrollTop / CATALOG_ROW_HEIGHT) - CATALOG_OVERSCAN
  );
  const virtualized = items.length > 30;
  const renderedItems = virtualized
    ? items.slice(
        firstRenderedIndex,
        Math.min(
          items.length,
          firstRenderedIndex +
            Math.ceil(CATALOG_VIEWPORT_HEIGHT / CATALOG_ROW_HEIGHT) +
            CATALOG_OVERSCAN * 2
        )
      )
    : items;
  useEffect(() => {
    setCatalogScrollTop(0);
    if (catalogViewportRef.current) catalogViewportRef.current.scrollTop = 0;
  }, [deferredQuery]);
  useEffect(() => {
    if (items.some((item) => item.definitionId === selectedId)) return;
    setSelectedId(items[0]?.definitionId ?? '');
  }, [items, selectedId]);
  const selected = items.find((item) => item.definitionId === selectedId) ?? null;
  const policyQuery = useQuery({
    queryKey: ['widget-registry', 'tenant-policy', selected?.definitionId],
    queryFn: () => getTenantWidgetPolicy(selected!.definitionId),
    enabled: Boolean(selected),
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: ['widget-registry', 'tenant-policy-history', selected?.definitionId],
    queryFn: () => listTenantPolicyHistory(selected!.definitionId, { page: 0, size: 10 }),
    enabled: Boolean(selected),
    retry: false,
  });
  const draftRevision =
    policyQuery.data?.current.policyState === 'DRAFT' ? policyQuery.data.current : null;
  const impactQuery = useQuery({
    queryKey: [
      'widget-registry',
      'tenant-policy-impact',
      selected?.definitionId,
      draftRevision?.policyRevisionId,
    ],
    queryFn: () =>
      previewTenantPolicyImpact(selected!.definitionId, draftRevision!.policyRevisionId),
    enabled: Boolean(selected && draftRevision),
    retry: false,
  });

  if (readinessQuery.isLoading) {
    return <LoadingState label={t('homeWidgets.controlPlane.loading')} variant="skeleton" />;
  }
  if (readinessQuery.isError || connection.reason !== 'SHADOW') {
    return (
      <ErrorState
        title={t('homeWidgets.controlPlane.unavailable')}
        description={t('homeWidgets.controlPlane.unavailableDescription')}
        retryLabel={t('homeWidgets.controlPlane.retry')}
        retrying={readinessQuery.isFetching}
        onRetry={() => void readinessQuery.refetch()}
      />
    );
  }
  if (catalogQuery.isLoading) {
    return <LoadingState label={t('homeWidgets.controlPlane.catalogLoading')} variant="skeleton" />;
  }
  if (catalogQuery.isError) {
    return (
      <ErrorState
        title={t('homeWidgets.controlPlane.catalogFailed')}
        description={t('homeWidgets.controlPlane.catalogFailedDescription')}
        retryLabel={t('homeWidgets.controlPlane.retry')}
        retrying={catalogQuery.isFetching}
        onRetry={() => void catalogQuery.refetch()}
      />
    );
  }

  const shadow = true;
  const catalogList = (
    <List
      disablePadding
      aria-label={t('homeWidgets.catalog.listLabel')}
      sx={{
        ...(virtualized ? { position: 'relative', height: items.length * CATALOG_ROW_HEIGHT } : {}),
        borderInlineEnd: { md: 1 },
        borderColor: 'divider',
      }}
    >
      {renderedItems.map((item, renderedIndex) => (
        <ListItem
          key={item.definitionId}
          disablePadding
          sx={
            virtualized
              ? {
                  position: 'absolute',
                  insetInline: 0,
                  top: (firstRenderedIndex + renderedIndex) * CATALOG_ROW_HEIGHT,
                  height: CATALOG_ROW_HEIGHT,
                }
              : undefined
          }
        >
          <ListItemButton
            selected={item.definitionId === selected?.definitionId}
            aria-label={item.definitionKey}
            aria-current={item.definitionId === selected?.definitionId ? 'true' : undefined}
            aria-controls={detailId}
            onClick={() => {
              setSelectedId(item.definitionId);
              revealDetail(detailId, headingId);
            }}
            sx={{ minHeight: 76, borderBottom: 1, borderColor: 'divider' }}
          >
            <ListItemText
              primary={item.definitionKey}
              secondary={item.semanticVersion || t('homeWidgets.controlPlane.unresolved')}
              primaryTypographyProps={{ variant: 'subtitle2' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t(`homeWidgets.controlPlane.effective.${item.effectiveState}`)}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
  return (
    <Stack
      gap={2.5}
      data-widget-control-plane-mode={connection.reason.toLowerCase()}
      data-widget-catalog-size={catalogItems.length}
      data-widget-catalog-visible-count={items.length}
      data-widget-catalog-rendered-count={renderedItems.length}
    >
      <InlineFeedback
        icon={<ShieldCheck size={19} />}
        severity={shadow ? 'warning' : 'info'}
        title={t(
          shadow ? 'homeWidgets.controlPlane.shadowTitle' : 'homeWidgets.controlPlane.activeTitle'
        )}
      >
        <Typography variant="body2">
          {t(
            shadow
              ? 'homeWidgets.controlPlane.shadowDescription'
              : 'homeWidgets.controlPlane.activeDescription'
          )}
        </Typography>
      </InlineFeedback>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
        <FormField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          label={t('homeWidgets.catalog.search')}
          placeholder={t('homeWidgets.catalog.searchPlaceholder')}
          sx={{ maxWidth: { sm: 420 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <ActionButton intent="secondary" onClick={onOpenPolicy}>
          {t('homeWidgets.catalog.openPolicy')}
        </ActionButton>
      </Stack>
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {t('homeWidgets.controlPlane.resultCount', { count: items.length })}
      </Typography>
      {items.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          title={t('homeWidgets.catalog.noResults')}
          description={t('homeWidgets.catalog.noResultsDescription')}
          size="standard"
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '340px minmax(0, 1fr)' },
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          {virtualized ? (
            <Box
              ref={catalogViewportRef}
              data-widget-catalog-virtualized="true"
              tabIndex={0}
              aria-label={t('homeWidgets.catalog.keyboardViewport')}
              onScroll={(event) => setCatalogScrollTop(event.currentTarget.scrollTop)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                const scrollTarget = event.currentTarget;
                let nextScrollTop = scrollTarget.scrollTop;
                if (event.key === 'Home') nextScrollTop = 0;
                else if (event.key === 'End')
                  nextScrollTop = Math.max(
                    0,
                    scrollTarget.scrollHeight - scrollTarget.clientHeight
                  );
                else if (event.key === 'PageDown') nextScrollTop += scrollTarget.clientHeight;
                else if (event.key === 'PageUp') nextScrollTop -= scrollTarget.clientHeight;
                else return;
                scrollTarget.scrollTop = nextScrollTop;
                setCatalogScrollTop(nextScrollTop);
                event.preventDefault();
              }}
              sx={{ maxHeight: CATALOG_VIEWPORT_HEIGHT, overflowY: 'auto' }}
            >
              {catalogList}
            </Box>
          ) : (
            catalogList
          )}
          {selected && (
            <TenantWidgetRegistryDetail
              detailId={detailId}
              headingId={headingId}
              item={selected}
              shadow={shadow}
              policyLoading={policyQuery.isLoading}
              policy={policyQuery.data}
              history={historyQuery.data?.items ?? []}
              impact={impactQuery.data}
            />
          )}
        </Box>
      )}
    </Stack>
  );
}

function TenantWidgetRegistryDetail({
  detailId,
  headingId,
  item,
  shadow,
  policyLoading,
  policy,
  history,
  impact,
}: {
  detailId: string;
  headingId: string;
  item: TenantCatalogRow;
  shadow: boolean;
  policyLoading: boolean;
  policy?: Awaited<ReturnType<typeof getTenantWidgetPolicy>>;
  history: Awaited<ReturnType<typeof listTenantPolicyHistory>>['items'];
  impact?: Awaited<ReturnType<typeof previewTenantPolicyImpact>>;
}) {
  const { t } = useTranslation('admin');
  const mutationReason = shadow ? t('homeWidgets.controlPlane.shadowMutationDisabled') : undefined;
  return (
    <Stack
      id={detailId}
      role="region"
      aria-labelledby={headingId}
      gap={2.5}
      sx={{ p: 3, minWidth: 0 }}
    >
      <Box>
        <Typography id={headingId} component="h2" variant="h6" tabIndex={-1}>
          {item.definitionKey}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {item.reasonCodes.length > 0
            ? item.reasonCodes
                .map((reason) => t(`homeWidgets.controlPlane.publicReasons.${reason}`))
                .join(', ')
            : t('homeWidgets.controlPlane.noPublicReason')}
        </Typography>
      </Box>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        <Chip
          size="small"
          label={item.semanticVersion || t('homeWidgets.controlPlane.unresolved')}
        />
        {item.placementContexts.map((context) => (
          <Chip key={context} size="small" variant="outlined" label={context} />
        ))}
        {policy?.current.required && (
          <Chip size="small" color="info" label={t('homeWidgets.controlPlane.required')} />
        )}
      </Stack>
      <Divider />
      <Box>
        <Typography variant="subtitle2">{t('homeWidgets.controlPlane.policyTitle')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {policyLoading
            ? t('homeWidgets.controlPlane.policyLoading')
            : policy
              ? t('homeWidgets.controlPlane.policySummary', {
                  state: policy.current.policyState,
                  revision: policy.current.revisionNumber,
                })
              : t('homeWidgets.controlPlane.policyMissing')}
        </Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2">{t('homeWidgets.controlPlane.impactTitle')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {impact
            ? t('homeWidgets.controlPlane.impactSummary', {
                tenants: impact.affectedTenantCount,
                instances: impact.instanceReferenceCount,
              })
            : t('homeWidgets.controlPlane.impactUnavailable')}
        </Typography>
      </Box>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        {(['publish', 'block', 'rollback'] as const).map((action) => (
          <ActionButton
            key={action}
            size="small"
            intent={action === 'block' ? 'danger' : 'secondary'}
            disabled={shadow || !policy || !impact}
            title={mutationReason}
          >
            {t(`homeWidgets.controlPlane.actions.${action}`)}
          </ActionButton>
        ))}
      </Stack>
      <Box>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <History size={16} aria-hidden="true" />
          <Typography variant="subtitle2">{t('homeWidgets.controlPlane.auditTitle')}</Typography>
        </Stack>
        {history.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t('homeWidgets.controlPlane.auditEmpty')}
          </Typography>
        ) : (
          <List dense disablePadding sx={{ mt: 0.5 }}>
            {history.map((revision) => (
              <ListItem key={revision.policyRevisionId} disableGutters>
                <ListItemText
                  primary={t('homeWidgets.controlPlane.auditRevision', {
                    revision: revision.revisionNumber,
                    state: revision.policyState,
                  })}
                  secondary={revision.createdAt}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Stack>
  );
}
