/**
 * Case Action Proposals Tab — Phase3
 * GET /api/synapse/cases/{caseId}/action-proposals?runId=
 * Phase3: fingerprint dedup — groupBy fingerprint, latest createdAt per group.
 * @see docs/job/PROMPT_FE_Phase3_SynapseX_MVP_SPEC.md
 */

import type { CaseActionProposalDto } from '@dwp-frontend/shared-utils';

import { useMemo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { formatDateTime, useTranslation } from '@dwp-frontend/shared-i18n';
import {
  useRejectProposalMutation,
  useApproveProposalMutation,
  useExecuteProposalMutation,
  useCaseActionProposalsQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { TabEmptyState, CaseTabQueryBoundary } from '../../../components/ux';
import { dedupeProposalsByFingerprint } from '../adapters/case-action-proposals-adapter';

type CaseActionProposalsTabProps = {
  caseId: string | undefined;
  runId?: string | null;
  enabled: boolean;
  tabKey?: string;
};

export const CaseActionProposalsTab = ({
  caseId,
  runId,
  enabled,
  tabKey = 'action-proposals',
}: CaseActionProposalsTabProps) => {
  const { t } = useTranslation('common');
  const { data: proposals, isLoading, isError, error, refetch } = useCaseActionProposalsQuery(caseId, {
    enabled,
    runId,
  });
  const approveMutation = useApproveProposalMutation();
  const rejectMutation = useRejectProposalMutation();
  const executeMutation = useExecuteProposalMutation();

  const rawItems: CaseActionProposalDto[] = useMemo(
    () =>
      Array.isArray(proposals)
        ? (proposals as CaseActionProposalDto[])
        : (proposals as { items?: CaseActionProposalDto[] } | undefined)?.items ?? [],
    [proposals]
  );
  const items = useMemo(() => dedupeProposalsByFingerprint(rawItems), [rawItems]);

  return (
    <CaseTabQueryBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      errorTitle={t('cases.tabs.actionProposals.error.title', { defaultValue: 'Failed to load action proposals' })}
      skeletonCards={2}
      empty={items.length === 0}
      emptyContent={
        <Box sx={{ p: 2 }}>
          <TabEmptyState
            icon="solar:shield-check-bold-duotone"
            title={t('cases.tabs.actionProposals.empty.title', { defaultValue: 'No action proposals' })}
            description={t('cases.tabs.actionProposals.empty.description', {
              defaultValue: 'Run analysis to get AI-generated action recommendations.',
            })}
          />
        </Box>
      }
    >
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        {items.map((item: CaseActionProposalDto) => {
          const proposalId = item.proposalId ?? (item as { id?: string }).id;
          const statusUpper = (item.status ?? '').toUpperCase();
          const isPending = statusUpper === 'PROPOSED' || statusUpper === 'DRAFT';
          const isApproved = statusUpper === 'APPROVED';
          const isApproving = approveMutation.isPending && approveMutation.variables?.proposalId === proposalId;
          const isRejecting = rejectMutation.isPending && rejectMutation.variables?.proposalId === proposalId;
          const isExecuting = executeMutation.isPending && executeMutation.variables?.proposalId === proposalId;
          const hasDecided = item.decidedBy != null || item.decidedAt != null || (item.decisionComment != null && item.decisionComment !== '');

          return (
            <Card key={proposalId} variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {item.type ?? '-'}
                    </Typography>
                    <Chip
                      label={item.status ?? '-'}
                      size="small"
                      color={isPending ? 'warning' : 'default'}
                      variant="outlined"
                    />
                    {item.requiresApproval === true && (
                      <Chip
                        label={t('caseDetail.requiresApproval', { defaultValue: '승인 필요' })}
                        size="small"
                        color="warning"
                        variant="filled"
                      />
                    )}
                    {item.riskLevel && (
                      <Chip label={item.riskLevel} size="small" variant="outlined" />
                    )}
                  </Stack>
                  {item.rationale && (
                    <Typography variant="body2" color="text.secondary">
                      {item.rationale}
                    </Typography>
                  )}
                  {Array.isArray(item.checklist) && item.checklist.length > 0 && (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        {t('caseDetail.checklist', { defaultValue: '추가 확인사항' })}
                      </Typography>
                      <Stack component="ul" sx={{ m: 0, pl: 2 }}>
                        {item.checklist.map((entry, idx) => (
                          <Typography key={idx} component="li" variant="caption" color="text.secondary">
                            {typeof entry === 'string' ? entry : String(entry)}
                          </Typography>
                        ))}
                      </Stack>
                    </Stack>
                  )}
                  {hasDecided && (
                    <Stack spacing={0.5} sx={{ py: 0.5 }}>
                      {item.decidedAt && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Iconify icon="solar:user-check-bold-duotone" width={14} sx={{ color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary">
                            {item.decidedBy != null && item.decidedBy !== ''
                              ? t('caseDetail.decidedByAt', {
                                  user: item.decidedBy,
                                  at: formatDateTime(item.decidedAt),
                                  defaultValue: '{{user}} · {{at}}',
                                })
                              : formatDateTime(item.decidedAt)}
                          </Typography>
                        </Stack>
                      )}
                      {item.decisionComment != null && item.decisionComment !== '' && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          {item.decisionComment}
                        </Typography>
                      )}
                    </Stack>
                  )}
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
                    {item.runId && (
                      <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                        runId: {String(item.runId).slice(0, 8)}…
                      </Typography>
                    )}
                    {item.createdAt && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Iconify icon="solar:calendar-bold-duotone" width={14} sx={{ color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(item.createdAt)}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                  {isPending && caseId && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Iconify icon="solar:check-circle-bold" width={16} />}
                        disabled={isApproving || isRejecting}
                        onClick={() => approveMutation.mutate({ caseId, proposalId: proposalId! })}
                      >
                        {t('caseDetail.approveAction')}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<Iconify icon="solar:close-circle-bold" width={16} />}
                        disabled={isApproving || isRejecting}
                        onClick={() => rejectMutation.mutate({ caseId, proposalId: proposalId! })}
                      >
                        {t('caseDetail.reject')}
                      </Button>
                    </Stack>
                  )}
                  {isApproved && caseId && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Iconify icon="solar:play-bold" width={16} />}
                        disabled={isExecuting}
                        onClick={() => executeMutation.mutate({ caseId, proposalId: proposalId! })}
                      >
                        {t('caseDetail.executeSimulation')}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
    </CaseTabQueryBoundary>
  );
};
