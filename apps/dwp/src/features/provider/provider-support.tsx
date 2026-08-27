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
  decideProviderSupportAccessRequest,
  getProviderOperatorProfile,
  listProviderSupportScopes,
  listProviderSupportAccessRequests,
  listProviderSupportSessions,
  revokeProviderSupportSession,
  reviewProviderSupportAccessRequest,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  isProviderSupportSessionActive,
  providerSupportContextQueryKey,
  publishProviderSupportContextRevision,
  useCurrentProviderSupportContext,
} from '@dwp-frontend/shared-utils/auth/provider-support-context';
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
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

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
import {
  cancelTenantDiagnosisWindow,
  completeTenantDiagnosisWindow,
  isExecutableProviderDiagnosisScopeSet,
  reserveTenantDiagnosisWindow,
  TENANT_EXPERIENCE_PREVIEW_SCOPE,
} from './provider-diagnosis-policy';
import { purgeProviderSupportTenantCache } from './provider-support-cache';
import { ProviderSupportRequestEvidence } from './provider-support-request-evidence';
import { ProviderSupportPostReviewEvidence } from './provider-support-post-review-evidence';
import { ProviderTenantPicker } from './provider-tenant-picker';

function CreateSupportSessionDialog({
  scopeCatalog,
  busy,
  initialTenantId,
  onClose,
  onCreate,
}: {
  scopeCatalog: ProviderSupportScope[];
  busy: boolean;
  initialTenantId?: string;
  onClose: () => void;
  onCreate: (request: {
    tenantId: string;
    scopes: string[];
    durationMinutes: number;
    justification: string;
    approvalReference?: string | null;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const [tenantId, setTenantId] = useState(initialTenantId ?? '');
  const [scopes, setScopes] = useState<Set<string>>(new Set());
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [justification, setJustification] = useState('');
  const [approvalReference, setApprovalReference] = useState('');
  useEffect(() => {
    if (scopes.size === 0 && scopeCatalog[0]) {
      setScopes(new Set([scopeCatalog[0].scopeCode]));
    }
  }, [scopeCatalog, scopes.size]);
  const requiresApproval = scopeCatalog.some(
    (scope) => scopes.has(scope.scopeCode) && scope.requiresCustomerApproval
  );
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
      submitLabel={t('support.actions.request')}
      submitIntent="primary"
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
          approvalReference: approvalReference.trim() ? approvalReference.trim() : null,
        })
      }
    >
      <Stack gap={2.25}>
        <Alert severity="info">{t('support.elevationWarning')}</Alert>
        <ProviderTenantPicker value={tenantId} onChange={setTenantId} />
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
        <FormField
          required={requiresApproval}
          label={t('support.approvalReference')}
          supportingText={t('support.approvalReferenceHelp')}
          value={approvalReference}
          onChange={(event) => setApprovalReference(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

type SupportAction = 'APPROVED' | 'DENIED' | 'CANCELLED' | 'REVIEWED';

function SupportActionDialog({
  request,
  action,
  busy,
  onClose,
  onConfirm,
}: {
  request: ProviderSupportAccessRequest;
  action: SupportAction;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  const [postReviewEvidenceReady, setPostReviewEvidenceReady] = useState(action !== 'REVIEWED');
  useEffect(() => setPostReviewEvidenceReady(action !== 'REVIEWED'), [action]);
  return (
    <FormDialog
      open
      title={t(`support.actionDialog.${action}.title`)}
      description={t(`support.actionDialog.${action}.description`)}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(`support.actions.${action}`)}
      submitIntent={action === 'DENIED' || action === 'CANCELLED' ? 'danger' : 'primary'}
      submitDisabled={!reason.trim() || !postReviewEvidenceReady}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onConfirm(reason.trim())}
    >
      <Stack gap={2}>
        <ProviderSupportRequestEvidence request={request} />
        {action === 'REVIEWED' && (
          <ProviderSupportPostReviewEvidence
            request={request}
            onReadyChange={setPostReviewEvidenceReady}
          />
        )}
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
      </Stack>
    </FormDialog>
  );
}

export function ProviderSupport() {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const wideRequestLedger = useMediaQuery('(min-width:1400px)');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const supportContext = useCurrentProviderSupportContext();
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
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const scopeCatalog = useQuery({
    queryKey: ['provider', 'support-scopes'],
    queryFn: listProviderSupportScopes,
  });
  const executableScopeCatalog = useMemo(
    () =>
      (scopeCatalog.data ?? []).filter(
        (scope) =>
          scope.scopeCode === TENANT_EXPERIENCE_PREVIEW_SCOPE && scope.lifecycleState === 'ACTIVE'
      ),
    [scopeCatalog.data]
  );
  const canWrite = operator.data?.permissions.includes('SUPPORT_SESSION_WRITE') ?? false;
  const canReview = operator.data?.permissions.includes('SUPPORT_ACCESS_REVIEW') ?? false;
  const canPostReview = operator.data?.permissions.includes('SUPPORT_POST_REVIEW') ?? false;
  const activeSupportContext =
    !supportContext.isError && isProviderSupportSessionActive(supportContext.data)
      ? supportContext.data
      : null;
  const canStartDiagnosis =
    canWrite &&
    executableScopeCatalog.length === 1 &&
    !activeSupportContext &&
    !supportContext.isLoading &&
    !supportContext.isError;
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
    if (requestedTenantId && canStartDiagnosis) setCreateOpen(true);
  }, [canStartDiagnosis, requestedTenantId]);

  const refreshSupport = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['provider', 'support'] }),
      queryClient.invalidateQueries({ queryKey: ['provider', 'support-access-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['provider', 'support-context'] }),
    ]);
  }, [queryClient]);

  const revokeSession = useCallback(
    async (session: Pick<ProviderSupportSession, 'supportSessionId' | 'version'>) => {
      if (busy) return;
      setBusy(true);
      try {
        await revokeProviderSupportSession(session, t('support.revokeReason'));
        queryClient.setQueryData(providerSupportContextQueryKey, null);
        await purgeProviderSupportTenantCache(queryClient);
        publishProviderSupportContextRevision();
        await refreshSupport();
        toast.success(t('support.revoked'));
      } catch (error) {
        toast.error(providerError(error, t('errors.operation')));
      } finally {
        setBusy(false);
      }
    },
    [busy, queryClient, refreshSupport, t, toast]
  );

  const activateRequest = useCallback(
    async (request: ProviderSupportAccessRequest) => {
      if (busy) return;
      if (!isExecutableProviderDiagnosisScopeSet(request.scopes)) {
        toast.error(t('support.scopeRetired'));
        return;
      }
      const diagnosisWindow = reserveTenantDiagnosisWindow(request.tenantId, request.scopes);
      setBusy(true);
      try {
        await activateProviderSupportAccessRequest(request);
        await refreshSupport();
        toast.success(t('support.activated'));
        completeTenantDiagnosisWindow(diagnosisWindow, (destination) => navigate(destination));
      } catch (error) {
        cancelTenantDiagnosisWindow(diagnosisWindow);
        toast.error(providerError(error, t('errors.operation')));
      } finally {
        setBusy(false);
      }
    },
    [busy, navigate, refreshSupport, t, toast]
  );

  const requestActions = useCallback(
    (row: ProviderSupportAccessRequest) => {
      const ownRequest = row.requesterOwned;
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
        const executable = isExecutableProviderDiagnosisScopeSet(row.scopes);
        return (
          <Stack direction="row" gap={0.5}>
            {executable && (
              <ActionIconButton
                label={t('support.actions.APPROVED')}
                intent="primary"
                size="small"
                onClick={() => setActionTarget({ request: row, action: 'APPROVED' })}
              >
                <Check size={17} />
              </ActionIconButton>
            )}
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
      if (
        row.lifecycleState === 'APPROVED' &&
        ownRequest &&
        isExecutableProviderDiagnosisScopeSet(row.scopes)
      ) {
        return (
          <Stack direction="row" alignItems="center" gap={0.5}>
            <ActionButton
              intent="quiet"
              size="small"
              disabled={busy}
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
    [activateRequest, busy, canPostReview, canReview, navigate, t]
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
              onClick={(event) => {
                event.stopPropagation();
                void revokeSession(row);
              }}
            >
              <ShieldOff size={17} />
            </ActionIconButton>
          ) : null,
      },
    ],
    [canWrite, revokeSession, scopeLabels, t]
  );

  const requestColumns = useMemo<GridColDef<ProviderSupportAccessRequest>[]>(
    () => [
      {
        field: 'tenantName',
        headerName: t('support.columns.tenantAndRequester'),
        minWidth: 230,
        flex: 0.9,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.tenantName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.tenantKey} · {row.requesterName}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'grantEvidence',
        headerName: t('support.columns.exactGrant'),
        minWidth: 300,
        flex: 1.2,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {row.scopes
                .map((scope) => t(`support.scopes.${scope}`, { defaultValue: scope }))
                .join(', ')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('support.minutes', { count: row.durationMinutes })} ·{' '}
              {display('riskTiers', row.riskTier)}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'stateEvidence',
        headerName: t('support.columns.stateAndDue'),
        width: 205,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <Box>
            <ProviderStatusChip state={row.lifecycleState} />
            <Typography variant="caption" color="text.secondary" display="block">
              {formatProviderDate(row.decisionDueAt)}
            </Typography>
          </Box>
        ),
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
      if (action === 'APPROVED' && !isExecutableProviderDiagnosisScopeSet(request.scopes)) {
        setActionTarget(null);
        toast.error(t('support.scopeRetired'));
        return;
      }
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
  }) => {
    if (!isExecutableProviderDiagnosisScopeSet(request.scopes)) {
      toast.error(t('support.scopeRetired'));
      return;
    }
    setBusy(true);
    try {
      await createProviderSupportAccessRequest({
        tenantId: request.tenantId,
        scopes: request.scopes,
        durationMinutes: request.durationMinutes,
        justification: request.justification,
        approvalReference: request.approvalReference,
        requestKey: `support-${crypto.randomUUID()}`,
      });
      setCreateOpen(false);
      if (requestedTenantId) setSearchParams({}, { replace: true });
      await refreshSupport();
      toast.success(t('support.requestSubmitted'));
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };

  if (sessions.isLoading || scopeCatalog.isLoading || (operator.isLoading && !operator.data))
    return <ProviderLoading />;
  if (sessions.isError || scopeCatalog.isError || (operator.isError && !operator.data))
    return (
      <ProviderError
        error={sessions.error ?? operator.error ?? scopeCatalog.error}
        onRetry={() =>
          void Promise.all([sessions.refetch(), scopeCatalog.refetch(), operator.refetch()])
        }
        retrying={sessions.isFetching || scopeCatalog.isFetching || operator.isFetching}
      />
    );

  const allSessions = sessions.data ?? [];
  const allRequests = requests.data ?? [];
  const requestMetricsUnavailable = !requests.data && (requests.isLoading || requests.isError);
  const visibleSessions = allSessions.filter((session) => {
    if (sessionFilter === 'ALL') return true;
    return sessionFilter === 'ACTIVE'
      ? session.lifecycleState === 'ACTIVE'
      : session.lifecycleState !== 'ACTIVE';
  });
  const metrics = [
    {
      label: t('support.metrics.pendingApproval'),
      value: requestMetricsUnavailable
        ? '—'
        : allRequests.filter((request) => request.lifecycleState === 'PENDING_APPROVAL').length,
      icon: ShieldCheck,
      unavailable: requestMetricsUnavailable,
    },
    {
      label: t('support.metrics.active'),
      value: allSessions.filter((session) => session.lifecycleState === 'ACTIVE').length,
      icon: KeyRound,
      unavailable: false,
    },
    {
      label: t('support.metrics.breakGlass'),
      value: allSessions.filter(
        (session) => session.lifecycleState === 'ACTIVE' && session.accessMode === 'BREAK_GLASS'
      ).length,
      icon: ShieldAlert,
      unavailable: false,
    },
    {
      label: t('support.metrics.pendingReview'),
      value: requestMetricsUnavailable
        ? '—'
        : allRequests.filter((request) => request.postReviewState === 'PENDING').length,
      icon: ClipboardCheck,
      unavailable: requestMetricsUnavailable,
    },
  ];

  return (
    <Stack gap={3}>
      {activeSupportContext && <Alert severity="info">{t('diagnosis.active.singleSession')}</Alert>}
      {supportContext.isError && !supportContext.data && (
        <Alert severity="warning">{t('diagnosis.contextUnavailable')}</Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        {metrics.map(({ label, value, icon: Icon, unavailable }, index) => (
          <Box
            key={label}
            aria-label={
              unavailable ? t('support.metrics.unavailable', { metric: label }) : undefined
            }
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
          canStartDiagnosis ? (
            <ActionButton
              intent="primary"
              startIcon={<Plus size={17} />}
              onClick={() => setCreateOpen(true)}
            >
              {t('support.actions.startDiagnosis')}
            </ActionButton>
          ) : undefined
        }
      />
      {canWrite && executableScopeCatalog.length === 0 && (
        <Alert severity="warning">{t('support.previewScopeUnavailable')}</Alert>
      )}
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
        wideRequestLedger ? (
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
            sx={{ m: 0, p: 0, listStyle: 'none', borderBlock: 1, borderColor: 'divider' }}
          >
            {allRequests.map((request) => (
              <Box
                component="li"
                key={request.supportAccessRequestId}
                sx={{
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:last-of-type': { borderBottom: 0 },
                }}
              >
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
                <Box sx={{ mt: 1.25 }}>
                  <ProviderSupportRequestEvidence request={request} showHeading={false} />
                </Box>
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
          actionLabel={canStartDiagnosis ? t('support.actions.startDiagnosis') : undefined}
          onAction={canStartDiagnosis ? () => setCreateOpen(true) : undefined}
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
              : canStartDiagnosis
                ? t('support.actions.startDiagnosis')
                : undefined
          }
          onAction={
            allSessions.length
              ? () => setSessionFilter('ALL')
              : canStartDiagnosis
                ? () => setCreateOpen(true)
                : undefined
          }
          size="standard"
        />
      )}
      {createOpen && canStartDiagnosis && (
        <CreateSupportSessionDialog
          initialTenantId={requestedTenantId}
          scopeCatalog={executableScopeCatalog}
          busy={busy}
          onClose={() => {
            setCreateOpen(false);
            if (requestedTenantId) setSearchParams({}, { replace: true });
          }}
          onCreate={create}
        />
      )}
      {actionTarget && (
        <SupportActionDialog
          request={actionTarget.request}
          action={actionTarget.action}
          busy={busy}
          onClose={() => setActionTarget(null)}
          onConfirm={runRequestAction}
        />
      )}
    </Stack>
  );
}
