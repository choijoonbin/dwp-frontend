import { useTranslation } from 'react-i18next';
import { GitBranch, RefreshCcw, PencilLine, Rocket, Archive, ArchiveRestore } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  InlineFeedback,
  LoadingState,
  FormDialog,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import ListItemButton from '@mui/material/ListItemButton';
import type {
  ApprovalFormWorkspaceHistory,
  ApprovalFormWorkspaceVersion,
} from '@dwp-frontend/shared-utils';
import type { ApprovalFormWorkspaceReadState } from './approval-form-workspace-model';
import { ApprovalFormVersionDiff } from './approval-form-version-diff';
import { ApprovalTypedDefinitionInspector } from './approval-form-typed-definition-inspector';
import { isApprovalTypedFormSchema } from '@dwp-frontend/shared-utils';
import { ApprovalFormWorkspaceReviewDialog } from './approval-form-workspace-review-dialog';
import { ApprovalFormAvailabilityDialog } from './approval-form-availability-dialog';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { ApprovalFormPublishReviewAssignment } from './approval-form-publish-review';
import { approvalFormWorkspaceRouteInstalled } from './approval-form-workspace-controller';
import type { useApprovalFormWorkspaceController } from './approval-form-workspace-controller';
import type { useApprovalFormPublishReviewAssignment } from './use-approval-form-publish-review';

export function ApprovalFormVersionHistory({
  history,
  state,
  selectedId,
  onSelect,
  onReload,
  onBranch,
  branchReady,
}: {
  history?: ApprovalFormWorkspaceHistory;
  state: ApprovalFormWorkspaceReadState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReload: () => void;
  onBranch: () => void;
  branchReady: boolean;
}) {
  const { t } = useTranslation('approvals');
  if (state === 'DENIED')
    return (
      <InlineFeedback severity="error">{t('admin.formWorkspace.sourceUnavailable')}</InlineFeedback>
    );
  return (
    <Box component="section" sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Box component="h3" sx={{ m: 0, typography: 'subtitle2' }}>
          {t('admin.formWorkspace.history')}
        </Box>
        <ActionIconButton
          label={t('admin.formWorkspace.reload')}
          tooltipDisablePortal
          onClick={onReload}
        >
          <RefreshCcw size={16} />
        </ActionIconButton>
      </Stack>
      {state === 'LOADING' ? (
        <LoadingState label={t('admin.formWorkspace.history')} size="compact" />
      ) : null}
      {state === 'STALE' || state === 'UNAVAILABLE' ? (
        <InlineFeedback severity="warning">
          {t('admin.formWorkspace.sourceUnavailable')}
        </InlineFeedback>
      ) : null}
      {history?.mayBeTruncated ? (
        <InlineFeedback severity="warning">
          {t('admin.formWorkspace.historyPartial')}
        </InlineFeedback>
      ) : null}
      {history?.versions.length ? (
        <Stack
          component="ul"
          sx={{ listStyle: 'none', p: 0, mt: 1, mb: 1, maxHeight: 280, overflowY: 'auto' }}
        >
          {history.versions.map((version) => (
            <Box component="li" key={version.formVersionId}>
              <ListItemButton
                selected={selectedId === version.formVersionId}
                onClick={() => onSelect(version.formVersionId)}
                sx={{ gap: 1, minWidth: 0 }}
              >
                <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>
                  {`v${version.versionNumber}`}
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`status.${version.lifecycleState}`)}
                />
                <Box
                  sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
                >
                  {version.schemaSha256.slice(0, 12)}
                </Box>
              </ListItemButton>
            </Box>
          ))}
        </Stack>
      ) : state === 'READY' ? (
        <EmptyState title={t('admin.formWorkspace.historyEmpty')} size="compact" />
      ) : null}
      <ActionButton
        intent="secondary"
        startIcon={<GitBranch size={16} />}
        disabled={!branchReady}
        onClick={onBranch}
      >
        {t('admin.formWorkspace.branch')}
      </ActionButton>
    </Box>
  );
}

export function ApprovalFormVersionBranchDialog({
  open,
  version,
  replacing,
  busy,
  ready,
  onClose,
  onConfirm,
}: {
  open: boolean;
  version?: ApprovalFormWorkspaceVersion;
  replacing: boolean;
  busy: boolean;
  ready: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <FormDialog
      open={open}
      title={t('admin.formWorkspace.branch')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('admin.formWorkspace.branch')}
      submittingLabel={t('actions.save')}
      busy={busy}
      submitDisabled={!ready}
      onClose={onClose}
      onSubmit={onConfirm}
      maxWidth="sm"
      mobileFullScreen
    >
      <Stack gap={2}>
        <Box sx={{ typography: 'body2' }}>{t('admin.formWorkspace.branchConfirm')}</Box>
        {version ? (
          <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>
            {`v${version.versionNumber}`} · {version.schemaSha256}
          </Box>
        ) : null}
        {replacing ? (
          <InlineFeedback severity="warning">
            {t('admin.formWorkspace.replaceWorkingDraft')}
          </InlineFeedback>
        ) : null}
        {!ready ? (
          <InlineFeedback severity="warning">
            {t('admin.formWorkspace.sourceChanged')}
          </InlineFeedback>
        ) : null}
      </Stack>
    </FormDialog>
  );
}

