import { GitBranch, Plus, RefreshCcw } from 'lucide-react';
import {
  ActionIconButton,
  EmptyState,
  ErrorState,
  InlineFeedback,
  LoadingState,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { ApprovalSurface } from './approval-ui';
import { ApprovalWorkflowInlineEditor } from './approval-workflow-inline-editor';
import { ApprovalWorkflowTypedInlineEditor } from './approval-workflow-typed-inline-editor';
import { ApprovalWorkflowListItem } from './approval-workflow-library';
import { isApprovalTypedWorkflowDraft } from './approval-workflow-typed-workspace-model';
import { useApprovalWorkflowStudioController } from './approval-workflow-studio-controller';
import { ApprovalWorkflowPlanningPanel } from './approval-workflow-planning-panel';
import { readApprovalTypedWorkflowDetail } from '@dwp-frontend/shared-utils/api/approval-workflow-typed-contract';

export function ApprovalWorkflowStudio() {
  const {
    t,
    i18n,
    scopeReady,
    workflowsState,
    detailState,
    workflows,
    detail,
    selectedId,
    setSelectedId,
    experience,
    catalogWriteReady,
    detailWriteReady,
    draftWriteReady,
    draftBindingMatches,
    editorOpen,
    setEditorOpen,
    creating,
    draft,
    setDraft,
    checking,
    creationDrafts,
    create,
    update,
    search,
    setSearch,
    lifecycleFilter,
    setLifecycleFilter,
    visibleWorkflows,
    highRiskPublish,
    openCreate,
    openEdit,
    save,
    displayDraft,
    conditionSource,
    needsConditionSource,
    baseConditional,
    retryRead,
    publish,
  } = useApprovalWorkflowStudioController();

  if (!scopeReady || workflowsState === 'DENIED' || (selectedId && detailState === 'DENIED')) {
    return (
      <ErrorState title={t('admin.loadError')} description={t('pages.workflows.description')} />
    );
  }

  if (workflowsState === 'LOADING') {
    return (
      <LoadingState
        label={t('pages.workflows.title')}
        description={t('pages.workflows.description')}
        variant="skeleton"
        skeletonRows={5}
      />
    );
  }

  if (workflowsState === 'UNAVAILABLE') {
    return (
      <ErrorState
        title={t('admin.loadError')}
        retryLabel={t('actions.retry')}
        retrying={workflows.isFetching}
        onRetry={() => void workflows.refetch()}
      />
    );
  }

  const library = (
    <ApprovalSurface
      title={t('admin.workflows.title')}
      meta={t('admin.workflows.meta')}
      action={
        experience.canEditDesign && catalogWriteReady ? (
          <ActionIconButton
            label={t('admin.studio.createWorkflow')}
            size="small"
            intent="primary"
            disabled={editorOpen || highRiskPublish.controller.busy}
            onClick={openCreate}
          >
            <Plus size={18} />
          </ActionIconButton>
        ) : (
          <Chip size="small" label={workflows.data?.length ?? 0} />
        )
      }
    >
      <Stack gap={1.25} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <FormField
          size="small"
          value={search}
          disabled={editorOpen}
          placeholder={t('admin.workflows.search')}
          inputProps={{ 'aria-label': t('admin.workflows.search') }}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          size="small"
          label={t('admin.workflows.lifecycle')}
          value={lifecycleFilter}
          disabled={editorOpen}
          options={[
            { value: 'ALL', label: t('admin.workflows.all') },
            ...['DRAFT', 'PUBLISHED', 'RETIRED'].map((value) => ({
              value,
              label: t(`status.${value}`),
            })),
          ]}
          onValueChange={(value) => value && setLifecycleFilter(value)}
        />
      </Stack>
      <Stack
        component="ul"
        sx={{ m: 0, p: 0, listStyle: 'none', maxHeight: 600, overflowY: 'auto' }}
      >
        {visibleWorkflows.map((workflow) => (
          <ApprovalWorkflowListItem
            key={workflow.workflowId}
            workflow={workflow}
            selected={workflow.workflowId === selectedId}
            locale={i18n.resolvedLanguage}
            disabled={editorOpen || highRiskPublish.controller.busy}
            onSelect={() => {
              if (!editorOpen) setSelectedId(workflow.workflowId);
            }}
          />
        ))}
      </Stack>
    </ApprovalSurface>
  );
  const planningOwner =
    !editorOpen &&
    workflowsState === 'READY' &&
    detailState === 'READY' &&
    !detail.isFetching &&
    detail.data
      ? readApprovalTypedWorkflowDetail(detail.data)
      : null;
  return (
    <>
      {displayDraft ? (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={isApprovalTypedWorkflowDraft(displayDraft) ? 'typed' : 'legacy'}
          aria-label={t('admin.typedWorkflow.modeLabel')}
          sx={{ mb: 1.5 }}
          onChange={(_event, mode: unknown) => {
            if (
              !creating ||
              !editorOpen ||
              checking ||
              create.isPending ||
              update.isPending ||
              (mode !== 'legacy' && mode !== 'typed')
            )
              return;
            if (mode === (isApprovalTypedWorkflowDraft(draft) ? 'typed' : 'legacy')) return;
            creationDrafts.current[isApprovalTypedWorkflowDraft(draft) ? 'typed' : 'legacy'] =
              draft;
            setDraft(creationDrafts.current[mode]);
          }}
        >
          <ToggleButton value="legacy" disabled={!editorOpen || !creating || checking}>
            {t('admin.typedWorkflow.legacyMode')}
          </ToggleButton>
          <ToggleButton value="typed" disabled={!editorOpen || !creating || checking}>
            {t('admin.typedWorkflow.graphMode')}
          </ToggleButton>
        </ToggleButtonGroup>
      ) : null}
      {workflowsState === 'STALE' || (selectedId && detailState === 'STALE') ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionIconButton
              label={t('actions.retry')}
              onClick={() => {
                void workflows.refetch();
                if (selectedId) void detail.refetch();
              }}
            >
              <RefreshCcw size={16} />
            </ActionIconButton>
          }
        >
          {t('admin.loadError')}
        </InlineFeedback>
      ) : null}
      {displayDraft && isApprovalTypedWorkflowDraft(displayDraft) ? (
        <ApprovalWorkflowTypedInlineEditor
          workspaceKey={editorOpen && creating ? 'new-typed-workflow' : (selectedId ?? 'none')}
          library={library}
          draft={displayDraft}
          editing={editorOpen}
          creating={editorOpen && creating}
          busy={checking || create.isPending || update.isPending}
          writeReady={
            (editorOpen ? draftWriteReady : detailWriteReady) &&
            (!needsConditionSource || conditionSource.available)
          }
          sourceConflict={editorOpen && !creating && !draftBindingMatches}
          readRetrying={workflows.isFetching || detail.isFetching}
          lifecycle={
            editorOpen && creating ? 'DRAFT' : (detail.data?.workflow.lifecycleState ?? 'DRAFT')
          }
          definitionHash={detail.data?.definitionHash}
          updatedAt={detail.data?.workflow.updatedAt}
          canEdit={experience.canEditDesign && detailWriteReady}
          canPublish={
            experience.canPublish &&
            detailWriteReady &&
            (!baseConditional || conditionSource.available)
          }
          publishing={highRiskPublish.controller.busy}
          source={conditionSource}
          onChange={setDraft}
          onEdit={openEdit}
          onSave={() => void save()}
          onCancel={() => setEditorOpen(false)}
          onRetryRead={retryRead}
          onPublish={() => void publish()}
        />
      ) : displayDraft ? (
        <ApprovalWorkflowInlineEditor
          workspaceKey={editorOpen && creating ? 'new-workflow' : (selectedId ?? 'none')}
          library={library}
          draft={displayDraft}
          editing={editorOpen}
          creating={editorOpen && creating}
          busy={checking || create.isPending || update.isPending}
          writeReady={editorOpen ? draftWriteReady : detailWriteReady}
          sourceConflict={editorOpen && !creating && !draftBindingMatches}
          readRetrying={workflows.isFetching || detail.isFetching}
          lifecycle={
            editorOpen && creating ? 'DRAFT' : (detail.data?.workflow.lifecycleState ?? 'DRAFT')
          }
          definitionHash={detail.data?.definitionHash}
          updatedAt={detail.data?.workflow.updatedAt}
          canEdit={experience.canEditDesign && detailWriteReady}
          canPublish={experience.canPublish && detailWriteReady}
          publishing={highRiskPublish.controller.busy}
          onChange={setDraft}
          onEdit={openEdit}
          onSave={() => void save()}
          onCancel={() => setEditorOpen(false)}
          onRetryRead={retryRead}
          onPublish={() => void publish()}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(240px,.7fr) minmax(0,2.3fr)' },
            gap: 1.5,
          }}
        >
          {library}
          {!selectedId ? (
            <EmptyState
              title={t('admin.studio.noWorkflow')}
              description={t('admin.studio.noWorkflowDescription')}
              icon={<GitBranch size={24} />}
            />
          ) : detailState === 'UNAVAILABLE' ? (
            <ErrorState
              title={t('admin.loadError')}
              retryLabel={t('actions.retry')}
              retrying={detail.isFetching}
              onRetry={() => void detail.refetch()}
              size="compact"
            />
          ) : (
            <LoadingState
              label={t('pages.workflows.title')}
              description={t('pages.workflows.description')}
              variant="skeleton"
              skeletonRows={5}
              size="compact"
            />
          )}
        </Box>
      )}
      {planningOwner && (
        <ApprovalWorkflowPlanningPanel
          key={planningOwner.workflow.workflowId}
          owner={{
            workflowId: planningOwner.workflow.workflowId,
            workflowRevision: planningOwner.workflow.version,
            workflowSha256: planningOwner.definitionHash,
            definition: planningOwner.definition,
          }}
        />
      )}
      <ApprovalHighRiskCommandDialog controller={highRiskPublish.controller} />
    </>
  );
}
