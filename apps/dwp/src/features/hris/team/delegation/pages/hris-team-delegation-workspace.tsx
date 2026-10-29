import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, RefreshCw, UserRoundX } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  FormField,
  InlineFeedback,
  LoadingState,
  LocalDateTimePickerField,
} from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { hrisDelegationDataSource } from '../api/hris-delegation-adapter';
import {
  approvalAdapterScopeIdentity,
  delegationManageAdmitted,
  delegationReadAdmitted,
  HRIS_APPROVAL_ADAPTER_FEATURE,
  HRIS_APPROVAL_SHARED_API_CONTRACTS,
  mergeHrisApprovalQueryState,
  parseHrisApprovalQueryState,
  runWithTrustedApprovalMutationExecution,
} from '../../../administration/workflow/model/hris-approval-adapter-contract';

import type { ApprovalDelegation, ApprovalDelegationCreateInput } from '@dwp-frontend/shared-utils';
import type { HrisDelegationDataSource } from '../api/hris-delegation-adapter';
import type {
  HrisApprovalAdapterAdmission,
  HrisApprovalCommandRunner,
} from '../../../administration/workflow/model/hris-approval-adapter-contract';

export const HRIS_TEAM_DELEGATION_RUNTIME_STATE = 'OFF' as const;

export type HrisTeamDelegationWorkspaceProps = Readonly<{
  admission?: HrisApprovalAdapterAdmission;
  dataSource?: HrisDelegationDataSource;
  commandRunner?: HrisApprovalCommandRunner;
}>;

type CreateDraft = Readonly<{
  delegateUserId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}>;

const EMPTY_DRAFT: CreateDraft = Object.freeze({
  delegateUserId: '',
  startsAt: '',
  endsAt: '',
  reason: '',
});

function currentSearch(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}