export function ApprovalFormWorkspacePanel({
  controller,
  publishReview,
  canEdit,
  canPublish,
  onEdit,
}: {
  controller: ReturnType<typeof useApprovalFormWorkspaceController>;
  publishReview: ReturnType<typeof useApprovalFormPublishReviewAssignment>;
  canEdit: boolean;
  canPublish: boolean;
  onEdit: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const workspace = controller.workspace.data;
  const available = workspace?.catalogAvailability === 'ACTIVE';
  const selected = controller.version.data;
  if (controller.state === 'DENIED')
    return (
      <InlineFeedback severity="error">{t('admin.formWorkspace.sourceUnavailable')}</InlineFeedback>
    );
  return (
    <Stack
      gap={2}
      component="section"
      aria-label={t('admin.formWorkspace.title')}
      sx={{ px: 2, py: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Box component="h2" sx={{ m: 0, typography: 'subtitle1', fontWeight: 'fontWeightBold' }}>
          {t('admin.formWorkspace.title')}
        </Box>
        <ActionIconButton
          label={t('admin.formWorkspace.reload')}
          tooltipDisablePortal
          disabled={!controller.installed}
          onClick={() => void controller.reload()}
        >
          <RefreshCcw size={16} />
        </ActionIconButton>
      </Stack>
      {controller.state === 'LOADING' ? (
        <LoadingState label={t('admin.formWorkspace.title')} size="compact" />
      ) : null}
      {!controller.ready && controller.state !== 'LOADING' ? (
        <InlineFeedback severity="warning">
          {t('admin.formWorkspace.sourceUnavailable')}
        </InlineFeedback>
      ) : null}
      {controller.feedback ? (
        <InlineFeedback
          severity="warning"
          action={
            controller.unknown ? (
              <ActionButton
                intent="secondary"
                disabled={controller.busy}
                onClick={controller.retryOriginal}
              >
                {t('admin.formWorkspace.retryOriginalCommand')}
              </ActionButton>
            ) : undefined
          }
        >
          {t(
            controller.unknown
              ? 'admin.formWorkspace.commandUnknown'
              : 'admin.formWorkspace.sourceChanged'
          )}
        </InlineFeedback>
      ) : null}
      {workspace ? (
        <>
          <Chip
            sx={{ alignSelf: 'flex-start' }}
            variant="outlined"
            size="small"
            label={t(available ? 'admin.formWorkspace.active' : 'admin.formWorkspace.retired')}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
              gap: 1,
              borderBlock: 1,
              borderColor: 'divider',
              py: 1.5,
            }}
          >
            {(
              [
                [t('admin.formWorkspace.published'), workspace.published],
                [t('admin.formWorkspace.workingDraft'), workspace.workingDraft],
              ] as const
            ).map(([label, version]) => {
              return (
                <Box key={String(label)} sx={{ minWidth: 0 }}>
                  <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{String(label)}</Box>
                  <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>
                    {version ? `v${version.versionNumber}` : t('admin.formWorkspace.notRecorded')}
                  </Box>
                  <Box
                    sx={{
                      typography: 'caption',
                      color: 'text.secondary',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {version?.schemaSha256.slice(0, 16)}
                  </Box>
                </Box>
              );
            })}
          </Box>
          {workspace.published && workspace.workingDraft ? (
            <InlineFeedback severity="info">
              {t('admin.formWorkspace.publishedContinues')}
            </InlineFeedback>
          ) : null}
          <ApprovalFormPublishReviewAssignment controller={publishReview} />
          <Stack direction="row" gap={1} flexWrap="wrap">
            {canEdit ? (
              <ActionButton
                intent="secondary"
                startIcon={<PencilLine size={16} />}
                disabled={!controller.updateReady || !workspace.workingDraft}
                onClick={onEdit}
              >
                {t('admin.formWorkspace.editWorkingDraft')}
              </ActionButton>
            ) : null}
            {canPublish && publishReview.assignedToActor ? (
              <ActionButton
                intent="primary"
                startIcon={<Rocket size={16} />}
                disabled={
                  !controller.ready ||
                  !workspace.workingDraft ||
                  controller.busy ||
                  controller.unknown ||
                  !approvalFormWorkspaceRouteInstalled('form-publish-review.data')
                }
                onClick={controller.openReview}
              >
                {t('admin.formWorkspace.review')}
              </ActionButton>
            ) : null}
            {canEdit ? (
              <ActionButton
                intent="secondary"
                startIcon={available ? <Archive size={16} /> : <ArchiveRestore size={16} />}
                disabled={
                  !controller.ready ||
                  controller.busy ||
                  controller.unknown ||
                  !approvalFormWorkspaceRouteInstalled(
                    available ? 'form-retire.action' : 'form-reinstate.action'
                  )
                }
                onClick={controller.openAvailability}
              >
                {t(available ? 'admin.formWorkspace.retire' : 'admin.formWorkspace.reinstate')}
              </ActionButton>
            ) : null}
          </Stack>
          <ApprovalFormVersionHistory
            history={controller.history.data}
            state={controller.historyState}
            selectedId={controller.selectedVersionId}
            onSelect={controller.setSelectedVersionId}
            onReload={() => void controller.history.refetch()}
            onBranch={controller.openBranch}
            branchReady={controller.branchReady}
          />
          {selected && controller.versionState !== 'DENIED' ? (
            <Box
              component="section"
              sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
            >
              <Box sx={{ typography: 'subtitle2', color: 'text.primary' }}>
                {`v${selected.versionNumber}`} · {t(`status.${selected.lifecycleState}`)}
              </Box>
              <Box>
                {t('admin.formWorkspace.schemaHash')}: {selected.schemaSha256}
              </Box>
              {selected.metadataProvenance === 'UNRECORDED_HISTORICAL_METADATA' ? (
                <Box>{t('admin.formWorkspace.unrecordedMetadata')}</Box>
              ) : (
                <Box>
                  {t('admin.formWorkspace.materialDigest')}: {selected.materialDigest}
                </Box>
              )}
              {controller.versionState !== 'READY' ? (
                <InlineFeedback severity="warning">
                  {t('admin.formWorkspace.sourceUnavailable')}
                </InlineFeedback>
              ) : null}
              <Box sx={{ typography: 'subtitle2', color: 'text.primary', mt: 2 }}>
                {t('admin.formCatalog.inspector.fields')}
              </Box>
              {isApprovalTypedFormSchema(selected.schema) ? (
                <ApprovalTypedDefinitionInspector
                  schema={selected.schema}
                  korean={(i18n.resolvedLanguage ?? i18n.language) === 'ko'}
                />
              ) : (
                <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {selected.schema.fields.map((field) => (
                    <Box
                      component="li"
                      key={field.key}
                      sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <Stack
                        direction="row"
                        gap={1}
                        justifyContent="space-between"
                        alignItems="flex-start"
                      >
                        <Box
                          sx={{
                            minWidth: 0,
                            overflowWrap: 'anywhere',
                            typography: 'body2',
                            color: 'text.primary',
                          }}
                        >
                          {((i18n.resolvedLanguage ?? i18n.language) === 'ko'
                            ? field.labelKo
                            : field.labelEn) || field.key}
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t(`admin.typedForm.fieldTypes.${field.type}`)}
                        />
                      </Stack>
                      <Box sx={{ typography: 'caption', overflowWrap: 'anywhere' }}>
                        {field.key} ·{' '}
                        {t(field.required ? 'admin.studio.required' : 'admin.studio.optional')}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          ) : null}
          {workspace.workingDraft ? (
            <ApprovalFormVersionDiff diff={controller.diff.data} state={controller.diffState} />
          ) : null}
        </>
      ) : null}
      <ApprovalFormVersionBranchDialog
        open={Boolean(controller.branchOriginal)}
        version={controller.branchOriginal?.sourceVersion ?? undefined}
        replacing={Boolean(workspace?.workingDraft)}
        busy={controller.busy}
        ready={controller.branchCurrent && controller.branchReady}
        onClose={controller.closeBranch}
        onConfirm={controller.confirmBranch}
      />
      <ApprovalFormAvailabilityDialog
        open={Boolean(controller.availabilityOriginal)}
        retiring={controller.availabilityOriginal?.kind === 'RETIRE'}
        ready={controller.availabilityCurrent}
        busy={controller.busy}
        onClose={controller.closeAvailability}
        onConfirm={controller.confirmAvailability}
      />
      <ApprovalFormWorkspaceReviewDialog
        open={Boolean(controller.reviewOriginal)}
        review={controller.review}
        state={controller.reviewState}
        ready={controller.reviewReady}
        expired={controller.reviewExpired}
        busy={controller.busy || controller.highRisk.controller.busy}
        onClose={controller.closeReview}
        onConfirm={controller.confirmReview}
        onReject={controller.rejectReview}
      />
      <ApprovalHighRiskCommandDialog controller={controller.highRisk.controller} />
    </Stack>
  );
}
