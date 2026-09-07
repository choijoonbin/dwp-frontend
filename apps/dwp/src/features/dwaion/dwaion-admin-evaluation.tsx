import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Play, Plus, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  EnterpriseDataGrid,
  FormField,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import {
  addDwaionEvaluationCase,
  createDwaionEvaluationSet,
  exportDwaionEvaluationRun,
  getDwaionEvaluationRun,
  getDwaionEvaluationSet,
  listDwaionEvaluationRuns,
  listDwaionEvaluationSets,
  runDwaionEvaluation,
  transitionDwaionEvaluationSet,
  type DwaionEvaluationSetSummary,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';
import {
  EMPTY_EVALUATION_CASE,
  EMPTY_EVALUATION_SET,
  EvaluationCaseDialog,
  EvaluationSetDialog,
  type EvaluationCaseDraft,
  type EvaluationSetDraft,
} from './dwaion-evaluation-dialogs';
import { DwaionEvaluationHistory } from './dwaion-evaluation-history';

import type { GridColDef } from '@mui/x-data-grid';

export function DwaionAdminEvaluation() {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate =
    hasPermission('ADMIN.DWAION_EVALUATION', 'CREATE') ||
    hasPermission('ADMIN.DWAION_EVALUATION', 'MANAGE');
  const canUpdate =
    hasPermission('ADMIN.DWAION_EVALUATION', 'UPDATE') ||
    hasPermission('ADMIN.DWAION_EVALUATION', 'MANAGE');
  const canManage = hasPermission('ADMIN.DWAION_EVALUATION', 'MANAGE');
  const canExecute = hasPermission('ADMIN.DWAION_EVALUATION', 'EXECUTE') || canManage;
  const canExport = hasPermission('ADMIN.DWAION_EVALUATION', 'EXPORT') || canManage;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [setDraft, setSetDraft] = useState<EvaluationSetDraft | null>(null);
  const [caseDraft, setCaseDraft] = useState<EvaluationCaseDraft | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const sets = useQuery({
    queryKey: ['dwaion', 'admin', 'evaluations'],
    queryFn: listDwaionEvaluationSets,
    staleTime: 15_000,
  });
  useEffect(() => {
    if (!selectedId && sets.data?.length) setSelectedId(sets.data[0].evaluationSetId);
  }, [selectedId, sets.data]);
  const detail = useQuery({
    queryKey: ['dwaion', 'admin', 'evaluation', selectedId],
    queryFn: () => getDwaionEvaluationSet(selectedId!),
    enabled: Boolean(selectedId),
    staleTime: 10_000,
  });
  const runs = useQuery({
    queryKey: ['dwaion', 'admin', 'evaluation-runs', selectedId],
    queryFn: () => listDwaionEvaluationRuns(selectedId!),
    enabled: Boolean(selectedId),
    staleTime: 10_000,
  });
  useEffect(() => {
    setSelectedRunId(null);
  }, [selectedId]);
  useEffect(() => {
    if (!selectedRunId && runs.data?.length) {
      setSelectedRunId(runs.data[0].evaluationRunId);
    }
  }, [runs.data, selectedRunId]);
  const selectedRun = useQuery({
    queryKey: ['dwaion', 'admin', 'evaluation-run', selectedId, selectedRunId],
    queryFn: () => getDwaionEvaluationRun(selectedId!, selectedRunId!),
    enabled: Boolean(selectedId && selectedRunId),
    staleTime: 30_000,
  });
  const baselineRunId = useMemo(() => {
    const index = runs.data?.findIndex((item) => item.evaluationRunId === selectedRunId) ?? -1;
    return index >= 0 ? (runs.data?.[index + 1]?.evaluationRunId ?? null) : null;
  }, [runs.data, selectedRunId]);
  const baselineRun = useQuery({
    queryKey: ['dwaion', 'admin', 'evaluation-run', selectedId, baselineRunId],
    queryFn: () => getDwaionEvaluationRun(selectedId!, baselineRunId!),
    enabled: Boolean(selectedId && baselineRunId),
    staleTime: 30_000,
  });
  const refresh = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'evaluations'] });
    if (id)
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'evaluation', id] });
    if (id)
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'evaluation-runs', id] });
  };
  const createMutation = useMutation({
    mutationFn: (draft: EvaluationSetDraft) =>
      createDwaionEvaluationSet({
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        locale: draft.locale,
      }),
    onSuccess: async (created) => {
      setSetDraft(null);
      setSelectedId(created.summary.evaluationSetId);
      await refresh(created.summary.evaluationSetId);
    },
  });
  const caseMutation = useMutation({
    mutationFn: (draft: EvaluationCaseDraft) =>
      addDwaionEvaluationCase(selectedId!, {
        name: draft.name.trim(),
        prompt: draft.prompt.trim(),
        expectedTerms: draft.expectedTerms
          .split(',')
          .map((term) => term.trim())
          .filter(Boolean),
        sourceScopes: draft.sourceScopes,
      }),
    onSuccess: async () => {
      setCaseDraft(null);
      await refresh(selectedId!);
    },
  });
  const lifecycleMutation = useMutation({
    mutationFn: (state: 'ACTIVE' | 'RETIRED') =>
      transitionDwaionEvaluationSet(selectedId!, {
        lifecycleState: state,
        expectedVersion: detail.data!.summary.version,
        changeReason: reason.trim(),
      }),
    onSuccess: async () => {
      setReason('');
      await refresh(selectedId!);
    },
  });
  const runMutation = useMutation({
    mutationFn: () => runDwaionEvaluation(selectedId!),
    onSuccess: async (result) => {
      setSelectedRunId(result.evaluationRunId);
      queryClient.setQueryData(
        ['dwaion', 'admin', 'evaluation-run', selectedId, result.evaluationRunId],
        result
      );
      await refresh(selectedId!);
    },
  });
  const exportMutation = useMutation({
    mutationFn: () => exportDwaionEvaluationRun(selectedId!, selectedRunId!),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dwaion-evaluation-${selectedRunId}.csv`;
      anchor.style.display = 'none';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    },
  });

  const columns = useMemo<GridColDef<DwaionEvaluationSetSummary>[]>(
    () => [
      {
        field: 'name',
        headerName: t('dwaionAdmin.evaluation.columns.name'),
        minWidth: 220,
        flex: 1,
      },
      {
        field: 'lifecycleState',
        headerName: t('dwaionAdmin.evaluation.columns.state'),
        width: 112,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={
              row.lifecycleState === 'ACTIVE'
                ? 'success'
                : row.lifecycleState === 'DRAFT'
                  ? 'warning'
                  : 'default'
            }
            label={row.lifecycleState}
          />
        ),
      },
      { field: 'caseCount', headerName: t('dwaionAdmin.evaluation.columns.cases'), width: 86 },
      {
        field: 'latestPassRate',
        headerName: t('dwaionAdmin.evaluation.columns.passRate'),
        width: 112,
        valueGetter: (_, row) => (row.latestPassRate == null ? '—' : `${row.latestPassRate}%`),
      },
      {
        field: 'latestRunState',
        headerName: t('dwaionAdmin.evaluation.columns.lastRun'),
        minWidth: 170,
        flex: 0.8,
        valueGetter: (_, row) => row.latestRunState ?? '—',
      },
    ],
    [t]
  );
  const hasError =
    sets.isError ||
    detail.isError ||
    createMutation.isError ||
    caseMutation.isError ||
    lifecycleMutation.isError ||
    runMutation.isError ||
    runs.isError ||
    selectedRun.isError ||
    baselineRun.isError ||
    exportMutation.isError;

  return (
    <PageCanvas>
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.shared.governance')}
        title={t('dwaionAdmin.evaluation.title')}
        description={t('dwaionAdmin.evaluation.description')}
        actions={
          canCreate ? (
            <ActionButton
              intent="primary"
              startIcon={<Plus size={16} />}
              onClick={() => setSetDraft({ ...EMPTY_EVALUATION_SET })}
            >
              {t('dwaionAdmin.evaluation.create')}
            </ActionButton>
          ) : undefined
        }
      />
      {hasError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.evaluation.error')}
        </Alert>
      )}
      <Alert severity="info" icon={<ShieldCheck size={19} />} sx={{ mt: 2 }}>
        {t('dwaionAdmin.evaluation.dataBoundary')}
      </Alert>
      <Box
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            xl: 'minmax(440px, .85fr) minmax(520px, 1.15fr)',
          },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0, borderBlock: 1, borderColor: 'divider' }}>
          <EnterpriseDataGrid
            ariaLabel={t('dwaionAdmin.evaluation.tableLabel')}
            rows={sets.data ?? []}
            columns={columns}
            getRowId={(row) => row.evaluationSetId}
            loading={sets.isLoading}
            hideFooter
            onRowClick={({ row }) => {
              setSelectedId(row.evaluationSetId);
            }}
            sx={{ border: 0, borderRadius: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          />
        </Box>
        <Box
          component="section"
          aria-label={t('dwaionAdmin.evaluation.detailLabel')}
          sx={{ minWidth: 0 }}
        >
          {!selectedId ? (
            <GuidedEmptyState
              kind="empty"
              title={t('dwaionAdmin.evaluation.emptyTitle')}
              description={t('dwaionAdmin.evaluation.emptyDescription')}
            />
          ) : detail.isLoading ? (
            <Skeleton variant="rounded" height={420} />
          ) : detail.data ? (
            <Stack spacing={2.5}>
              <Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  gap={2}
                >
                  <Box>
                    <Typography component="h2" variant="h6" fontWeight={850}>
                      {detail.data.summary.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {detail.data.summary.description || t('dwaionAdmin.evaluation.noDescription')}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} alignItems="flex-start">
                    {canUpdate && detail.data.summary.lifecycleState !== 'RETIRED' && (
                      <ActionButton
                        intent="secondary"
                        size="small"
                        startIcon={<Plus size={15} />}
                        onClick={() => setCaseDraft({ ...EMPTY_EVALUATION_CASE })}
                      >
                        {t('dwaionAdmin.evaluation.addCase')}
                      </ActionButton>
                    )}
                    {canExecute && detail.data.summary.lifecycleState === 'ACTIVE' && (
                      <ActionButton
                        intent="primary"
                        size="small"
                        startIcon={<Play size={15} />}
                        loading={runMutation.isPending}
                        disabled={runs.data?.some((item) => item.runState === 'RUNNING')}
                        onClick={() => runMutation.mutate()}
                      >
                        {t('dwaionAdmin.evaluation.run')}
                      </ActionButton>
                    )}
                  </Stack>
                </Stack>
              </Box>
              {detail.data.summary.lifecycleState === 'DRAFT' && canManage && (
                <Box sx={{ borderBlock: 1, borderColor: 'divider', py: 1.5 }}>
                  <FormField
                    label={t('dwaionAdmin.shared.reason')}
                    value={reason}
                    multiline
                    minRows={2}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <ActionButton
                    intent="secondary"
                    startIcon={<CheckCircle2 size={16} />}
                    disabled={!detail.data.cases.length || reason.trim().length < 10}
                    loading={lifecycleMutation.isPending}
                    onClick={() => lifecycleMutation.mutate('ACTIVE')}
                    sx={{ mt: 1.25 }}
                  >
                    {t('dwaionAdmin.evaluation.activate')}
                  </ActionButton>
                </Box>
              )}
              <Box sx={{ borderBlock: 1, borderColor: 'divider' }}>
                {detail.data.cases.length ? (
                  detail.data.cases.map((item, index) => (
                    <Box key={item.evaluationCaseId}>
                      {index > 0 && <Divider />}
                      <Box sx={{ py: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" gap={2}>
                          <Box>
                            <Typography variant="body2" fontWeight={800}>
                              {item.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              component="p"
                              sx={{ mt: 0.3 }}
                            >
                              {item.prompt}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={t('dwaionAdmin.evaluation.termCount', {
                              count: item.expectedTerms.length,
                            })}
                          />
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{ mt: 0.8 }}
                        >
                          {item.sourceScopes.map((scope) => (
                            <Chip key={scope} size="small" label={scope} />
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  ))
                ) : (
                  <GuidedEmptyState
                    kind="empty"
                    title={t('dwaionAdmin.evaluation.noCasesTitle')}
                    description={t('dwaionAdmin.evaluation.noCasesDescription')}
                  />
                )}
              </Box>
              <DwaionEvaluationHistory
                runs={runs.data ?? []}
                selectedRunId={selectedRunId}
                run={selectedRun.data}
                baseline={baselineRun.data}
                loading={runs.isLoading}
                canExport={canExport}
                exporting={exportMutation.isPending}
                onSelect={setSelectedRunId}
                onExport={() => exportMutation.mutate()}
              />
            </Stack>
          ) : null}
        </Box>
      </Box>

      <EvaluationSetDialog
        draft={setDraft}
        busy={createMutation.isPending}
        onChange={setSetDraft}
        onClose={() => setSetDraft(null)}
        onSubmit={() => {
          if (setDraft) createMutation.mutate(setDraft);
        }}
      />
      <EvaluationCaseDialog
        draft={caseDraft}
        busy={caseMutation.isPending}
        onChange={setCaseDraft}
        onClose={() => setCaseDraft(null)}
        onSubmit={() => {
          if (caseDraft) caseMutation.mutate(caseDraft);
        }}
      />
    </PageCanvas>
  );
}
