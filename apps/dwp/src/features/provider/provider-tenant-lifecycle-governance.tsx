import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArchiveRestore, Plus, RefreshCw, Send, ShieldCheck, ShieldX } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProviderTenantLifecycleRequest,
  decideProviderTenantLifecycleRequest,
  getProviderOperatorProfile,
  listAllProviderTenants,
  listProviderTenantLifecycleRequests,
  refreshProviderTenantLifecycleHold,
  submitProviderTenantLifecycleRequest,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderTenantLifecycleRequest } from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';
import {
  canDecideTenantLifecycle,
  tenantExecutionPresentationState,
} from './provider-governance-action-model';
import {
  providerTenantHoldStateLabel,
  providerTenantLifecycleActionLabel,
} from './provider-resource-presentation';

type DialogState =
  | { kind: 'create' }
  | { kind: 'refresh'; request: ProviderTenantLifecycleRequest }
  | { kind: 'submit'; request: ProviderTenantLifecycleRequest }
  | {
      kind: 'decision';
      request: ProviderTenantLifecycleRequest;
      decision: 'APPROVED' | 'REJECTED';
    };

function LifecycleCreateDialog({
  tenants,
  busy,
  onClose,
  onSubmit,
}: {
  tenants: Array<{ tenantId: string; tenantKey: string; displayName: string }>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (
    tenantId: string,
    action: 'RETIRE' | 'PURGE',
    justification: string
  ) => Promise<unknown>;
}) {
  const { t } = useTranslation('provider');
  const [tenantId, setTenantId] = useState(tenants[0]?.tenantId ?? '');
  const [action, setAction] = useState<'RETIRE' | 'PURGE'>('RETIRE');
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open
      title={t('resourceGovernance.lifecycle.createTitle')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('resourceGovernance.lifecycle.createAction')}
      busy={busy}
      submitDisabled={!tenantId || !justification.trim()}
      onClose={onClose}
      onSubmit={async () => {
        try {
          await onSubmit(tenantId, action, justification.trim());
        } catch {
          setError(t('errors.operation'));
        }
      }}
    >
      <Stack gap={2}>
        <Alert severity="warning">{t('resourceGovernance.lifecycle.createGuidance')}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <SelectField
          required
          label={t('resourceGovernance.fields.tenant')}
          value={tenantId}
          options={tenants.map((tenant) => ({
            value: tenant.tenantId,
            label: `${tenant.displayName} · ${tenant.tenantKey}`,
          }))}
          onValueChange={setTenantId}
        />
        <SelectField
          label={t('resourceGovernance.lifecycle.requestedAction')}
          value={action}
          options={(['RETIRE', 'PURGE'] as const).map((value) => ({
            value,
            label: t(`resourceGovernance.lifecycle.actions.${value}`),
          }))}
          onValueChange={(value) => setAction(value as 'RETIRE' | 'PURGE')}
        />
        <FormField
          required
          multiline
          minRows={4}
          label={t('resourceGovernance.lifecycle.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function LifecycleReasonDialog({
  dialog,
  busy,
  onClose,
  onSubmit,
}: {
  dialog: Exclude<DialogState, { kind: 'create' }>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<unknown>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const title =
    dialog.kind === 'decision'
      ? t(`resourceGovernance.lifecycle.decision.${dialog.decision}.title`)
      : t(`resourceGovernance.lifecycle.${dialog.kind}Title`);
  return (
    <FormDialog
      open
      title={title}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('resourceGovernance.lifecycle.confirmAction')}
      busy={busy}
      submitDisabled={!reason.trim()}
      onClose={onClose}
      onSubmit={async () => {
        try {
          await onSubmit(reason.trim());
        } catch {
          setError(t('errors.operation'));
        }
      }}
    >
      <Stack gap={2}>
        <Alert
          severity={
            dialog.kind === 'decision' && dialog.decision === 'REJECTED' ? 'warning' : 'info'
          }
        >
          {t('resourceGovernance.lifecycle.transitionGuidance')}
        </Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <FormField
          required
          multiline
          minRows={4}
          label={t('resourceGovernance.fields.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

export function ProviderTenantLifecycleGovernance() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const canReadEstate = operator.data?.permissions.includes('ESTATE_READ') ?? false;
  const canWrite = operator.data?.permissions.includes('RESOURCE_GOVERNANCE_WRITE') ?? false;
  const canApprove =
    operator.data?.permissions.includes('TENANT_LIFECYCLE_GOVERNANCE_APPROVE') ?? false;
  const lifecycle = useQuery({
    queryKey: ['provider', 'resource-governance', 'lifecycle-requests'],
    queryFn: () => listProviderTenantLifecycleRequests(),
    enabled: canReadEstate,
  });
  const tenants = useQuery({
    queryKey: ['provider', 'tenants', 'resource-governance'],
    queryFn: listAllProviderTenants,
    enabled: canReadEstate && canWrite,
  });
  const mutation = useMutation({
    mutationFn: async (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider', 'resource-governance'] });
      setDialog(null);
      toast.success(t('resourceGovernance.lifecycle.completed'));
    },
    onError: () => toast.error(t('errors.operation')),
  });
  const rows = lifecycle.data ?? [];
  const tenantOptions = (tenants.data?.content ?? []).map((tenant) => ({
    tenantId: tenant.tenantId,
    tenantKey: tenant.tenantKey,
    displayName: tenant.displayName,
  }));
  const tenantCatalogReady = tenants.isSuccess;

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <ProviderSectionHeading
        title={t('resourceGovernance.lifecycle.title')}
        description={t('resourceGovernance.lifecycle.description')}
        action={
          canReadEstate && canWrite ? (
            <ActionButton
              intent="secondary"
              startIcon={<Plus size={16} />}
              disabled={!tenantCatalogReady}
              onClick={() => setDialog({ kind: 'create' })}
            >
              {t('resourceGovernance.lifecycle.createAction')}
            </ActionButton>
          ) : undefined
        }
      />
      <Alert severity="warning" sx={{ mt: 1.5 }}>
        {t('resourceGovernance.lifecycle.executionBoundary')}
      </Alert>
      {operator.isError && (
        <Alert
          severity="error"
          sx={{ mt: 1.5 }}
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void operator.refetch()}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('resourceGovernance.operatorUnavailable')}
        </Alert>
      )}
      {canReadEstate && canWrite && tenants.isError && (
        <Alert
          severity="warning"
          sx={{ mt: 1.5 }}
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void tenants.refetch()}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('resourceGovernance.lifecycle.tenantCatalogUnavailable')}
        </Alert>
      )}
      {operator.isLoading ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('resourceGovernance.operatorLoading')}
        </Typography>
      ) : operator.isError ? null : !canReadEstate ? (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {t('resourceGovernance.lifecycle.readBoundary')}
        </Alert>
      ) : lifecycle.isLoading ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('loading')}
        </Typography>
      ) : lifecycle.isError ? (
        <Alert
          severity="error"
          sx={{ mt: 1.5 }}
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void lifecycle.refetch()}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {providerError(lifecycle.error, t('errors.operation'))}
        </Alert>
      ) : rows.length ? (
        <Stack divider={<Divider flexItem />} sx={{ mt: 1.5 }}>
          {rows.map((request) => {
            const actorIsRequesterOrSubmitter =
              operator.data?.operatorId === request.requestedBy ||
              operator.data?.operatorId === request.submittedBy;
            const decisionAllowed = canDecideTenantLifecycle({
              canApprove,
              operatorId: operator.data?.operatorId,
              requestedBy: request.requestedBy,
              submittedBy: request.submittedBy,
            });
            return (
              <Box key={request.lifecycleRequestId} sx={{ py: 1.5 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  gap={1.5}
                >
                  <Box minWidth={0}>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" fontWeight={750}>
                        {request.tenantDisplayName} ·{' '}
                        {providerTenantLifecycleActionLabel(t, request.requestedAction)}
                      </Typography>
                      <ProviderStatusChip state={request.lifecycleState} />
                      <Chip
                        size="small"
                        variant="outlined"
                        color={
                          request.holdEvaluationState === 'ACTIVE_GLOBAL_LEGAL_HOLD'
                            ? 'error'
                            : 'warning'
                        }
                        label={providerTenantHoldStateLabel(t, request.holdEvaluationState)}
                      />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ mt: 0.5 }}
                    >
                      {request.justification} · {formatProviderDate(request.updatedAt)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('resourceGovernance.lifecycle.ownerHandoff')} ·{' '}
                      {t(
                        `resourceGovernance.lifecycle.executionStates.${tenantExecutionPresentationState(request.executionState)}`
                      )}
                    </Typography>
                    {!!request.holdEvidenceRefs.length && (
                      <Typography
                        variant="caption"
                        color="error.main"
                        display="block"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {request.holdEvidenceRefs.join(' · ')}
                      </Typography>
                    )}
                    {canApprove &&
                      actorIsRequesterOrSubmitter &&
                      request.lifecycleState === 'PENDING_APPROVAL' && (
                        <Alert severity="info" icon={false} sx={{ mt: 1, py: 0.25 }}>
                          {t('resourceGovernance.lifecycle.selfDecisionBlocked')}
                        </Alert>
                      )}
                  </Box>
                  <Stack direction="row" gap={1} alignItems="flex-start" flexWrap="wrap">
                    {canWrite && ['DRAFT', 'BLOCKED_BY_HOLD'].includes(request.lifecycleState) && (
                      <ActionButton
                        intent="quiet"
                        startIcon={<RefreshCw size={16} />}
                        onClick={() => setDialog({ kind: 'refresh', request })}
                      >
                        {t('resourceGovernance.lifecycle.refreshAction')}
                      </ActionButton>
                    )}
                    {canWrite && request.lifecycleState === 'DRAFT' && (
                      <ActionButton
                        intent="primary"
                        startIcon={<Send size={16} />}
                        onClick={() => setDialog({ kind: 'submit', request })}
                      >
                        {t('resourceGovernance.lifecycle.submitAction')}
                      </ActionButton>
                    )}
                    {decisionAllowed && request.lifecycleState === 'PENDING_APPROVAL' && (
                      <ActionButton
                        intent="primary"
                        startIcon={<ShieldCheck size={16} />}
                        onClick={() =>
                          setDialog({ kind: 'decision', request, decision: 'APPROVED' })
                        }
                      >
                        {t('resourceGovernance.lifecycle.approveAction')}
                      </ActionButton>
                    )}
                    {decisionAllowed && request.lifecycleState === 'PENDING_APPROVAL' && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<ShieldX size={16} />}
                        onClick={() =>
                          setDialog({ kind: 'decision', request, decision: 'REJECTED' })
                        }
                      >
                        {t('resourceGovernance.lifecycle.rejectAction')}
                      </ActionButton>
                    )}
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <EmptyState
          icon={<ArchiveRestore size={22} />}
          title={t('resourceGovernance.lifecycle.emptyTitle')}
          description={t('resourceGovernance.lifecycle.emptyDescription')}
        />
      )}
      {dialog?.kind === 'create' && tenantCatalogReady && (
        <LifecycleCreateDialog
          tenants={tenantOptions}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(tenantId, requestedAction, justification) =>
            mutation.mutateAsync(() =>
              createProviderTenantLifecycleRequest(tenantId, {
                requestedAction,
                justification,
              })
            )
          }
        />
      )}
      {dialog && dialog.kind !== 'create' && (
        <LifecycleReasonDialog
          dialog={dialog}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(reason) => {
            if (dialog.kind === 'refresh') {
              return mutation.mutateAsync(() =>
                refreshProviderTenantLifecycleHold(dialog.request, reason)
              );
            }
            if (dialog.kind === 'submit') {
              return mutation.mutateAsync(() =>
                submitProviderTenantLifecycleRequest(dialog.request, reason)
              );
            }
            return mutation.mutateAsync(() =>
              decideProviderTenantLifecycleRequest(dialog.request, {
                decision: dialog.decision,
                reason,
              })
            );
          }}
        />
      )}
    </Paper>
  );
}
