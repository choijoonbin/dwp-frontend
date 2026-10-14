import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileSearch, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  useInfiniteQuery,
  useIsFetching,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { getHcmAuditEvidence, HttpError, listHcmAuditEvidence } from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';

import type {
  HcmAuditCategory,
  HcmAuditEvidence,
  HcmAuditEvidenceFilters,
  HcmAuditOutcome,
  HcmAuditSeverity,
  HcmAuditWindow,
} from '@dwp-frontend/shared-utils';

export const HCM_AUDIT_SAFE_RETURN_PATH = '/hr/home';
export const GENERIC_AUDIT_QUERY_KEY = ['audit-control'] as const;
export const HCM_AUDIT_QUERY_KEY = ['hcm-audit-evidence'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const WINDOWS: HcmAuditWindow[] = ['H24', 'D7', 'D30', 'D90'];
const CATEGORIES: HcmAuditCategory[] = ['ALL', 'ADMIN_CHANGE', 'POLICY_DENIED'];
const SEVERITIES: HcmAuditSeverity[] = ['ALL', 'INFO', 'HIGH', 'CRITICAL'];
const OUTCOMES: HcmAuditOutcome[] = ['ALL', 'SUCCESS', 'DENIED', 'FAILED'];

type AuditOverviewProfile = 'GENERIC' | 'HCM' | 'INVALID';
type FocusState = { kind: 'NONE' } | { kind: 'VALID'; eventId: string } | { kind: 'INVALID' };
type EvidenceBoundaryFailure = { error: unknown; detail: boolean };

type FilterState = Required<
  Pick<HcmAuditEvidenceFilters, 'window' | 'category' | 'severity' | 'outcome'>
> &
  Pick<HcmAuditEvidenceFilters, 'sourceService' | 'query'>;

const DEFAULT_FILTERS: FilterState = {
  window: 'D7',
  category: 'ALL',
  severity: 'ALL',
  outcome: 'ALL',
  sourceService: '',
  query: '',
};
const REPLAY_INCONSISTENT_ERROR = new Error('HCM audit evidence replay is inconsistent');

function purgeQueryFamily(queryClient: QueryClient, queryKey: readonly unknown[]) {
  void queryClient.cancelQueries({ queryKey, exact: false });
  queryClient.removeQueries({ queryKey, exact: false });
}

export function resolveAuditOverviewProfile(
  searchParams: URLSearchParams,
  rawSearch = searchParams.toString()
): AuditOverviewProfile {
  const rawQuery = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
  const rawProductTokens = rawQuery.split('&').filter((token) => {
    const rawKey = token.split('=', 1)[0] ?? '';
    let decodedKey = rawKey;
    try {
      decodedKey = decodeURIComponent(rawKey.replace(/\+/gu, ' '));
    } catch {
      // Keep the raw key so malformed percent escapes can only fail closed.
    }
    const normalizedKey = decodedKey.normalize('NFKC').toLowerCase();
    const compactKey = normalizedKey.replace(/[^a-z]/gu, '');
    return compactKey.includes('product');
  });
  const products = searchParams.getAll('product');
  if (products.length === 0 && rawProductTokens.length === 0) return 'GENERIC';
  // This is only a presentation/profile selector. All authority remains server-owned.
  return products.length === 1 &&
    products[0] === 'HCM' &&
    rawProductTokens.length === 1 &&
    rawProductTokens[0] === 'product=HCM'
    ? 'HCM'
    : 'INVALID';
}

export function resolveHcmAuditFocus(searchParams: URLSearchParams): FocusState {
  const values = searchParams.getAll('focus');
  if (values.length === 0) return { kind: 'NONE' };
  return values.length === 1 && UUID.test(values[0] ?? '')
    ? { kind: 'VALID', eventId: values[0]! }
    : { kind: 'INVALID' };
}

function errorKey(error: unknown, detail = false): string {
  if (!(error instanceof HttpError)) return 'auditControl.hcmEvidence.errors.unavailable';
  if (error.status === 401 || error.status === 403) {
    return 'auditControl.hcmEvidence.errors.denied';
  }
  if (detail && error.status === 404) return 'auditControl.hcmEvidence.errors.notFound';
  return 'auditControl.hcmEvidence.errors.unavailable';
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && [401, 403, 404, 503].includes(error.status)) return false;
  return failureCount < 1;
}

