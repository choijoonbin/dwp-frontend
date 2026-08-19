import { useDeferredValue, useMemo, useState } from 'react';
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
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalSurface, StatusChip, approvalTone } from './approval-ui';

import type { ApprovalDelegation, ApprovalDelegationCandidate } from '@dwp-frontend/shared-utils';

export function ApprovalDelegations() {
  const { t, i18n } = useTranslation('approvals');
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [selected, setSelected] = useState<ApprovalDelegationCandidate | null>(null);
  const [scopeType, setScopeType] = useState<'ALL' | 'WORKFLOW'>('ALL');
  const [workflowKey, setWorkflowKey] = useState('');
  const [reason, setReason] = useState('');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString());
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString());
  const [revoking, setRevoking] = useState<ApprovalDelegation | null>(null);
  const deferredCandidateQuery = useDeferredValue(candidateQuery.trim());
  const canManage = hasPermission('ACTION.APPROVAL_DELEGATION', 'MANAGE');
  const delegations = useQuery({
    queryKey: ['approvals', 'delegations'],
    queryFn: getApprovalDelegations,
    staleTime: 20_000,
  });
  const candidates = useQuery({
    queryKey: ['approvals', 'delegations', 'candidates', deferredCandidateQuery],
    queryFn: () => searchApprovalDelegationCandidates(deferredCandidateQuery),
    enabled: open && deferredCandidateQuery.length >= 2,
    staleTime: 30_000,
  });
  const workflows = useQuery({
    queryKey: ['approvals', 'workflows', 'published'],
    queryFn: getPublishedApprovalWorkflows,
    enabled: open,
    staleTime: 60_000,
  });
  const workflowOptions = useMemo(
    () =>
      (workflows.data ?? []).map((workflow) => ({
        value: workflow.workflowKey,
        label: i18n.resolvedLanguage?.startsWith('ko') ? workflow.nameKo : workflow.nameEn,
      })),
    [i18n.resolvedLanguage, workflows.data]
  );

  const closeEditor = () => {
    setOpen(false);
    setCandidateQuery('');
    setSelected(null);
    setScopeType('ALL');
    setWorkflowKey('');
    setReason('');
  };
  const create = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Delegation candidate is required.');
      return createApprovalDelegation({
        delegateUserId: selected.userId,
        scopeType,
        workflowKey: scopeType === 'WORKFLOW' ? workflowKey : undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        reason: reason.trim(),
      });
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['approvals', 'delegations'], next);
      closeEditor();
      toast.success(t('delegations.created'));
    },
    onError: () => toast.error(t('delegations.createError')),
  });
  const revoke = useMutation({
    mutationFn: (delegation: ApprovalDelegation) =>
      revokeApprovalDelegation(delegation.delegationId, delegation.version),
    onSuccess: (next) => {
      queryClient.setQueryData(['approvals', 'delegations'], next);
      setRevoking(null);
      toast.success(t('delegations.revoked'));
    },
    onError: () => toast.error(t('delegations.revokeError')),
  });
  const valid =
    selected !== null &&
    reason.trim().length >= 10 &&
    new Date(endsAt) > new Date(startsAt) &&
    (scopeType === 'ALL' || Boolean(workflowKey));

  return (
    <ApprovalSurface
      title={t('delegations.title')}
      meta={t('delegations.meta')}
      action={
        canManage ? (
          <ActionButton
            intent="primary"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={() => setOpen(true)}
          >
            {t('delegations.add')}
          </ActionButton>
        ) : undefined
      }
    >
      {(delegations.data ?? []).map((delegation) => (
        <DelegationRow
          key={delegation.delegationId}
          delegation={delegation}
          canRevoke={canManage && delegation.direction === 'OUTGOING'}
          onRevoke={() => setRevoking(delegation)}
        />
      ))}
      {!delegations.isLoading && delegations.data?.length === 0 && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CalendarClock size={34} color="#728096" />
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            {t('delegations.empty')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('delegations.emptyDescription')}
          </Typography>
        </Box>
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
        onSubmit={() => create.mutate()}
      >
        <Stack gap={2}>
          <AutocompleteField<ApprovalDelegationCandidate>
            required
            label={t('delegations.fields.delegate')}
            supportingText={t('delegations.fields.delegateHelp')}
            value={selected}
            inputValue={candidateQuery}
            options={candidates.data ?? []}
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
              <SelectField
                required
                label={t('delegations.fields.workflow')}
                value={workflowKey}
                options={workflowOptions}
                onValueChange={(value) => setWorkflowKey(value ?? '')}
              />
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
  const incoming = delegation.direction === 'INCOMING';
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
            <Chip
              size="small"
              variant="outlined"
              label={t(`delegations.directions.${delegation.direction.toLowerCase()}`)}
            />
            <StatusChip status={delegation.lifecycleState} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {delegation.delegateEmail ? `${delegation.delegateEmail} · ` : ''}
            {formatDate(delegation.startsAt)} - {formatDate(delegation.endsAt)}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.35 }}>
            {delegation.reason}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {delegation.scopeType === 'ALL'
              ? t('delegations.scopes.all')
              : t('delegations.scopeWorkflow', { key: delegation.workflowKey })}
          </Typography>
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
