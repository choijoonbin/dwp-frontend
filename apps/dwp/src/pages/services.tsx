import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileClock,
  LifeBuoy,
  PencilLine,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  cancelServiceRequest,
  createServiceRequest,
  dwaionHandoffText,
  getServiceDiscoverCatalog,
  getServiceDraftRequest,
  getServiceDraftRequests,
  getServiceMyRequest,
  getServiceMyRequests,
  parseDwaionHandoff,
  submitServiceDraft,
  updateServiceDraft,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormField,
  FormDialog,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type {
  ServiceCatalogItem,
  ServiceRequestDetail,
  ServiceRequestField,
  ServiceRequestStatus,
  ServiceRequestSummary,
} from '@dwp-frontend/shared-utils';

import { ServiceCatalogCard } from '../features/services/service-catalog-card';
import { useProductActionMutation } from '../components/use-product-action-mutation';

const statusColors: Record<
  ServiceRequestStatus,
  'default' | 'primary' | 'info' | 'warning' | 'success' | 'error'
> = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  TRIAGED: 'primary',
  IN_PROGRESS: 'primary',
  AWAITING_REQUESTER: 'warning',
  RESOLVED: 'success',
  CLOSED: 'success',
  CANCELLED: 'error',
};

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function fieldLabel(field: ServiceRequestField, language: string) {
  return language.startsWith('en') ? field.labelEn : field.labelKo;
}

function optionLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function requestServiceName(request: ServiceRequestSummary, language: string) {
  return language.startsWith('en') ? request.serviceNameEn : request.serviceNameKo;
}

function StatusChip({ status }: { status: ServiceRequestStatus }) {
  const { t } = useTranslation('services');
  return (
    <Chip
      size="small"
      variant={status === 'IN_PROGRESS' ? 'filled' : 'outlined'}
      color={statusColors[status]}
      label={t(`requests.statusLabels.${status}`)}
      sx={{ height: 24, fontWeight: 700 }}
    />
  );
}

