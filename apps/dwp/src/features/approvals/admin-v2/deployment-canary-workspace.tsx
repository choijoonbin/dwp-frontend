import {
  ArchiveRestore,
  Boxes,
  CirclePause,
  GitCompareArrows,
  PackageCheck,
  RefreshCcw,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  AdminV2FactGrid,
  AdminV2GovernedAction,
  AdminV2InspectorPaper,
  AdminV2MetricStrip,
  AdminV2RecordButton,
  AdminV2Section,
  AdminV2StateBoundary,
  AdminV2StatusPill,
  AdminV2Timeline,
  AdminV2ViewTabs,
  AdminV2WorkspaceFrame,
} from './admin-v2-foundation';
import { ApprovalAdminV2ActionDeck } from './approval-admin-v2-action-deck';

import type { AdminV2WorkspaceActionDeck } from './approval-admin-v2-action-deck';
import type {
  AdminV2Fact,
  AdminV2Metric,
  AdminV2SourceState,
  AdminV2StateCopy,
  AdminV2Status,
  AdminV2WorkspaceHeader,
} from './admin-v2-types';

export type DeploymentCanaryView = 'packages' | 'promotion' | 'canary' | 'rollback';

export type ApprovalAssetPackage = {
  id: string;
  name: string;
  description: string;
  versionLabel: string;
  environmentLabel: string;
  digestLabel: string;
  assetCountLabel: string;
  status: AdminV2Status;
  validationStatus: AdminV2Status;
  facts: readonly AdminV2Fact[];
  dependencies: readonly {
    id: string;
    title: string;
    detail: string;
    meta?: string;
    status: AdminV2Status;
  }[];
};

export type ApprovalPromotionPlan = {
  id: string;
  packageId: string;
  title: string;
  description: string;
  sourceEnvironmentLabel: string;
  targetEnvironmentLabel: string;
  scheduledLabel: string;
  validationStatus: AdminV2Status;
  reviewStatus: AdminV2Status;
  facts: readonly AdminV2Fact[];
  gates: readonly {
    id: string;
    title: string;
    detail: string;
    meta?: string;
    status: AdminV2Status;
  }[];
};

export type ApprovalCanaryEvidence = {
  planId: string;
  status: AdminV2Status;
  sampledAtLabel: string;
  sourceRevisionLabel: string;
  evidenceWindowLabel: string;
  metrics: readonly AdminV2Metric[];
  observations: readonly {
    id: string;
    title: string;
    detail: string;
    meta?: string;
    status: AdminV2Status;
  }[];
};

export type ApprovalRollbackAssessment = {
  planId: string;
  status: AdminV2Status;
  reversible: boolean;
  assessedAtLabel: string;
  sourceRevisionLabel: string;
  summary: string;
  facts: readonly AdminV2Fact[];
  blockers: readonly {
    id: string;
    title: string;
    detail: string;
    status: AdminV2Status;
  }[];
};

export type DeploymentCanaryCopy = {
  header: AdminV2WorkspaceHeader;
  state: AdminV2StateCopy;
  navigationLabel: string;
  packagesTab: string;
  promotionTab: string;
  canaryTab: string;
  rollbackTab: string;
  packagesTitle: string;
  packagesDescription: string;
  packageDetailTitle: string;
  packageDetailDescription: string;
  dependenciesTitle: string;
  promotionTitle: string;
  promotionDescription: string;
  gatesTitle: string;
  canaryTitle: string;
  canaryDescription: string;
  observationsTitle: string;
  rollbackTitle: string;
  rollbackDescription: string;
  blockersTitle: string;
  noSelectionLabel: string;
  refreshLabel: string;
  validatePackageLabel: string;
  submitPromotionLabel: string;
  mobilePromotionLabel: string;
  mobilePromotionReason: string;
  pauseCanaryLabel: string;
  mobilePauseLabel: string;
  mobilePauseReason: string;
  requestRollbackLabel: string;
  mobileRollbackLabel: string;
  mobileRollbackReason: string;
  evidenceTruthTitle: string;
  evidenceTruthDescription: string;
};

