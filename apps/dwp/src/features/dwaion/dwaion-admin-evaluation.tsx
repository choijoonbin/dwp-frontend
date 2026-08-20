import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FlaskConical, Play, Plus, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import {
  addDwaionEvaluationCase,
  createDwaionEvaluationSet,
  getDwaionEvaluationSet,
  listDwaionEvaluationSets,
  runDwaionEvaluation,
  transitionDwaionEvaluationSet,
  type DwaionEvaluationRun,
  type DwaionEvaluationSetSummary,
  type DwaionSourceKey,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';

import type { GridColDef } from '@mui/x-data-grid';

const SOURCE_KEYS: DwaionSourceKey[] = [
  'WORK_ITEM',
  'MAIL',
  'CALENDAR',
  'APPROVAL_TASK',
  'APPROVAL_REQUEST',
  'APPROVAL_FORM',
  'APPROVAL_OPERATION',
];

type SetDraft = { name: string; description: string; locale: string };
type CaseDraft = {
  name: string;
  prompt: string;
  expectedTerms: string;
  sourceScopes: DwaionSourceKey[];
};
const EMPTY_SET: SetDraft = { name: '', description: '', locale: 'ko-KR' };
const EMPTY_CASE: CaseDraft = {
  name: '',
  prompt: '',
  expectedTerms: '',
  sourceScopes: ['WORK_ITEM'],
};

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [setDraft, setSetDraft] = useState<SetDraft | null>(null);
  const [caseDraft, setCaseDraft] = useState<CaseDraft | null>(null);
  const [run, setRun] = useState<DwaionEvaluationRun | null>(null);
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
  const refresh = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'evaluations'] });
    if (id)
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'evaluation', id] });
  };
  const createMutation = useMutation({
    mutationFn: (draft: SetDraft) =>
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
    mutationFn: (draft: CaseDraft) =>
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
      setRun(result);
      await refresh(selectedId!);
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
    runMutation.isError;

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
              onClick={() => setSetDraft({ ...EMPTY_SET })}
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
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(440px, .85fr) minmax(520px, 1.15fr)' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box sx={{ borderBlock: 1, borderColor: 'divider' }}>
          <EnterpriseDataGrid
            ariaLabel={t('dwaionAdmin.evaluation.tableLabel')}
            rows={sets.data ?? []}
            columns={columns}
            getRowId={(row) => row.evaluationSetId}
            loading={sets.isLoading}
            hideFooter
            onRowClick={({ row }) => {
              setSelectedId(row.evaluationSetId);
              setRun(null);
            }}
            sx={{ border: 0, borderRadius: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          />
        </Box>
        <Box component="section" aria-label={t('dwaionAdmin.evaluation.detailLabel')}>
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
                        onClick={() => setCaseDraft({ ...EMPTY_CASE })}
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
              {run && <EvaluationRunResult run={run} />}
            </Stack>
          ) : null}
        </Box>
      </Box>

      <FormDialog
        open={Boolean(setDraft)}
        title={t('dwaionAdmin.evaluation.setDialogTitle')}
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.shared.create')}
        submittingLabel={t('dwaionAdmin.shared.saving')}
        busy={createMutation.isPending}
        submitDisabled={!setDraft?.name.trim()}
        onClose={() => setSetDraft(null)}
        onSubmit={() => {
          if (setDraft) createMutation.mutate(setDraft);
        }}
      >
        {setDraft && (
          <Stack spacing={2}>
            <FormField
              label={t('dwaionAdmin.evaluation.fields.name')}
              value={setDraft.name}
              onChange={(event) => setSetDraft({ ...setDraft, name: event.target.value })}
            />
            <FormField
              label={t('dwaionAdmin.evaluation.fields.description')}
              value={setDraft.description}
              multiline
              minRows={3}
              onChange={(event) => setSetDraft({ ...setDraft, description: event.target.value })}
            />
            <FormField
              label={t('dwaionAdmin.evaluation.fields.locale')}
              value={setDraft.locale}
              onChange={(event) => setSetDraft({ ...setDraft, locale: event.target.value })}
            />
          </Stack>
        )}
      </FormDialog>
      <FormDialog
        open={Boolean(caseDraft)}
        title={t('dwaionAdmin.evaluation.caseDialogTitle')}
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.shared.create')}
        submittingLabel={t('dwaionAdmin.shared.saving')}
        busy={caseMutation.isPending}
        submitDisabled={
          !caseDraft?.name.trim() || !caseDraft?.prompt.trim() || !caseDraft.sourceScopes.length
        }
        onClose={() => setCaseDraft(null)}
        onSubmit={() => {
          if (caseDraft) caseMutation.mutate(caseDraft);
        }}
      >
        {caseDraft && (
          <Stack spacing={2}>
            <FormField
              label={t('dwaionAdmin.evaluation.fields.caseName')}
              value={caseDraft.name}
              onChange={(event) => setCaseDraft({ ...caseDraft, name: event.target.value })}
            />
            <FormField
              label={t('dwaionAdmin.evaluation.fields.prompt')}
              value={caseDraft.prompt}
              multiline
              minRows={4}
              onChange={(event) => setCaseDraft({ ...caseDraft, prompt: event.target.value })}
            />
            <FormField
              label={t('dwaionAdmin.evaluation.fields.expectedTerms')}
              supportingText={t('dwaionAdmin.evaluation.fields.expectedTermsHelp')}
              value={caseDraft.expectedTerms}
              onChange={(event) =>
                setCaseDraft({ ...caseDraft, expectedTerms: event.target.value })
              }
            />
            <Box>
              <Typography variant="body2" fontWeight={750}>
                {t('dwaionAdmin.evaluation.fields.sources')}
              </Typography>
              <FormGroup row>
                {SOURCE_KEYS.map((source) => (
                  <FormControlLabel
                    key={source}
                    control={
                      <Checkbox
                        size="small"
                        checked={caseDraft.sourceScopes.includes(source)}
                        onChange={(event) =>
                          setCaseDraft({
                            ...caseDraft,
                            sourceScopes: event.target.checked
                              ? [...caseDraft.sourceScopes, source]
                              : caseDraft.sourceScopes.filter((item) => item !== source),
                          })
                        }
                      />
                    }
                    label={source}
                  />
                ))}
              </FormGroup>
            </Box>
          </Stack>
        )}
      </FormDialog>
    </PageCanvas>
  );
}

