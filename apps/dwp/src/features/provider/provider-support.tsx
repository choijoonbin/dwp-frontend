import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Plus, ShieldAlert, ShieldCheck, ShieldOff, Timer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProviderSupportSession,
  getProviderOperatorProfile,
  listProviderSupportScopes,
  listProviderSupportSessions,
  listProviderTenants,
  revokeProviderSupportSession,
  useToast,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid, GuidedEmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import type { GridColDef } from '@mui/x-data-grid';
import type { ProviderSupportScope, ProviderSupportSession } from '@dwp-frontend/shared-utils';

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
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('support.createTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2.25}>
          <Alert severity={accessMode === 'BREAK_GLASS' ? 'error' : 'warning'}>
            {t(
              accessMode === 'BREAK_GLASS'
                ? 'support.breakGlassWarning'
                : 'support.elevationWarning'
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
          <TextField
            select
            required
            fullWidth
            label={t('fields.tenant')}
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          >
            {tenants.map((tenant) => (
              <MenuItem key={tenant.tenantId} value={tenant.tenantId}>
                {tenant.displayName} ({tenant.tenantKey})
              </MenuItem>
            ))}
          </TextField>
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
                      <Chip size="small" variant="outlined" label={scope.riskTier} />
                    </Stack>
                  }
                />
              ))}
            </FormGroup>
          </Box>
          <TextField
            select
            fullWidth
            label={t('fields.duration')}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
          >
            {[15, 30, 45, 60].map((minutes) => (
              <MenuItem key={minutes} value={minutes}>
                {t('support.minutes', { count: minutes })}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            required
            multiline
            minRows={3}
            label={t('fields.justification')}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
          />
          {requiresApproval && (
            <TextField
              required
              label={t('support.approvalReference')}
              helperText={t('support.approvalReferenceHelp')}
              value={approvalReference}
              onChange={(event) => setApprovalReference(event.target.value)}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={<KeyRound size={17} />}
          disabled={
            busy ||
            !tenantId ||
            scopes.size === 0 ||
            !justification.trim() ||
            (requiresApproval && !approvalReference.trim())
          }
          onClick={() =>
            void onCreate({
              tenantId,
              scopes: [...scopes],
              durationMinutes,
              justification: justification.trim(),
              approvalReference: requiresApproval ? approvalReference.trim() : null,
              emergencyAccess: accessMode === 'BREAK_GLASS',
            })
          }
        >
          {t('support.actions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProviderSupport() {
  const { t } = useTranslation('provider');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [sessionFilter, setSessionFilter] = useState<'ACTIVE' | 'HISTORY' | 'ALL'>('ACTIVE');
  const [busy, setBusy] = useState(false);
  const sessions = useQuery({
    queryKey: ['provider', 'support'],
    queryFn: () => listProviderSupportSessions(),
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
            <Tooltip title={t('support.actions.revoke')}>
              <IconButton
                size="small"
                aria-label={t('support.actions.revoke')}
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
              </IconButton>
            </Tooltip>
          ) : null,
      },
    ],
    [canWrite, queryClient, scopeLabels, t, toast]
  );

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
      await createProviderSupportSession(request);
      setCreateOpen(false);
      if (requestedTenantId) setSearchParams({}, { replace: true });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['provider', 'support'] }),
        queryClient.invalidateQueries({ queryKey: ['provider', 'support-context'] }),
      ]);
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
  const visibleSessions = allSessions.filter((session) => {
    if (sessionFilter === 'ALL') return true;
    return sessionFilter === 'ACTIVE'
      ? session.lifecycleState === 'ACTIVE'
      : session.lifecycleState !== 'ACTIVE';
  });
  const metrics = [
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
      label: t('support.metrics.expiring'),
      value: allSessions.filter(
        (session) =>
          session.lifecycleState === 'ACTIVE' &&
          new Date(session.expiresAt).getTime() - Date.now() < 15 * 60_000
      ).length,
      icon: Timer,
    },
  ];

  return (
    <Stack gap={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
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
        title={t('support.title')}
        description={t('support.description')}
        action={
          canWrite ? (
            <Button
              variant="contained"
              startIcon={<Plus size={17} />}
              onClick={() => setCreateOpen(true)}
            >
              {t('support.actions.create')}
            </Button>
          ) : undefined
        }
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
    </Stack>
  );
}
