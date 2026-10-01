import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FileCode2,
  PackageCheck,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  appendProviderArtifactRolloutEvidence,
  assessProviderArtifactCompatibility,
  createProviderArtifactManifest,
  createProviderArtifactRolloutPlan,
  decideProviderArtifactManifest,
  decideProviderArtifactRolloutPlan,
  getProviderOperatorProfile,
  listProviderArtifactManifests,
  listProviderArtifactRolloutPlans,
  markProviderArtifactRolloutPlanReady,
  submitProviderArtifactManifest,
  submitProviderArtifactRolloutPlan,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  OperationalContextBar,
  SignalMetric,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  ProviderArtifactManifest,
  ProviderArtifactRolloutPlan,
} from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
} from './provider-ui';

import {
  CompatibilityDialog,
  EvidenceDialog,
  ManifestDialog,
  PlanDialog,
  ReasonDialog,
  ReviewDialog,
} from './provider-artifact-governance-dialogs';
import {
  ArtifactCompatibilityDetails,
  ArtifactRolloutDetails,
} from './provider-artifact-governance-details';
import {
  artifactEnumPresentation,
  canDecideArtifactPlan,
  canReviewArtifact,
  type ArtifactEnumKind,
} from './provider-artifact-governance-model';
import { providerOwnerCountLabel } from './provider-bounded-list-coverage';

type DialogState =
  | { kind: 'manifest' }
  | { kind: 'compatibility'; artifact: ProviderArtifactManifest }
  | { kind: 'artifact-submit'; artifact: ProviderArtifactManifest }
  | {
      kind: 'artifact-review';
      artifact: ProviderArtifactManifest;
      decision: 'APPROVED' | 'RETURNED';
    }
  | { kind: 'plan' }
  | { kind: 'plan-submit'; plan: ProviderArtifactRolloutPlan }
  | { kind: 'plan-decision'; plan: ProviderArtifactRolloutPlan; decision: 'APPROVED' | 'REJECTED' }
  | { kind: 'plan-ready'; plan: ProviderArtifactRolloutPlan }
  | { kind: 'evidence'; plan: ProviderArtifactRolloutPlan };