function RequestDialog({
  service,
  draft,
  initialSummary = '',
  fromDwaion = false,
  onClose,
}: {
  service: ServiceCatalogItem | null;
  draft?: ServiceRequestDetail | null;
  initialSummary?: string;
  fromDwaion?: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('services');
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createRequest = useProductActionMutation('route.services.work.request-create.action');
  const updateDraft = useProductActionMutation('route.services.work.draft-update.action');
  const [summary, setSummary] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [validationVisible, setValidationVisible] = useState(false);
  const fields = service?.requestSchema.fields ?? draft?.requestSchema.fields ?? [];
  const open = Boolean(service || draft);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const targetName = service?.name ?? (draft ? requestServiceName(draft.request, language) : '');
  const classification = service?.dataClassification ?? draft?.dataClassification;

  useEffect(() => {
    if (draft) {
      setSummary(draft.request.summary);
      setValues(draft.values);
      setValidationVisible(false);
    } else if (service) {
      setSummary(initialSummary);
      setValues({});
      setValidationVisible(false);
    }
  }, [draft, initialSummary, service]);
  const valid = Boolean(
    summary.trim() &&
      fields.every((field) => {
        if (!field.required) return true;
        const value = values[field.key];
        return value !== undefined && value !== null && value !== '' && value !== false;
      })
  );
  const mutation = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }) => {
      if (draft) {
        const updated = await updateDraft((authority) =>
          updateServiceDraft(
            draft.request.requestId,
            {
              summary: summary.trim(),
              values,
              version: draft.request.version,
              submit,
            },
            authority
          )
        );
        return updated;
      }
      if (!service) throw new Error('Service unavailable');
      return createRequest((authority) =>
        createServiceRequest(
          {
            serviceKey: service.serviceKey,
            summary: summary.trim(),
            values,
            idempotencyKey: crypto.randomUUID(),
            submit,
          },
          authority
        )
      );
    },
    onSuccess: async (detail, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services', 'requests'] }),
        queryClient.invalidateQueries({
          queryKey: ['services', 'request', detail.request.requestId],
        }),
      ]);
      toast.success(
        t(
          input.submit
            ? draft
              ? 'requestDialog.updatedAndSubmitted'
              : 'requestDialog.created'
            : draft
              ? 'requestDialog.updated'
              : 'requestDialog.drafted',
          {
            number: detail.request.requestNumber,
          }
        )
      );
      onClose();
      navigate(`/services/${input.submit ? 'my' : 'drafts'}/${detail.request.requestId}`);
    },
    onError: (error) => toast.error(errorText(error, t('requestDialog.error'))),
  });

  const submit = (shouldSubmit: boolean) => {
    if (!summary.trim() || (shouldSubmit && !valid)) {
      setValidationVisible(true);
      return;
    }
    mutation.mutate({ submit: shouldSubmit });
  };

  const close = () => {
    setSummary('');
    setValues({});
    setValidationVisible(false);
    onClose();
  };

  const renderField = (field: ServiceRequestField) => {
    const label = fieldLabel(field, i18n.resolvedLanguage ?? i18n.language);
    const value = values[field.key];
    const update = (next: unknown) => setValues((current) => ({ ...current, [field.key]: next }));
    if (field.type === 'CHECKBOX') {
      return (
        <FormControlLabel
          key={field.key}
          control={
            <Checkbox checked={Boolean(value)} onChange={(event) => update(event.target.checked)} />
          }
          label={label}
          sx={{ minHeight: 48, alignItems: 'center' }}
        />
      );
    }
    if (field.type === 'SELECT') {
      return (
        <FormField
          key={field.key}
          select
          required={field.required}
          label={label}
          value={String(value ?? '')}
          errorMessage={
            validationVisible && field.required && !value ? t('requestDialog.required') : undefined
          }
          onChange={(event) => update(event.target.value)}
        >
          <MenuItem value="" disabled>
            {t('requestDialog.selectPlaceholder')}
          </MenuItem>
          {(field.options ?? []).map((option) => (
            <MenuItem key={option} value={option}>
              {optionLabel(option)}
            </MenuItem>
          ))}
        </FormField>
      );
    }
    return (
      <FormField
        key={field.key}
        required={field.required}
        label={label}
        type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
        multiline={field.type === 'TEXTAREA'}
        minRows={field.type === 'TEXTAREA' ? 3 : undefined}
        value={String(value ?? '')}
        slotProps={field.type === 'DATE' ? { inputLabel: { shrink: true } } : undefined}
        errorMessage={
          validationVisible && field.required && !value ? t('requestDialog.required') : undefined
        }
        onChange={(event) => {
          const next = event.target.value;
          update(field.type === 'NUMBER' && next !== '' ? Number(next) : next);
        }}
      />
    );
  };

  return (
    <FormDialog
      open={open}
      title={t(draft ? 'requestDialog.editTitle' : 'requestDialog.title', {
        service: targetName,
      })}
      description={t(draft ? 'requestDialog.editDescription' : 'requestDialog.description')}
      cancelLabel={t('requestDialog.cancel')}
      submitLabel={t('requestDialog.submit')}
      onClose={close}
      onSubmit={() => submit(true)}
      busy={mutation.isPending}
      maxWidth="sm"
      secondaryActions={
        <ActionButton
          intent="secondary"
          startIcon={<FileClock size={17} />}
          onClick={() => submit(false)}
          disabled={mutation.isPending}
        >
          {t('requestDialog.saveDraft')}
        </ActionButton>
      }
    >
      {open && classification && (
        <Stack gap={2.25}>
          {fromDwaion && <Alert severity="info">{t('requestDialog.dwaionDraftNotice')}</Alert>}
          <Alert severity="info" icon={<ShieldCheck size={18} />}>
            {t('requestDialog.privacy', {
              classification: t(`classification.${classification}`),
            })}
          </Alert>
          <FormField
            autoFocus
            required
            label={t('requestDialog.summary')}
            placeholder={t('requestDialog.summaryPlaceholder')}
            value={summary}
            errorMessage={
              validationVisible && !summary.trim() ? t('requestDialog.required') : undefined
            }
            supportingText={`${summary.length}/240`}
            onChange={(event) => setSummary(event.target.value.slice(0, 240))}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
              '& > .MuiFormControl-root:has(textarea)': { gridColumn: { sm: '1 / -1' } },
            }}
          >
            {fields.map(renderField)}
          </Box>
          {validationVisible && !valid && (
            <Alert severity="warning">{t('requestDialog.invalid')}</Alert>
          )}
        </Stack>
      )}
    </FormDialog>
  );
}

