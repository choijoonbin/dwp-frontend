import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { ActionButton, InlineFeedback, FormField, LoadingState } from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  approvalAdapterScopeIdentity,
  HRIS_APPROVAL_ADAPTER_FEATURE,
  HRIS_APPROVAL_SHARED_API_CONTRACTS,
  mergeHrisApprovalQueryState,
  parseHrisApprovalQueryState,
  runWithTrustedApprovalMutationExecution,
  workflowPublishAdmitted,
  workflowReadAdmitted,
} from '../model/hris-approval-adapter-contract';
import { hrisWorkflowPolicyDataSource } from '../api/hris-workflow-policy-adapter';

import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';
import type { HrisWorkflowPolicyDataSource } from '../api/hris-workflow-policy-adapter';
import type {
  HrisApprovalAdapterAdmission,
  HrisApprovalCommandRunner,
} from '../model/hris-approval-adapter-contract';

export const HRIS_WORKFLOW_POLICY_RUNTIME_STATE = 'OFF' as const;

export type HrisWorkflowPolicyWorkspaceProps = Readonly<{
  admission?: HrisApprovalAdapterAdmission;
  dataSource?: HrisWorkflowPolicyDataSource;
  commandRunner?: HrisApprovalCommandRunner;
}>;

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

function DisabledWorkflow({ invalid }: Readonly<{ invalid: boolean }>) {
  const { t } = useTranslation('hcm');
  return (
    <Stack
      data-testid="hris-workflow-policy-workspace"
      data-runtime-state={HRIS_WORKFLOW_POLICY_RUNTIME_STATE}
      data-feature={HRIS_APPROVAL_ADAPTER_FEATURE}
      gap={2}
      sx={{ minWidth: 0 }}
    >
      <InlineFeedback
        severity={invalid ? 'error' : 'info'}
        title={t(
          invalid
            ? 'administration.workflow.disabled.invalidTitle'
            : 'administration.workflow.disabled.offTitle'
        )}
      >
        {t(
          invalid
            ? 'administration.workflow.disabled.invalidDescription'
            : 'administration.workflow.disabled.offDescription'
        )}
      </InlineFeedback>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
          {t('administration.workflow.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
          {t('administration.workflow.description')}
        </Typography>
      </Paper>
    </Stack>
  );
}

function policyName(policy: ApprovalPolicy): string {
  return policy.nameEn.trim() || policy.nameKo.trim() || policy.policyKey;
}

function ActiveWorkflow({
  admission,
  dataSource,
  commandRunner,
}: Readonly<{
  admission: HrisApprovalAdapterAdmission;
  dataSource: HrisWorkflowPolicyDataSource;
  commandRunner?: HrisApprovalCommandRunner;
}>) {
  const { t } = useTranslation('hcm');
  const queryClient = useQueryClient();
  const scopeIdentity = approvalAdapterScopeIdentity(admission);
  const authorityRef = useRef({ admission, scopeIdentity });
  authorityRef.current = { admission, scopeIdentity };
  const initialQueryState = useMemo(() => parseHrisApprovalQueryState(currentSearch()), []);
  const [selectedId, setSelectedId] = useState<string | null>(initialQueryState.focus);
  const [reviewComment, setReviewComment] = useState('');
  const [ownerOutcome, setOwnerOutcome] = useState<string | null>(null);
  const queryKey = ['hris', 'approval-adapter', 'workflow-policies', scopeIdentity] as const;
  const policies = useQuery({
    queryKey,
    queryFn: ({ signal }) => dataSource.list(admission.ownerContextScopeKey, signal),
    staleTime: 20_000,
    retry: false,
  });
  const rows = useMemo(() => policies.data ?? [], [policies.data]);
  const selected = rows.find((policy) => policy.policyId === selectedId) ?? null;

  useEffect(() => {
    if (!policies.isSuccess) return;
    const next = rows.find((policy) => policy.policyId === selectedId)?.policyId ?? null;
    if (next) return;
    const fallback = rows[0]?.policyId ?? null;
    setSelectedId(fallback);
    replaceFocus(fallback);
    setOwnerOutcome(null);
  }, [policies.isSuccess, rows, selectedId]);

  const canPublish = workflowPublishAdmitted(admission) && Boolean(commandRunner);
  const makerBlocked =
    selected?.pendingBy != null && String(selected.pendingBy) === admission.actorId;
  const publish = useMutation({
    mutationFn: async (
      snapshot: Readonly<{ policyId: string; version: number; comment: string }>
    ) => {
      const current = queryClient
        .getQueryData<ApprovalPolicy[]>(queryKey)
        ?.find((policy) => policy.policyId === snapshot.policyId);
      const latest = authorityRef.current;
      if (
        !commandRunner ||
        latest.scopeIdentity !== scopeIdentity ||
        !workflowPublishAdmitted(latest.admission) ||
        !current ||
        current.version !== snapshot.version ||
        !current.pendingReview ||
        String(current.pendingBy ?? '') === admission.actorId
      ) {
        throw new HttpError('Approval policy authority is stale.', 409);
      }
      return commandRunner({
        routeContractKey: HRIS_APPROVAL_SHARED_API_CONTRACTS.policyPublish.routeContractKey,
        expectedDecisionRevision: admission.pageDecisionRevision,
        expectedObjectVersion: snapshot.version,
        run: (execution) =>
          runWithTrustedApprovalMutationExecution(admission, execution, (trustedExecution) =>
            dataSource.publish(
              snapshot.policyId,
              { expectedVersion: snapshot.version, reviewComment: snapshot.comment },
              trustedExecution
            )
          ),
      });
    },
    onSuccess: (result, snapshot) => {
      queryClient.setQueryData(queryKey, result);
      void queryClient.invalidateQueries({ queryKey, exact: true });
      setReviewComment('');
      setOwnerOutcome(
        t('administration.workflow.publish.ownerConfirmed', { policyId: snapshot.policyId })
      );
    },
  });

  function select(policyId: string) {
    setSelectedId(policyId);
    replaceFocus(policyId);
    setOwnerOutcome(null);
  }

  return (
    <Stack
      data-testid="hris-workflow-policy-workspace"
      data-runtime-state="ON"
      data-owner="dwp-approval-server"
      gap={2}
      sx={{ minWidth: 0 }}
    >
      <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between">
          <Box minWidth={0}>
            <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {t('administration.workflow.title')}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
              {t('administration.workflow.activeDescription')}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            label={t('administration.workflow.liveAuthority')}
          />
        </Stack>
      </Paper>

      {policies.isLoading ? (
        <Stack aria-busy="true" aria-label={t('administration.workflow.loading')} gap={1}>
          <LoadingState
            embedded
            variant="skeleton"
            label={t('administration.workflow.loading')}
            skeletonHeights={[96, 320]}
            skeletonGap={1}
          />
        </Stack>
      ) : policies.isError ? (
        <InlineFeedback
          severity={denied(policies.error) ? 'error' : 'warning'}
          title={t(
            denied(policies.error)
              ? 'administration.workflow.error.accessTitle'
              : 'administration.workflow.error.ownerTitle'
          )}
        >
          {t('administration.workflow.error.description')}
        </InlineFeedback>
      ) : rows.length === 0 ? (
        <InlineFeedback severity="info" title={t('administration.workflow.empty.title')}>
          {t('administration.workflow.empty.description')}
        </InlineFeedback>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(260px, .8fr) minmax(0, 1.2fr)',
            },
            gap: 2,
            minWidth: 0,
          }}
        >
          <Paper component="section" variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
            <Stack component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {rows.map((policy) => (
                <Box component="li" key={policy.policyId}>
                  <ButtonBase
                    onClick={() => select(policy.policyId)}
                    aria-current={selected?.policyId === policy.policyId ? 'true' : undefined}
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
                        {policyName(policy)}
                      </Typography>
                      <Chip
                        size="small"
                        color={policy.pendingReview ? 'warning' : 'default'}
                        label={
                          policy.pendingReview
                            ? t('administration.workflow.review.pending')
                            : policy.lifecycleState
                        }
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {t('administration.workflow.policyVersionShort', {
                        policyKey: policy.policyKey,
                        version: policy.version,
                      })}
                    </Typography>
                  </ButtonBase>
                </Box>
              ))}
            </Stack>
          </Paper>

          <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
            {selected ? (
              <Stack gap={2}>
                <Box>
                  <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                    {policyName(selected)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('administration.workflow.policyVersion', {
                      policyType: selected.policyType,
                      enforcementMode: selected.enforcementMode,
                      version: selected.version,
                    })}
                  </Typography>
                </Box>
                <InlineFeedback
                  severity={selected.pendingReview ? 'warning' : 'info'}
                  title={t(
                    selected.pendingReview
                      ? 'administration.workflow.review.requiredTitle'
                      : 'administration.workflow.review.noneTitle'
                  )}
                >
                  {selected.pendingReview
                    ? selected.pendingChangeReason ||
                      t('administration.workflow.review.requiredDescription')
                    : t('administration.workflow.review.noneDescription')}
                </InlineFeedback>
                {makerBlocked ? (
                  <InlineFeedback
                    severity="warning"
                    title={t('administration.workflow.review.fourEyesTitle')}
                  >
                    {t('administration.workflow.review.fourEyesDescription')}
                  </InlineFeedback>
                ) : null}
                <FormField
                  fullWidth={false}
                  label={t('administration.workflow.review.comment')}
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  multiline
                  minRows={3}
                  disabled={
                    !canPublish || !selected.pendingReview || makerBlocked || publish.isPending
                  }
                  inputProps={{ maxLength: 1000 }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  <ActionButton
                    intent="primary"
                    startIcon={<ShieldCheck size={17} />}
                    disabled={
                      !canPublish ||
                      !selected.pendingReview ||
                      makerBlocked ||
                      publish.isPending ||
                      reviewComment.trim().length < 3
                    }
                    onClick={() =>
                      publish.mutate({
                        policyId: selected.policyId,
                        version: selected.version,
                        comment: reviewComment.trim(),
                      })
                    }
                  >
                    {t(
                      publish.isPending
                        ? 'administration.workflow.publish.publishing'
                        : 'administration.workflow.publish.action'
                    )}
                  </ActionButton>
                  <ActionButton
                    intent="quiet"
                    startIcon={<RefreshCw size={17} />}
                    disabled={policies.isFetching || publish.isPending}
                    onClick={() => void policies.refetch()}
                  >
                    {t('administration.workflow.refreshAuthority')}
                  </ActionButton>
                </Stack>
              </Stack>
            ) : null}
          </Paper>
        </Box>
      )}

      {publish.isPending ? (
        <InlineFeedback severity="info" title={t('administration.workflow.publish.pendingTitle')}>
          {t('administration.workflow.publish.pendingDescription')}
        </InlineFeedback>
      ) : null}
      {publish.isError ? (
        <InlineFeedback severity="error" title={t('administration.workflow.publish.rejectedTitle')}>
          {t('administration.workflow.publish.rejectedDescription')}
        </InlineFeedback>
      ) : null}
      {ownerOutcome ? (
        <InlineFeedback
          severity="success"
          title={t('administration.workflow.publish.confirmedTitle')}
          icon={<CheckCircle2 size={18} />}
        >
          {ownerOutcome} {t('administration.workflow.publish.confirmedDescription')}
        </InlineFeedback>
      ) : null}
    </Stack>
  );
}

export function HrisWorkflowPolicyWorkspace({
  admission,
  dataSource = hrisWorkflowPolicyDataSource,
  commandRunner,
}: HrisWorkflowPolicyWorkspaceProps) {
  if (!workflowReadAdmitted(admission)) {
    return <DisabledWorkflow invalid={admission !== undefined} />;
  }
  const scopeIdentity = approvalAdapterScopeIdentity(admission);
  return (
    <ActiveWorkflow
      key={scopeIdentity}
      admission={admission}
      dataSource={dataSource}
      {...(commandRunner ? { commandRunner } : {})}
    />
  );
}
