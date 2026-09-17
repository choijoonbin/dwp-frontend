import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CheckCircle2,
  Database,
  FileDown,
  FlaskConical,
  ListChecks,
  Play,
  Plus,
} from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  FormField,
  foundationTokens,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  SignalMetric,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
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
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';
import { DwaionEvaluationOperationsPanel } from './admin-advancement/dwaion-evaluation-operations-panel';
import {
  EMPTY_EVALUATION_CASE,
  EMPTY_EVALUATION_SET,
  EvaluationCaseDialog,
  EvaluationSetDialog,
  type EvaluationCaseDraft,
  type EvaluationSetDraft,
} from './dwaion-evaluation-dialogs';
import { DwaionEvaluationHistory } from './dwaion-evaluation-history';
import { DwaionEvaluationSetList } from './dwaion-evaluation-set-list';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

export function DwaionAdminEvaluation() {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const queryClient = useQueryClient();
  const governCreate = useDwaionGovernedMutation(
    'route.dwaion.management.evaluation-create.action'
  );
  const governCaseCreate = useDwaionGovernedMutation(
    'route.dwaion.management.evaluation-case-create.action'
  );
  const governLifecycle = useDwaionGovernedMutation(
    'route.dwaion.management.evaluation-lifecycle.action'
  );
  const governRun = useDwaionGovernedMutation('route.dwaion.management.evaluation-run.action');
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('ADMIN.DWAION_EVALUATION', 'CREATE');
  const canUpdate = hasPermission('ADMIN.DWAION_EVALUATION', 'UPDATE');
  const canManage = hasPermission('ADMIN.DWAION_EVALUATION', 'MANAGE');
  const canExecute = hasPermission('ADMIN.DWAION_EVALUATION', 'EXECUTE');
  const canExport = hasPermission('ADMIN.DWAION_EVALUATION', 'EXPORT');
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
  const setRows = useMemo(() => sets.data ?? [], [sets.data]);

  useEffect(() => {
    if (!selectedId && setRows.length) setSelectedId(setRows[0].evaluationSetId);
  }, [selectedId, setRows]);

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
    setReason('');
  }, [selectedId]);
  useEffect(() => {
    if (!selectedRunId && runs.data?.length) setSelectedRunId(runs.data[0].evaluationRunId);
  }, [runs.data, selectedRunId]);

  const selectedRun = useQuery({
    queryKey: ['dwaion', 'admin', 'evaluation-run', selectedId, selectedRunId],
    queryFn: () => getDwaionEvaluationRun(selectedId!, selectedRunId!),
    enabled: Boolean(selectedId && selectedRunId),
    staleTime: 30_000,
  });

  const refresh = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'evaluations'] });
    if (!id) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'evaluation', id] }),
      queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'evaluation-runs', id] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (draft: EvaluationSetDraft) =>
      governCreate((authority) =>
        createDwaionEvaluationSet(
          {
            name: draft.name.trim(),
            description: draft.description.trim() || undefined,
            locale: draft.locale,
          },
          authority
        )
      ),
    onSuccess: async (created) => {
      setSetDraft(null);
      setSelectedId(created.summary.evaluationSetId);
      await refresh(created.summary.evaluationSetId);
    },
  });
  const caseMutation = useMutation({
    mutationFn: (draft: EvaluationCaseDraft) =>
      governCaseCreate((authority) =>
        addDwaionEvaluationCase(
          selectedId!,
          {
            name: draft.name.trim(),
            prompt: draft.prompt.trim(),
            expectedTerms: draft.expectedTerms
              .split(',')
              .map((term) => term.trim())
              .filter(Boolean),
            sourceScopes: draft.sourceScopes,
          },
          authority
        )
      ),
    onSuccess: async () => {
      setCaseDraft(null);
      await refresh(selectedId!);
    },
  });
  const lifecycleMutation = useMutation({
    mutationFn: (state: 'ACTIVE' | 'RETIRED') =>
      governLifecycle((authority) =>
        transitionDwaionEvaluationSet(
          selectedId!,
          {
            lifecycleState: state,
            expectedVersion: detail.data!.summary.version,
            changeReason: reason.trim(),
          },
          authority
        )
      ),
    onSuccess: async () => {
      setReason('');
      await refresh(selectedId!);
    },
  });
  const runMutation = useMutation({
    mutationFn: () => governRun((authority) => runDwaionEvaluation(selectedId!, authority)),
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

  const summary = useMemo(
    () => ({
      active: setRows.filter((row) => row.lifecycleState === 'ACTIVE').length,
      cases: setRows.reduce((total, row) => total + row.caseCount, 0),
      completed: setRows.filter((row) => row.latestRunState === 'COMPLETED').length,
    }),
    [setRows]
  );
  const selectedSummary = detail.data?.summary;
  const mutationFailed =
    createMutation.isError ||
    caseMutation.isError ||
    lifecycleMutation.isError ||
    runMutation.isError ||
    exportMutation.isError;

  return (
    <PageCanvas topInset="compact">
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.shared.governance')}
        title={t('dwaionAdmin.evaluation.title')}
        description={t('dwaionAdmin.evaluation.description')}
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="stretch">
            <ActionButton
              intent="secondary"
              startIcon={<FileDown size={16} />}
              onClick={() =>
                document
                  .getElementById('dwaion-evaluation-operations')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              Dataset import
            </ActionButton>
            {canCreate && (
              <ActionButton
                intent="secondary"
                startIcon={<Plus size={16} />}
                onClick={() => setSetDraft({ ...EMPTY_EVALUATION_SET })}
              >
                {t('dwaionAdmin.evaluation.create')}
              </ActionButton>
            )}
            {canExecute && selectedSummary?.lifecycleState === 'ACTIVE' && (
              <ActionButton
                intent="primary"
                startIcon={<Play size={16} />}
                loading={runMutation.isPending}
                disabled={runs.data?.some((item) => item.runState === 'RUNNING')}
                onClick={() => runMutation.mutate()}
              >
                {t('dwaionAdmin.evaluation.run')}
              </ActionButton>
            )}
          </Stack>
        }
      />

      {mutationFailed && (
        <InlineFeedback severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.evaluation.error')}
        </InlineFeedback>
      )}
      <InlineFeedback severity="info" sx={{ mt: 2 }}>
        {t('dwaionAdmin.evaluation.dataBoundary')} {t('dwaionAdmin.evaluation.ruleBoundary')}
      </InlineFeedback>

      {sets.isError ? (
        <Box sx={{ mt: 3 }}>
          <ErrorState
            size="page"
            title={t('dwaionAdmin.evaluation.error')}
            description={t('dwaionAdmin.evaluation.unavailableDescription')}
            retryLabel={t('dwaionAdmin.shared.retry')}
            retrying={sets.isFetching}
            onRetry={() => void sets.refetch()}
          />
        </Box>
      ) : (
        <>
          <Box
            component="section"
            aria-label={t('dwaionAdmin.evaluation.summaryLabel')}
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <SignalMetric
              label={t('dwaionAdmin.evaluation.summary.loaded')}
              value={String(setRows.length)}
              detail={t('dwaionAdmin.evaluation.summary.loadedDetail')}
              icon={<Database size={18} />}
            />
            <SignalMetric
              label={t('dwaionAdmin.evaluation.summary.active')}
              value={String(summary.active)}
              detail={t('dwaionAdmin.evaluation.summary.activeDetail')}
              icon={<CheckCircle2 size={18} />}
              tone="success"
            />
            <SignalMetric
              label={t('dwaionAdmin.evaluation.summary.cases')}
              value={String(summary.cases)}
              detail={t('dwaionAdmin.evaluation.summary.casesDetail')}
              icon={<ListChecks size={18} />}
              tone="info"
            />
            <SignalMetric
              label={t('dwaionAdmin.evaluation.summary.completed')}
              value={String(summary.completed)}
              detail={t('dwaionAdmin.evaluation.summary.completedDetail')}
              icon={<FlaskConical size={18} />}
              tone="warning"
            />
          </Box>

          <InlineFeedback severity="warning" sx={{ mt: 2 }}>
            {t('dwaionAdmin.evaluation.unsupportedNotice')}
          </InlineFeedback>

          <Box
            component="section"
            sx={{
              mt: 2,
              p: { xs: 1.5, md: 2 },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.radius.surface + 'px',
              minWidth: 0,
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              gap={1}
            >
              <Box>
                <Typography component="h2" variant="h6">
                  {t('dwaionAdmin.evaluation.registryTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('dwaionAdmin.evaluation.registryScope', { count: setRows.length })}
                </Typography>
              </Box>
              <Chip size="small" variant="outlined" label={t('dwaionAdmin.evaluation.contract')} />
            </Stack>

            {sets.isLoading ? (
              <LoadingState
                size="page"
                variant="skeleton"
                label={t('dwaionAdmin.evaluation.loading')}
              />
            ) : (
              <Box
                sx={{
                  mt: 2,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    lg: 'minmax(0, 1.15fr) minmax(0, 1fr)',
                  },
                  gap: 1.5,
                  alignItems: 'start',
                  minWidth: 0,
                }}
              >
                <Box sx={{ minWidth: 0, borderBlock: 1, borderColor: 'divider' }}>
                  <DwaionEvaluationSetList
                    rows={setRows}
                    selectedId={selectedId}
                    loading={false}
                    failed={false}
                    onSelect={setSelectedId}
                  />
                </Box>
                <Box
                  component="section"
                  aria-label={t('dwaionAdmin.evaluation.detailLabel')}
                  sx={{
                    minWidth: 0,
                    maxHeight: { lg: 'calc(100vh - 7rem)' },
                    overflowY: { lg: 'auto' },
                    p: 1.75,
                    border: 1,
                    borderColor: 'divider',
                    borderTop: 3,
                    borderTopColor: 'primary.main',
                    borderRadius: foundationTokens.radius.surface + 'px',
                    bgcolor: 'background.paper',
                  }}
                >
                  {!selectedId ? (
                    <GuidedEmptyState
                      kind="empty"
                      title={t('dwaionAdmin.evaluation.emptyTitle')}
                      description={t('dwaionAdmin.evaluation.emptyDescription')}
                    />
                  ) : detail.isLoading ? (
                    <Skeleton variant="rounded" height={420} />
                  ) : detail.isError || !detail.data ? (
                    <InlineFeedback severity="error">
                      {t('dwaionAdmin.evaluation.detailUnavailable')}
                    </InlineFeedback>
                  ) : (
                    <Stack spacing={2}>
                      <Box>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          justifyContent="space-between"
                          gap={1.5}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography component="h3" variant="h6">
                              {detail.data.summary.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 0.35, overflowWrap: 'anywhere' }}
                            >
                              {detail.data.summary.description ||
                                t('dwaionAdmin.evaluation.noDescription')}
                            </Typography>
                          </Box>
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
                        </Stack>
                        <Stack
                          direction="row"
                          gap={0.75}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{ mt: 1.25 }}
                        >
                          <Chip
                            size="small"
                            variant="outlined"
                            label={detail.data.summary.lifecycleState}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={t('dwaionAdmin.evaluation.metadata.locale', {
                              value: detail.data.summary.locale,
                            })}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={t('dwaionAdmin.evaluation.metadata.version', {
                              value: detail.data.summary.version,
                            })}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={formatDate(
                              detail.data.summary.updatedAt,
                              { dateStyle: 'medium', timeStyle: 'short' },
                              locale
                            )}
                          />
                        </Stack>
                      </Box>

                      <Box component="section" aria-labelledby="evaluation-case-title">
                        <Typography id="evaluation-case-title" component="h4" variant="subtitle1">
                          {t('dwaionAdmin.evaluation.casesTitle')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('dwaionAdmin.evaluation.casesDescription')}
                        </Typography>
                        <Box sx={{ mt: 1, borderBlock: 1, borderColor: 'divider' }}>
                          {detail.data.cases.length ? (
                            detail.data.cases.map((item, index) => (
                              <Box key={item.evaluationCaseId}>
                                {index > 0 && <Divider />}
                                <Box sx={{ py: 1.25 }}>
                                  <Stack direction="row" justifyContent="space-between" gap={2}>
                                    <Box sx={{ minWidth: 0 }}>
                                      <Typography variant="body2" fontWeight={800}>
                                        {item.name}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        component="p"
                                        sx={{ mt: 0.3, overflowWrap: 'anywhere' }}
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
                                    gap={0.5}
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
                              size="compact"
                            />
                          )}
                        </Box>
                      </Box>

                      <DwaionEvaluationHistory
                        runs={runs.data ?? []}
                        selectedRunId={selectedRunId}
                        run={selectedRun.isError ? undefined : selectedRun.data}
                        loading={runs.isLoading}
                        canExport={canExport}
                        exporting={exportMutation.isPending}
                        onSelect={setSelectedRunId}
                        onExport={() => exportMutation.mutate()}
                      />
                      {canManage &&
                        ['DRAFT', 'ACTIVE'].includes(detail.data.summary.lifecycleState) && (
                          <Box
                            component="section"
                            aria-label={t('dwaionAdmin.evaluation.lifecycleTitle')}
                            sx={{
                              p: 1.5,
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: foundationTokens.radius.control + 'px',
                            }}
                          >
                            <Typography component="h4" variant="subtitle2">
                              {t('dwaionAdmin.evaluation.lifecycleTitle')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t('dwaionAdmin.evaluation.lifecycleDescription')}
                            </Typography>
                            <FormField
                              label={t('dwaionAdmin.shared.reason')}
                              value={reason}
                              multiline
                              minRows={2}
                              onChange={(event) => setReason(event.target.value)}
                              sx={{ mt: 1 }}
                            />
                            <ActionButton
                              intent={
                                detail.data.summary.lifecycleState === 'DRAFT'
                                  ? 'secondary'
                                  : 'danger'
                              }
                              size="small"
                              startIcon={
                                detail.data.summary.lifecycleState === 'DRAFT' ? (
                                  <CheckCircle2 size={16} />
                                ) : (
                                  <Archive size={16} />
                                )
                              }
                              disabled={
                                reason.trim().length < 10 ||
                                (detail.data.summary.lifecycleState === 'DRAFT' &&
                                  !detail.data.cases.length)
                              }
                              loading={lifecycleMutation.isPending}
                              onClick={() =>
                                lifecycleMutation.mutate(
                                  detail.data.summary.lifecycleState === 'DRAFT'
                                    ? 'ACTIVE'
                                    : 'RETIRED'
                                )
                              }
                              sx={{ mt: 1 }}
                            >
                              {t(
                                detail.data.summary.lifecycleState === 'DRAFT'
                                  ? 'dwaionAdmin.evaluation.activate'
                                  : 'dwaionAdmin.evaluation.retire'
                              )}
                            </ActionButton>
                          </Box>
                        )}
                    </Stack>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </>
      )}

      <DwaionEvaluationOperationsPanel />

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
