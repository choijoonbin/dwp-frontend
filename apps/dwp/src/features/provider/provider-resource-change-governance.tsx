import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileCheck2, RefreshCw, Send, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decideProviderResourceCommitmentChange,
  getProviderOperatorProfile,
  listProviderResourceCommitmentChanges,
  publishProviderResourceCommitmentChange,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, EmptyState, FormDialog, FormField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderResourceCommitmentChange } from '@dwp-frontend/shared-utils';

import { formatProviderDate, ProviderSectionHeading, ProviderStatusChip } from './provider-ui';
import { canDecideResourceChange } from './provider-governance-action-model';
import {
  providerCommitmentLifecycleLabel,
  providerResourceChangeKindLabel,
  providerResourceControlModeLabel,
  providerResourceUnitLabel,
} from './provider-resource-presentation';

type DialogState =
  | {
      kind: 'decision';
      change: ProviderResourceCommitmentChange;
      decision: 'APPROVED' | 'REJECTED';
    }
  | { kind: 'publish'; change: ProviderResourceCommitmentChange };

function ChangeReasonDialog({
  dialog,
  busy,
  onClose,
  onSubmit,
}: {
  dialog: DialogState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<unknown>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open
      title={
        dialog.kind === 'publish'
          ? t('resourceGovernance.changes.publishTitle')
          : t(`resourceGovernance.changes.decision.${dialog.decision}.title`)
      }
      cancelLabel={t('actions.cancel')}
      submitLabel={t('resourceGovernance.changes.confirmAction')}
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
        <Alert severity={dialog.kind === 'publish' ? 'warning' : 'info'}>
          {dialog.kind === 'publish'
            ? t('resourceGovernance.changes.publishGuidance')
            : t('resourceGovernance.changes.decisionGuidance')}
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

function DefinitionSummary({ change }: { change: ProviderResourceCommitmentChange }) {
  const { t } = useTranslation('provider');
  const base = change.baseline;
  const proposed = change.proposed;
  const facts = [
    {
      label: t('resourceGovernance.fields.unit'),
      before: base ? providerResourceUnitLabel(t, base.unit) : null,
      after: providerResourceUnitLabel(t, proposed.unit),
    },
    {
      label: t('resourceGovernance.fields.quotaLimit'),
      before: base?.quotaLimit,
      after: proposed.quotaLimit,
    },
    {
      label: t('resourceGovernance.fields.budgetLimit'),
      before: base?.budgetLimit,
      after: proposed.budgetLimit,
    },
    {
      label: t('resourceGovernance.fields.currency'),
      before: base?.currencyCode,
      after: proposed.currencyCode,
    },
    {
      label: t('resourceGovernance.fields.controlPeriodStartsAt'),
      before: base ? formatProviderDate(base.controlPeriodStartsAt) : null,
      after: formatProviderDate(proposed.controlPeriodStartsAt),
    },
    {
      label: t('resourceGovernance.fields.controlPeriodEndsAt'),
      before: base ? formatProviderDate(base.controlPeriodEndsAt) : null,
      after: formatProviderDate(proposed.controlPeriodEndsAt),
    },
    {
      label: t('resourceGovernance.fields.controlMode'),
      before: base ? providerResourceControlModeLabel(t, base.controlMode) : null,
      after: providerResourceControlModeLabel(t, proposed.controlMode),
    },
    {
      label: t('resourceGovernance.fields.lifecycle'),
      before: base ? providerCommitmentLifecycleLabel(t, base.lifecycleState) : null,
      after: providerCommitmentLifecycleLabel(t, proposed.lifecycleState),
    },
  ];
  return (
    <Stack gap={1}>
      {!base && (
        <Alert severity="info" icon={false} sx={{ py: 0.25 }}>
          {t('resourceGovernance.changes.newBaseline')}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {facts.map((fact) => {
          const before = fact.before ?? t('notAvailable');
          const after = fact.after ?? t('notAvailable');
          const changed = String(before) !== String(after);
          return (
            <Box
              key={fact.label}
              sx={{
                bgcolor: 'action.hover',
                borderRadius: 1,
                border: 1,
                borderColor: changed ? 'warning.main' : 'divider',
                p: 1,
              }}
            >
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography variant="caption" color="text.secondary">
                  {fact.label}
                </Typography>
                {changed && (
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label={t('resourceGovernance.changes.changed')}
                  />
                )}
              </Stack>
              <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>
                {before} → {after}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}

export function ProviderResourceChangeGovernance() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const changes = useQuery({
    queryKey: ['provider', 'resource-governance', 'changes'],
    queryFn: () => listProviderResourceCommitmentChanges(),
  });
  const mutation = useMutation({
    mutationFn: async (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider', 'resource-governance'] });
      setDialog(null);
      toast.success(t('resourceGovernance.completed'));
    },
    onError: () => toast.error(t('errors.operation')),
  });
  const canWrite = operator.data?.permissions.includes('RESOURCE_GOVERNANCE_WRITE') ?? false;
  const canApprove = operator.data?.permissions.includes('RESOURCE_GOVERNANCE_APPROVE') ?? false;
  const rows = changes.data?.items ?? [];
  const changesPartial = changes.data?.hasMore ?? false;

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2 }}>
      <ProviderSectionHeading
        title={t('resourceGovernance.changes.title')}
        description={t('resourceGovernance.changes.description')}
        action={
          <Chip
            size="small"
            variant="outlined"
            color="warning"
            label={t('resourceGovernance.changes.reservationUnavailable')}
          />
        }
      />
      {operator.isError && (
        <Alert
          severity="warning"
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
      {changesPartial && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t('resourceGovernance.changes.listPartial', {
            count: rows.length,
            limit: changes.data?.limit ?? rows.length,
          })}
        </Alert>
      )}
      {changes.isLoading ? (
        <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 2 }}>
          <RefreshCw size={16} aria-hidden="true" />
          <Typography variant="body2" color="text.secondary">
            {t('resourceGovernance.changes.loading')}
          </Typography>
        </Stack>
      ) : changes.isError ? (
        <Alert
          severity="error"
          sx={{ mt: 1.5 }}
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void changes.refetch()}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('resourceGovernance.changes.loadError')}
        </Alert>
      ) : rows.length ? (
        <Stack divider={<Divider flexItem />} sx={{ mt: 1.5 }}>
          {rows.map((change) => {
            const selfApproval = operator.data?.operatorId === change.requestedBy;
            const decisionAllowed = canDecideResourceChange({
              canApprove,
              operatorId: operator.data?.operatorId,
              requestedBy: change.requestedBy,
            });
            return (
              <Box key={change.changeRequestId} sx={{ py: 1.5 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  gap={1.5}
                >
                  <Box minWidth={0} flex={1}>
                    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                      <Typography variant="subtitle2">
                        {change.tenantDisplayName} · {change.resourceKey}
                      </Typography>
                      <ProviderStatusChip state={change.lifecycleState} />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={providerResourceChangeKindLabel(t, change.changeKind)}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {change.justification} ·{' '}
                      {t('resourceGovernance.changes.reviewDue', {
                        date: formatProviderDate(change.decisionDueAt),
                      })}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <DefinitionSummary change={change} />
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ mt: 1 }}
                    >
                      {change.changeKind === 'CONTRACT_CHANGE'
                        ? t('resourceGovernance.changes.commercialEvidence', {
                            id: change.commercialRenewalRevisionId,
                          })
                        : t('resourceGovernance.changes.overrideExpiry', {
                            date: formatProviderDate(change.overrideExpiresAt),
                          })}
                    </Typography>
                    {canApprove && selfApproval && change.lifecycleState === 'PENDING_APPROVAL' && (
                      <Alert severity="info" icon={false} sx={{ mt: 1, py: 0.25 }}>
                        {t('resourceGovernance.changes.selfApprovalBlocked')}
                      </Alert>
                    )}
                  </Box>
                  <Stack direction="row" gap={1} flexWrap="wrap" alignContent="flex-start">
                    {decisionAllowed && change.lifecycleState === 'PENDING_APPROVAL' && (
                      <ActionButton
                        intent="primary"
                        startIcon={<CheckCircle2 size={16} />}
                        onClick={() =>
                          setDialog({ kind: 'decision', change, decision: 'APPROVED' })
                        }
                      >
                        {t('resourceGovernance.changes.approveAction')}
                      </ActionButton>
                    )}
                    {decisionAllowed && change.lifecycleState === 'PENDING_APPROVAL' && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<XCircle size={16} />}
                        onClick={() =>
                          setDialog({ kind: 'decision', change, decision: 'REJECTED' })
                        }
                      >
                        {t('resourceGovernance.changes.rejectAction')}
                      </ActionButton>
                    )}
                    {canWrite && change.lifecycleState === 'APPROVED' && (
                      <ActionButton
                        intent="primary"
                        startIcon={<Send size={16} />}
                        onClick={() => setDialog({ kind: 'publish', change })}
                      >
                        {t('resourceGovernance.changes.publishAction')}
                      </ActionButton>
                    )}
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      ) : !changesPartial ? (
        <Box sx={{ mt: 1.5 }}>
          <EmptyState
            icon={<FileCheck2 size={22} />}
            title={t('resourceGovernance.changes.emptyTitle')}
            description={t('resourceGovernance.changes.emptyDescription')}
          />
        </Box>
      ) : null}
      {dialog && (
        <ChangeReasonDialog
          dialog={dialog}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(reason) =>
            dialog.kind === 'publish'
              ? mutation.mutateAsync(() =>
                  publishProviderResourceCommitmentChange(dialog.change, reason)
                )
              : mutation.mutateAsync(() =>
                  decideProviderResourceCommitmentChange(dialog.change, {
                    decision: dialog.decision,
                    reason,
                  })
                )
          }
        />
      )}
    </Paper>
  );
}
