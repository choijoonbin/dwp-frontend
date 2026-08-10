import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Check,
  CirclePause,
  ClipboardCheck,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  executeProviderOperation,
  listProviderEntitlements,
  listProviderOperations,
  listProviderTenants,
  previewProviderOnboarding,
  replaceProviderTenantEntitlements,
  updateProviderTenantLifecycle,
  useToast,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FormGroup from '@mui/material/FormGroup';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  OnboardingPlanRequest,
  ProviderEntitlement,
  ProviderOperation,
  ProviderTenant,
} from '@dwp-frontend/shared-utils';

function failure(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function StatusChip({ state }: { state: string }) {
  const { t } = useTranslation('provider');
  const color =
    state === 'ACTIVE' || state === 'READY' || state === 'SUCCEEDED'
      ? 'success'
      : state === 'FAILED'
        ? 'error'
        : state === 'PREVIEWED' || state === 'PARTIAL' || state === 'PENDING_EXTERNAL'
          ? 'warning'
          : 'default';
  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      label={t(`states.${state}`, { defaultValue: state })}
    />
  );
}

function OnboardingDialog({
  open,
  entitlements,
  busy,
  onClose,
  onPreview,
}: {
  open: boolean;
  entitlements: ProviderEntitlement[];
  busy: boolean;
  onClose: () => void;
  onPreview: (request: OnboardingPlanRequest) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [tenantKey, setTenantKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [serviceTier, setServiceTier] = useState<ProviderTenant['serviceTier']>('ENTERPRISE');
  const [dataRegion, setDataRegion] = useState('ap-northeast-2');
  const [isolationModel, setIsolationModel] = useState<ProviderTenant['isolationModel']>('POOL');
  const [selected, setSelected] = useState<Set<string>>(new Set(['core.workspace']));
  const [justification, setJustification] = useState('');
  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('onboarding.title')}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack gap={2.25}>
          <Typography variant="body2" color="text.secondary">
            {t('onboarding.description')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              autoFocus
              required
              fullWidth
              label={t('fields.tenantKey')}
              value={tenantKey}
              onChange={(event) => setTenantKey(event.target.value)}
            />
            <TextField
              required
              fullWidth
              label={t('fields.displayName')}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              select
              fullWidth
              label={t('fields.serviceTier')}
              value={serviceTier}
              onChange={(event) =>
                setServiceTier(event.target.value as ProviderTenant['serviceTier'])
              }
            >
              {['STANDARD', 'ENTERPRISE', 'REGULATED'].map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`tiers.${value}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              fullWidth
              label={t('fields.dataRegion')}
              value={dataRegion}
              onChange={(event) => setDataRegion(event.target.value)}
            />
            <TextField
              select
              fullWidth
              label={t('fields.isolation')}
              value={isolationModel}
              onChange={(event) =>
                setIsolationModel(event.target.value as ProviderTenant['isolationModel'])
              }
            >
              {['POOL', 'BRIDGE', 'SILO'].map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`isolation.${value}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              {t('onboarding.entitlements')}
            </Typography>
            <FormGroup
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 0.5,
              }}
            >
              {entitlements.map((entitlement) => (
                <FormControlLabel
                  key={entitlement.entitlementId}
                  control={
                    <Checkbox
                      checked={selected.has(entitlement.entitlementKey)}
                      onChange={() => toggle(entitlement.entitlementKey)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        {entitlement.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entitlement.entitlementKey} / {entitlement.entitlementType}
                      </Typography>
                    </Box>
                  }
                  sx={{ m: 0, alignItems: 'flex-start' }}
                />
              ))}
            </FormGroup>
          </Box>
          <TextField
            required
            multiline
            minRows={2}
            label={t('fields.justification')}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            helperText={t('onboarding.justificationHelp')}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={<ClipboardCheck size={17} />}
          disabled={
            busy ||
            tenantKey.length < 2 ||
            !displayName.trim() ||
            !dataRegion.trim() ||
            !justification.trim()
          }
          onClick={() =>
            void onPreview({
              tenantKey: tenantKey.trim(),
              displayName: displayName.trim(),
              serviceTier,
              dataRegion: dataRegion.trim(),
              isolationModel,
              entitlementKeys: [...selected],
              justification: justification.trim(),
            })
          }
        >
          {t('actions.preview')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function OperationDialog({
  operation,
  busy,
  onClose,
  onExecute,
}: {
  operation: ProviderOperation | null;
  busy: boolean;
  onClose: () => void;
  onExecute: (operation: ProviderOperation) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  let plan: Record<string, unknown> = {};
  try {
    plan = operation ? (JSON.parse(operation.plan) as Record<string, unknown>) : {};
  } catch {
    plan = {};
  }
  return (
    <Dialog open={Boolean(operation)} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('operations.reviewTitle')}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {operation && (
          <Stack gap={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
              <Box>
                <Typography variant="h6">
                  {String(plan.displayName ?? operation.operationType)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {String(plan.tenantKey ?? operation.operationId)}
                </Typography>
              </Box>
              <Stack direction="row" gap={0.75} alignItems="center">
                <Chip
                  size="small"
                  label={operation.riskTier}
                  color={operation.riskTier === 'L3' ? 'warning' : 'default'}
                />
                <StatusChip state={operation.lifecycleState} />
              </Stack>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                borderTop: 1,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              {[
                ['serviceTier', t('fields.serviceTier')],
                ['dataRegion', t('fields.dataRegion')],
                ['isolationModel', t('fields.isolation')],
              ].map(([key, label]) => (
                <Box key={key} sx={{ py: 1.5, px: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {String(plan[key] ?? t('notAvailable'))}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('operations.planHash')}
              </Typography>
              <Typography
                variant="caption"
                component="code"
                sx={{
                  display: 'block',
                  p: 1.25,
                  bgcolor: 'action.hover',
                  overflowWrap: 'anywhere',
                }}
              >
                {operation.planHash}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('operations.steps')}
              </Typography>
              <Stack component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                {operation.steps.map((step) => (
                  <Stack
                    component="li"
                    key={step.order}
                    direction="row"
                    alignItems="center"
                    gap={1.25}
                    sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor:
                          step.lifecycleState === 'SUCCEEDED' ? 'success.main' : 'action.selected',
                        color:
                          step.lifecycleState === 'SUCCEEDED'
                            ? 'success.contrastText'
                            : 'text.secondary',
                      }}
                    >
                      {step.lifecycleState === 'SUCCEEDED' ? <Check size={14} /> : step.order}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {t(`steps.${step.stepKey}`, { defaultValue: step.stepKey })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {step.targetService}
                      </Typography>
                    </Box>
                    <StatusChip state={step.lifecycleState} />
                  </Stack>
                ))}
              </Stack>
            </Box>
            {operation.lifecycleState === 'PARTIAL' && (
              <Typography variant="body2" color="warning.main">
                {t('operations.externalGateNotice')}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.close')}
        </Button>
        {operation?.lifecycleState === 'PREVIEWED' && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<Play size={17} />}
            disabled={busy}
            onClick={() => void onExecute(operation)}
          >
            {t('actions.execute')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function EntitlementDialog({
  tenant,
  catalog,
  busy,
  onClose,
  onSave,
}: {
  tenant: ProviderTenant | null;
  catalog: ProviderEntitlement[];
  busy: boolean;
  onClose: () => void;
  onSave: (keys: string[], justification: string) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(
      tenant?.entitlements
        .filter((item) => item.lifecycleState === 'ACTIVE')
        .map((item) => item.entitlementKey) ?? []
    )
  );
  const [justification, setJustification] = useState('');
  return (
    <Dialog open={Boolean(tenant)} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('entitlements.title', { tenant: tenant?.displayName })}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <FormGroup>
          {catalog.map((item) => (
            <FormControlLabel
              key={item.entitlementId}
              control={
                <Checkbox
                  checked={selected.has(item.entitlementKey)}
                  onChange={() =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(item.entitlementKey)) next.delete(item.entitlementKey);
                      else next.add(item.entitlementKey);
                      return next;
                    })
                  }
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {item.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.entitlementKey}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start' }}
            />
          ))}
        </FormGroup>
        <TextField
          fullWidth
          required
          multiline
          minRows={2}
          sx={{ mt: 2 }}
          label={t('fields.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.cancel')}</Button>
        <Button
          variant="contained"
          disabled={busy || !justification.trim()}
          onClick={() => void onSave([...selected], justification.trim())}
        >
          {t('actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProviderTenants() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<ProviderOperation | null>(null);
  const [entitlementTenant, setEntitlementTenant] = useState<ProviderTenant | null>(null);
  const [busy, setBusy] = useState(false);
  const tenants = useQuery({
    queryKey: ['provider', 'tenants', deferredQuery],
    queryFn: () => listProviderTenants({ query: deferredQuery, size: 100 }),
  });
  const entitlements = useQuery({
    queryKey: ['provider', 'entitlements'],
    queryFn: listProviderEntitlements,
  });
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['provider'] }),
    [queryClient]
  );
  const mutate = useCallback(
    async <T,>(action: () => Promise<T>, success: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const result = await action();
        await refresh();
        toast.success(success);
        return result;
      } catch (error) {
        toast.error(failure(error, t('errors.operation')));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [refresh, t, toast]
  );
  const columns = useMemo<GridColDef<ProviderTenant>[]>(
    () => [
      {
        field: 'displayName',
        headerName: t('tenants.columns.tenant'),
        minWidth: 200,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.tenantKey} / {row.tenantId}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'serviceTier',
        headerName: t('tenants.columns.tier'),
        width: 110,
        valueGetter: (_value, row) => t(`tiers.${row.serviceTier}`),
      },
      { field: 'dataRegion', headerName: t('tenants.columns.region'), width: 125 },
      {
        field: 'isolationModel',
        headerName: t('tenants.columns.isolation'),
        width: 90,
        valueGetter: (_value, row) => t(`isolation.${row.isolationModel}`),
      },
      {
        field: 'onboardingState',
        headerName: t('tenants.columns.onboarding'),
        width: 115,
        renderCell: ({ row }) => <StatusChip state={row.onboardingState} />,
      },
      {
        field: 'lifecycleState',
        headerName: t('tenants.columns.state'),
        width: 95,
        renderCell: ({ row }) => <StatusChip state={row.lifecycleState} />,
      },
      {
        field: 'entitlements',
        headerName: t('tenants.columns.entitlements'),
        width: 92,
        valueGetter: (_value, row) =>
          row.entitlements.filter((item) => item.lifecycleState === 'ACTIVE').length,
      },
      {
        field: 'actions',
        headerName: '',
        width: 80,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row">
            <Tooltip title={t('tenants.actions.entitlements')}>
              <IconButton size="small" onClick={() => setEntitlementTenant(row)}>
                <Settings2 size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={
                row.lifecycleState === 'ACTIVE'
                  ? t('tenants.actions.suspend')
                  : t('tenants.actions.activate')
              }
            >
              <span>
                <IconButton
                  size="small"
                  disabled={busy || !['ACTIVE', 'SUSPENDED'].includes(row.lifecycleState)}
                  onClick={() =>
                    void mutate(
                      () =>
                        updateProviderTenantLifecycle(
                          row,
                          row.lifecycleState === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                          t('tenants.lifecycleJustification')
                        ),
                      t('tenants.toasts.lifecycle')
                    )
                  }
                >
                  <CirclePause size={16} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [busy, mutate, t]
  );
  if (tenants.isLoading || entitlements.isLoading)
    return (
      <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
        <Typography color="text.secondary">{t('loading')}</Typography>
      </Box>
    );
  if (tenants.isError || entitlements.isError)
    return (
      <Box role="alert" sx={{ py: 8, textAlign: 'center' }}>
        <Typography>{failure(tenants.error ?? entitlements.error, t('errors.load'))}</Typography>
      </Box>
    );
  return (
    <>
      <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1}
          sx={{ p: 2 }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Building2 size={18} />
            <Typography variant="subtitle1">{t('tenants.title')}</Typography>
            <Chip size="small" variant="outlined" label={tenants.data?.totalElements ?? 0} />
          </Stack>
          <Stack direction="row">
            <TextField
              size="small"
              label={t('tenants.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              sx={{ width: 260 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }}
            />
            <Tooltip title={t('actions.refresh')}>
              <IconButton onClick={() => void tenants.refetch()}>
                <RefreshCw size={18} />
              </IconButton>
            </Tooltip>
            <Button startIcon={<Plus size={17} />} onClick={() => setOnboardingOpen(true)}>
              {t('tenants.actions.onboard')}
            </Button>
          </Stack>
        </Stack>
        <EnterpriseDataGrid
          ariaLabel={t('tenants.title')}
          rows={tenants.data?.content ?? []}
          columns={columns}
          getRowId={(row) => row.tenantId}
          hideFooter
          minVisibleRows={4}
          maxVisibleRows={10}
          sx={{ border: 0, borderRadius: 0 }}
        />
      </Box>
      {onboardingOpen && (
        <OnboardingDialog
          open
          entitlements={entitlements.data ?? []}
          busy={busy}
          onClose={() => setOnboardingOpen(false)}
          onPreview={async (request) => {
            const result = await mutate(
              () => previewProviderOnboarding(request),
              t('onboarding.previewed')
            );
            if (result) {
              setOnboardingOpen(false);
              setSelectedOperation(result);
            }
          }}
        />
      )}
      <OperationDialog
        operation={selectedOperation}
        busy={busy}
        onClose={() => setSelectedOperation(null)}
        onExecute={async (operation) => {
          const result = await mutate(
            () => executeProviderOperation(operation),
            t('operations.executed')
          );
          if (result) setSelectedOperation(result);
        }}
      />
      {entitlementTenant && (
        <EntitlementDialog
          tenant={entitlementTenant}
          catalog={entitlements.data ?? []}
          busy={busy}
          onClose={() => setEntitlementTenant(null)}
          onSave={async (keys, justification) => {
            const result = await mutate(
              () => replaceProviderTenantEntitlements(entitlementTenant, keys, justification),
              t('entitlements.saved')
            );
            if (result) setEntitlementTenant(null);
          }}
        />
      )}
    </>
  );
}

export function ProviderOperations() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ProviderOperation | null>(null);
  const [busy, setBusy] = useState(false);
  const operations = useQuery({
    queryKey: ['provider', 'operations'],
    queryFn: listProviderOperations,
  });
  const columns = useMemo<GridColDef<ProviderOperation>[]>(
    () => [
      {
        field: 'operationId',
        headerName: t('operations.columns.operation'),
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={700}>
              {row.operationType}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.operationId}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'tenantId',
        headerName: t('operations.columns.tenant'),
        minWidth: 170,
        flex: 0.8,
        valueGetter: (_value, row) => row.tenantId || t('operations.notCreated'),
      },
      { field: 'riskTier', headerName: t('operations.columns.risk'), width: 80 },
      {
        field: 'lifecycleState',
        headerName: t('operations.columns.state'),
        width: 120,
        renderCell: ({ row }) => <StatusChip state={row.lifecycleState} />,
      },
      {
        field: 'startedAt',
        headerName: t('operations.columns.started'),
        width: 150,
        valueGetter: (_value, row) =>
          row.startedAt ? new Date(row.startedAt).toLocaleString() : t('notAvailable'),
      },
      {
        field: 'steps',
        headerName: t('operations.columns.steps'),
        width: 80,
        valueGetter: (_value, row) =>
          `${row.steps.filter((step) => step.lifecycleState === 'SUCCEEDED').length}/${row.steps.length}`,
      },
    ],
    [t]
  );
  if (operations.isLoading)
    return (
      <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
        <Typography color="text.secondary">{t('loading')}</Typography>
      </Box>
    );
  return (
    <>
      <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <ListChecks size={18} />
            <Typography variant="subtitle1">{t('operations.title')}</Typography>
            <Chip size="small" variant="outlined" label={operations.data?.totalElements ?? 0} />
          </Stack>
          <Tooltip title={t('actions.refresh')}>
            <IconButton onClick={() => void operations.refetch()}>
              <RefreshCw size={18} />
            </IconButton>
          </Tooltip>
        </Stack>
        <EnterpriseDataGrid
          ariaLabel={t('operations.title')}
          rows={operations.data?.content ?? []}
          columns={columns}
          getRowId={(row) => row.operationId}
          hideFooter
          minVisibleRows={4}
          maxVisibleRows={10}
          onRowClick={({ row }) => setSelected(row)}
          sx={{ border: 0, borderRadius: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Box>
      <OperationDialog
        operation={selected}
        busy={busy}
        onClose={() => setSelected(null)}
        onExecute={async (operation) => {
          setBusy(true);
          try {
            const result = await executeProviderOperation(operation);
            await queryClient.invalidateQueries({ queryKey: ['provider'] });
            setSelected(result);
            toast.success(t('operations.executed'));
          } catch (error) {
            toast.error(failure(error, t('errors.operation')));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