function EvaluationRunResult({ run }: { run: DwaionEvaluationRun }) {
  const { t } = useTranslation('work');
  return (
    <Box component="section">
      <Stack direction="row" spacing={1} alignItems="center">
        <FlaskConical size={18} color="var(--dwp-product-accent)" />
        <Typography component="h3" variant="subtitle1" fontWeight={850}>
          {t('dwaionAdmin.evaluation.runResult')}
        </Typography>
        <Chip size="small" variant="outlined" label={run.runState} />
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
        <Chip
          color="success"
          variant="outlined"
          label={t('dwaionAdmin.evaluation.passed', { count: run.passedCount })}
        />
        <Chip
          color="error"
          variant="outlined"
          label={t('dwaionAdmin.evaluation.failed', { count: run.failedCount })}
        />
        <Chip
          color="warning"
          variant="outlined"
          label={t('dwaionAdmin.evaluation.configuration', {
            count: run.configurationRequiredCount,
          })}
        />
      </Stack>
      <Box sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}>
        {run.results.map((result, index) => (
          <Box key={result.evaluationCaseId}>
            {index > 0 && <Divider />}
            <Stack direction="row" justifyContent="space-between" gap={2} sx={{ py: 1.2 }}>
              <Box>
                <Typography variant="body2" fontWeight={750}>
                  {result.caseName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {result.statusCode} ·{' '}
                  {t('dwaionAdmin.evaluation.latency', { count: result.latencyMs })}
                </Typography>
              </Box>
              <Chip
                size="small"
                color={
                  result.outcome === 'PASS'
                    ? 'success'
                    : result.outcome === 'FAIL'
                      ? 'error'
                      : 'warning'
                }
                label={t(`dwaionAdmin.evaluation.outcomes.${result.outcome}`)}
              />
            </Stack>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