function DiscoverView() {
  const { t } = useTranslation('services');
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [categoryKey, setCategoryKey] = useState(searchParams.get('category') ?? 'ALL');
  const [requesting, setRequesting] = useState<ServiceCatalogItem | null>(null);
  const [dwaionSummary, setDwaionSummary] = useState('');
  const [dwaionCategory, setDwaionCategory] = useState('');
  const [dwaionDraft, setDwaionDraft] = useState(false);
  const dwaionHandoff = useMemo(
    () => parseDwaionHandoff(location.state, 'SERVICE.REQUEST.CREATE'),
    [location.state]
  );
  const catalog = useQuery({
    queryKey: ['services', 'catalog', 'view', 'discover'],
    queryFn: ({ signal }) => getServiceDiscoverCatalog(signal),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const categoryMap = useMemo(
    () =>
      new Map((catalog.data?.categories ?? []).map((category) => [category.categoryKey, category])),
    [catalog.data?.categories]
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return (catalog.data?.items ?? []).filter((item) => {
      const categoryMatches = categoryKey === 'ALL' || item.categoryKey === categoryKey;
      const queryMatches =
        !normalized ||
        `${item.name} ${item.description} ${item.ownerGroup} ${item.tags.join(' ')}`
          .toLocaleLowerCase()
          .includes(normalized);
      return categoryMatches && queryMatches;
    });
  }, [catalog.data?.items, categoryKey, query]);
  const featured = (catalog.data?.items ?? []).filter((item) => item.featured).slice(0, 4);

  useEffect(() => {
    if (!dwaionHandoff) return;
    setDwaionSummary(dwaionHandoffText(dwaionHandoff, 'requestSummary') ?? '');
    setDwaionCategory(dwaionHandoffText(dwaionHandoff, 'serviceCategory') ?? '');
    setDwaionDraft(true);
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null }
    );
  }, [dwaionHandoff, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (
      dwaionCategory &&
      catalog.data?.categories.some((category) => category.categoryKey === dwaionCategory)
    ) {
      setCategoryKey(dwaionCategory);
    }
  }, [catalog.data?.categories, dwaionCategory]);

  useEffect(() => {
    const requestedService = searchParams.get('service');
    if (!requestedService || !catalog.data) return;
    const match = catalog.data.items.find((item) => item.serviceKey === requestedService);
    if (!match) return;
    setCategoryKey(match.categoryKey);
    setRequesting(match);
    const next = new URLSearchParams(searchParams);
    next.delete('service');
    setSearchParams(next, { replace: true });
  }, [catalog.data, searchParams, setSearchParams]);

  return (
    <>
      <Box
        component="section"
        sx={{
          position: 'relative',
          minHeight: { xs: 330, md: 360 },
          px: { xs: 2.5, sm: 4, xl: 6 },
          py: { xs: 5, md: 7 },
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          color: 'common.white',
          bgcolor: '#0C2348',
          backgroundImage:
            'linear-gradient(90deg, rgba(5, 18, 40, 0.92) 0%, rgba(5, 18, 40, 0.72) 52%, rgba(5, 18, 40, 0.22) 100%), url(/media/services/service-center-hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Box sx={{ width: 1, maxWidth: 760, position: 'relative' }}>
          <Typography component="p" variant="overline" sx={{ color: '#88D9CD' }}>
            {t('discover.eyebrow')}
          </Typography>
          <Typography component="h1" variant="h2" sx={{ mt: 0.75, maxWidth: 680 }}>
            {t('discover.title')}
          </Typography>
          <Typography
            variant="body1"
            sx={{ mt: 1.5, maxWidth: 620, color: 'rgba(255,255,255,.78)' }}
          >
            {t('discover.description')}
          </Typography>
          <FormField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('discover.searchPlaceholder')}
            aria-label={t('discover.searchLabel')}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={19} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              mt: 3,
              maxWidth: 620,
              '& .MuiOutlinedInput-root': {
                minHeight: 52,
                bgcolor: 'rgba(255,255,255,.96)',
                color: 'text.primary',
                boxShadow: '0 18px 40px rgba(0,0,0,.18)',
              },
            }}
          />
        </Box>
      </Box>
      <PageCanvas>
        <Box sx={{ pt: { xs: 3, md: 4 }, pb: 8 }}>
          {dwaionDraft && dwaionSummary && (
            <Alert
              severity="info"
              icon={<ShieldCheck size={19} />}
              action={
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={() => {
                    setDwaionSummary('');
                    setDwaionCategory('');
                    setDwaionDraft(false);
                  }}
                >
                  {t('discover.dwaionDraftDismiss')}
                </ActionButton>
              }
              sx={{ mb: 3, alignItems: 'flex-start' }}
            >
              <Typography variant="subtitle2" fontWeight={800}>
                {t('discover.dwaionDraftTitle')}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.25 }}>
                {t('discover.dwaionDraftDescription')}
              </Typography>
              <Typography
                component="blockquote"
                variant="body2"
                fontWeight={650}
                sx={{ m: 0, mt: 1, overflowWrap: 'anywhere' }}
              >
                {dwaionSummary}
              </Typography>
            </Alert>
          )}
          {catalog.isLoading ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              {[0, 1, 2].map((value) => (
                <Skeleton key={value} variant="rounded" height={228} />
              ))}
            </Box>
          ) : catalog.isError ? (
            <Alert severity="error">{errorText(catalog.error, t('discover.loadError'))}</Alert>
          ) : (
            <Stack gap={4}>
              {!query.trim() && categoryKey === 'ALL' && featured.length > 0 && (
                <Box component="section" aria-labelledby="featured-services-title">
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                    <Typography id="featured-services-title" component="h2" variant="h5">
                      {t('discover.featured')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('discover.serviceCount', { count: featured.length })}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      mt: 2,
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, 1fr)',
                        xl: 'repeat(4, 1fr)',
                      },
                      gap: 2,
                    }}
                  >
                    {featured.map((item) => (
                      <ServiceCatalogCard
                        key={item.serviceKey}
                        item={item}
                        category={categoryMap.get(item.categoryKey)}
                        onRequest={setRequesting}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              <Box component="section" aria-labelledby="all-services-title">
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ md: 'center' }}
                  justifyContent="space-between"
                  gap={2}
                >
                  <Box>
                    <Typography id="all-services-title" component="h2" variant="h5">
                      {t('discover.allServices')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {t('discover.serviceCount', { count: filtered.length })}
                    </Typography>
                  </Box>
                  <ToggleButtonGroup
                    exclusive
                    value={categoryKey}
                    onChange={(_event, value) => value && setCategoryKey(value)}
                    size="small"
                    aria-label={t('discover.allServices')}
                    sx={{ maxWidth: 1, overflowX: 'auto', justifyContent: 'flex-start' }}
                  >
                    <ToggleButton value="ALL">{t('discover.allCategories')}</ToggleButton>
                    {(catalog.data?.categories ?? []).map((category) => (
                      <ToggleButton key={category.categoryKey} value={category.categoryKey}>
                        {category.name}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Stack>
                {filtered.length ? (
                  <Box
                    sx={{
                      mt: 2,
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, 1fr)',
                        xl: 'repeat(3, 1fr)',
                      },
                      gap: 2,
                    }}
                  >
                    {filtered.map((item) => (
                      <ServiceCatalogCard
                        key={item.serviceKey}
                        item={item}
                        category={categoryMap.get(item.categoryKey)}
                        onRequest={setRequesting}
                      />
                    ))}
                  </Box>
                ) : (
                  <GuidedEmptyState
                    kind="no-results"
                    title={t('discover.noResultsTitle')}
                    description={t('discover.noResultsDescription')}
                    actionLabel={t('discover.clearSearch')}
                    onAction={() => {
                      setQuery('');
                      setCategoryKey('ALL');
                    }}
                  />
                )}
              </Box>
            </Stack>
          )}
        </Box>
      </PageCanvas>
      <RequestDialog
        service={requesting}
        initialSummary={dwaionSummary}
        fromDwaion={dwaionDraft}
        onClose={() => {
          setRequesting(null);
          setDwaionSummary('');
          setDwaionCategory('');
          setDwaionDraft(false);
        }}
      />
    </>
  );
}

