import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  Check,
  ClipboardCheck,
  History,
  KeyRound,
  Play,
  Plus,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateProviderSupportAccessRequest,
  cancelProviderSupportAccessRequest,
  createProviderSupportAccessRequest,
  createProviderSupportSession,
  decideProviderSupportAccessRequest,
  getProviderOperatorProfile,
  listProviderSupportScopes,
  listProviderSupportAccessRequests,
  listProviderSupportSessions,
  listProviderTenants,
  revokeProviderSupportSession,
  reviewProviderSupportAccessRequest,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  GuidedEmptyState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  ProviderSupportAccessRequest,
  ProviderSupportScope,
  ProviderSupportSession,
} from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';

function CreateSupportSessionDialog({
  tenants,
  scopeCatalog,
  busy,
  canBreakGlass,
  initialTenantId,
  onClose,
  onCreate,
}: {
  tenants: { tenantId: string; displayName: string; tenantKey: string }[];
  scopeCatalog: ProviderSupportScope[];
  busy: boolean;
  canBreakGlass: boolean;
  initialTenantId?: string;
  onClose: () => void;
  onCreate: (request: {
    tenantId: string;
    scopes: string[];
    durationMinutes: number;
    justification: string;
    approvalReference?: string | null;
    emergencyAccess: boolean;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const [tenantId, setTenantId] = useState(initialTenantId ?? '');
  const [scopes, setScopes] = useState<Set<string>>(new Set());
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [justification, setJustification] = useState('');
  const [accessMode, setAccessMode] = useState<'STANDARD' | 'BREAK_GLASS'>('STANDARD');
  const [approvalReference, setApprovalReference] = useState('');
  useEffect(() => {
    if (scopes.size === 0 && scopeCatalog[0]) {
      setScopes(new Set([scopeCatalog[0].scopeCode]));
    }
  }, [scopeCatalog, scopes.size]);
  const requiresApproval =
    accessMode === 'STANDARD' &&
    scopeCatalog.some((scope) => scopes.has(scope.scopeCode) && scope.requiresCustomerApproval);
  const toggle = (scope: string) =>
    setScopes((current) => {
      const next = new Set(current);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });

  return (
    <FormDialog
      open
      title={t('support.createTitle')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(
        accessMode === 'BREAK_GLASS'
          ? 'support.actions.activateEmergency'
          : 'support.actions.request'
      )}
      submitIntent={accessMode === 'BREAK_GLASS' ? 'danger' : 'primary'}
      busy={busy}
      submitDisabled={
        !tenantId ||
        scopes.size === 0 ||
        !justification.trim() ||
        (requiresApproval && !approvalReference.trim())
      }
      onClose={onClose}
      onSubmit={() =>
        onCreate({
          tenantId,
          scopes: [...scopes],
          durationMinutes,
          justification: justification.trim(),
          approvalReference:
            accessMode === 'STANDARD' && approvalReference.trim() ? approvalReference.trim() : null,
          emergencyAccess: accessMode === 'BREAK_GLASS',
        })
      }
    >
      <Stack gap={2.25}>
        <Alert severity={accessMode === 'BREAK_GLASS' ? 'error' : 'info'}>
          {t(
            accessMode === 'BREAK_GLASS' ? 'support.breakGlassWarning' : 'support.elevationWarning'
          )}
        </Alert>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
            {t('support.accessMode')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={accessMode}
            onChange={(_event, value: 'STANDARD' | 'BREAK_GLASS' | null) =>
              value && setAccessMode(value)
            }
            aria-label={t('support.accessMode')}
          >
            <ToggleButton value="STANDARD">
              <ShieldCheck size={16} />
              <Box component="span" sx={{ ml: 0.75 }}>
                {t('support.modes.STANDARD')}
              </Box>
            </ToggleButton>
            {canBreakGlass && (
              <ToggleButton value="BREAK_GLASS">
                <ShieldAlert size={16} />
                <Box component="span" sx={{ ml: 0.75 }}>
                  {t('support.modes.BREAK_GLASS')}
                </Box>
              </ToggleButton>
            )}
          </ToggleButtonGroup>
        </Box>
        <SelectField
          required
          label={t('fields.tenant')}
          value={tenantId}
          options={tenants.map((tenant) => ({
            value: tenant.tenantId,
            label: `${tenant.displayName} (${tenant.tenantKey})`,
          }))}
          onValueChange={setTenantId}
        />
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {t('fields.scopes')}
          </Typography>
          <FormGroup>
            {scopeCatalog.map((scope) => (
              <FormControlLabel
                key={scope.scopeCode}
                control={
                  <Checkbox
                    checked={scopes.has(scope.scopeCode)}
                    onChange={() => toggle(scope.scopeCode)}
                  />
                }
                label={
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Typography variant="body2">
                      {t(`support.scopes.${scope.scopeCode}`, {
                        defaultValue: scope.displayName,
                      })}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={display('riskTiers', scope.riskTier)}
                    />
                  </Stack>
                }
              />
            ))}
          </FormGroup>
        </Box>
        <SelectField<number>
          label={t('fields.duration')}
          value={durationMinutes}
          options={[15, 30, 45, 60].map((minutes) => ({
            value: minutes,
            label: t('support.minutes', { count: minutes }),
          }))}
          onValueChange={(value) => value !== '' && setDurationMinutes(value)}
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('fields.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
        {accessMode === 'STANDARD' && (
          <FormField
            required={requiresApproval}
            label={t('support.approvalReference')}
            supportingText={t('support.approvalReferenceHelp')}
            value={approvalReference}
            onChange={(event) => setApprovalReference(event.target.value)}
          />
        )}
      </Stack>
    </FormDialog>
  );
}

type SupportAction = 'APPROVED' | 'DENIED' | 'CANCELLED' | 'REVIEWED';

function SupportActionDialog({
  action,
  busy,
  onClose,
  onConfirm,
}: {
  action: SupportAction;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      open
      title={t(`support.actionDialog.${action}.title`)}
      description={t(`support.actionDialog.${action}.description`)}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(`support.actions.${action}`)}
      submitIntent={action === 'DENIED' || action === 'CANCELLED' ? 'danger' : 'primary'}
      submitDisabled={!reason.trim()}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onConfirm(reason.trim())}
    >
      <FormField
        required
        multiline
        minRows={3}
        label={t(
          action === 'REVIEWED' ? 'support.actionDialog.reviewSummary' : 'fields.justification'
        )}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}

export function ProviderSupport() {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<{
    request: ProviderSupportAccessRequest;
    action: SupportAction;
  } | null>(null);
  const [sessionFilter, setSessionFilter] = useState<'ACTIVE' | 'HISTORY' | 'ALL'>('ACTIVE');
  const [busy, setBusy] = useState(false);
  const sessions = useQuery({
    queryKey: ['provider', 'support'],
    queryFn: () => listProviderSupportSessions(),
  });
  const requests = useQuery({
    queryKey: ['provider', 'support-access-requests'],
    queryFn: () => listProviderSupportAccessRequests(),
  });
  const tenants = useQuery({
    queryKey: ['provider', 'tenants', 'support'],
    queryFn: () => listProviderTenants({ state: 'ACTIVE', page: 0, size: 100 }),
  });
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const scopeCatalog = useQuery({
    queryKey: ['provider', 'support-scopes'],
    queryFn: listProviderSupportScopes,
  });
  const canWrite = operator.data?.permissions.includes('SUPPORT_SESSION_WRITE') ?? false;
  const canBreakGlass = operator.data?.permissions.includes('BREAK_GLASS_SUPPORT') ?? false;
  const canReview = operator.data?.permissions.includes('SUPPORT_ACCESS_REVIEW') ?? false;
  const canPostReview = operator.data?.permissions.includes('SUPPORT_POST_REVIEW') ?? false;
  const requestedTenantId = searchParams.get('tenantId') ?? undefined;
  const scopeLabels = useMemo(
    () =>
      new Map(
        (scopeCatalog.data ?? []).map((scope) => [
          scope.scopeCode,
          t(`support.scopes.${scope.scopeCode}`, { defaultValue: scope.displayName }),
        ])
      ),
    [scopeCatalog.data, t]
  );

  useEffect(() => {
    if (requestedTenantId && canWrite) setCreateOpen(true);
  }, [canWrite, requestedTenantId]);

  const refreshSupport = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['provider', 'support'] }),
      queryClient.invalidateQueries({ queryKey: ['provider', 'support-access-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['provider', 'support-context'] }),
    ]);
  }, [queryClient]);

  const activateRequest = useCallback(
    async (request: ProviderSupportAccessRequest) => {
      setBusy(true);
      try {
        await activateProviderSupportAccessRequest(request);
        await refreshSupport();
        toast.success(t('support.activated'));
        navigate(
          request.scopes.includes('TENANT_CONFIGURATION_READ') ||
            request.scopes.includes('TENANT_CONFIGURATION_WRITE')
            ? '/admin/experience/branding'
            : '/workforce/organization'
        );
      } catch (error) {
        toast.error(providerError(error, t('errors.operation')));
      } finally {
        setBusy(false);
      }
    },
    [navigate, refreshSupport, t, toast]
  );

  const requestActions = useCallback(
    (row: ProviderSupportAccessRequest) => {
      const ownRequest = row.requesterOperatorId === operator.data?.operatorId;
      const audit = (
        <ActionIconButton
          label={t('support.actions.audit')}
          size="small"
          onClick={() =>
            navigate(
              `/provider/audit?query=${encodeURIComponent(
                row.supportAccessRequestId
              )}&tenantId=${encodeURIComponent(row.tenantId)}`
            )
          }
        >
          <History size={16} />
        </ActionIconButton>
      );
      if (row.lifecycleState === 'PENDING_APPROVAL' && canReview && !ownRequest) {
        return (
          <Stack direction="row" gap={0.5}>
            <ActionIconButton
              label={t('support.actions.APPROVED')}
              intent="primary"
              size="small"
              onClick={() => setActionTarget({ request: row, action: 'APPROVED' })}
            >
              <Check size={17} />
            </ActionIconButton>
            <ActionIconButton
              label={t('support.actions.DENIED')}
              intent="danger"
              size="small"
              onClick={() => setActionTarget({ request: row, action: 'DENIED' })}
            >
              <X size={17} />
            </ActionIconButton>
            {audit}
          </Stack>
        );
      }
      if (row.lifecycleState === 'APPROVED' && ownRequest) {
        return (
          <Stack direction="row" alignItems="center" gap={0.5}>
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<Play size={15} />}
              onClick={() => void activateRequest(row)}
            >
              {t('support.actions.activate')}
            </ActionButton>
            {audit}
          </Stack>
        );
      }
      if (
        (row.lifecycleState === 'PENDING_APPROVAL' || row.lifecycleState === 'APPROVED') &&
        (ownRequest || canReview)
      ) {
        return (
          <Stack direction="row" alignItems="center" gap={0.5}>
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => setActionTarget({ request: row, action: 'CANCELLED' })}
            >
              {t('support.actions.CANCELLED')}
            </ActionButton>
            {audit}
          </Stack>
        );
      }
      if (row.lifecycleState === 'COMPLETED' && canPostReview && !ownRequest) {
        return (
          <Stack direction="row" alignItems="center" gap={0.5}>
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<ClipboardCheck size={15} />}
              onClick={() => setActionTarget({ request: row, action: 'REVIEWED' })}
            >
              {t('support.actions.REVIEWED')}
            </ActionButton>
            {audit}
          </Stack>
        );
      }
      return audit;
    },
    [activateRequest, canPostReview, canReview, navigate, operator.data?.operatorId, t]
  );

  const columns = useMemo<GridColDef<ProviderSupportSession>[]>(
    () => [
      {
        field: 'tenantName',
        headerName: t('support.columns.tenant'),
        minWidth: 200,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.tenantName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.tenantKey}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'operatorName',
        headerName: t('support.columns.operator'),
        minWidth: 170,
        flex: 0.8,
      },
      {
        field: 'scopes',
        headerName: t('support.columns.scopes'),
        minWidth: 260,
        flex: 1.2,
        valueGetter: (_value, row) =>
          row.scopes.map((scope) => scopeLabels.get(scope) ?? scope).join(', '),
      },
      {
        field: 'accessMode',
        headerName: t('support.columns.mode'),
        width: 145,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.accessMode === 'BREAK_GLASS' ? 'error' : 'default'}
            icon={row.accessMode === 'BREAK_GLASS' ? <ShieldAlert size={14} /> : undefined}
            label={t(`support.modes.${row.accessMode}`)}
          />
        ),
      },
      {
        field: 'riskTier',
        headerName: t('support.columns.risk'),
        width: 80,
      },
      {
        field: 'expiresAt',
        headerName: t('support.columns.expires'),
        width: 185,
        valueFormatter: (value?: string | null) => formatProviderDate(value),
      },
      {
        field: 'lifecycleState',
        headerName: t('support.columns.state'),
        width: 115,
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
      {
        field: 'actions',
        headerName: '',
        width: 64,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) =>
          canWrite && row.lifecycleState === 'ACTIVE' ? (
            <ActionIconButton
              label={t('support.actions.revoke')}
              intent="danger"
              size="small"
              onClick={async (event) => {
                event.stopPropagation();
                setBusy(true);
                try {
                  await revokeProviderSupportSession(row, t('support.revokeReason'));
                  toast.success(t('support.revoked'));
                  await queryClient.invalidateQueries({ queryKey: ['provider', 'support'] });
                } catch (error) {
                  toast.error(providerError(error, t('errors.operation')));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <ShieldOff size={17} />
            </ActionIconButton>
          ) : null,
      },
    ],
    [canWrite, queryClient, scopeLabels, t, toast]
  );

  const requestColumns = useMemo<GridColDef<ProviderSupportAccessRequest>[]>(
    () => [
      {
        field: 'tenantName',
        headerName: t('support.columns.tenant'),
        minWidth: 190,
        flex: 0.9,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.tenantName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.tenantKey}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'requesterName',
        headerName: t('support.columns.requester'),
        minWidth: 160,
        flex: 0.7,
      },
      {
        field: 'justification',
        headerName: t('support.columns.purpose'),
        minWidth: 260,
        flex: 1.25,
      },
      {
        field: 'riskTier',
        headerName: t('support.columns.risk'),
        width: 80,
        renderCell: ({ value }) => (
          <Chip size="small" variant="outlined" label={display('riskTiers', String(value))} />
        ),
      },
      {
        field: 'decisionDueAt',
        headerName: t('support.columns.decisionDue'),
        width: 175,
        valueFormatter: (value?: string | null) => formatProviderDate(value),
      },
      {
        field: 'lifecycleState',
        headerName: t('support.columns.state'),
        width: 145,
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
      {
        field: 'requestActions',
        headerName: t('support.columns.actions'),
        width: 210,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => requestActions(row),
      },
    ],
    [display, requestActions, t]
  );

  async function runRequestAction(reason: string) {
    if (!actionTarget) return;
    setBusy(true);
    try {
      const { request, action } = actionTarget;
      if (action === 'APPROVED' || action === 'DENIED') {
        await decideProviderSupportAccessRequest(request, action, reason);
      } else if (action === 'CANCELLED') {
        await cancelProviderSupportAccessRequest(request, reason);
      } else {
        await reviewProviderSupportAccessRequest(request, reason);
      }
      setActionTarget(null);
      await refreshSupport();
      toast.success(t(`support.messages.${action}`));
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  }

  const create = async (request: {
    tenantId: string;
    scopes: string[];
    durationMinutes: number;
    justification: string;
    approvalReference?: string | null;
    emergencyAccess: boolean;
  }) => {
    setBusy(true);
    try {
      if (request.emergencyAccess) {
        await createProviderSupportSession({
          ...request,
          requestKey: `break-glass-${crypto.randomUUID()}`,
        });
      } else {
        await createProviderSupportAccessRequest({
          tenantId: request.tenantId,
          scopes: request.scopes,
          durationMinutes: request.durationMinutes,
          justification: request.justification,
          approvalReference: request.approvalReference,
          requestKey: `support-${crypto.randomUUID()}`,
        });
      }
      setCreateOpen(false);
      if (requestedTenantId) setSearchParams({}, { replace: true });
      await refreshSupport();
      toast.success(t(request.emergencyAccess ? 'support.activated' : 'support.requestSubmitted'));
      if (request.emergencyAccess) {
        navigate(
          request.scopes.includes('TENANT_CONFIGURATION_READ') ||
            request.scopes.includes('TENANT_CONFIGURATION_WRITE')
            ? '/admin/experience/branding'
            : '/workforce/organization'
        );
      }
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };

  if (
    sessions.isLoading ||
    tenants.isLoading ||
    scopeCatalog.isLoading ||
    (operator.isLoading && !operator.data)
  )
    return <ProviderLoading />;
  if (
    sessions.isError ||
    tenants.isError ||
    scopeCatalog.isError ||
    (operator.isError && !operator.data)
  )
    return (
      <ProviderError
        error={sessions.error ?? tenants.error ?? operator.error ?? scopeCatalog.error}
        onRetry={() =>
          void Promise.all([
            sessions.refetch(),
            tenants.refetch(),
            scopeCatalog.refetch(),
            operator.refetch(),
          ])
        }
        retrying={
          sessions.isFetching ||
          tenants.isFetching ||
          scopeCatalog.isFetching ||
          operator.isFetching
        }
      />
    );

  const allSessions = sessions.data ?? [];
  const allRequests = requests.data ?? [];
  const visibleSessions = allSessions.filter((session) => {
    if (sessionFilter === 'ALL') return true;
    return sessionFilter === 'ACTIVE'
      ? session.lifecycleState === 'ACTIVE'
      : session.lifecycleState !== 'ACTIVE';
  });
  const metrics = [
    {
      label: t('support.metrics.pendingApproval'),
      value: allRequests.filter((request) => request.lifecycleState === 'PENDING_APPROVAL').length,
      icon: ShieldCheck,
    },
    {
      label: t('support.metrics.active'),
      value: allSessions.filter((session) => session.lifecycleState === 'ACTIVE').length,
      icon: KeyRound,
    },
    {
      label: t('support.metrics.breakGlass'),
      value: allSessions.filter(
        (session) => session.lifecycleState === 'ACTIVE' && session.accessMode === 'BREAK_GLASS'
      ).length,
      icon: ShieldAlert,
    },
    {
      label: t('support.metrics.pendingReview'),
      value: allRequests.filter((request) => request.postReviewState === 'PENDING').length,
      icon: ClipboardCheck,
    },
  ];

  return (
    <Stack gap={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        {metrics.map(({ label, value, icon: Icon }, index) => (
          <Box
            key={label}
            sx={{
              p: 1.75,
              borderLeft: { sm: index ? 1 : 0 },
              borderTop: { xs: index ? 1 : 0, sm: 0 },
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.75} color="text.secondary">
              <Icon size={16} />
              <Typography variant="caption">{label}</Typography>
            </Stack>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <ProviderSectionHeading
        title={t('support.workflowTitle')}
        description={t('support.workflowDescription')}
        action={
          canWrite ? (
            <ActionButton
              intent="primary"
              startIcon={<Plus size={17} />}
              onClick={() => setCreateOpen(true)}
            >
              {t('support.actions.create')}
            </ActionButton>
          ) : undefined
        }
      />
      {requests.isError ? (
        <Alert
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void requests.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('support.partialRequests')}
        </Alert>
      ) : allRequests.length > 0 || requests.isFetching ? (
        desktop ? (
          <EnterpriseDataGrid
            ariaLabel={t('support.workflowTitle')}
            rows={allRequests}
            columns={requestColumns}
            getRowId={(row) => row.supportAccessRequestId}
            loading={requests.isFetching || busy}
            hideFooter
            maxVisibleRows={8}
          />
        ) : (
          <Stack
            component="ul"
            aria-label={t('support.workflowTitle')}
            divider={<Divider flexItem />}
            sx={{ m: 0, p: 0, listStyle: 'none', borderBlock: 1, borderColor: 'divider' }}
          >
            {allRequests.map((request) => (
              <Box component="li" key={request.supportAccessRequestId} sx={{ py: 1.5 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  gap={1}
                >
                  <Box minWidth={0}>
                    <Typography variant="subtitle2">{request.tenantName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {request.requesterName} · {display('riskTiers', request.riskTier)}
                    </Typography>
                  </Box>
                  <ProviderStatusChip state={request.lifecycleState} />
                </Stack>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {request.justification}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ mt: 0.5 }}
                >
                  {t('support.columns.decisionDue')}: {formatProviderDate(request.decisionDueAt)}
                </Typography>
                <Box sx={{ mt: 1 }}>{requestActions(request)}</Box>
              </Box>
            ))}
          </Stack>
        )
      ) : (
        <GuidedEmptyState
          kind="first-use"
          title={t('support.empty.noRequestsTitle')}
          description={t('support.empty.noRequestsDescription')}
          actionLabel={canWrite ? t('support.actions.create') : undefined}
          onAction={canWrite ? () => setCreateOpen(true) : undefined}
          size="compact"
        />
      )}
      <ProviderSectionHeading
        title={t('support.sessionsTitle')}
        description={t('support.sessionsDescription')}
      />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={sessionFilter}
        onChange={(_event, value: typeof sessionFilter | null) => value && setSessionFilter(value)}
        aria-label={t('support.filterLabel')}
      >
        {['ACTIVE', 'HISTORY', 'ALL'].map((value) => (
          <ToggleButton key={value} value={value}>
            {t(`support.filters.${value}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {visibleSessions.length > 0 ? (
        <EnterpriseDataGrid
          ariaLabel={t('support.title')}
          rows={visibleSessions}
          columns={columns}
          getRowId={(row) => row.supportSessionId}
          loading={sessions.isFetching || busy}
          hideFooter
          maxVisibleRows={12}
        />
      ) : (
        <GuidedEmptyState
          kind={allSessions.length ? 'no-results' : 'first-use'}
          title={
            allSessions.length
              ? t('support.empty.noResultsTitle')
              : t('support.empty.firstUseTitle')
          }
          description={
            allSessions.length
              ? t('support.empty.noResultsDescription')
              : t('support.empty.firstUseDescription')
          }
          actionLabel={
            allSessions.length
              ? t('support.empty.showAll')
              : canWrite
                ? t('support.actions.create')
                : undefined
          }
          onAction={
            allSessions.length
              ? () => setSessionFilter('ALL')
              : canWrite
                ? () => setCreateOpen(true)
                : undefined
          }
          size="standard"
        />
      )}
      {createOpen && (
        <CreateSupportSessionDialog
          initialTenantId={requestedTenantId}
          tenants={tenants.data?.content ?? []}
          scopeCatalog={scopeCatalog.data ?? []}
          busy={busy}
          canBreakGlass={canBreakGlass}
          onClose={() => {
            setCreateOpen(false);
            if (requestedTenantId) setSearchParams({}, { replace: true });
          }}
          onCreate={create}
        />
      )}
      {actionTarget && (
        <SupportActionDialog
          action={actionTarget.action}
          busy={busy}
          onClose={() => setActionTarget(null)}
          onConfirm={runRequestAction}
        />
      )}
    </Stack>
  );
}