export function ProviderArtifactGovernance() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const artifacts = useQuery({
    queryKey: ['provider', 'artifact-governance', 'manifests'],
    queryFn: listProviderArtifactManifests,
  });
  const plans = useQuery({
    queryKey: ['provider', 'artifact-governance', 'plans'],
    queryFn: listProviderArtifactRolloutPlans,
  });
  const operatorReady = operator.isSuccess;
  const canWrite = operatorReady && operator.data.permissions.includes('ARTIFACT_GOVERNANCE_WRITE');
  const canApprove =
    operatorReady && operator.data.permissions.includes('ARTIFACT_GOVERNANCE_APPROVE');
  const mutation = useMutation({
    mutationFn: async (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider', 'artifact-governance'] });
      setDialog(null);
      toast.success(t('artifactGovernance.completed'));
    },
    onError: () => toast.error(t('errors.operation')),
  });
  const artifactRows = artifacts.data?.items ?? [];
  const planRows = plans.data?.items ?? [];
  const artifactsPartial = artifacts.data?.hasMore ?? false;
  const plansPartial = plans.data?.hasMore ?? false;
  const selectedArtifact =
    artifactRows.find((item) => item.artifactId === selectedArtifactId) ?? artifactRows[0];
  const selectedPlan =
    planRows.find((item) => item.rolloutPlanId === selectedPlanId) ?? planRows[0];
  const approvedCount = artifactRows.filter((item) => item.lifecycleState === 'APPROVED').length;
  const readyCount = planRows.filter((item) => item.lifecycleState === 'READY').length;
  const enumLabel = (kind: ArtifactEnumKind, value: string) => {
    const safeValue = artifactEnumPresentation(kind, value);
    return safeValue === 'UNAVAILABLE_VALUE'
      ? t('artifactGovernance.enums.unavailable')
      : t(`artifactGovernance.enums.${kind}.${safeValue}`);
  };
  const canReviewSelected = selectedArtifact
    ? canReviewArtifact(selectedArtifact, operator.data?.operatorId, canApprove)
    : false;
  const canDecideSelectedPlan = selectedPlan
    ? canDecideArtifactPlan(selectedPlan, operator.data?.operatorId, canApprove)
    : false;

  if (
    (operator.isLoading || artifacts.isLoading || plans.isLoading) &&
    !artifacts.data &&
    !plans.data
  )
    return <ProviderLoading />;
  if ((operator.isError || artifacts.isError || plans.isError) && !artifacts.data && !plans.data) {
    return (
      <ProviderError
        error={operator.error ?? artifacts.error ?? plans.error}
        onRetry={() => {
          void operator.refetch();
          void artifacts.refetch();
          void plans.refetch();
        }}
        retrying={operator.isFetching || artifacts.isFetching || plans.isFetching}
      />
    );
  }

  return (
    <Stack gap={2.5}>
      <OperationalContextBar
        label={t('artifactGovernance.contextLabel')}
        items={[
          {
            label: t('artifactGovernance.context.manifests'),
            value: providerOwnerCountLabel(artifactRows.length, artifactsPartial),
            icon: <FileCode2 size={16} />,
          },
          {
            label: t('artifactGovernance.context.execution'),
            value: t('artifactGovernance.context.unavailable'),
            icon: <ShieldAlert size={16} />,
          },
        ]}
        actions={
          <Stack direction="row" gap={1}>
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={16} />}
              onClick={() => {
                void artifacts.refetch();
                void plans.refetch();
              }}
            >
              {t('actions.refresh')}
            </ActionButton>
            {canWrite && (
              <ActionButton
                intent="primary"
                startIcon={<Plus size={16} />}
                onClick={() => setDialog({ kind: 'manifest' })}
              >
                {t('artifactGovernance.createManifest')}
              </ActionButton>
            )}
          </Stack>
        }
      />
      <Alert severity="warning">{t('artifactGovernance.externalBoundary')}</Alert>
      {operator.isError && (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => void operator.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('artifactGovernance.ownerFailures.operator')}
        </Alert>
      )}
      {artifacts.isError && (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => void artifacts.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('artifactGovernance.ownerFailures.manifests')}
        </Alert>
      )}
      {plans.isError && (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => void plans.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('artifactGovernance.ownerFailures.plans')}
        </Alert>
      )}
      {artifactsPartial && (
        <Alert severity="warning">
          {t('artifactGovernance.manifestListPartial', {
            count: artifactRows.length,
            limit: artifacts.data?.limit ?? artifactRows.length,
          })}
        </Alert>
      )}
      {plansPartial && (
        <Alert severity="warning">
          {t('artifactGovernance.planListPartial', {
            count: planRows.length,
            limit: plans.data?.limit ?? planRows.length,
          })}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        <SignalMetric
          label={t('artifactGovernance.metrics.manifests')}
          value={
            artifacts.isSuccess
              ? providerOwnerCountLabel(artifactRows.length, artifactsPartial)
              : t('notAvailable')
          }
          detail={t('artifactGovernance.metrics.manifestsDetail')}
          icon={<PackageCheck size={18} />}
        />
        <SignalMetric
          label={t('artifactGovernance.metrics.approved')}
          value={
            artifacts.isSuccess && !artifactsPartial ? String(approvedCount) : t('notAvailable')
          }
          detail={
            artifactsPartial
              ? t('artifactGovernance.metrics.partialDetail')
              : t('artifactGovernance.metrics.approvedDetail')
          }
          icon={<BadgeCheck size={18} />}
          tone={approvedCount ? 'success' : 'neutral'}
        />
        <SignalMetric
          label={t('artifactGovernance.metrics.ready')}
          value={plans.isSuccess && !plansPartial ? String(readyCount) : t('notAvailable')}
          detail={
            plansPartial
              ? t('artifactGovernance.metrics.partialDetail')
              : t('artifactGovernance.metrics.readyDetail')
          }
          icon={<ClipboardCheck size={18} />}
          tone={readyCount ? 'info' : 'neutral'}
        />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
          gap: 2,
        }}
      >
        <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
          <ProviderSectionHeading
            title={t('artifactGovernance.manifestInventory')}
            description={t('artifactGovernance.manifestInventoryDescription')}
          />
          <Stack gap={1} sx={{ mt: 1.5 }}>
            {artifacts.isLoading && !artifacts.data && <ProviderLoading />}
            {artifactRows.map((artifact) => (
              <Paper
                key={artifact.artifactId}
                variant="outlined"
                sx={{
                  bgcolor:
                    selectedArtifact?.artifactId === artifact.artifactId
                      ? 'action.selected'
                      : undefined,
                }}
              >
                <ButtonBase
                  type="button"
                  onClick={() => setSelectedArtifactId(artifact.artifactId)}
                  sx={{
                    width: '100%',
                    p: 1.25,
                    textAlign: 'left',
                    borderRadius: 1,
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" gap={1} width="100%">
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {artifact.productKey} · {artifact.artifactVersion}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {enumLabel('artifactType', artifact.artifactType)} ·{' '}
                        {enumLabel('compatibilityDecision', artifact.compatibilityState)}
                      </Typography>
                    </Box>
                    <ProviderStatusChip state={artifact.lifecycleState} />
                  </Stack>
                </ButtonBase>
              </Paper>
            ))}
            {artifacts.isSuccess && !artifactRows.length && !artifactsPartial && (
              <EmptyState
                title={t('artifactGovernance.emptyArtifacts.title')}
                description={t('artifactGovernance.emptyArtifacts.description')}
                action={
                  canWrite ? (
                    <ActionButton
                      intent="primary"
                      startIcon={<Plus size={16} />}
                      onClick={() => setDialog({ kind: 'manifest' })}
                    >
                      {t('artifactGovernance.createManifest')}
                    </ActionButton>
                  ) : undefined
                }
              />
            )}
          </Stack>
        </Paper>
        <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
          <ProviderSectionHeading
            title={t('artifactGovernance.planInventory')}
            description={t('artifactGovernance.planInventoryDescription')}
            action={
              canWrite ? (
                <ActionButton
                  intent="secondary"
                  startIcon={<Plus size={16} />}
                  onClick={() => setDialog({ kind: 'plan' })}
                >
                  {t('artifactGovernance.createPlan')}
                </ActionButton>
              ) : undefined
            }
          />
          <Stack gap={1} sx={{ mt: 1.5 }}>
            {plans.isLoading && !plans.data && <ProviderLoading />}
            {planRows.map((plan) => (
              <Paper
                key={plan.rolloutPlanId}
                variant="outlined"
                sx={{
                  bgcolor:
                    selectedPlan?.rolloutPlanId === plan.rolloutPlanId
                      ? 'action.selected'
                      : undefined,
                }}
              >
                <ButtonBase
                  type="button"
                  onClick={() => setSelectedPlanId(plan.rolloutPlanId)}
                  sx={{
                    width: '100%',
                    p: 1.25,
                    textAlign: 'left',
                    borderRadius: 1,
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" gap={1} width="100%">
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {plan.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {plan.productKey} · {plan.artifactVersion}
                      </Typography>
                    </Box>
                    <ProviderStatusChip state={plan.lifecycleState} />
                  </Stack>
                </ButtonBase>
              </Paper>
            ))}
            {plans.isSuccess && !planRows.length && !plansPartial && (
              <EmptyState
                title={t('artifactGovernance.emptyPlans.title')}
                description={t('artifactGovernance.emptyPlans.description')}
                action={
                  canWrite ? (
                    <ActionButton
                      intent="secondary"
                      startIcon={<Plus size={16} />}
                      onClick={() => setDialog({ kind: 'plan' })}
                    >
                      {t('artifactGovernance.createPlan')}
                    </ActionButton>
                  ) : undefined
                }
              />
            )}
          </Stack>
        </Paper>
      </Box>
      {selectedArtifact && (
        <Paper component="section" variant="outlined" sx={{ p: 2 }}>
          <ProviderSectionHeading
            title={`${selectedArtifact.productKey} · ${selectedArtifact.artifactVersion}`}
            description={t('artifactGovernance.artifactDetail', {
              type: enumLabel('artifactType', selectedArtifact.artifactType),
              updated: formatProviderDate(selectedArtifact.updatedAt),
            })}
            action={<ProviderStatusChip state={selectedArtifact.lifecycleState} />}
          />
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
            <Chip
              size="small"
              variant="outlined"
              label={enumLabel('compatibilityDecision', selectedArtifact.compatibilityState)}
            />
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={t('artifactGovernance.context.unavailable')}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${t('artifactGovernance.fields.digest')} · ${selectedArtifact.declaredDigest || t('notAvailable')}`}
            />
          </Stack>
          <ArtifactCompatibilityDetails artifact={selectedArtifact} />
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
            {canWrite &&
              (selectedArtifact.lifecycleState === 'DRAFT' ||
                selectedArtifact.lifecycleState === 'REVIEW_REQUIRED') && (
                <ActionButton
                  intent="secondary"
                  onClick={() => setDialog({ kind: 'compatibility', artifact: selectedArtifact })}
                >
                  {t('artifactGovernance.recordCompatibility')}
                </ActionButton>
              )}
            {canWrite &&
              selectedArtifact.lifecycleState === 'DRAFT' &&
              selectedArtifact.compatibilityState === 'COMPATIBLE' && (
                <ActionButton
                  intent="primary"
                  startIcon={<Send size={16} />}
                  onClick={() => setDialog({ kind: 'artifact-submit', artifact: selectedArtifact })}
                >
                  {t('artifactGovernance.submitArtifact')}
                </ActionButton>
              )}
            {canReviewSelected && selectedArtifact.lifecycleState === 'REVIEW_REQUIRED' && (
              <ActionButton
                intent="primary"
                startIcon={<CheckCircle2 size={16} />}
                onClick={() =>
                  setDialog({
                    kind: 'artifact-review',
                    artifact: selectedArtifact,
                    decision: 'APPROVED',
                  })
                }
              >
                {t('artifactGovernance.approveArtifact')}
              </ActionButton>
            )}
            {canReviewSelected && selectedArtifact.lifecycleState === 'REVIEW_REQUIRED' && (
              <ActionButton
                intent="secondary"
                startIcon={<XCircle size={16} />}
                onClick={() =>
                  setDialog({
                    kind: 'artifact-review',
                    artifact: selectedArtifact,
                    decision: 'RETURNED',
                  })
                }
              >
                {t('artifactGovernance.returnArtifact')}
              </ActionButton>
            )}
          </Stack>
          {canApprove &&
            selectedArtifact.lifecycleState === 'REVIEW_REQUIRED' &&
            !canReviewSelected && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                {t('artifactGovernance.independentReviewRequired')}
              </Alert>
            )}
          {!!selectedArtifact.reviews.length && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">{t('artifactGovernance.reviewHistory')}</Typography>
              <Stack gap={0.75} sx={{ mt: 1 }}>
                {selectedArtifact.reviews.map((review) => (
                  <Typography key={review.reviewId} variant="body2">
                    {enumLabel('reviewDecision', review.decision)} · {review.reason} ·{' '}
                    {formatProviderDate(review.reviewedAt)}
                  </Typography>
                ))}
              </Stack>
            </>
          )}
          {selectedArtifact.reviewsHasMore && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {t('artifactGovernance.reviewHistoryPartial', {
                count: selectedArtifact.reviews.length,
                limit: selectedArtifact.reviewsLimit,
              })}
            </Alert>
          )}
        </Paper>
      )}
      {selectedPlan && (
        <Paper component="section" variant="outlined" sx={{ p: 2 }}>
          <ProviderSectionHeading
            title={selectedPlan.name}
            description={`${selectedPlan.productKey} · ${selectedPlan.artifactVersion} · ${t('artifactGovernance.executorUnavailable')}`}
            action={<ProviderStatusChip state={selectedPlan.lifecycleState} />}
          />
          <ArtifactRolloutDetails plan={selectedPlan} />
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
            {canWrite && selectedPlan.lifecycleState === 'DRAFT' && (
              <ActionButton
                intent="primary"
                startIcon={<Send size={16} />}
                onClick={() => setDialog({ kind: 'plan-submit', plan: selectedPlan })}
              >
                {t('artifactGovernance.submitPlan')}
              </ActionButton>
            )}
            {canDecideSelectedPlan && selectedPlan.lifecycleState === 'PENDING_APPROVAL' && (
              <ActionButton
                intent="primary"
                startIcon={<CheckCircle2 size={16} />}
                onClick={() =>
                  setDialog({ kind: 'plan-decision', plan: selectedPlan, decision: 'APPROVED' })
                }
              >
                {t('artifactGovernance.approvePlan')}
              </ActionButton>
            )}
            {canDecideSelectedPlan && selectedPlan.lifecycleState === 'PENDING_APPROVAL' && (
              <ActionButton
                intent="secondary"
                startIcon={<XCircle size={16} />}
                onClick={() =>
                  setDialog({ kind: 'plan-decision', plan: selectedPlan, decision: 'REJECTED' })
                }
              >
                {t('artifactGovernance.rejectPlan')}
              </ActionButton>
            )}
            {canWrite && selectedPlan.lifecycleState === 'APPROVED' && (
              <ActionButton
                intent="primary"
                startIcon={<BadgeCheck size={16} />}
                onClick={() => setDialog({ kind: 'plan-ready', plan: selectedPlan })}
              >
                {t('artifactGovernance.markReady')}
              </ActionButton>
            )}
            {canWrite && !['REJECTED', 'CANCELLED'].includes(selectedPlan.lifecycleState) && (
              <ActionButton
                intent="secondary"
                onClick={() => setDialog({ kind: 'evidence', plan: selectedPlan })}
              >
                {t('artifactGovernance.recordEvidence')}
              </ActionButton>
            )}
          </Stack>
          {canApprove &&
            selectedPlan.lifecycleState === 'PENDING_APPROVAL' &&
            !canDecideSelectedPlan && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                {t('artifactGovernance.independentPlanDecisionRequired')}
              </Alert>
            )}
          {!!selectedPlan.evidence.length && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">{t('artifactGovernance.evidenceHistory')}</Typography>
              <Stack gap={0.75} sx={{ mt: 1 }}>
                {selectedPlan.evidence.map((entry) => (
                  <Typography key={entry.evidenceId} variant="body2">
                    {enumLabel('evidenceType', entry.evidenceType)} ·{' '}
                    {enumLabel('evidenceState', entry.evidenceState)} ·{' '}
                    {formatProviderDate(entry.recordedAt)}
                  </Typography>
                ))}
              </Stack>
            </>
          )}
          {selectedPlan.evidenceHasMore && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {t('artifactGovernance.evidenceHistoryPartial', {
                count: selectedPlan.evidence.length,
                limit: selectedPlan.evidenceLimit,
              })}
            </Alert>
          )}
        </Paper>
      )}
      {dialog?.kind === 'manifest' && (
        <ManifestDialog
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(request) =>
            mutation.mutateAsync(() => createProviderArtifactManifest(request))
          }
        />
      )}
      {dialog?.kind === 'compatibility' && (
        <CompatibilityDialog
          artifact={dialog.artifact}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(request) =>
            mutation.mutateAsync(() =>
              assessProviderArtifactCompatibility(dialog.artifact, request)
            )
          }
        />
      )}
      {dialog?.kind === 'artifact-submit' && (
        <ReasonDialog
          title={t('artifactGovernance.submitArtifact')}
          description={t('artifactGovernance.submitArtifactGuidance')}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(reason) =>
            mutation.mutateAsync(() => submitProviderArtifactManifest(dialog.artifact, reason))
          }
        />
      )}
      {dialog?.kind === 'artifact-review' && (
        <ReviewDialog
          artifact={dialog.artifact}
          decision={dialog.decision}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(request) =>
            mutation.mutateAsync(() => decideProviderArtifactManifest(dialog.artifact, request))
          }
        />
      )}
      {dialog?.kind === 'plan' && (
        <PlanDialog
          artifacts={artifactRows}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(request) =>
            mutation.mutateAsync(() => createProviderArtifactRolloutPlan(request))
          }
        />
      )}
      {dialog?.kind === 'plan-submit' && (
        <ReasonDialog
          title={t('artifactGovernance.submitPlan')}
          description={t('artifactGovernance.submitPlanGuidance')}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(reason) =>
            mutation.mutateAsync(() => submitProviderArtifactRolloutPlan(dialog.plan, reason))
          }
        />
      )}
      {dialog?.kind === 'plan-decision' && (
        <ReasonDialog
          title={t(`artifactGovernance.planDecision.${dialog.decision}.title`)}
          description={t('artifactGovernance.planDecisionGuidance')}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(reason) =>
            mutation.mutateAsync(() =>
              decideProviderArtifactRolloutPlan(dialog.plan, { decision: dialog.decision, reason })
            )
          }
        />
      )}
      {dialog?.kind === 'plan-ready' && (
        <ReasonDialog
          title={t('artifactGovernance.markReady')}
          description={t('artifactGovernance.readyGuidance')}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(reason) =>
            mutation.mutateAsync(() => markProviderArtifactRolloutPlanReady(dialog.plan, reason))
          }
        />
      )}
      {dialog?.kind === 'evidence' && (
        <EvidenceDialog
          plan={dialog.plan}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(request) =>
            mutation.mutateAsync(() => appendProviderArtifactRolloutEvidence(dialog.plan, request))
          }
        />
      )}
    </Stack>
  );
}