function ContextHeader({ actions }: { actions?: ReactNode }) {
  const { t } = useTranslation('admin');
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ sm: 'center' }}
      justifyContent="space-between"
      gap={2}
      sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderBottom: 1, borderColor: 'divider' }}
    >
      <Stack direction="row" alignItems="center" gap={1.5} minWidth={0}>
        <Box
          aria-hidden="true"
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            flex: '0 0 auto',
            borderRadius: 2,
            bgcolor: 'success.light',
            color: 'success.dark',
          }}
        >
          <ShieldCheck size={21} />
        </Box>
        <Box minWidth={0}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography component="h2" variant="h6" fontWeight={760}>
              {t('auditControl.hcmEvidence.title')}
            </Typography>
            <Chip size="small" color="success" label={t('auditControl.hcmEvidence.context')} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t('auditControl.hcmEvidence.description')}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        {actions}
        <Button
          component={RouterLink}
          to={HCM_AUDIT_SAFE_RETURN_PATH}
          variant="outlined"
          startIcon={<ArrowLeft size={17} />}
        >
          {t('auditControl.hcmEvidence.backToHris')}
        </Button>
      </Stack>
    </Stack>
  );
}

export function InvalidHcmAuditEvidenceContext() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();

  useLayoutEffect(() => {
    purgeQueryFamily(queryClient, GENERIC_AUDIT_QUERY_KEY);
    purgeQueryFamily(queryClient, HCM_AUDIT_QUERY_KEY);
    return () => purgeQueryFamily(queryClient, HCM_AUDIT_QUERY_KEY);
  }, [queryClient]);

  return (
    <Box
      data-testid="hcm-audit-invalid-context"
      sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <ContextHeader />
      <ManagementPanelError message={t('auditControl.hcmEvidence.errors.invalidContext')} />
    </Box>
  );
}

function FilterPanel({
  value,
  onChange,
  onApply,
  onReset,
}: {
  value: FilterState;
  onChange: (value: FilterState) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation('admin');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply();
  };
  return (
    <Box
      component="form"
      onSubmit={submit}
      aria-label={t('auditControl.hcmEvidence.filters.label')}
      sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderBottom: 1, borderColor: 'divider' }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(6, minmax(130px, 1fr))',
          },
          gap: 1.25,
        }}
      >
        <TextField
          select
          size="small"
          label={t('auditControl.hcmEvidence.filters.window')}
          value={value.window}
          onChange={(event) => onChange({ ...value, window: event.target.value as HcmAuditWindow })}
        >
          {WINDOWS.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`auditControl.windows.${option}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('auditControl.hcmEvidence.filters.category')}
          value={value.category}
          onChange={(event) =>
            onChange({ ...value, category: event.target.value as HcmAuditCategory })
          }
        >
          {CATEGORIES.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`auditControl.hcmEvidence.category.${option}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('auditControl.hcmEvidence.filters.severity')}
          value={value.severity}
          onChange={(event) =>
            onChange({ ...value, severity: event.target.value as HcmAuditSeverity })
          }
        >
          {SEVERITIES.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`auditControl.hcmEvidence.severity.${option}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('auditControl.hcmEvidence.filters.outcome')}
          value={value.outcome}
          onChange={(event) =>
            onChange({ ...value, outcome: event.target.value as HcmAuditOutcome })
          }
        >
          {OUTCOMES.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`auditControl.hcmEvidence.outcome.${option}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label={t('auditControl.hcmEvidence.filters.sourceService')}
          value={value.sourceService}
          inputProps={{ maxLength: 128 }}
          onChange={(event) => onChange({ ...value, sourceService: event.target.value })}
        />
        <TextField
          size="small"
          label={t('auditControl.hcmEvidence.filters.query')}
          value={value.query}
          inputProps={{ maxLength: 160 }}
          onChange={(event) => onChange({ ...value, query: event.target.value })}
        />
      </Box>
      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mt: 1.5 }}>
        <Button type="button" onClick={onReset}>
          {t('auditControl.hcmEvidence.filters.reset')}
        </Button>
        <Button type="submit" variant="contained">
          {t('auditControl.hcmEvidence.filters.apply')}
        </Button>
      </Stack>
    </Box>
  );
}