export type DeploymentCanaryWorkspaceProps = {
  state: AdminV2SourceState;
  copy: DeploymentCanaryCopy;
  metrics: readonly AdminV2Metric[];
  view: DeploymentCanaryView;
  packages: readonly ApprovalAssetPackage[];
  selectedPackageId: string | null;
  promotionPlan: ApprovalPromotionPlan | null;
  canaryEvidence: ApprovalCanaryEvidence | null;
  rollbackAssessment: ApprovalRollbackAssessment | null;
  onViewChange: (view: DeploymentCanaryView) => void;
  onSelectPackage: (packageId: string) => void;
  onRefresh: () => void;
  onValidatePackage: (packageId: string) => void;
  onSubmitPromotion: (planId: string) => void;
  onPauseCanary: (planId: string) => void;
  onRequestRollback: (planId: string) => void;
  promotionReady: boolean;
  promotionDisabledReason?: string;
  pauseReady: boolean;
  pauseDisabledReason?: string;
  rollbackReady: boolean;
  rollbackDisabledReason?: string;
  actionDeck?: AdminV2WorkspaceActionDeck;
  onRetry?: () => void;
  onResolveConflict?: () => void;
};

function PackagesView({
  copy,
  packages,
  selectedPackageId,
  selectedPackage,
  commandReady,
  onSelectPackage,
  onValidatePackage,
}: Pick<
  DeploymentCanaryWorkspaceProps,
  'copy' | 'packages' | 'selectedPackageId' | 'onSelectPackage' | 'onValidatePackage'
> & { selectedPackage: ApprovalAssetPackage | null; commandReady: boolean }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(300px,.85fr) minmax(0,1.5fr)' },
        gap: { xs: 1.5, lg: 2 },
        alignItems: 'start',
      }}
    >
      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.packagesTitle}
          description={copy.packagesDescription}
          labelledBy="admin-v2-deployment-packages"
        >
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {packages.map((item) => (
              <Box component="li" key={item.id}>
                <AdminV2RecordButton
                  selected={item.id === selectedPackageId}
                  title={item.name}
                  description={item.description}
                  meta={`${item.versionLabel} · ${item.environmentLabel} · ${item.assetCountLabel}`}
                  status={item.status}
                  onClick={() => onSelectPackage(item.id)}
                />
              </Box>
            ))}
          </Box>
        </AdminV2Section>
      </AdminV2InspectorPaper>

      <AdminV2InspectorPaper>
        <AdminV2Section
          title={selectedPackage?.name ?? copy.packageDetailTitle}
          description={selectedPackage?.description ?? copy.packageDetailDescription}
          labelledBy="admin-v2-deployment-package-detail"
          action={
            selectedPackage ? (
              <AdminV2StatusPill status={selectedPackage.validationStatus} />
            ) : undefined
          }
        >
          {selectedPackage ? (
            <>
              <Stack
                direction="row"
                gap={0.75}
                flexWrap="wrap"
                sx={{ p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}
              >
                <AdminV2StatusPill status={selectedPackage.status} />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {selectedPackage.digestLabel}
                </Typography>
              </Stack>
              <AdminV2FactGrid facts={selectedPackage.facts} />
              <Box sx={{ px: 1.5, py: 1.25, borderBlock: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="fontWeightBold">
                  {copy.dependenciesTitle}
                </Typography>
              </Box>
              <AdminV2Timeline items={selectedPackage.dependencies} />
              <Stack direction="row" justifyContent="flex-end" sx={{ p: 1.5 }}>
                <ActionButton
                  intent="secondary"
                  startIcon={<PackageCheck size={16} />}
                  disabled={!commandReady}
                  onClick={() => onValidatePackage(selectedPackage.id)}
                >
                  {copy.validatePackageLabel}
                </ActionButton>
              </Stack>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {copy.noSelectionLabel}
            </Typography>
          )}
        </AdminV2Section>
      </AdminV2InspectorPaper>
    </Box>
  );
}

function PromotionView({
  copy,
  promotionPlan,
  promotionReady,
  promotionDisabledReason,
  onSubmitPromotion,
}: Pick<
  DeploymentCanaryWorkspaceProps,
  'copy' | 'promotionPlan' | 'promotionReady' | 'promotionDisabledReason' | 'onSubmitPromotion'
>) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.promotionTitle}
        description={copy.promotionDescription}
        labelledBy="admin-v2-deployment-promotion"
        action={
          promotionPlan ? <AdminV2StatusPill status={promotionPlan.reviewStatus} /> : undefined
        }
      >
        {promotionPlan ? (
          <>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              gap={1}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              flexWrap="wrap"
              sx={{ p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}
            >
              <Box sx={{ minWidth: 0, mr: { sm: 'auto' } }}>
                <Typography variant="subtitle2" fontWeight="fontWeightBold">
                  {promotionPlan.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {promotionPlan.description}
                </Typography>
              </Box>
              <AdminV2StatusPill status={promotionPlan.validationStatus} />
              <Typography variant="body2" fontWeight="fontWeightBold">
                {promotionPlan.sourceEnvironmentLabel}
              </Typography>
              <GitCompareArrows size={17} aria-hidden="true" />
              <Typography variant="body2" fontWeight="fontWeightBold">
                {promotionPlan.targetEnvironmentLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {promotionPlan.scheduledLabel}
              </Typography>
            </Stack>
            <AdminV2FactGrid facts={promotionPlan.facts} />
            <Box sx={{ px: 1.5, py: 1.25, borderBlock: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight="fontWeightBold">
                {copy.gatesTitle}
              </Typography>
            </Box>
            <AdminV2Timeline items={promotionPlan.gates} />
            <Box sx={{ p: 1.5, borderBlockStart: 1, borderColor: 'divider' }}>
              <AdminV2GovernedAction
                desktopLabel={copy.submitPromotionLabel}
                mobileLabel={copy.mobilePromotionLabel}
                mobileReason={copy.mobilePromotionReason}
                disabled={!promotionReady}
                disabledReason={promotionDisabledReason}
                onAction={() => onSubmitPromotion(promotionPlan.id)}
                icon={<Rocket size={16} />}
              />
            </Box>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {copy.promotionDescription}
          </Typography>
        )}
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

function CanaryView({
  copy,
  evidence,
  pauseReady,
  pauseDisabledReason,
  onPauseCanary,
}: Pick<
  DeploymentCanaryWorkspaceProps,
  'copy' | 'pauseReady' | 'pauseDisabledReason' | 'onPauseCanary'
> & { evidence: ApprovalCanaryEvidence | null }) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.canaryTitle}
        description={copy.canaryDescription}
        labelledBy="admin-v2-deployment-canary"
        action={evidence ? <AdminV2StatusPill status={evidence.status} /> : undefined}
      >
        {evidence ? (
          <>
            <Box sx={{ p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}>
              <InlineFeedback severity="info" title={copy.evidenceTruthTitle}>
                {`${evidence.sourceRevisionLabel} · ${evidence.sampledAtLabel} · ${evidence.evidenceWindowLabel}`}
              </InlineFeedback>
            </Box>
            <AdminV2MetricStrip metrics={evidence.metrics} />
            <Box sx={{ px: 1.5, py: 1.25, borderBlock: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight="fontWeightBold">
                {copy.observationsTitle}
              </Typography>
            </Box>
            <AdminV2Timeline items={evidence.observations} />
            <Box sx={{ p: 1.5, borderBlockStart: 1, borderColor: 'divider' }}>
              <AdminV2GovernedAction
                desktopLabel={copy.pauseCanaryLabel}
                mobileLabel={copy.mobilePauseLabel}
                mobileReason={copy.mobilePauseReason}
                disabled={!pauseReady}
                disabledReason={pauseDisabledReason}
                onAction={() => onPauseCanary(evidence.planId)}
                icon={<CirclePause size={16} />}
              />
            </Box>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {copy.evidenceTruthDescription}
          </Typography>
        )}
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

function RollbackView({
  copy,
  assessment,
  rollbackReady,
  rollbackDisabledReason,
  onRequestRollback,
}: Pick<
  DeploymentCanaryWorkspaceProps,
  'copy' | 'rollbackReady' | 'rollbackDisabledReason' | 'onRequestRollback'
> & { assessment: ApprovalRollbackAssessment | null }) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.rollbackTitle}
        description={copy.rollbackDescription}
        labelledBy="admin-v2-deployment-rollback"
        action={assessment ? <AdminV2StatusPill status={assessment.status} /> : undefined}
      >
        {assessment ? (
          <>
            <Box sx={{ p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}>
              <InlineFeedback severity={rollbackReady ? 'success' : 'warning'}>
                {assessment.summary}
              </InlineFeedback>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {assessment.sourceRevisionLabel} · {assessment.assessedAtLabel}
              </Typography>
            </Box>
            <AdminV2FactGrid facts={assessment.facts} />
            <Box sx={{ px: 1.5, py: 1.25, borderBlock: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight="fontWeightBold">
                {copy.blockersTitle}
              </Typography>
            </Box>
            <AdminV2Timeline items={assessment.blockers} />
            <Box sx={{ p: 1.5 }}>
              <AdminV2GovernedAction
                desktopLabel={copy.requestRollbackLabel}
                mobileLabel={copy.mobileRollbackLabel}
                mobileReason={copy.mobileRollbackReason}
                disabled={!rollbackReady}
                disabledReason={rollbackDisabledReason}
                onAction={() => onRequestRollback(assessment.planId)}
                icon={<ArchiveRestore size={16} />}
              />
            </Box>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {copy.rollbackDescription}
          </Typography>
        )}
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

export function DeploymentCanaryWorkspace({
  state,
  copy,
  metrics,
  view,
  packages,
  selectedPackageId,
  promotionPlan,
  canaryEvidence,
  rollbackAssessment,
  onViewChange,
  onSelectPackage,
  onRefresh,
  onValidatePackage,
  onSubmitPromotion,
  onPauseCanary,
  onRequestRollback,
  promotionReady,
  promotionDisabledReason,
  pauseReady,
  pauseDisabledReason,
  rollbackReady,
  rollbackDisabledReason,
  actionDeck,
  onRetry,
  onResolveConflict,
}: DeploymentCanaryWorkspaceProps) {
  const selectedPackage = packages.find((item) => item.id === selectedPackageId) ?? null;
  const commandReady = state === 'ready';

  return (
    <AdminV2WorkspaceFrame
      header={copy.header}
      icon={Boxes}
      primaryAction={
        <ActionButton intent="secondary" startIcon={<RefreshCcw size={16} />} onClick={onRefresh}>
          {copy.refreshLabel}
        </ActionButton>
      }
    >
      <AdminV2StateBoundary
        state={state}
        copy={copy.state}
        actions={{ onRetry, onResolveConflict }}
      >
        <InlineFeedback
          severity="info"
          title={copy.evidenceTruthTitle}
          icon={<ShieldCheck size={18} />}
        >
          {copy.evidenceTruthDescription}
        </InlineFeedback>
        <AdminV2MetricStrip metrics={metrics} />
        {actionDeck ? <ApprovalAdminV2ActionDeck state={state} deck={actionDeck} /> : null}
        <AdminV2InspectorPaper>
          <AdminV2ViewTabs
            label={copy.navigationLabel}
            value={view}
            options={[
              { value: 'packages', label: copy.packagesTab, count: packages.length },
              { value: 'promotion', label: copy.promotionTab, count: promotionPlan ? 1 : 0 },
              { value: 'canary', label: copy.canaryTab, count: canaryEvidence ? 1 : 0 },
              { value: 'rollback', label: copy.rollbackTab, count: rollbackAssessment ? 1 : 0 },
            ]}
            onChange={onViewChange}
          />
          <Box sx={{ p: { xs: 1.25, sm: 1.75 } }}>
            {view === 'packages' ? (
              <PackagesView
                copy={copy}
                packages={packages}
                selectedPackageId={selectedPackageId}
                selectedPackage={selectedPackage}
                commandReady={commandReady}
                onSelectPackage={onSelectPackage}
                onValidatePackage={onValidatePackage}
              />
            ) : null}
            {view === 'promotion' ? (
              <PromotionView
                copy={copy}
                promotionPlan={promotionPlan}
                promotionReady={commandReady && promotionReady}
                promotionDisabledReason={promotionDisabledReason}
                onSubmitPromotion={onSubmitPromotion}
              />
            ) : null}
            {view === 'canary' ? (
              <CanaryView
                copy={copy}
                evidence={canaryEvidence}
                pauseReady={commandReady && pauseReady}
                pauseDisabledReason={pauseDisabledReason}
                onPauseCanary={onPauseCanary}
              />
            ) : null}
            {view === 'rollback' ? (
              <RollbackView
                copy={copy}
                assessment={rollbackAssessment}
                rollbackReady={commandReady && rollbackReady}
                rollbackDisabledReason={rollbackDisabledReason}
                onRequestRollback={onRequestRollback}
              />
            ) : null}
          </Box>
        </AdminV2InspectorPaper>
      </AdminV2StateBoundary>
    </AdminV2WorkspaceFrame>
  );
}
