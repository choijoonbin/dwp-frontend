/**
 * Case Action Proposals Tab — Phase3
 * GET /api/synapse/cases/{caseId}/action-proposals?runId=
 * Phase3: fingerprint dedup — groupBy fingerprint, latest createdAt per group.
 * @see docs/job/PROMPT_FE_Phase3_SynapseX_MVP_SPEC.md
 */

import type {
  CaseActionProposalDto,
  ProposalExecuteResponseDto,
} from '@dwp-frontend/shared-utils';

import { useEffect, useMemo, useState } from 'react';
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
import Collapse from '@mui/material/Collapse';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';

import { TabEmptyState, CaseTabQueryBoundary } from '../../../components/ux';
import { dedupeProposalsByFingerprint } from '../adapters/case-action-proposals-adapter';

/** 카드별 실행 결과: 성공 시 data, 실패 시 message(+stage) */
type ExecuteResult =
  | { kind: 'success'; data: ProposalExecuteResponseDto }
  | { kind: 'error'; message: string; stage?: string };

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

  /** runId 변경 시 카드별 실행 결과 초기화 (DoD: run 간 결과가 섞이지 않음) */
  const [executeResults, setExecuteResults] = useState<Record<string, ExecuteResult>>({});
  useEffect(() => {
    setExecuteResults({});
  }, [runId]);

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
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center" flexWrap="wrap">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Iconify icon={isExecuting ? 'solar:refresh-bold' : 'solar:play-bold'} width={16} />}
                        disabled={isExecuting}
                        onClick={() =>
                          executeMutation.mutate(
                            {
                              caseId,
                              proposalId: proposalId!,
                              runId: runId ?? item.runId ?? undefined,
                            },
                            {
                              onSuccess: (data) => {
                                setExecuteResults((prev) => ({ ...prev, [proposalId!]: { kind: 'success', data } }));
                              },
                              onError: (err) => {
                                setExecuteResults((prev) => ({
                                  ...prev,
                                  [proposalId!]: {
                                    kind: 'error',
                                    message: err instanceof Error ? err.message : String(err),
                                    stage: (err as Error & { stage?: string }).stage,
                                  },
                                }));
                              },
                            }
                          )
                        }
                      >
                        {isExecuting ? t('caseDetail.executing', { defaultValue: '실행 중…' }) : t('caseDetail.executeSimulation')}
                      </Button>
                    </Stack>
                  )}
                  {/* 실행 결과 패널 (P0): actionId, simulation 요약, 실패 시 메시지 */}
                  {executeResults[proposalId!] && (
                    <Collapse in>
                      <Box
                        sx={{
                          mt: 1.5,
                          p: 1.5,
                          borderRadius: 1,
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: executeResults[proposalId!].kind === 'error' ? 'error.lighter' : 'success.lighter',
                        }}
                      >
                        {executeResults[proposalId!].kind === 'success' ? (
                          <Stack spacing={1}>
                            {(executeResults[proposalId!] as { kind: 'success'; data: ProposalExecuteResponseDto }).data.actionId && (
                              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                actionId: {(executeResults[proposalId!] as { kind: 'success'; data: ProposalExecuteResponseDto }).data.actionId}
                              </Typography>
                            )}
                            {(executeResults[proposalId!] as { kind: 'success'; data: ProposalExecuteResponseDto }).data.executedAt && (
                              <Typography variant="caption" color="text.secondary">
                                {t('caseDetail.lastExecutedAt', {
                                  at: formatDateTime((executeResults[proposalId!] as { kind: 'success'; data: ProposalExecuteResponseDto }).data.executedAt!),
                                  defaultValue: '최근 실행: {{at}}',
                                })}
                              </Typography>
                            )}
                            {(executeResults[proposalId!] as { kind: 'success'; data: ProposalExecuteResponseDto }).data.simulation &&
                              Object.keys((executeResults[proposalId!] as { kind: 'success'; data: ProposalExecuteResponseDto }).data.simulation!).length > 0 && (
                                <Box>
                                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                    {t('caseDetail.simulationResult', { defaultValue: '시뮬레이션 결과' })}
                                  </Typography>
                                  <Table size="small" sx={{ '& td': { py: 0.25, borderColor: 'divider', fontSize: '0.75rem' } }}>
                                    <TableBody>
                                      {Object.entries((executeResults[proposalId!] as { kind: 'success'; data: ProposalExecuteResponseDto }).data.simulation!).map(([k, v]) => (
                                        <TableRow key={k}>
                                          <TableCell sx={{ color: 'text.secondary' }}>{k}</TableCell>
                                          <TableCell>{typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </Box>
                              )}
                            {(executeResults[proposalId!] as { kind: 'success'; data: ProposalExecuteResponseDto }).data.message && (
                              <Typography variant="caption" color="text.secondary">
                                {(executeResults[proposalId!] as { kind: 'success'; data: ProposalExecuteResponseDto }).data.message}
                              </Typography>
                            )}
                          </Stack>
                        ) : (
                          <Stack spacing={0.5}>
                            <Typography variant="body2" color="error.dark" sx={{ fontWeight: 500 }}>
                              {(executeResults[proposalId!] as { kind: 'error'; message: string; stage?: string }).message}
                            </Typography>
                            {(executeResults[proposalId!] as { kind: 'error'; message: string; stage?: string }).stage && (
                              <Typography variant="caption" color="text.secondary">
                                stage: {(executeResults[proposalId!] as { kind: 'error'; message: string; stage?: string }).stage}
                              </Typography>
                            )}
                          </Stack>
                        )}
                      </Box>
                    </Collapse>
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