function RequestsView({ drafts }: { drafts: boolean }) {
  const { t, i18n } = useTranslation('services');
  const navigate = useNavigate();
  const requests = useQuery({
    queryKey: ['services', 'requests', 'view', drafts ? 'drafts' : 'my'],
    queryFn: ({ signal }) =>
      drafts ? getServiceDraftRequests(signal) : getServiceMyRequests(signal),
    staleTime: 30_000,
    retry: 1,
  });
  const rows = (requests.data ?? []).filter((request) =>
    drafts ? request.status === 'DRAFT' : !['DRAFT', 'CLOSED', 'CANCELLED'].includes(request.status)
  );
  return (
    <PageCanvas>
      <Box sx={{ py: { xs: 3, md: 4 } }}>
        <Box component="header" sx={{ mb: 3 }}>
          <Typography component="p" variant="overline" color="primary.main">
            {t('requests.eyebrow')}
          </Typography>
          <Typography component="h1" variant="h3" sx={{ mt: 0.25 }}>
            {t(drafts ? 'requests.draftTitle' : 'requests.activeTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t(drafts ? 'requests.draftDescription' : 'requests.activeDescription')}
          </Typography>
        </Box>
        {requests.isError ? (
          <Alert severity="error">{errorText(requests.error, t('requests.loadError'))}</Alert>
        ) : requests.isLoading ? (
          <Skeleton variant="rounded" height={260} />
        ) : rows.length === 0 ? (
          <GuidedEmptyState
            kind="empty"
            title={t(drafts ? 'requests.emptyDraftTitle' : 'requests.emptyActiveTitle')}
            description={t(
              drafts ? 'requests.emptyDraftDescription' : 'requests.emptyActiveDescription'
            )}
            actionLabel={t('requests.discover')}
            onAction={() => navigate('/services/discover')}
          />
        ) : (
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              overflowX: 'auto',
              bgcolor: 'background.paper',
            }}
          >
            <Table sx={{ minWidth: 860 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('requests.requestNumber')}</TableCell>
                  <TableCell>{t('requests.service')}</TableCell>
                  <TableCell>{t('requests.summary')}</TableCell>
                  <TableCell>{t('requests.status')}</TableCell>
                  <TableCell>{t('requests.owner')}</TableCell>
                  <TableCell>{t('requests.updated')}</TableCell>
                  <TableCell padding="checkbox" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((request) => (
                  <TableRow
                    key={request.requestId}
                    hover
                    tabIndex={0}
                    onClick={() =>
                      navigate(`/services/${drafts ? 'drafts' : 'my'}/${request.requestId}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter')
                        navigate(`/services/${drafts ? 'drafts' : 'my'}/${request.requestId}`);
                    }}
                    sx={{ cursor: 'pointer', '& > td': { height: 68 } }}
                  >
                    <TableCell sx={{ fontWeight: 750 }}>{request.requestNumber}</TableCell>
                    <TableCell>
                      {requestServiceName(request, i18n.resolvedLanguage ?? i18n.language)}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography variant="body2" noWrap>
                        {request.summary}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={request.status} />
                    </TableCell>
                    <TableCell>{request.assignedGroup}</TableCell>
                    <TableCell>
                      {formatDate(request.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell padding="checkbox">
                      <ActionIconButton label={t('requests.view')}>
                        <ArrowRight size={17} />
                      </ActionIconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Box>
    </PageCanvas>
  );
}

function RequestDetailView({ requestId, draft }: { requestId: string; draft: boolean }) {
  const { t, i18n } = useTranslation('services');
  const display = useDisplayDictionary();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const submitDraft = useProductActionMutation('route.services.work.draft-submit.action');
  const cancelRequest = useProductActionMutation('route.services.work.request-cancel.action');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  const detail = useQuery({
    queryKey: ['services', 'request', requestId, 'view', draft ? 'draft' : 'absent'],
    queryFn: ({ signal }) =>
      draft ? getServiceDraftRequest(requestId, signal) : getServiceMyRequest(requestId, signal),
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: ({
      operation,
      data,
    }: {
      operation: 'submit' | 'cancel';
      data: ServiceRequestDetail;
    }) =>
      operation === 'submit'
        ? submitDraft((authority) =>
            submitServiceDraft(data.request.requestId, data.request.version, authority)
          )
        : cancelRequest((authority) =>
            cancelServiceRequest(data.request.requestId, data.request.version, authority)
          ),
    onSuccess: async (data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['services', 'request', requestId] }),
      ]);
      toast.success(
        t(input.operation === 'submit' ? 'detail.submittedSuccess' : 'detail.cancelledSuccess')
      );
      setConfirmCancel(false);
      navigate(
        `/services/${input.operation === 'submit' ? 'my' : 'drafts'}/${data.request.requestId}`
      );
    },
    onError: (error) => toast.error(errorText(error, t('detail.actionError'))),
  });
  const data = detail.data;
  const fieldByKey = new Map((data?.requestSchema.fields ?? []).map((field) => [field.key, field]));
  const backPath = data?.request.status === 'DRAFT' ? '/services/drafts' : '/services/my';
  const cancellable = data && ['DRAFT', 'SUBMITTED', 'TRIAGED'].includes(data.request.status);

  return (
    <PageCanvas>
      <Box sx={{ py: { xs: 3, md: 4 } }}>
        <ActionButton
          component={Link}
          to={backPath}
          intent="quiet"
          startIcon={<ArrowLeft size={17} />}
          sx={{ mb: 2 }}
        >
          {t('detail.back')}
        </ActionButton>
        {detail.isError ? (
          <Alert severity="error">{errorText(detail.error, t('detail.loadError'))}</Alert>
        ) : !data ? (
          <Skeleton variant="rounded" height={420} />
        ) : (
          <Stack gap={3}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
              <Box>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <Typography variant="overline" color="primary.main">
                    {data.request.requestNumber}
                  </Typography>
                  <StatusChip status={data.request.status} />
                </Stack>
                <Typography component="h1" variant="h3" sx={{ mt: 0.5 }}>
                  {requestServiceName(data.request, i18n.resolvedLanguage ?? i18n.language)}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
                  {data.request.summary}
                </Typography>
              </Box>
              <Stack direction="row" gap={1} alignItems="flex-start">
                {data.request.status === 'DRAFT' && (
                  <>
                    <ActionButton
                      intent="primary"
                      startIcon={<PencilLine size={17} />}
                      onClick={() => setEditing(true)}
                      disabled={mutation.isPending}
                    >
                      {t('detail.editDraft')}
                    </ActionButton>
                    <ActionButton
                      intent="secondary"
                      onClick={() => mutation.mutate({ operation: 'submit', data })}
                      disabled={mutation.isPending}
                    >
                      {t('detail.submitDraft')}
                    </ActionButton>
                  </>
                )}
                {cancellable && (
                  <ActionButton
                    intent="secondary"
                    onClick={() => setConfirmCancel(true)}
                    disabled={mutation.isPending}
                  >
                    {t('detail.cancelRequest')}
                  </ActionButton>
                )}
              </Stack>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(320px, .65fr)' },
                gap: 3,
              }}
            >
              <Stack gap={3}>
                <Box
                  component="section"
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography
                    component="h2"
                    variant="subtitle1"
                    fontWeight={800}
                    sx={{ px: 2.5, py: 2 }}
                  >
                    {t('detail.overview')}
                  </Typography>
                  <Divider />
                  <Box
                    sx={{
                      p: 2.5,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      gap: 2.5,
                    }}
                  >
                    {[
                      [t('detail.assignedGroup'), data.request.assignedGroup, UsersRound],
                      [
                        t('detail.assignedTo'),
                        data.request.assignedTo || t('detail.unassigned'),
                        LifeBuoy,
                      ],
                      [
                        t('detail.updated'),
                        formatDate(data.request.updatedAt, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                        Clock3,
                      ],
                      [
                        t('detail.slaDue'),
                        data.request.slaDueAt
                          ? formatDate(data.request.slaDueAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '—',
                        CalendarDays,
                      ],
                    ].map(([label, value, Icon]) => (
                      <Stack key={String(label)} direction="row" gap={1.25} alignItems="flex-start">
                        <Box sx={{ mt: 0.25, color: 'text.secondary' }}>
                          <Icon size={18} />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {label as string}
                          </Typography>
                          <Typography variant="body2" fontWeight={650}>
                            {value as string}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Box>
                </Box>
                <Box
                  component="section"
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography
                    component="h2"
                    variant="subtitle1"
                    fontWeight={800}
                    sx={{ px: 2.5, py: 2 }}
                  >
                    {t('detail.requestData')}
                  </Typography>
                  <Divider />
                  <Box
                    component="dl"
                    sx={{
                      m: 0,
                      p: 2.5,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      gap: 2.5,
                    }}
                  >
                    {Object.entries(data.values).map(([key, value]) => {
                      const field = fieldByKey.get(key);
                      return (
                        <Box key={key}>
                          <Typography component="dt" variant="caption" color="text.secondary">
                            {field
                              ? fieldLabel(field, i18n.resolvedLanguage ?? i18n.language)
                              : key}
                          </Typography>
                          <Typography
                            component="dd"
                            variant="body2"
                            sx={{ m: 0, mt: 0.5, whiteSpace: 'pre-wrap' }}
                          >
                            {typeof value === 'boolean'
                              ? t(value ? 'requestDialog.booleanYes' : 'requestDialog.booleanNo')
                              : String(value)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Stack>
              <Box
                component="section"
                sx={{ borderLeft: { lg: 1 }, borderColor: 'divider', pl: { lg: 3 } }}
              >
                <Typography component="h2" variant="subtitle1" fontWeight={800}>
                  {t('detail.timeline')}
                </Typography>
                <Stack component="ol" gap={0} sx={{ mt: 2, p: 0, m: 0, listStyle: 'none' }}>
                  {data.timeline.map((event, index) => (
                    <Box
                      component="li"
                      key={event.eventId}
                      sx={{
                        position: 'relative',
                        display: 'grid',
                        gridTemplateColumns: '24px minmax(0, 1fr)',
                        gap: 1.5,
                        pb: 3,
                      }}
                    >
                      {index < data.timeline.length - 1 && (
                        <Box
                          aria-hidden="true"
                          sx={{
                            position: 'absolute',
                            top: 20,
                            bottom: 0,
                            left: 11,
                            width: 1,
                            bgcolor: 'divider',
                          }}
                        />
                      )}
                      <Box
                        aria-hidden="true"
                        sx={{
                          zIndex: 1,
                          width: 24,
                          height: 24,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '50%',
                          color: index === 0 ? 'success.main' : 'text.secondary',
                          bgcolor: 'background.paper',
                          border: 1,
                          borderColor: index === 0 ? 'success.main' : 'divider',
                        }}
                      >
                        {index === 0 ? <CheckCircle2 size={14} /> : <Clock3 size={13} />}
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={750}>
                          {display('auditActions', event.eventType)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(event.occurredAt, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Typography>
                        {event.note && (
                          <Typography variant="body2" sx={{ mt: 0.75 }}>
                            {event.note}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Stack>
        )}
        <ConfirmDialog
          open={confirmCancel}
          title={t('detail.confirmCancel')}
          description={t('detail.confirmCancelDescription')}
          cancelLabel={t('detail.cancel')}
          confirmLabel={t('detail.confirm')}
          onClose={() => setConfirmCancel(false)}
          onConfirm={() => data && mutation.mutate({ operation: 'cancel', data })}
          busy={mutation.isPending}
          intent="danger"
        />
        <RequestDialog
          service={null}
          draft={editing && data?.request.status === 'DRAFT' ? data : null}
          onClose={() => setEditing(false)}
        />
      </Box>
    </PageCanvas>
  );
}

export default function ServicesPage() {
  const { view = 'discover', requestId } = useParams();
  if (requestId) return <RequestDetailView requestId={requestId} draft={view === 'drafts'} />;
  if (view === 'my') return <RequestsView drafts={false} />;
  if (view === 'drafts') return <RequestsView drafts />;
  return <DiscoverView />;
}