function replaceFocus(focus: string | null) {
  const search = mergeHrisApprovalQueryState(currentSearch(), { focus });
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}?${search.toString()}${window.location.hash}`
  );
}

function denied(error: unknown): boolean {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}

function DisabledDelegation({ invalid }: Readonly<{ invalid: boolean }>) {
  const { t } = useTranslation('workforce');
  return (
    <Stack
      data-testid="hris-team-delegation-workspace"
      data-runtime-state={HRIS_TEAM_DELEGATION_RUNTIME_STATE}
      data-feature={HRIS_APPROVAL_ADAPTER_FEATURE}
      gap={2}
      sx={{ minWidth: 0 }}
    >
      <InlineFeedback
        severity={invalid ? 'error' : 'info'}
        title={invalid ? 'Delegation access is unavailable' : 'Team delegation is off'}
      >
        {invalid
          ? 'The HCM team page and Approval read evidence no longer match the same tenant, actor, population scope or authority revision. No Approval owner request was started.'
          : 'This default-off HRIS adapter is not enrolled for the tenant. No Approval delegation request was started.'}
      </InlineFeedback>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
          {t('governedPeople.delegation.header.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
          {t('governedPeople.delegation.disabled.description')}
        </Typography>
      </Paper>
    </Stack>
  );
}

function iso(value: string): string | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function validDraft(draft: CreateDraft): ApprovalDelegationCreateInput | null {
  const delegateUserId = Number(draft.delegateUserId);
  const startsAt = iso(draft.startsAt);
  const endsAt = iso(draft.endsAt);
  if (
    !Number.isSafeInteger(delegateUserId) ||
    delegateUserId < 1 ||
    !startsAt ||
    !endsAt ||
    Date.parse(startsAt) >= Date.parse(endsAt) ||
    draft.reason.trim().length < 3
  ) {
    return null;
  }
  return {
    delegateUserId,
    scopeType: 'ALL',
    startsAt,
    endsAt,
    reason: draft.reason.trim(),
  };
}

function ActiveDelegation({
  admission,
  dataSource,
  commandRunner,
}: Readonly<{
  admission: HrisApprovalAdapterAdmission;
  dataSource: HrisDelegationDataSource;
  commandRunner?: HrisApprovalCommandRunner;
}>) {
  const { t } = useTranslation('workforce');
  const queryClient = useQueryClient();
  const scopeIdentity = approvalAdapterScopeIdentity(admission);
  const authorityRef = useRef({ admission, scopeIdentity });
  authorityRef.current = { admission, scopeIdentity };
  const initialQueryState = useMemo(() => parseHrisApprovalQueryState(currentSearch()), []);
  const [selectedId, setSelectedId] = useState<string | null>(initialQueryState.focus);
  const [draft, setDraft] = useState<CreateDraft>(EMPTY_DRAFT);
  const [showCreate, setShowCreate] = useState(false);
  const [ownerOutcome, setOwnerOutcome] = useState<string | null>(null);
  const queryKey = ['hris', 'approval-adapter', 'delegations', scopeIdentity] as const;
  const delegations = useQuery({
    queryKey,
    queryFn: ({ signal }) => dataSource.list(admission.ownerContextScopeKey, signal),
    staleTime: 20_000,
    retry: false,
  });
  const rows = useMemo(() => delegations.data ?? [], [delegations.data]);
  const selected = rows.find((item) => item.delegationId === selectedId) ?? null;

  useEffect(() => {
    if (!delegations.isSuccess) return;
    const next = rows.find((item) => item.delegationId === selectedId)?.delegationId ?? null;
    if (next) return;
    const fallback = rows[0]?.delegationId ?? null;
    setSelectedId(fallback);
    replaceFocus(fallback);
    setOwnerOutcome(null);
  }, [delegations.isSuccess, rows, selectedId]);

  const canManage = delegationManageAdmitted(admission) && Boolean(commandRunner);
  const create = useMutation({
    mutationFn: async (input: ApprovalDelegationCreateInput) => {
      const latest = authorityRef.current;
      if (
        !commandRunner ||
        latest.scopeIdentity !== scopeIdentity ||
        !delegationManageAdmitted(latest.admission) ||
        queryClient.getQueryState(queryKey)?.status !== 'success'
      ) {
        throw new HttpError('Delegation authority is stale.', 409);
      }
      return commandRunner({
        routeContractKey: HRIS_APPROVAL_SHARED_API_CONTRACTS.delegationCreate.routeContractKey,
        expectedDecisionRevision: admission.pageDecisionRevision,
        run: (execution) =>
          runWithTrustedApprovalMutationExecution(admission, execution, (trustedExecution) =>
            dataSource.create(input, trustedExecution)
          ),
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      void queryClient.invalidateQueries({ queryKey, exact: true });
      setDraft(EMPTY_DRAFT);
      setShowCreate(false);
      setOwnerOutcome('The Approval owner confirmed the delegation create command.');
    },
  });
  const revoke = useMutation({
    mutationFn: async (snapshot: Readonly<{ delegationId: string; version: number }>) => {
      const current = queryClient
        .getQueryData<ApprovalDelegation[]>(queryKey)
        ?.find((item) => item.delegationId === snapshot.delegationId);
      const latest = authorityRef.current;
      if (
        !commandRunner ||
        latest.scopeIdentity !== scopeIdentity ||
        !delegationManageAdmitted(latest.admission) ||
        !current ||
        current.version !== snapshot.version ||
        current.lifecycleState !== 'ACTIVE'
      ) {
        throw new HttpError('Delegation authority is stale.', 409);
      }
      return commandRunner({
        routeContractKey: HRIS_APPROVAL_SHARED_API_CONTRACTS.delegationRevoke.routeContractKey,
        expectedDecisionRevision: admission.pageDecisionRevision,
        expectedObjectVersion: snapshot.version,
        run: (execution) =>
          runWithTrustedApprovalMutationExecution(admission, execution, (trustedExecution) =>
            dataSource.revoke(snapshot.delegationId, snapshot.version, trustedExecution)
          ),
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      void queryClient.invalidateQueries({ queryKey, exact: true });
      setOwnerOutcome('The Approval owner confirmed the delegation revoke command.');
    },
  });
  const pending = create.isPending || revoke.isPending;

  function select(delegationId: string) {
    setSelectedId(delegationId);
    replaceFocus(delegationId);
    setOwnerOutcome(null);
  }

  return (
    <Stack
      data-testid="hris-team-delegation-workspace"
      data-runtime-state="ON"
      data-owner="dwp-approval-server"
      gap={2}
      sx={{ minWidth: 0 }}
    >
      <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between">
          <Box minWidth={0}>
            <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {t('governedPeople.delegation.header.title')}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
              {t('governedPeople.delegation.header.description')}
            </Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              variant="outlined"
              label={t('governedPeople.delegation.header.liveAuthority')}
            />
            <ActionButton
              intent="secondary"
              startIcon={<Plus size={17} />}
              disabled={!canManage || pending || !delegations.isSuccess}
              onClick={() => setShowCreate((value) => !value)}
            >
              {t('governedPeople.delegation.actions.create')}
            </ActionButton>
          </Stack>
        </Stack>
      </Paper>

      {showCreate ? (
        <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack gap={1.5}>
            <Typography component="h2" variant="h6">
              {t('governedPeople.delegation.create.title')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              <FormField
                label={t('governedPeople.delegation.create.delegateUserId')}
                value={draft.delegateUserId}
                onChange={(event) => setDraft({ ...draft, delegateUserId: event.target.value })}
                inputMode="numeric"
              />
              <FormField
                label={t('governedPeople.delegation.create.reason')}
                value={draft.reason}
                onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
                inputProps={{ maxLength: 500 }}
              />
              <LocalDateTimePickerField
                label={t('governedPeople.delegation.create.startsAt')}
                value={draft.startsAt || null}
                onValueChange={(value) => setDraft({ ...draft, startsAt: value ?? '' })}
              />
              <LocalDateTimePickerField
                label={t('governedPeople.delegation.create.endsAt')}
                value={draft.endsAt || null}
                onValueChange={(value) => setDraft({ ...draft, endsAt: value ?? '' })}
              />
            </Box>
            <ActionButton
              intent="primary"
              disabled={!canManage || pending || validDraft(draft) === null}
              onClick={() => {
                const input = validDraft(draft);
                if (input) create.mutate(input);
              }}
            >
              {create.isPending
                ? t('governedPeople.delegation.actions.submitting')
                : t('governedPeople.delegation.actions.submit')}
            </ActionButton>
          </Stack>
        </Paper>
      ) : null}

      {delegations.isLoading ? (
        <LoadingState
          label={t('governedPeople.delegation.states.loading')}
          variant="skeleton"
          skeletonHeights={[96, 320]}
          skeletonGap={1}
          embedded
        />
      ) : delegations.isError ? (
        <InlineFeedback
          severity={denied(delegations.error) ? 'error' : 'warning'}
          title={
            denied(delegations.error)
              ? 'Delegation access is unavailable'
              : 'Delegation owner unavailable'
          }
        >
          {t('governedPeople.delegation.states.ownerUnavailableDescription')}
        </InlineFeedback>
      ) : rows.length === 0 ? (
        <InlineFeedback severity="info" title={t('governedPeople.delegation.states.emptyTitle')}>
          {t('governedPeople.delegation.states.emptyDescription')}
        </InlineFeedback>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(280px, 1fr) minmax(0, 1fr)' },
            gap: 2,
          }}
        >
          <Paper component="section" variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
            <Stack component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {rows.map((delegation) => (
                <Box component="li" key={delegation.delegationId}>
                  <ActionButton
                    intent="quiet"
                    onClick={() => select(delegation.delegationId)}
                    aria-current={
                      selected?.delegationId === delegation.delegationId ? 'true' : undefined
                    }
                    sx={{
                      width: 1,
                      p: 1.5,
                      display: 'block',
                      textAlign: 'left',
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main' },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography fontWeight="fontWeightBold" sx={{ overflowWrap: 'anywhere' }}>
                        {delegation.delegateDisplayName}
                      </Typography>
                      <Chip size="small" label={delegation.lifecycleState} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {t('governedPeople.delegation.list.identity', {
                        direction: delegation.direction,
                        scopeType: delegation.scopeType,
                        version: delegation.version,
                      })}
                    </Typography>
                  </ActionButton>
                </Box>
              ))}
            </Stack>
          </Paper>
          <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
            {selected ? (
              <Stack gap={1.5}>
                <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                  {selected.delegateDisplayName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('governedPeople.delegation.detail.period', {
                    startsAt: formatDate(selected.startsAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                    endsAt: formatDate(selected.endsAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })}
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {selected.reason}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('governedPeople.delegation.detail.identity', {
                    delegationId: selected.delegationId,
                    version: selected.version,
                  })}
                </Typography>
                <ActionButton
                  intent="danger"
                  startIcon={<UserRoundX size={17} />}
                  disabled={!canManage || pending || selected.lifecycleState !== 'ACTIVE'}
                  onClick={() =>
                    revoke.mutate({
                      delegationId: selected.delegationId,
                      version: selected.version,
                    })
                  }
                >
                  {revoke.isPending
                    ? t('governedPeople.delegation.actions.revoking')
                    : t('governedPeople.delegation.actions.revoke')}
                </ActionButton>
              </Stack>
            ) : null}
          </Paper>
        </Box>
      )}

      <ActionButton
        intent="quiet"
        startIcon={<RefreshCw size={17} />}
        disabled={delegations.isFetching || pending}
        onClick={() => void delegations.refetch()}
      >
        {t('governedPeople.delegation.actions.refreshAuthority')}
      </ActionButton>
      {pending ? (
        <InlineFeedback severity="info" title={t('governedPeople.delegation.states.pendingTitle')}>
          {t('governedPeople.delegation.states.pendingDescription')}
        </InlineFeedback>
      ) : null}
      {create.isError || revoke.isError ? (
        <InlineFeedback
          severity="error"
          title={t('governedPeople.delegation.states.rejectedTitle')}
        >
          {t('governedPeople.delegation.states.rejectedDescription')}
        </InlineFeedback>
      ) : null}
      {ownerOutcome ? (
        <InlineFeedback
          severity="success"
          title={t('governedPeople.delegation.states.confirmedTitle')}
          icon={<CheckCircle2 size={18} />}
        >
          {t('governedPeople.delegation.states.confirmedDescription', { ownerOutcome })}
        </InlineFeedback>
      ) : null}
    </Stack>
  );
}

export function HrisTeamDelegationWorkspace({
  admission,
  dataSource = hrisDelegationDataSource,
  commandRunner,
}: HrisTeamDelegationWorkspaceProps) {
  if (!delegationReadAdmitted(admission)) {
    return <DisabledDelegation invalid={admission !== undefined} />;
  }
  const scopeIdentity = approvalAdapterScopeIdentity(admission);
  return (
    <ActiveDelegation
      key={scopeIdentity}
      admission={admission}
      dataSource={dataSource}
      {...(commandRunner ? { commandRunner } : {})}
    />
  );
}
