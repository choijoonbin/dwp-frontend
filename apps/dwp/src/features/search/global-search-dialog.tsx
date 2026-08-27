import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AppWindow,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Database,
  Search,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import {
  createDwaionQuestionLaunchState,
  createQuestionLaunch,
  getCatalogOverview,
  getOrganizationChart,
  getProviderDataGovernance,
  getProviderOperatorProfile,
  getWorkspaceWorkQueue,
  listAuditEvents,
  listPeople,
  listProviderAuditEvents,
  listProviderTenants,
  recordGlobalSearchAudit,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';

import {
  createAskSearchItem,
  createGlobalSearchItems,
  filterGlobalSearchItems,
} from './global-search-model';

import type { HomeAppDefinition } from '../../components/workspace-composer/app-launchpad-model';
import type { GlobalSearchItem, GlobalSearchKind } from './global-search-model';
import type { GlobalSearchAuditSource } from '@dwp-frontend/shared-utils';

const resultIcon: Record<GlobalSearchKind, typeof Search> = {
  app: AppWindow,
  work: BriefcaseBusiness,
  person: UserRound,
  organization: Building2,
  audit: ClipboardList,
  tenant: Building2,
  catalog: Database,
  ask: Sparkles,
};

type GlobalSearchDialogProps = {
  open: boolean;
  apps: readonly HomeAppDefinition[];
  includeWork: boolean;
  includeAsk: boolean;
  includePeople: boolean;
  includeTenantAudit: boolean;
  includeTenantCatalog: boolean;
  includeProvider: boolean;
  onClose: () => void;
};

export function GlobalSearchDialog({
  open,
  apps,
  includeWork,
  includeAsk,
  includePeople,
  includeTenantAudit,
  includeTenantCatalog,
  includeProvider,
  onClose,
}: GlobalSearchDialogProps) {
  const { t } = useTranslation('shell');
  const display = useDisplayDictionary();
  const { t: tWork } = useTranslation('work');
  const navigate = useNavigate();
  const toast = useToast();
  const theme = useTheme();
  const compactSearchLabel = useMediaQuery(theme.breakpoints.down('sm'));
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const lastAuditSignature = useRef('');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [auditUnavailable, setAuditUnavailable] = useState(false);
  const [launchingAsk, setLaunchingAsk] = useState(false);
  const workQuery = useQuery({
    queryKey: ['workspace', 'work-queue'],
    queryFn: getWorkspaceWorkQueue,
    enabled: open && includeWork,
    staleTime: 30_000,
    retry: 1,
  });
  const normalizedQuery = query.trim();
  const peopleQuery = useQuery({
    queryKey: ['global-search', 'people', normalizedQuery],
    queryFn: () => listPeople({ query: normalizedQuery, size: 20, surface: 'directory' }),
    enabled: open && includePeople && normalizedQuery.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });
  const organizationQuery = useQuery({
    queryKey: ['global-search', 'organizations'],
    queryFn: () => getOrganizationChart({ surface: 'directory', depth: 10 }),
    enabled: open && includePeople,
    staleTime: 300_000,
    retry: 1,
  });
  const tenantAuditQuery = useQuery({
    queryKey: ['global-search', 'tenant-audit', normalizedQuery],
    queryFn: () => listAuditEvents({ window: 'D90', query: normalizedQuery, page: 0, size: 20 }),
    enabled: open && includeTenantAudit && normalizedQuery.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });
  const tenantCatalogQuery = useQuery({
    queryKey: ['global-search', 'tenant-catalog', normalizedQuery],
    queryFn: () => getCatalogOverview({ query: normalizedQuery }),
    enabled: open && includeTenantCatalog && normalizedQuery.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });
  const providerOperatorQuery = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
    enabled: open && includeProvider,
    staleTime: 30_000,
    retry: 1,
  });
  const providerPermissions = useMemo(
    () => new Set(providerOperatorQuery.data?.permissions ?? []),
    [providerOperatorQuery.data?.permissions]
  );
  const providerTenantsQuery = useQuery({
    queryKey: ['global-search', 'provider-tenants', normalizedQuery],
    queryFn: () => listProviderTenants({ query: normalizedQuery, page: 0, size: 20 }),
    enabled:
      open &&
      normalizedQuery.length >= 2 &&
      includeProvider &&
      providerPermissions.has('ESTATE_READ'),
    staleTime: 30_000,
    retry: 1,
  });
  const providerAuditQuery = useQuery({
    queryKey: ['global-search', 'provider-audit'],
    queryFn: () => listProviderAuditEvents(),
    enabled:
      open &&
      normalizedQuery.length >= 2 &&
      includeProvider &&
      providerPermissions.has('AUDIT_READ'),
    staleTime: 30_000,
    retry: 1,
  });
  const providerCatalogQuery = useQuery({
    queryKey: ['global-search', 'provider-catalog'],
    queryFn: getProviderDataGovernance,
    enabled:
      open &&
      normalizedQuery.length >= 2 &&
      includeProvider &&
      providerPermissions.has('DATA_GOVERNANCE_READ'),
    staleTime: 60_000,
    retry: 1,
  });
  const workItems = useMemo(
    () =>
      (workQuery.data?.items ?? []).map((item) => ({
        ...item,
        due: item.dueAt
          ? formatDate(new Date(item.dueAt), { dateStyle: 'medium', timeStyle: 'short' })
          : tWork('workPage.noDueDate'),
      })),
    [tWork, workQuery.data?.items]
  );
  const catalog = useMemo(
    () =>
      createGlobalSearchItems(apps, includeWork ? workItems : [], t, {
        people: includePeople ? peopleQuery.data?.items : [],
        organizations: includePeople ? organizationQuery.data?.organizations : [],
        audits: [
          ...(tenantAuditQuery.data?.content ?? []).map((event) => ({
            id: `tenant-${event.eventId}`,
            title: event.targetDisplayName
              ? `${display('auditActions', event.action)} / ${event.targetDisplayName}`
              : display('auditActions', event.action),
            description: `${event.sourceService} / ${display(
              'outcomes',
              event.outcome
            )} / ${formatDate(new Date(event.occurredAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}`,
            route: `/admin/governance/audit-events?mode=events&query=${encodeURIComponent(
              event.eventId
            )}`,
            keywords: [
              event.eventId,
              event.action,
              event.targetType,
              event.targetId,
              event.actorDisplayName ?? '',
              event.correlationId ?? '',
            ],
            source: t('search.sources.tenantAudit'),
          })),
          ...(providerAuditQuery.data ?? []).map((event) => ({
            id: `provider-${event.auditEventId}`,
            title: display('auditActions', event.action),
            description: `${event.tenantKey ?? t('search.globalScope')} / ${display(
              'outcomes',
              event.outcome
            )} / ${formatDate(new Date(event.occurredAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}`,
            route: `/provider/audit?event=${encodeURIComponent(event.auditEventId)}`,
            keywords: [
              event.auditEventId,
              event.targetType,
              event.targetId,
              event.operatorName ?? '',
              event.tenantKey ?? '',
              event.correlationId ?? '',
            ],
            source: t('search.sources.providerAudit'),
          })),
        ],
        tenants: (providerTenantsQuery.data?.content ?? []).map((tenant) => ({
          tenantId: tenant.tenantId,
          title: tenant.displayName,
          description: `${tenant.organizationName} / ${tenant.dataRegion} / ${display(
            'states',
            tenant.lifecycleState
          )}`,
          route: `/provider/tenants/${encodeURIComponent(tenant.tenantId)}`,
          keywords: [
            tenant.tenantKey,
            tenant.organizationKey,
            tenant.organizationName,
            tenant.environmentKey,
            tenant.serviceTier,
          ],
          source: t('search.sources.providerTenants'),
        })),
        catalogAssets: [
          ...(tenantCatalogQuery.data?.entities ?? []).map((entity) => ({
            id: `tenant-${entity.ref}`,
            title: entity.name,
            description: `${display('entityKinds', entity.kind)} / ${
              entity.ownerRef ?? t('search.unassignedOwner')
            } / ${display('states', entity.lifecycleState)}`,
            route: `/admin/platform/catalog?focus=${encodeURIComponent(entity.ref)}`,
            keywords: [entity.ref, entity.key, entity.kind, entity.riskTier, entity.scope],
            source: t('search.sources.tenantCatalog'),
          })),
          ...(providerCatalogQuery.data?.assets ?? []).map((asset) => ({
            id: `provider-${asset.assetKey}`,
            title: asset.objectName,
            description: `${asset.databaseName}.${asset.schemaName} / ${asset.businessDomain} / ${asset.ownerService}`,
            route: `/provider/data-governance?tab=catalog&asset=${encodeURIComponent(
              asset.assetKey
            )}`,
            keywords: [
              asset.assetKey,
              asset.databaseKey,
              asset.objectType,
              asset.lifecycleState,
              asset.dataClassification,
            ],
            source: t('search.sources.providerCatalog'),
          })),
        ],
      }),
    [
      apps,
      display,
      includePeople,
      includeWork,
      organizationQuery.data?.organizations,
      peopleQuery.data?.items,
      providerAuditQuery.data,
      providerCatalogQuery.data?.assets,
      providerTenantsQuery.data?.content,
      t,
      tenantAuditQuery.data?.content,
      tenantCatalogQuery.data?.entities,
      workItems,
    ]
  );
  const results = useMemo(() => {
    const matches = filterGlobalSearchItems(catalog, query, 11);
    if (!query.trim() || !includeAsk) return matches;
    return [...matches, createAskSearchItem(query, t)].slice(0, 12);
  }, [catalog, includeAsk, query, t]);

  const activeSources = useMemo(() => {
    const sources: GlobalSearchAuditSource[] = ['APPS'];
    if (includeWork) sources.push('WORK');
    if (includePeople) sources.push('PEOPLE', 'ORGANIZATIONS');
    if (includeTenantAudit) sources.push('TENANT_AUDIT');
    if (includeTenantCatalog) sources.push('TENANT_CATALOG');
    if (providerPermissions.has('ESTATE_READ')) sources.push('PROVIDER_TENANTS');
    if (providerPermissions.has('AUDIT_READ')) sources.push('PROVIDER_AUDIT');
    if (providerPermissions.has('DATA_GOVERNANCE_READ')) sources.push('PROVIDER_CATALOG');
    return sources;
  }, [includePeople, includeTenantAudit, includeTenantCatalog, includeWork, providerPermissions]);

  const sourceFailures = [
    workQuery.isError && t('search.sources.work'),
    peopleQuery.isError && t('search.sources.people'),
    organizationQuery.isError && t('search.sources.organizations'),
    tenantAuditQuery.isError && t('search.sources.tenantAudit'),
    tenantCatalogQuery.isError && t('search.sources.tenantCatalog'),
    providerOperatorQuery.isError && t('search.sources.providerControl'),
    providerTenantsQuery.isError && t('search.sources.providerTenants'),
    providerAuditQuery.isError && t('search.sources.providerAudit'),
    providerCatalogQuery.isError && t('search.sources.providerCatalog'),
  ].filter((value): value is string => Boolean(value));

  useEffect(() => {
    if (!open || normalizedQuery.length < 2) return;
    const signature = `${normalizedQuery}\u0000${activeSources.join(',')}\u0000${results.length}`;
    if (signature === lastAuditSignature.current) return;
    const timer = window.setTimeout(() => {
      lastAuditSignature.current = signature;
      void recordGlobalSearchAudit({
        phase: 'QUERY',
        query: normalizedQuery,
        sources: activeSources,
        resultCount: results.length,
      }).catch(() => setAuditUnavailable(true));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeSources, normalizedQuery, open, results.length]);

  useEffect(() => setActiveIndex(0), [query]);
  useEffect(() => {
    if (!open) {
      setQuery('');
      setAuditUnavailable(false);
      lastAuditSignature.current = '';
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const close = () => {
    setQuery('');
    setActiveIndex(0);
    onClose();
  };
  const select = async (item: GlobalSearchItem) => {
    if (item.kind === 'ask' && launchingAsk) return;
    if (normalizedQuery.length >= 2) {
      void recordGlobalSearchAudit({
        phase: 'SELECTION',
        query: normalizedQuery,
        sources: activeSources,
        resultCount: results.length,
        selectedKind: item.kind.toUpperCase(),
        selectedId: item.id,
      }).catch(() => undefined);
    }
    if (item.kind !== 'ask') {
      close();
      navigate(item.route);
      return;
    }
    setLaunchingAsk(true);
    try {
      const receipt = await createQuestionLaunch(normalizedQuery);
      const state = createDwaionQuestionLaunchState(receipt.launchId);
      if (!state) throw new Error('Question launch receipt is invalid.');
      close();
      navigate(item.route, { state });
    } catch {
      toast.error(t('search.questionLaunchUnavailable'));
    } finally {
      setLaunchingAsk(false);
    }
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      void select(results[activeIndex]);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      aria-labelledby="global-search-title"
      slotProps={{
        transition: {
          onEntered: () => searchInputRef.current?.focus({ preventScroll: true }),
        },
        backdrop: {
          sx: {
            bgcolor: 'rgba(7, 14, 24, 0.46)',
            backdropFilter: 'blur(7px)',
            WebkitBackdropFilter: 'blur(7px)',
            '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': {
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            },
          },
        },
        paper: {
          sx: {
            alignSelf: 'flex-start',
            mt: { xs: 1.5, sm: 8 },
            mx: { xs: 1.5, sm: 3 },
            width: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            maxHeight: { xs: 'calc(100dvh - 24px)', sm: 'min(680px, calc(100dvh - 96px))' },
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.96),
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 32px 88px rgba(0, 0, 0, 0.56)'
                : '0 32px 88px rgba(18, 29, 45, 0.24)',
            backdropFilter: 'blur(30px) saturate(145%)',
            WebkitBackdropFilter: 'blur(30px) saturate(145%)',
            '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': {
              bgcolor: 'background.paper',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            },
          },
        },
      }}
    >
      <Typography
        id="global-search-title"
        component="h2"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {t('search.label')}
      </Typography>
      <Box sx={{ minHeight: 70, px: { xs: 1, sm: 1.5 }, display: 'flex', alignItems: 'center' }}>
        <Search size={22} strokeWidth={1.8} aria-hidden="true" />
        <InputBase
          autoFocus
          inputRef={searchInputRef}
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={compactSearchLabel ? t('search.shortPlaceholder') : t('search.placeholder')}
          inputProps={{
            'aria-label': t('search.label'),
            'aria-autocomplete': 'list',
            'aria-controls': 'global-search-results',
            'aria-expanded': true,
            'aria-activedescendant': results[activeIndex]
              ? `global-search-option-${activeIndex}`
              : undefined,
            role: 'combobox',
          }}
          sx={{ mx: 1.25, '& input': { py: 1.5, fontSize: { xs: 16, sm: 18 } } }}
        />
        <Tooltip title={t('search.close')}>
          <IconButton aria-label={t('search.close')} onClick={close} size="small">
            <X size={19} strokeWidth={1.8} />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />

      <Box sx={{ overflowY: 'auto', p: { xs: 1, sm: 1.5 }, minHeight: 120 }}>
        {sourceFailures.length > 0 && (
          <Typography
            role="status"
            variant="caption"
            color="warning.main"
            sx={{ display: 'block', px: 1.25, pb: 0.5 }}
          >
            {t('search.partialResults', { sources: sourceFailures.join(', ') })}
          </Typography>
        )}
        {auditUnavailable && (
          <Typography
            role="status"
            variant="caption"
            color="warning.main"
            sx={{ display: 'block', px: 1.25, pb: 0.5 }}
          >
            {t('search.auditUnavailable')}
          </Typography>
        )}
        <Typography
          component="p"
          variant="overline"
          color="text.secondary"
          sx={{ px: 1.25, py: 0.5 }}
        >
          {query.trim() ? t('search.bestMatches') : t('search.suggested')}
        </Typography>
        {results.length > 0 ? (
          <Box
            component="ul"
            id="global-search-results"
            role="listbox"
            aria-label={t('search.resultsLabel')}
            sx={{ p: 0, m: 0, listStyle: 'none' }}
          >
            {results.map((item, index) => {
              const Icon = resultIcon[item.kind];
              const selected = index === activeIndex;
              return (
                <Box component="li" key={item.id} role="presentation">
                  <ButtonBase
                    id={`global-search-option-${index}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    disabled={launchingAsk && item.kind === 'ask'}
                    onClick={() => void select(item)}
                    sx={{
                      width: 1,
                      minHeight: 62,
                      px: 1.25,
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '38px minmax(0, 1fr)',
                        sm: '38px minmax(0, 1fr) auto',
                      },
                      gap: 1.25,
                      alignItems: 'center',
                      borderRadius: 1,
                      textAlign: 'left',
                      bgcolor: selected ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 36,
                        height: 36,
                        display: 'grid',
                        placeItems: 'center',
                        border: 1,
                        borderColor: selected ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        color: selected ? 'primary.main' : 'text.secondary',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        component="p"
                        variant="subtitle2"
                        noWrap
                        color={selected ? 'text.primary' : undefined}
                      >
                        {item.title}
                      </Typography>
                      <Typography
                        component="p"
                        variant="caption"
                        color={selected ? 'text.primary' : 'text.secondary'}
                        noWrap
                      >
                        {item.description}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      color={selected ? 'text.primary' : 'text.secondary'}
                      sx={{ px: 0.5, display: { xs: 'none', sm: 'block' } }}
                    >
                      {item.source}
                    </Typography>
                  </ButtonBase>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{ minHeight: 96, display: 'grid', placeItems: 'center' }}>
            <Typography color="text.secondary">{t('search.noResults')}</Typography>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