function EvidenceList({
  items,
  selectedEventId,
  onSelect,
}: {
  items: HcmAuditEvidence[];
  selectedEventId?: string;
  onSelect: (eventId: string) => void;
}) {
  const { t } = useTranslation('admin');
  if (!items.length) {
    return (
      <Stack alignItems="center" justifyContent="center" gap={1} sx={{ minHeight: 260, p: 3 }}>
        <FileSearch size={28} />
        <Typography variant="subtitle2">{t('auditControl.hcmEvidence.empty.title')}</Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {t('auditControl.hcmEvidence.empty.description')}
        </Typography>
      </Stack>
    );
  }
  return (
    <List disablePadding aria-label={t('auditControl.hcmEvidence.listLabel')}>
      {items.map((item) => (
        <ListItemButton
          key={item.eventId}
          selected={item.eventId === selectedEventId}
          onClick={() => onSelect(item.eventId)}
          sx={{
            alignItems: 'flex-start',
            gap: 1.5,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <ListItemText
            primary={item.action}
            secondary={
              <>
                {`${item.sourceService} · ${item.sourceModule}`}
                <br />
                {formatDate(item.occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}
              </>
            }
            primaryTypographyProps={{ fontWeight: 720, noWrap: true }}
            secondaryTypographyProps={{ component: 'span' }}
          />
          <Chip
            size="small"
            variant="outlined"
            color={item.outcome === 'SUCCESS' ? 'success' : 'warning'}
            label={t(`auditControl.hcmEvidence.outcome.${item.outcome}`)}
          />
        </ListItemButton>
      ))}
    </List>
  );
}

function EvidenceField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box component="div" sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

function EvidenceDetail({
  evidence,
  onClose,
}: {
  evidence: HcmAuditEvidence;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const field = (key: string) => t(`auditControl.hcmEvidence.fields.${key}`);
  const optional = (value: string | null) => value ?? t('auditControl.hcmEvidence.unavailable');
  return (
    <Box component="article" aria-labelledby="hcm-audit-detail-title" sx={{ p: 2.25 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box minWidth={0}>
          <Typography id="hcm-audit-detail-title" component="h3" variant="subtitle1">
            {t('auditControl.hcmEvidence.detailTitle')}
          </Typography>
          <Typography variant="body2" fontWeight={720} sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
            {evidence.action}
          </Typography>
        </Box>
        <Button size="small" startIcon={<X size={16} />} onClick={onClose}>
          {t('auditControl.hcmEvidence.closeDetail')}
        </Button>
      </Stack>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
        <Chip
          size="small"
          color={evidence.outcome === 'SUCCESS' ? 'success' : 'warning'}
          label={t(`auditControl.hcmEvidence.outcome.${evidence.outcome}`)}
        />
        <Chip
          size="small"
          variant="outlined"
          label={t(`auditControl.hcmEvidence.classification.${evidence.classification}`)}
        />
        <Chip
          size="small"
          variant="outlined"
          label={t(`auditControl.hcmEvidence.retention.${evidence.retentionClass}`)}
        />
      </Stack>
      <Divider sx={{ my: 2 }} />
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.75,
        }}
      >
        <EvidenceField label={field('occurredAt')}>
          {formatDate(evidence.occurredAt, { dateStyle: 'long', timeStyle: 'medium' })}
        </EvidenceField>
        <EvidenceField label={field('eventId')}>{evidence.eventId}</EvidenceField>
        <EvidenceField label={field('category')}>
          {t(`auditControl.hcmEvidence.category.${evidence.category}`)}
        </EvidenceField>
        <EvidenceField label={field('severity')}>
          {t(`auditControl.hcmEvidence.severity.${evidence.severity}`)}
        </EvidenceField>
        <EvidenceField label={field('actorType')}>
          {t(`auditControl.hcmEvidence.actorType.${evidence.actorType}`)}
        </EvidenceField>
        <EvidenceField label={field('source')}>
          {`${evidence.sourceService} · ${evidence.sourceModule}`}
        </EvidenceField>
        <EvidenceField label={field('aggregate')}>
          {t('auditControl.hcmEvidence.aggregateValue', {
            type: evidence.aggregateType,
            revision: evidence.aggregateRevision,
          })}
        </EvidenceField>
        <EvidenceField label={field('effectiveCapability')}>
          {evidence.effectiveCapability}
        </EvidenceField>
        <EvidenceField label={field('purposeCode')}>{evidence.purposeCode}</EvidenceField>
        <EvidenceField label={field('authorizationDecisionRef')}>
          {evidence.authorizationDecisionRef}
        </EvidenceField>
        <EvidenceField label={field('scopeRevision')}>{evidence.scopeRevision}</EvidenceField>
        <EvidenceField label={field('fieldPolicyRevision')}>
          {evidence.fieldPolicyRevision}
        </EvidenceField>
        <EvidenceField label={field('approvalReceiptId')}>
          {optional(evidence.approvalReceiptId)}
        </EvidenceField>
        <EvidenceField label={field('reasonCode')}>{optional(evidence.reasonCode)}</EvidenceField>
        <EvidenceField label={field('causationId')}>{evidence.causationId}</EvidenceField>
        <EvidenceField label={field('correlationId')}>{evidence.correlationId}</EvidenceField>
        <EvidenceField label={field('beforeDigest')}>
          {optional(evidence.beforeDigest)}
        </EvidenceField>
        <EvidenceField label={field('afterDigest')}>{optional(evidence.afterDigest)}</EvidenceField>
        <EvidenceField label={field('evidenceDigest')}>{evidence.evidenceDigest}</EvidenceField>
        <EvidenceField label={field('recordHash')}>{evidence.recordHash}</EvidenceField>
      </Box>
    </Box>
  );
}

function HcmAuditEvidenceQueryBoundary({
  filters,
  focus,
  onFocus,
  onFailure,
}: {
  filters: FilterState;
  focus: FocusState;
  onFocus: (eventId?: string) => void;
  onFailure: (failure: EvidenceBoundaryFailure) => void;
}) {
  const { t } = useTranslation('admin');
  const listQuery = useInfiniteQuery({
    queryKey: [...HCM_AUDIT_QUERY_KEY, 'list', filters],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      listHcmAuditEvidence(
        {
          ...filters,
          size: 25,
          cursor: pageParam ?? undefined,
        },
        signal
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    gcTime: 0,
    retry: shouldRetry,
  });

  const focusedEventId = focus.kind === 'VALID' ? focus.eventId : undefined;
  const detailQuery = useQuery({
    queryKey: [...HCM_AUDIT_QUERY_KEY, 'detail', focusedEventId],
    queryFn: ({ signal }) => getHcmAuditEvidence(focusedEventId!, signal),
    enabled: focus.kind === 'VALID',
    gcTime: 0,
    retry: shouldRetry,
  });

  const pages = useMemo(() => listQuery.data?.pages ?? [], [listQuery.data?.pages]);
  const items = useMemo(() => pages.flatMap((page) => page.items), [pages]);
  const snapshots = new Set(pages.map((page) => page.snapshotAt));
  const uniqueIds = new Set(items.map((item) => item.eventId));
  const replayIsConsistent = snapshots.size <= 1 && uniqueIds.size === items.length;
  const boundaryError =
    listQuery.error ??
    detailQuery.error ??
    (!replayIsConsistent ? REPLAY_INCONSISTENT_ERROR : null);
  const boundaryIsDetail = !listQuery.error && Boolean(detailQuery.error);

  useEffect(() => {
    if (boundaryError) onFailure({ error: boundaryError, detail: boundaryIsDetail });
  }, [boundaryError, boundaryIsDetail, onFailure]);

  if (boundaryError) {
    return <ManagementPanelError message={t(errorKey(boundaryError, boundaryIsDetail))} />;
  }

  if (listQuery.isPending) {
    return <ManagementPanelLoading label={t('auditControl.hcmEvidence.loading')} />;
  }

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={0.75}
        sx={{ px: { xs: 2, md: 2.5 }, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="subtitle2">{t('auditControl.hcmEvidence.listTitle')}</Typography>
        {pages[0] && (
          <Typography variant="caption" color="text.secondary">
            {t('auditControl.hcmEvidence.snapshotAt', {
              time: formatDate(pages[0].snapshotAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </Typography>
        )}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 0.8fr) minmax(0, 1.2fr)' },
          minHeight: 360,
        }}
      >
        <Box sx={{ minWidth: 0, borderRight: { lg: 1 }, borderColor: 'divider' }}>
          <EvidenceList items={items} selectedEventId={focusedEventId} onSelect={onFocus} />
          {listQuery.hasNextPage && (
            <Box sx={{ p: 1.5, textAlign: 'center' }}>
              <Button
                onClick={() => void listQuery.fetchNextPage()}
                disabled={listQuery.isFetchingNextPage}
              >
                {listQuery.isFetchingNextPage
                  ? t('auditControl.hcmEvidence.loadingMore')
                  : t('auditControl.hcmEvidence.loadMore')}
              </Button>
            </Box>
          )}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {focus.kind === 'INVALID' ? (
            <ManagementPanelError message={t('auditControl.hcmEvidence.errors.invalidFocus')} />
          ) : focus.kind === 'NONE' ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              gap={1}
              sx={{ minHeight: 300, p: 3 }}
            >
              <FileSearch size={28} />
              <Typography variant="subtitle2">
                {t('auditControl.hcmEvidence.selectEvidence.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {t('auditControl.hcmEvidence.selectEvidence.description')}
              </Typography>
            </Stack>
          ) : detailQuery.isPending || !detailQuery.data ? (
            <ManagementPanelLoading label={t('auditControl.hcmEvidence.detailLoading')} />
          ) : (
            <EvidenceDetail evidence={detailQuery.data} onClose={() => onFocus()} />
          )}
        </Box>
      </Box>
    </>
  );
}

export function HcmAuditEvidenceOverview() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  const focus = resolveHcmAuditFocus(searchParams);
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [cacheReady, setCacheReady] = useState(false);
  const [boundaryFailure, setBoundaryFailure] = useState<EvidenceBoundaryFailure | null>(null);
  const hcmFetchCount = useIsFetching({ queryKey: HCM_AUDIT_QUERY_KEY });

  useLayoutEffect(() => {
    purgeQueryFamily(queryClient, GENERIC_AUDIT_QUERY_KEY);
    purgeQueryFamily(queryClient, HCM_AUDIT_QUERY_KEY);
    setCacheReady(true);
    return () => purgeQueryFamily(queryClient, HCM_AUDIT_QUERY_KEY);
  }, [queryClient]);

  useEffect(() => {
    const current = new URLSearchParams(search);
    const tabs = current.getAll('tab');
    if (tabs.length === 1 && tabs[0] === 'overview') return;
    current.delete('tab');
    current.append('tab', 'overview');
    setSearchParams(current, { replace: true });
  }, [search, setSearchParams]);

  const setFocus = useCallback(
    (eventId?: string) => {
      const next = new URLSearchParams(search);
      next.delete('focus');
      if (eventId) next.append('focus', eventId);
      setSearchParams(next, { replace: true });
    },
    [search, setSearchParams]
  );

  const handleBoundaryFailure = useCallback(
    (failure: EvidenceBoundaryFailure) => {
      setBoundaryFailure(failure);
      purgeQueryFamily(queryClient, HCM_AUDIT_QUERY_KEY);
    },
    [queryClient]
  );

  const retryFromCleanCache = useCallback(() => {
    purgeQueryFamily(queryClient, HCM_AUDIT_QUERY_KEY);
    setBoundaryFailure(null);
  }, [queryClient]);

  const applyFilters = () => {
    setFocus();
    if (boundaryFailure) retryFromCleanCache();
    setFilters(draftFilters);
  };
  const resetFilters = () => {
    setFocus();
    if (boundaryFailure) retryFromCleanCache();
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <Box
      data-testid="hcm-audit-evidence-overview"
      sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <ContextHeader
        actions={
          <Button
            type="button"
            onClick={() => {
              if (boundaryFailure) retryFromCleanCache();
              else
                void queryClient.refetchQueries({
                  queryKey: HCM_AUDIT_QUERY_KEY,
                  type: 'active',
                });
            }}
            startIcon={<RefreshCw size={17} />}
            disabled={!cacheReady || hcmFetchCount > 0}
          >
            {t('auditControl.hcmEvidence.refresh')}
          </Button>
        }
      />
      <FilterPanel
        value={draftFilters}
        onChange={setDraftFilters}
        onApply={applyFilters}
        onReset={resetFilters}
      />
      {!cacheReady ? (
        <ManagementPanelLoading label={t('auditControl.hcmEvidence.loading')} />
      ) : boundaryFailure ? (
        <ManagementPanelError
          message={t(errorKey(boundaryFailure.error, boundaryFailure.detail))}
          retryLabel={t('auditControl.hcmEvidence.retry')}
          onRetry={retryFromCleanCache}
        />
      ) : (
        <HcmAuditEvidenceQueryBoundary
          filters={filters}
          focus={focus}
          onFocus={setFocus}
          onFailure={handleBoundaryFailure}
        />
      )}
    </Box>
  );
}
