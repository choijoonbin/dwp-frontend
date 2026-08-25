import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock3, Search, ShieldAlert, UserRoundCog } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getServiceOperationsQueue,
  getServiceOperationsRequest,
  transitionServiceRequest,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  FormField,
  GuidedEmptyState,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import type { ServiceRequestStatus, ServiceRequestSummary } from '@dwp-frontend/shared-utils';
import { useProductSurfaceCapabilityAccess } from '../../components/product-surface-capability-access';
import { useProductActionMutation } from '../../components/use-product-action-mutation';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

const statuses: ServiceRequestStatus[] = [
  'SUBMITTED',
  'TRIAGED',
  'IN_PROGRESS',
  'AWAITING_REQUESTER',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

const transitions: Partial<Record<ServiceRequestStatus, ServiceRequestStatus[]>> = {
  SUBMITTED: ['TRIAGED', 'IN_PROGRESS', 'CANCELLED'],
  TRIAGED: ['IN_PROGRESS', 'AWAITING_REQUESTER', 'CANCELLED'],
  IN_PROGRESS: ['AWAITING_REQUESTER', 'RESOLVED', 'CANCELLED'],
  AWAITING_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
};

function slaState(request: ServiceRequestSummary) {
  if (!request.slaDueAt || ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(request.status))
    return 'healthy';
  const remaining = Date.parse(request.slaDueAt) - Date.now();
  if (remaining <= 0) return 'breached';
  if (remaining <= 4 * 60 * 60 * 1000) return 'atRisk';
  return 'healthy';
}

function statusColor(status: ServiceRequestStatus) {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'success' as const;
  if (status === 'CANCELLED') return 'error' as const;
  if (status === 'AWAITING_REQUESTER') return 'warning' as const;
  if (status === 'IN_PROGRESS' || status === 'TRIAGED') return 'primary' as const;
  return 'info' as const;
}

export function ServiceOperationsManager() {
  const { t, i18n } = useTranslation(['admin', 'services']);
  const display = useDisplayDictionary();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const capabilityAccess = useProductSurfaceCapabilityAccess();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'services',
    surfaceKey: 'services.management',
  });
  const transitionRequest = useProductActionMutation(
    'route.services.management.request-transition.action'
  );
  const canManage = capabilityAccess.governed
    ? capabilityAccess.hasWritableCapability('services.operations.update')
    : hasPermission('ADMIN.SERVICE_OPERATIONS', 'MANAGE');
  const [status, setStatus] = useState<'ALL' | ServiceRequestStatus>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<ServiceRequestStatus | ''>('');
  const [assignedTo, setAssignedTo] = useState('');
  const [note, setNote] = useState('');
  const queue = useQuery({
    queryKey: ['admin', 'services', 'requests', status, ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getServiceOperationsQueue(
        status === 'ALL' ? undefined : status,
        requestScope.contextScopeKey,
        signal
      ),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
    retry: 1,
  });
  const detail = useQuery({
    queryKey: ['admin', 'services', 'request', selectedId, ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getServiceOperationsRequest(selectedId as string, requestScope.contextScopeKey, signal),
    enabled: Boolean(selectedId) && requestScope.ready,
    meta: requestScope.queryMeta,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: () => {
      if (!detail.data || !targetStatus) throw new Error('Select a transition');
      return transitionRequest((authority) =>
        transitionServiceRequest(
          detail.data.request.requestId,
          {
            targetStatus,
            assignedTo: assignedTo.trim() || null,
            note: note.trim() || null,
            version: detail.data.request.version,
          },
          authority
        )
      );
    },
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'services', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'services', 'request', selectedId] }),
      ]);
      toast.success(
        t('admin:serviceCenter.operations.transitioned', { number: updated.request.requestNumber })
      );
      setTargetStatus('');
      setNote('');
    },
    onError: () => toast.error(t('admin:serviceCenter.operations.transitionError')),
  });
  const rows = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return (queue.data ?? []).filter(
      (request) =>
        !normalized ||
        `${request.requestNumber} ${request.serviceNameKo} ${request.serviceNameEn} ${request.summary} ${request.assignedGroup}`
          .toLocaleLowerCase()
          .includes(normalized)
    );
  }, [queue.data, search]);
  const allRows = queue.data ?? [];
  const open = allRows.filter(
    (request) => !['RESOLVED', 'CLOSED', 'CANCELLED', 'DRAFT'].includes(request.status)
  ).length;
  const atRisk = allRows.filter((request) => slaState(request) === 'atRisk').length;
  const breached = allRows.filter((request) => slaState(request) === 'breached').length;
  const waiting = allRows.filter((request) => request.status === 'AWAITING_REQUESTER').length;
  const selected = detail.data;
  const nextStatuses = selected ? (transitions[selected.request.status] ?? []) : [];

  return (
    <Stack gap={2.5}>
      <OperationalKpiStrip
        ariaLabel={t('admin:navigation.items.service-operations.title')}
        items={[
          {
            key: 'open',
            label: t('admin:serviceCenter.operations.open'),
            value: open,
            tone: open ? 'info' : 'neutral',
          },
          {
            key: 'waiting',
            label: t('admin:serviceCenter.operations.waiting'),
            value: waiting,
            tone: waiting ? 'warning' : 'neutral',
          },
          {
            key: 'risk',
            label: t('admin:serviceCenter.operations.atRisk'),
            value: atRisk,
            tone: atRisk ? 'warning' : 'neutral',
          },
          {
            key: 'breached',
            label: t('admin:serviceCenter.operations.breached'),
            value: breached,
            tone: breached ? 'critical' : 'neutral',
          },
        ]}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(280px, 440px) minmax(210px, 240px)' },
          gap: 1.25,
          alignItems: 'start',
        }}
      >
        <FormField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('admin:serviceCenter.operations.search')}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} />
                </InputAdornment>
              ),
            },
          }}
        />
        <FormField
          select
          label={t('admin:serviceCenter.operations.filter')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as typeof status);
            setSelectedId(null);
          }}
        >
          <MenuItem value="ALL">{t('admin:serviceCenter.operations.all')}</MenuItem>
          {statuses.map((value) => (
            <MenuItem key={value} value={value}>
              {t(`admin:serviceCenter.requestStatus.${value}`)}
            </MenuItem>
          ))}
        </FormField>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            xl: selectedId ? 'minmax(0, 1.25fr) minmax(380px, .75fr)' : '1fr',
          },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Box>
          {queue.isLoading ? (
            <Skeleton variant="rounded" height={340} />
          ) : queue.isError ? (
            <Alert severity="error">{t('admin:serviceCenter.operations.loadError')}</Alert>
          ) : rows.length === 0 ? (
            <GuidedEmptyState
              kind="no-results"
              title={t('admin:serviceCenter.operations.emptyTitle')}
              description={t('admin:serviceCenter.operations.emptyDescription')}
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
              <Table aria-label={t('admin:serviceCenter.operations.queue')} sx={{ minWidth: 920 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('admin:serviceCenter.operations.request')}</TableCell>
                    <TableCell>{t('admin:serviceCenter.operations.service')}</TableCell>
                    <TableCell>{t('admin:serviceCenter.operations.summary')}</TableCell>
                    <TableCell>{t('admin:serviceCenter.operations.status')}</TableCell>
                    <TableCell>{t('admin:serviceCenter.operations.owner')}</TableCell>
                    <TableCell>{t('admin:serviceCenter.operations.sla')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((request) => {
                    const risk = slaState(request);
                    return (
                      <TableRow
                        key={request.requestId}
                        hover
                        selected={selectedId === request.requestId}
                        onClick={() => {
                          setSelectedId(request.requestId);
                          setTargetStatus('');
                          setAssignedTo(request.assignedTo ?? '');
                          setNote('');
                        }}
                        sx={{ cursor: 'pointer', '& > td': { height: 72 } }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={750}>
                            {request.requestNumber}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(request.updatedAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {(i18n.resolvedLanguage ?? i18n.language).startsWith('en')
                            ? request.serviceNameEn
                            : request.serviceNameKo}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 280 }}>
                          <Typography variant="body2" noWrap>
                            {request.summary}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={statusColor(request.status)}
                            variant="outlined"
                            label={t(`admin:serviceCenter.requestStatus.${request.status}`)}
                          />
                        </TableCell>
                        <TableCell>{request.assignedGroup}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={
                              risk === 'breached'
                                ? 'error'
                                : risk === 'atRisk'
                                  ? 'warning'
                                  : 'success'
                            }
                            label={
                              request.slaDueAt
                                ? formatDate(request.slaDueAt, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </Box>
        {selectedId && (
          <Box
            component="aside"
            sx={{
              position: { xl: 'sticky' },
              top: { xl: 84 },
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {detail.isLoading ? (
              <Box sx={{ p: 2.5 }}>
                <Skeleton height={320} />
              </Box>
            ) : detail.isError || !selected ? (
              <Alert severity="error" sx={{ m: 2 }}>
                {t('admin:serviceCenter.operations.detailError')}
              </Alert>
            ) : (
              <>
                <Box sx={{ p: 2.5 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    gap={1}
                  >
                    <Box>
                      <Typography variant="overline" color="primary.main">
                        {selected.request.requestNumber}
                      </Typography>
                      <Typography component="h2" variant="h6">
                        {(i18n.resolvedLanguage ?? i18n.language).startsWith('en')
                          ? selected.request.serviceNameEn
                          : selected.request.serviceNameKo}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={statusColor(selected.request.status)}
                      label={t(`admin:serviceCenter.requestStatus.${selected.request.status}`)}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {selected.request.summary}
                  </Typography>
                  <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }}>
                    <Chip size="small" variant="outlined" label={selected.request.assignedGroup} />
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<ShieldAlert size={13} />}
                      label={t(`admin:serviceCenter.classification.${selected.dataClassification}`)}
                    />
                  </Stack>
                </Box>
                <Divider />
                <Box sx={{ p: 2.5 }}>
                  <Typography component="h3" variant="subtitle2">
                    {t('admin:serviceCenter.operations.requestData')}
                  </Typography>
                  <Box
                    component="dl"
                    sx={{
                      m: 0,
                      mt: 1.5,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 1.5,
                    }}
                  >
                    {Object.entries(selected.values).map(([key, value]) => {
                      const field = selected.requestSchema.fields.find(
                        (candidate) => candidate.key === key
                      );
                      const label = field
                        ? (i18n.resolvedLanguage ?? i18n.language).startsWith('en')
                          ? field.labelEn
                          : field.labelKo
                        : key;
                      return (
                        <Box key={key}>
                          <Typography component="dt" variant="caption" color="text.secondary">
                            {label}
                          </Typography>
                          <Typography
                            component="dd"
                            variant="body2"
                            sx={{ m: 0, mt: 0.25, whiteSpace: 'pre-wrap' }}
                          >
                            {String(value)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
                <Divider />
                <Box sx={{ p: 2.5 }}>
                  <Typography component="h3" variant="subtitle2">
                    {t('admin:serviceCenter.operations.timeline')}
                  </Typography>
                  <Stack component="ol" sx={{ m: 0, mt: 1.5, p: 0, listStyle: 'none' }}>
                    {selected.timeline.slice(0, 6).map((event, index) => (
                      <Stack
                        component="li"
                        key={event.eventId}
                        direction="row"
                        gap={1.25}
                        sx={{ pb: 1.75 }}
                      >
                        <Box
                          sx={{
                            mt: 0.2,
                            width: 22,
                            height: 22,
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: '50%',
                            border: 1,
                            borderColor: index === 0 ? 'success.main' : 'divider',
                            color: index === 0 ? 'success.main' : 'text.secondary',
                          }}
                        >
                          {index === 0 ? <CheckCircle2 size={13} /> : <Clock3 size={12} />}
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {display('auditActions', event.eventType)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(event.occurredAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </Typography>
                          {event.note && (
                            <Typography variant="body2" sx={{ mt: 0.35 }}>
                              {event.note}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
                <Divider />
                <Box sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                    <UserRoundCog size={17} />
                    <Typography component="h3" variant="subtitle2">
                      {t('admin:serviceCenter.operations.nextAction')}
                    </Typography>
                  </Stack>
                  {nextStatuses.length === 0 ? (
                    <Alert severity="info">
                      {t('admin:serviceCenter.operations.noTransition')}
                    </Alert>
                  ) : (
                    <Stack gap={1.5}>
                      <FormField
                        select
                        label={t('admin:serviceCenter.operations.targetStatus')}
                        value={targetStatus}
                        onChange={(event) =>
                          setTargetStatus(event.target.value as ServiceRequestStatus)
                        }
                      >
                        <MenuItem value="" disabled>
                          {t('admin:serviceCenter.operations.targetStatus')}
                        </MenuItem>
                        {nextStatuses.map((value) => (
                          <MenuItem key={value} value={value}>
                            {t(`admin:serviceCenter.requestStatus.${value}`)}
                          </MenuItem>
                        ))}
                      </FormField>
                      <FormField
                        label={t('admin:serviceCenter.operations.assignee')}
                        placeholder={t('admin:serviceCenter.operations.assigneePlaceholder')}
                        value={assignedTo}
                        onChange={(event) => setAssignedTo(event.target.value.slice(0, 160))}
                      />
                      <FormField
                        multiline
                        minRows={3}
                        label={t('admin:serviceCenter.operations.note')}
                        placeholder={t('admin:serviceCenter.operations.notePlaceholder')}
                        value={note}
                        onChange={(event) => setNote(event.target.value.slice(0, 2000))}
                      />
                      <ActionButton
                        intent="primary"
                        disabled={!canManage || !targetStatus || mutation.isPending}
                        onClick={() => mutation.mutate()}
                      >
                        {t('admin:serviceCenter.operations.transition')}
                      </ActionButton>
                    </Stack>
                  )}
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>
    </Stack>
  );
}
