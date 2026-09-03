import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Plus, RotateCcw, UserRoundCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  AutocompleteField,
  ConfirmDialog,
  DateTimePickerField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  createApprovalDelegation,
  getApprovalDelegations,
  getPublishedApprovalWorkflows,
  revokeApprovalDelegation,
  searchApprovalDelegationCandidates,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalSurface, StatusChip, approvalTone } from './approval-ui';
import {
  buildApprovalDelegationCreateInput,
  buildApprovalDelegationWorkflowReference,
  buildApprovalDelegationWorkflowOptions,
  isApprovalDelegationDirection,
} from './approval-delegation-model';
import { useApprovalExperience } from './use-approval-experience';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';

import type { ApprovalDelegation, ApprovalDelegationCandidate } from '@dwp-frontend/shared-utils';

export function ApprovalDelegations() {
  const { t, i18n } = useTranslation('approvals');
  const { canManageDelegations: canManage } = useApprovalExperience();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [selected, setSelected] = useState<ApprovalDelegationCandidate | null>(null);
  const [scopeType, setScopeType] = useState<'ALL' | 'WORKFLOW'>('ALL');
  const [workflowId, setWorkflowId] = useState('');
  const [reason, setReason] = useState('');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString());
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString());
  const [revoking, setRevoking] = useState<ApprovalDelegation | null>(null);
  const deferredCandidateQuery = useDeferredValue(candidateQuery.trim());
  const delegations = useQuery({
    queryKey: ['approvals', 'delegations'],
    queryFn: getApprovalDelegations,
    staleTime: 20_000,
    retry: 1,
  });
  const candidates = useQuery({
    queryKey: ['approvals', 'delegations', 'candidates', deferredCandidateQuery],
    queryFn: () => searchApprovalDelegationCandidates(deferredCandidateQuery),
    enabled: open && deferredCandidateQuery.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });
  const workflows = useQuery({
    queryKey: ['approvals', 'workflows', 'published'],
    queryFn: getPublishedApprovalWorkflows,
    enabled: open,
    staleTime: 60_000,
    retry: 1,
  });
  useEffect(() => {
    if (delegations.isError) {
      setOpen(false);
      setCandidateQuery('');
      setSelected(null);
      setScopeType('ALL');
      setWorkflowId('');
      setReason('');
    }
    if (!delegations.isFetching && !delegations.isError) return;
    setRevoking(null);
  }, [delegations.isError, delegations.isFetching]);
  const workflowOptions = useMemo(
    () => buildApprovalDelegationWorkflowOptions(workflows.data ?? [], i18n.resolvedLanguage),
    [i18n.resolvedLanguage, workflows.data]
  );
  const runCreate = useApprovalGovernedMutation('route.approvals.work.delegation-create.action');
  const runRevoke = useApprovalGovernedMutation('route.approvals.work.delegation-revoke.action');

  const closeEditor = () => {
    setOpen(false);
    setCandidateQuery('');
    setSelected(null);
    setScopeType('ALL');
    setWorkflowId('');
    setReason('');
  };
  const create = useMutation({
    mutationFn: () => {
      if (delegations.isFetching || delegations.isError || !delegations.data) {
        throw new Error('Delegation authority is not loaded.');
      }
      if (!selected) throw new Error('Delegation candidate is required.');
      const input = buildApprovalDelegationCreateInput({
        delegateUserId: selected.userId,
        scopeType,
        workflowId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        reason: reason.trim(),
      });
      if (!input) throw new Error('Delegation workflow identity is required.');
      return runCreate((execution) => createApprovalDelegation(input, execution));
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['approvals', 'delegations'], next);
      closeEditor();
      toast.success(t('delegations.created'));
    },
    onError: (error) =>
      !isProductSurfaceOperationCancelledError(error) && toast.error(t('delegations.createError')),
  });
  const revoke = useMutation({
    mutationFn: (delegation: ApprovalDelegation) => {
      const authoritative = delegations.data?.find(
        (candidate) => candidate.delegationId === delegation.delegationId
      );
      if (
        delegations.isFetching ||
        delegations.isError ||
        !authoritative ||
        authoritative.version !== delegation.version ||
        authoritative.direction !== 'OUTGOING'
      ) {
        throw new Error('Delegation authority is not current.');
      }
      return runRevoke((execution) =>
        revokeApprovalDelegation(delegation.delegationId, delegation.version, execution)
      );
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['approvals', 'delegations'], next);
      setRevoking(null);
      toast.success(t('delegations.revoked'));
    },
    onError: (error) =>
      !isProductSurfaceOperationCancelledError(error) && toast.error(t('delegations.revokeError')),
  });
  const selectedWorkflowAvailable = workflowOptions.some((option) => option.value === workflowId);
  const valid =
    selected !== null &&
    !delegations.isFetching &&
    !delegations.isError &&
    !candidates.isError &&
    reason.trim().length >= 10 &&
    new Date(endsAt) > new Date(startsAt) &&
    (scopeType === 'ALL' ||
      (!workflows.isFetching && !workflows.isError && selectedWorkflowAvailable));

  return (
    <ApprovalSurface
      title={t('delegations.title')}
      meta={t('delegations.meta')}
      action={
        canManage ? (
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<Plus size={16} />}
            disabled={delegations.isFetching || delegations.isError}
            onClick={() => setOpen(true)}
          >
            {t('delegations.add')}
          </ActionButton>
        ) : undefined
      }
    >
      {delegations.isError ? (
        <Alert
          severity="error"
          action={
            <ActionButton
              type="button"
              intent="quiet"
              size="small"
              disabled={delegations.isFetching}
              onClick={() => void delegations.refetch()}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('delegations.loadError')}
        </Alert>
      ) : (
        <>
          {(delegations.data ?? []).map((delegation) => (
            <DelegationRow
              key={delegation.delegationId}
              delegation={delegation}
              canRevoke={
                canManage &&
                !delegations.isFetching &&
                !delegations.isError &&
                delegation.direction === 'OUTGOING'
              }
              onRevoke={() => setRevoking(delegation)}
            />
          ))}
          {!delegations.isLoading && delegations.data?.length === 0 && (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CalendarClock size={34} color="#728096" />
              <Typography component="p" variant="subtitle1" sx={{ mt: 1 }}>
                {t('delegations.empty')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('delegations.emptyDescription')}
              </Typography>
            </Box>
          )}
        </>
      )}
      <FormDialog
        open={open}
        title={t('delegations.dialog.title')}
        description={t('delegations.dialog.description')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        busy={create.isPending}
        submitDisabled={!valid}
        onClose={closeEditor}
        onSubmit={() => {
          if (!valid) return;
          create.mutate();
        }}
      >
        <Stack gap={2}>
          {candidates.isError && deferredCandidateQuery.length >= 2 && (
            <Alert
              severity="error"
              action={
                <ActionButton
                  type="button"
                  intent="quiet"
                  size="small"
                  disabled={candidates.isFetching}
                  onClick={() => void candidates.refetch()}
                >
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('delegations.candidateLoadError')}
            </Alert>
          )}
          <AutocompleteField<ApprovalDelegationCandidate>
            required
            label={t('delegations.fields.delegate')}
            supportingText={t('delegations.fields.delegateHelp')}
            value={selected}
            inputValue={candidateQuery}
            options={candidates.isError ? [] : (candidates.data ?? [])}
            loading={candidates.isFetching}
            filterOptions={(options) => options}
            isOptionEqualToValue={(option, value) => option.userId === value.userId}
            getOptionLabel={(option) =>
              `${option.displayName}${option.email ? ` · ${option.email}` : ''}`
            }
            noOptionsText={
              deferredCandidateQuery.length < 2
                ? t('delegations.searchHint')
                : t('delegations.noCandidates')
            }
            onInputChange={(_event, value) => setCandidateQuery(value)}
            onChange={(_event, value) => setSelected(value)}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
            }}
          >
            <SelectField
              label={t('delegations.fields.scope')}
              value={scopeType}
              options={[
                { value: 'ALL', label: t('delegations.scopes.all') },
                { value: 'WORKFLOW', label: t('delegations.scopes.workflow') },
              ]}
              onValueChange={(value) => value && setScopeType(value as 'ALL' | 'WORKFLOW')}
            />
            {scopeType === 'WORKFLOW' ? (
              <Stack gap={1}>
                {workflows.isError && (
                  <Alert
                    severity="error"
                    action={
                      <ActionButton
                        type="button"
                        intent="quiet"
                        size="small"
                        disabled={workflows.isFetching}
                        onClick={() => void workflows.refetch()}
                      >
                        {t('actions.retry')}
                      </ActionButton>
                    }
                  >
                    {t('delegations.workflowLoadError')}
                  </Alert>
                )}
                <SelectField
                  required
                  label={t('delegations.fields.workflow')}
                  value={workflowId}
                  options={workflows.isError ? [] : workflowOptions}
                  onValueChange={(value) => setWorkflowId(value ?? '')}
                />
              </Stack>
            ) : (
              <Box />
            )}
            <DateTimePickerField
              required
              label={t('delegations.fields.startsAt')}
              value={startsAt || null}
              onValueChange={(value) => setStartsAt(value ?? '')}
            />
            <DateTimePickerField
              required
              label={t('delegations.fields.endsAt')}
              value={endsAt || null}
              onValueChange={(value) => setEndsAt(value ?? '')}
            />
          </Box>
          <FormField
            required
            multiline
            minRows={3}
            label={t('delegations.fields.reason')}
            supportingText={t('delegations.fields.reasonHelp')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Stack>
      </FormDialog>
      <ConfirmDialog
        open={Boolean(revoking)}
        title={t('delegations.revoke.title')}
        description={t('delegations.revoke.description', {
          name: revoking?.delegateDisplayName ?? '',
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('delegations.revoke.confirm')}
        intent="danger"
        busy={revoke.isPending}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          if (revoking) revoke.mutate(revoking);
        }}
      />
    </ApprovalSurface>
  );
}

