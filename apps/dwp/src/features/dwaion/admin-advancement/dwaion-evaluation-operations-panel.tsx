import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileCheck2, FileUp, FlaskConical, ShieldAlert, ShieldCheck } from 'lucide-react';
import { OperationalKpiStrip } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getDwaionEvaluationSafety } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';
import { DwaionCanonicalCommandActions } from './dwaion-canonical-command-actions';
import { evaluationCanonicalActions } from './dwaion-evaluation-canonical-actions';
import {
  DwaionAdminQueryBoundary,
  DwaionAdminSection,
  DwaionCapabilityNotice,
  DwaionFreshness,
} from './dwaion-admin-advancement-ui';
import {
  DwaionGovernedCommandDialog,
  type DwaionCommandIntent,
} from './dwaion-governed-command-dialog';
import {
  DwaionComparisonDialog,
  DwaionDatasetDialog,
  DwaionPiiDecisionDialog,
  type DwaionComparisonDraft,
  type DwaionDatasetDraft,
  type DwaionPiiDecisionDraft,
} from './dwaion-evaluation-dialogs';
import { DwaionCommandCapabilityButton } from './dwaion-command-capability-button';

export function DwaionEvaluationOperationsPanel() {
  const copy = useDwaionAdminAdvancementCopy();
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'control-plane', 'evaluation-safety'],
    queryFn: getDwaionEvaluationSafety,
    staleTime: 20_000,
  });
  const [intent, setIntent] = useState<DwaionCommandIntent | null>(null);
  const [datasetDraft, setDatasetDraft] = useState<DwaionDatasetDraft | null>(null);
  const [comparisonDraft, setComparisonDraft] = useState<DwaionComparisonDraft | null>(null);
  const [piiDraft, setPiiDraft] = useState<DwaionPiiDecisionDraft | null>(null);
  const data = query.data;
  const pendingPii = useMemo(
    () =>
      data?.datasets.filter(
        (dataset) => dataset.piiState === 'PENDING' || dataset.piiState === 'REVIEW'
      ) ?? [],
    [data?.datasets]
  );
  const eligibleDatasets = useMemo(
    () => data?.datasets.filter((dataset) => dataset.piiState === 'PASS') ?? [],
    [data?.datasets]
  );

  const submitDataset = () => {
    if (!datasetDraft) return;
    setIntent({
      title: copy.evaluation.importDataset,
      description: copy.command.description,
      kind: 'DATASET_IMPORT',
      target: {
        type: 'EVALUATION_DATASET',
        id: datasetDraft.name.trim().toLowerCase().replace(/\s+/g, '-'),
      },
      expectedVersion: 0,
      changes: [
        { label: 'Dataset', before: '—', after: datasetDraft.name },
        { label: 'Format', before: '—', after: datasetDraft.format },
        { label: 'PII handling', before: '—', after: datasetDraft.piiHandling },
      ],
      impacts: [datasetDraft.ownerRef, datasetDraft.schemaMapping, 'Evaluation data retention'],
      recoveryPlan:
        'Reject the imported version, purge staged rows, and preserve the immutable checksum evidence.',
      payload: datasetDraft,
    });
    setDatasetDraft(null);
  };

  const submitComparison = () => {
    if (!comparisonDraft) return;
    const dataset = data?.datasets.find((item) => item.datasetId === comparisonDraft.datasetId);
    if (!dataset || dataset.piiState !== 'PASS') return;
    setIntent({
      title: copy.evaluation.compare,
      description: copy.command.description,
      kind: 'EVALUATION_COMPARE',
      target: { type: 'EVALUATION_DATASET', id: comparisonDraft.datasetId },
      expectedVersion: dataset?.version ?? 0,
      changes: [
        { label: 'Baseline', before: comparisonDraft.baseline, after: comparisonDraft.candidate },
        { label: 'Prompt', before: 'Pinned', after: comparisonDraft.promptVersion },
        { label: 'Evaluator', before: 'Pinned', after: comparisonDraft.evaluatorVersion },
      ],
      impacts: [
        dataset?.name ?? comparisonDraft.datasetId,
        'Release gate evidence',
        'No production policy change',
      ],
      recoveryPlan:
        'Cancel queued evaluator jobs and retain partial results as incomplete evidence.',
      payload: comparisonDraft,
    });
    setComparisonDraft(null);
  };

  const submitPiiDecision = () => {
    if (!piiDraft) return;
    const dataset = data?.datasets.find((item) => item.datasetId === piiDraft.datasetId);
    if (!dataset) return;
    setIntent({
      title: 'PII review decision',
      description: copy.command.description,
      kind: 'DATASET_PII_DECIDE',
      target: { type: 'EVALUATION_DATASET', id: dataset.datasetId },
      expectedVersion: dataset.version,
      changes: [{ label: 'PII state', before: dataset.piiState, after: piiDraft.decision }],
      impacts: [dataset.ownerRef, `${dataset.caseCount} cases`, piiDraft.evidenceRefs],
      recoveryPlan:
        'Quarantine the dataset version and revoke it from all queued comparisons if evidence is invalidated.',
      payload: {
        decision: piiDraft.decision,
        evidenceRefs: splitRefs(piiDraft.evidenceRefs),
        reviewerNote: piiDraft.reviewerNote,
      },
      destructive: piiDraft.decision === 'BLOCKED',
    });
    setPiiDraft(null);
  };

  return (
    <Box id="dwaion-evaluation-operations" sx={{ mt: 2.5, scrollMarginTop: 16 }}>
      <DwaionAdminQueryBoundary
        loading={query.isLoading}
        error={query.isError}
        fetching={query.isFetching}
        onRetry={() => void query.refetch()}
      >
        {data && (
          <Stack spacing={2}>
            <DwaionCapabilityNotice capability={data.capability} />
            <DwaionAdminSection
              title={copy.evaluation.title}
              description={copy.evaluation.description}
              actions={
                <DwaionFreshness
                  generatedAt={data.generatedAt}
                  fetching={query.isFetching}
                  onRefresh={() => void query.refetch()}
                />
              }
            >
              <OperationalKpiStrip
                ariaLabel={copy.ui.evaluation.summaryLabel}
                items={[
                  { key: 'datasets', label: 'Datasets', value: data.datasets.length },
                  {
                    key: 'pii',
                    label: 'PII review',
                    value: pendingPii.length,
                    tone: pendingPii.length ? 'warning' : 'success',
                  },
                  {
                    key: 'regressions',
                    label: 'Regressions',
                    value: data.comparisons.reduce(
                      (sum, item) => sum + (item.regressionCount ?? 0),
                      0
                    ),
                    tone: data.comparisons.some((item) => (item.regressionCount ?? 0) > 0)
                      ? 'critical'
                      : 'success',
                  },
                  {
                    key: 'drift',
                    label: 'Production drift',
                    value: data.driftSignals.length,
                    tone: data.driftSignals.some((signal) => signal.severity === 'CRITICAL')
                      ? 'critical'
                      : 'warning',
                  },
                  {
                    key: 'gate',
                    label: 'Release gate',
                    value: data.releaseGateState,
                    tone: data.releaseGateState === 'PASS' ? 'success' : 'warning',
                  },
                ]}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0,1fr)',
                    xl: 'minmax(0,7fr) minmax(19rem,5fr)',
                  },
                  gap: 2,
                  p: { xs: 1.5, md: 2 },
                  alignItems: 'start',
                }}
              >
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                    <DwaionCommandCapabilityButton
                      commandKind="DATASET_IMPORT"
                      intent="primary"
                      startIcon={<FileUp size={16} />}
                      onClick={() =>
                        setDatasetDraft({
                          name: '',
                          ownerRef: '',
                          format: 'CSV',
                          checksumSha256: '',
                          schemaMapping: '',
                          piiHandling: '',
                        })
                      }
                    >
                      {copy.evaluation.importDataset}
                    </DwaionCommandCapabilityButton>
                    <DwaionCommandCapabilityButton
                      commandKind="EVALUATION_COMPARE"
                      intent="secondary"
                      startIcon={<FlaskConical size={16} />}
                      disabled={!eligibleDatasets.length}
                      onClick={() =>
                        setComparisonDraft({
                          datasetId: eligibleDatasets[0]?.datasetId ?? '',
                          baseline: '',
                          candidate: '',
                          promptVersion: '',
                          policyVersion: '',
                          toolVersion: '',
                          evaluatorVersion: '',
                        })
                      }
                    >
                      {copy.evaluation.compare}
                    </DwaionCommandCapabilityButton>
                    <DwaionCommandCapabilityButton
                      commandKind="SAFETY_SIMULATE"
                      intent="secondary"
                      startIcon={<ShieldAlert size={16} />}
                      onClick={() =>
                        setIntent({
                          title: copy.ui.evaluation.safetySimulation,
                          description:
                            'Run adversarial and policy scenarios without changing production.',
                          kind: 'SAFETY_SIMULATE',
                          target: { type: 'SAFETY_POLICY', id: 'production' },
                          expectedVersion: 0,
                          changes: [
                            {
                              label: 'Production policy',
                              before: 'Unchanged',
                              after: 'Dry-run only',
                            },
                          ],
                          impacts: ['Synthetic and anonymized samples only'],
                          recoveryPlan:
                            'Cancel simulation workers and discard incomplete results; production remains unchanged.',
                          payload: {
                            suites: ['PROMPT_INJECTION', 'PRIVILEGED_DATA', 'TOOL_MISUSE'],
                          },
                        })
                      }
                    >
                      {copy.ui.evaluation.safetySimulation}
                    </DwaionCommandCapabilityButton>
                  </Stack>
                  <Box
                    sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
                  >
                    {data.comparisons.map((comparison, index) => (
                      <Stack
                        key={comparison.comparisonId}
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        gap={1}
                        sx={{ px: 1.5, py: 1.25, borderTop: index ? 1 : 0, borderColor: 'divider' }}
                      >
                        <Box>
                          <Typography variant="subtitle2">
                            {comparison.baselineLabel} → {comparison.candidateLabel}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {comparison.comparisonId} ·{' '}
                            {formatDate(comparison.createdAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </Typography>
                        </Box>
                        <Stack direction="row" gap={1} alignItems="center">
                          <Chip size="small" label={comparison.state} />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={
                              comparison.passRate == null
                                ? '—'
                                : `${comparison.passRate.toFixed(2)}%`
                            }
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            color={(comparison.regressionCount ?? 0) > 0 ? 'warning' : 'default'}
                            label={`Regression ${comparison.regressionCount ?? '—'}`}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            color={
                              (comparison.evaluatorFailureCount ?? 0) > 0 ? 'error' : 'default'
                            }
                            label={`Evaluator failures ${comparison.evaluatorFailureCount ?? '—'}`}
                          />
                        </Stack>
                      </Stack>
                    ))}
                  </Box>
                </Stack>
                <Stack spacing={2}>
                  <Typography component="h3" variant="subtitle1">
                    {copy.ui.evaluation.productionDriftReview}
                  </Typography>
                  {data.driftSignals.map((signal) => (
                    <Box
                      key={signal.signalId}
                      sx={{
                        p: 1.5,
                        border: 1,
                        borderColor: signal.severity === 'CRITICAL' ? 'error.main' : 'divider',
                        borderRadius: 2,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography variant="subtitle2">{signal.label}</Typography>
                        <Chip
                          size="small"
                          color={signal.severity === 'CRITICAL' ? 'error' : 'warning'}
                          label={signal.severity}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {signal.affectedScope} · {signal.currentValue ?? '—'} /{' '}
                        {signal.threshold ?? '—'}
                      </Typography>
                      {signal.anonymizedSample && (
                        <Typography variant="body2" sx={{ mt: 0.75 }}>
                          {copy.ui.evaluation.anonymizedSample} {signal.anonymizedSample}
                        </Typography>
                      )}
                      {signal.feedbackEvidenceRef && (
                        <Typography variant="caption" color="text.secondary" component="p">
                          {copy.ui.evaluation.feedbackEvidence} {signal.feedbackEvidenceRef}
                        </Typography>
                      )}
                      {signal.rollbackRecommendation && (
                        <Typography variant="caption" color="warning.main" component="p">
                          {copy.ui.evaluation.recommendation} {signal.rollbackRecommendation}
                        </Typography>
                      )}
                      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
                        <DwaionCommandCapabilityButton
                          commandKind="DRIFT_EVIDENCE_ATTACH"
                          intent="quiet"
                          startIcon={<FileCheck2 size={15} />}
                          onClick={() =>
                            setIntent({
                              title: copy.evaluation.attachEvidence,
                              description: copy.command.description,
                              kind: 'DRIFT_EVIDENCE_ATTACH',
                              target: { type: 'DRIFT_SIGNAL', id: signal.signalId },
                              expectedVersion: 0,
                              changes: [
                                {
                                  label: 'Gate evidence',
                                  before: 'Not linked',
                                  after: signal.signalId,
                                },
                              ],
                              impacts: [signal.affectedScope, 'Release gate'],
                              recoveryPlan:
                                'Remove the evidence link while retaining the immutable source event.',
                              payload: { signalId: signal.signalId },
                            })
                          }
                        >
                          {copy.evaluation.attachEvidence}
                        </DwaionCommandCapabilityButton>
                        {!signal.approvedRawAccess && (
                          <DwaionCommandCapabilityButton
                            commandKind="DRIFT_RAW_EVIDENCE_REQUEST"
                            intent="quiet"
                            onClick={() =>
                              setIntent({
                                title: 'Request approved raw evidence',
                                description: copy.command.description,
                                kind: 'DRIFT_RAW_EVIDENCE_REQUEST',
                                target: { type: 'DRIFT_SIGNAL', id: signal.signalId },
                                expectedVersion: 0,
                                changes: [
                                  {
                                    label: 'Raw evidence access',
                                    before: 'Not approved',
                                    after: 'Approval pending',
                                  },
                                ],
                                impacts: [signal.affectedScope, 'Sensitive production evidence'],
                                recoveryPlan:
                                  'Expire the access grant and retain only the anonymized evidence reference.',
                                payload: { signalId: signal.signalId, access: 'TIME_BOUND_READ' },
                              })
                            }
                          >
                            {copy.ui.evaluation.requestRawEvidence}
                          </DwaionCommandCapabilityButton>
                        )}
                      </Stack>
                    </Box>
                  ))}
                  {pendingPii.map((dataset) => (
                    <Box
                      key={dataset.datasetId}
                      sx={{ p: 1.5, border: 1, borderColor: 'warning.main', borderRadius: 2 }}
                    >
                      <Typography variant="subtitle2">{dataset.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dataset.piiState} {copy.ui.common.checksumSeparator}{' '}
                        {dataset.checksumSha256 ?? 'unavailable'}
                      </Typography>
                      <DwaionCommandCapabilityButton
                        commandKind="DATASET_PII_DECIDE"
                        intent="primary"
                        startIcon={<ShieldCheck size={15} />}
                        onClick={() =>
                          setPiiDraft({
                            datasetId: dataset.datasetId,
                            name: dataset.name,
                            version: dataset.version,
                            before: dataset.piiState,
                            decision: 'PASS',
                            evidenceRefs: '',
                            reviewerNote: '',
                          })
                        }
                      >
                        {copy.ui.evaluation.reviewPii}
                      </DwaionCommandCapabilityButton>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </DwaionAdminSection>
            <DwaionCanonicalCommandActions
              title={copy.ui.evaluation.releaseGateOperations}
              description={copy.ui.evaluation.releaseGateOperationsDescription}
              actions={evaluationCanonicalActions(data, copy.command.description)}
              disabled={!data.datasets.some((dataset) => dataset.piiState === 'PASS')}
              onRefresh={async () => {
                await query.refetch();
              }}
            />
          </Stack>
        )}
      </DwaionAdminQueryBoundary>

      <DwaionDatasetDialog
        value={datasetDraft}
        onChange={setDatasetDraft}
        onClose={() => setDatasetDraft(null)}
        onSubmit={submitDataset}
      />
      <DwaionComparisonDialog
        datasets={eligibleDatasets}
        value={comparisonDraft}
        onChange={setComparisonDraft}
        onClose={() => setComparisonDraft(null)}
        onSubmit={submitComparison}
      />
      <DwaionPiiDecisionDialog
        value={piiDraft}
        onChange={setPiiDraft}
        onClose={() => setPiiDraft(null)}
        onSubmit={submitPiiDecision}
      />
      <DwaionGovernedCommandDialog
        intent={intent}
        onClose={() => setIntent(null)}
        onReconcile={async () => {
          await query.refetch();
        }}
        onCompleted={async () => {
          setIntent(null);
          await query.refetch();
        }}
      />
    </Box>
  );
}

function splitRefs(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
