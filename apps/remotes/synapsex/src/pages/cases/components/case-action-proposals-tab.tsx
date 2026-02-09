/**
 * Case Action Proposals Tab — Phase2 AI 분석 기반 권고
 * GET /api/synapse/cases/{caseId}/action-proposals
 * @see docs/job/BE_FOLLOWUP_QUESTIONS_PHASE2.md
 */

import type { CaseActionProposalDto } from '@dwp-frontend/shared-utils';

import { Iconify } from '@dwp-frontend/design-system';
import { formatDateTime, useTranslation } from '@dwp-frontend/shared-i18n';
import { useCaseActionProposalsQuery, useApproveProposalMutation, useRejectProposalMutation } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { TabEmptyState } from '../../../components/ux/tab-empty-state';
import { TabErrorState } from '../../../components/ux/tab-error-state';
import { TabContentSkeleton } from '../../../components/ux/tab-content-skeleton';

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

  if (isLoading) {
    return <TabContentSkeleton cards={2} />;
  }

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <TabErrorState
          title={t('cases.tabs.actionProposals.error.title', { defaultValue: 'Failed to load action proposals' })}
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      </Box>
    );
  }

  const items: CaseActionProposalDto[] = Array.isArray(proposals)
    ? (proposals as CaseActionProposalDto[])
    : (proposals as { items?: CaseActionProposalDto[] } | undefined)?.items ?? [];

  if (items.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <TabEmptyState
          icon="solar:shield-check-bold-duotone"
          title={t('cases.tabs.actionProposals.empty.title', { defaultValue: 'No action proposals' })}
          description={t('cases.tabs.actionProposals.empty.description', {
            defaultValue: 'Run analysis to get AI-generated action recommendations.',
          })}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        {items.map((item: CaseActionProposalDto) => {
          const proposalId = item.proposalId ?? (item as { id?: string }).id;
          const isPending = (item.status ?? '').toUpperCase() === 'PROPOSED' || (item.status ?? '').toUpperCase() === 'DRAFT';
          const isApproving = approveMutation.isPending && approveMutation.variables?.proposalId === proposalId;
          const isRejecting = rejectMutation.isPending && rejectMutation.variables?.proposalId === proposalId;

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
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
};