function DelegationRow({
  delegation,
  canRevoke,
  onRevoke,
}: {
  delegation: ApprovalDelegation;
  canRevoke: boolean;
  onRevoke: () => void;
}) {
  const { t } = useTranslation('approvals');
  const direction = isApprovalDelegationDirection(delegation.direction)
    ? delegation.direction
    : null;
  const incoming = direction === 'INCOMING';
  const workflowReference = buildApprovalDelegationWorkflowReference(delegation);
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent="space-between"
      gap={1.5}
      sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
    >
      <Stack direction="row" gap={1.25} minWidth={0}>
        <Box
          sx={{
            width: 36,
            height: 36,
            flex: '0 0 36px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            color: incoming ? approvalTone.primary : approvalTone.teal,
            bgcolor: incoming ? 'rgba(40,86,199,0.1)' : 'rgba(8,126,114,0.1)',
          }}
        >
          <UserRoundCheck size={18} />
        </Box>
        <Box minWidth={0}>
          <Stack direction="row" gap={0.75} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="body2" fontWeight={760}>
              {incoming
                ? t('delegations.receivedFrom', { userId: delegation.delegatorUserId })
                : delegation.delegateDisplayName}
            </Typography>
            {direction ? (
              <Chip
                size="small"
                variant="outlined"
                label={t(`delegations.directions.${direction.toLowerCase()}`)}
              />
            ) : null}
            <StatusChip status={delegation.lifecycleState} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {delegation.delegateEmail ? `${delegation.delegateEmail} · ` : ''}
            {formatDate(delegation.startsAt)} - {formatDate(delegation.endsAt)}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.35 }}>
            {delegation.reason}
          </Typography>
          <Stack direction="row" gap={0.75} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              {delegation.scopeType === 'ALL'
                ? t('delegations.scopes.all')
                : workflowReference.displayKey
                  ? t('delegations.scopeWorkflow', { key: workflowReference.displayKey })
                  : t('delegations.scopeWorkflowUnavailable')}
            </Typography>
            {delegation.scopeType === 'WORKFLOW' && workflowReference.workflowId ? (
              <Chip
                size="small"
                variant="outlined"
                label={`ID ${workflowReference.compactWorkflowId}`}
                title={workflowReference.workflowId}
                aria-label={t('delegations.workflowIdentity', {
                  id: workflowReference.workflowId,
                })}
              />
            ) : null}
          </Stack>
        </Box>
      </Stack>
      {canRevoke && delegation.lifecycleState === 'ACTIVE' ? (
        <>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          <ActionButton
            intent="danger"
            size="small"
            startIcon={<RotateCcw size={15} />}
            onClick={onRevoke}
          >
            {t('delegations.revoke.confirm')}
          </ActionButton>
        </>
      ) : null}
    </Stack>
  );
}
