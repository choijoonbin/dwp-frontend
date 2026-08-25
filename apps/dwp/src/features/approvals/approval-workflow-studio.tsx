import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  GitBranch,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  createApprovalWorkflowDraft,
  getApprovalStudioWorkflow,
  getApprovalStudioWorkflows,
  publishApprovalWorkflow,
  updateApprovalWorkflowDraft,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { ApprovalSurface, StatusChip, approvalTone } from './approval-ui';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { approvalWorkflowPublishCommand } from './approval-high-risk-command-model';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';
import { useApprovalHighRiskCommand } from './use-approval-high-risk-command';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';

import type {
  ApprovalWorkflow,
  ApprovalWorkflowDraftInput,
  ApprovalWorkflowStep,
} from '@dwp-frontend/shared-utils';

type WorkflowDraft = ApprovalWorkflowDraftInput & { workflowKey: string };

const CATEGORY_OPTIONS = ['GENERAL', 'FINANCE', 'PEOPLE', 'PROCUREMENT', 'ACCESS'].map((value) => ({
  value,
  label: value,
}));
const CLASSIFICATION_OPTIONS = ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].map((value) => ({
  value,
  label: value,
}));
const STEP_MODE_OPTIONS: readonly {
  value: ApprovalWorkflowStep['mode'];
  label: string;
}[] = [{ value: 'ANY', label: 'ANY' }];

const EMPTY_DRAFT: WorkflowDraft = {
  workflowKey: '',
  nameKo: '',
  nameEn: '',
  descriptionKo: '',
  descriptionEn: '',
  category: 'GENERAL',
  dataClassification: 'INTERNAL',
  slaMinutes: 1440,
  ownerGroupRef: 'APPROVAL_OPERATOR',
  steps: [
    {
      key: 'PRIMARY_REVIEW',
      name: 'Primary review',
      mode: 'ANY',
      candidateRole: 'APPROVAL_OPERATOR',
      slaMinutes: 1440,
    },
  ],
};

export function ApprovalWorkflowStudio() {
  const { t, i18n } = useTranslation('approvals');
  const experience = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<WorkflowDraft>(EMPTY_DRAFT);
  const workflows = useQuery({
    queryKey: ['approvals', 'admin', 'workflows', 'view', 'absent', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalStudioWorkflows(requestScope.contextScopeKey, signal),
    staleTime: 30_000,
  });
  const detail = useQuery({
    queryKey: [
      'approvals',
      'admin',
      'workflows',
      selectedId,
      'view',
      'absent',
      ...requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      getApprovalStudioWorkflow(selectedId!, requestScope.contextScopeKey, signal),
    enabled: Boolean(selectedId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!selectedId && workflows.data?.length) setSelectedId(workflows.data[0].workflowId);
  }, [selectedId, workflows.data]);

  const refresh = async (workflowId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['approvals', 'admin', 'workflows'] });
    if (workflowId) setSelectedId(workflowId);
  };
  const runCreate = useApprovalGovernedMutation('route.approvals.admin.workflow-create.action');
  const runUpdate = useApprovalGovernedMutation('route.approvals.admin.workflow-update.action');
  const highRiskPublish = useApprovalHighRiskCommand({
    operation: 'WORKFLOW_PUBLISH',
    execute: (command, execution) =>
      publishApprovalWorkflow(command.targetId, command.expectedObjectVersion, execution),
    onSuccess: async () => {
      await refresh(selectedId ?? undefined);
      if (selectedId) {
        await queryClient.invalidateQueries({
          queryKey: ['approvals', 'admin', 'workflows', selectedId],
        });
      }
      toast.success(t('admin.workflowPublished'));
    },
    onConflict: async () => {
      await refresh(selectedId ?? undefined);
    },
  });
  const create = useMutation({
    mutationFn: (input: WorkflowDraft) =>
      runCreate((execution) => createApprovalWorkflowDraft(input, execution)),
    onSuccess: async (result) => {
      await refresh(result.workflow.workflowId);
      setEditorOpen(false);
      toast.success(t('admin.studio.workflowCreated'));
    },
    onError: (error) => {
      if (!isProductSurfaceOperationCancelledError(error)) {
        toast.error(t('admin.studio.saveError'));
      }
    },
  });
  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: ApprovalWorkflowDraftInput & { expectedVersion: number };
    }) => runUpdate((execution) => updateApprovalWorkflowDraft(id, input, execution)),
    onSuccess: async (result) => {
      await refresh(result.workflow.workflowId);
      await queryClient.invalidateQueries({
        queryKey: ['approvals', 'admin', 'workflows', result.workflow.workflowId],
      });
      setEditorOpen(false);
      toast.success(t('admin.studio.workflowSaved'));
    },
    onError: (error) => {
      if (!isProductSurfaceOperationCancelledError(error)) {
        toast.error(t('admin.studio.saveConflict'));
      }
    },
  });
  const openCreate = () => {
    setCreating(true);
    setDraft({ ...EMPTY_DRAFT, steps: EMPTY_DRAFT.steps.map((step) => ({ ...step })) });
    setEditorOpen(true);
  };
  const openEdit = () => {
    if (!detail.data) return;
    const workflow = detail.data.workflow;
    setCreating(false);
    setDraft({
      workflowKey: workflow.workflowKey,
      nameKo: workflow.nameKo,
      nameEn: workflow.nameEn,
      descriptionKo: workflow.descriptionKo,
      descriptionEn: workflow.descriptionEn,
      category: workflow.category,
      dataClassification: workflow.dataClassification,
      slaMinutes: workflow.slaMinutes,
      ownerGroupRef: workflow.ownerGroupRef ?? '',
      steps: detail.data.definition.steps.map((step) => ({
        ...step,
        name: step.name || step.key,
      })),
    });
    setEditorOpen(true);
  };
  const save = () => {
    if (creating) create.mutate(draft);
    else if (detail.data)
      update.mutate({
        id: detail.data.workflow.workflowId,
        input: {
          ...draft,
          expectedVersion: detail.data.workflow.version,
        },
      });
  };
  const valid =
    draft.workflowKey.trim().length >= 3 &&
    draft.nameKo.trim() &&
    draft.nameEn.trim() &&
    draft.ownerGroupRef.trim() &&
    draft.steps.length > 0 &&
    draft.steps.every((step) => step.key.trim() && step.name.trim() && step.candidateRole.trim());

  if (workflows.isError) return <Alert severity="error">{t('admin.loadError')}</Alert>;

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(250px, 0.72fr) minmax(0, 2.28fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <ApprovalSurface
          title={t('admin.workflows.title')}
          meta={t('admin.workflows.meta')}
          action={
            experience.canEditDesign ? (
              <ActionIconButton
                label={t('admin.studio.createWorkflow')}
                size="small"
                intent="primary"
                onClick={openCreate}
              >
                <Plus size={18} />
              </ActionIconButton>
            ) : (
              <Chip size="small" label={workflows.data?.length ?? 0} />
            )
          }
        >
          <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {(workflows.data ?? []).map((workflow) => (
              <WorkflowListItem
                key={workflow.workflowId}
                workflow={workflow}
                selected={workflow.workflowId === selectedId}
                locale={i18n.resolvedLanguage}
                onSelect={() => setSelectedId(workflow.workflowId)}
              />
            ))}
          </Stack>
        </ApprovalSurface>

        {!selectedId ? (
          <EmptyState
            title={t('admin.studio.noWorkflow')}
            description={t('admin.studio.noWorkflowDescription')}
            icon={<GitBranch size={24} />}
          />
        ) : detail.isError ? (
          <Alert severity="error">{t('admin.loadError')}</Alert>
        ) : detail.data ? (
          <WorkflowInspector
            detail={detail.data}
            locale={i18n.resolvedLanguage}
            canEdit={experience.canEditDesign}
            canPublish={experience.canPublish}
            publishing={highRiskPublish.controller.busy}
            onEdit={openEdit}
            onPublish={() =>
              void highRiskPublish.begin(
                approvalWorkflowPublishCommand(
                  detail.data.workflow.workflowId,
                  detail.data.workflow.version
                )
              )
            }
          />
        ) : null}
      </Box>

      <WorkflowEditorDialog
        open={editorOpen}
        creating={creating}
        draft={draft}
        valid={Boolean(valid)}
        busy={create.isPending || update.isPending}
        onChange={setDraft}
        onClose={() => setEditorOpen(false)}
        onSave={save}
      />
      <ApprovalHighRiskCommandDialog controller={highRiskPublish.controller} />
    </>
  );
}

function WorkflowListItem({
  workflow,
  selected,
  locale,
  onSelect,
}: {
  workflow: ApprovalWorkflow;
  selected: boolean;
  locale?: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation('approvals');
  const name = locale?.startsWith('ko') ? workflow.nameKo : workflow.nameEn;
  return (
    <Box component="li">
      <ButtonBase
        onClick={onSelect}
        sx={{
          width: 1,
          minHeight: 72,
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          textAlign: 'left',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: selected ? alpha(approvalTone.primary, 0.08) : 'transparent',
          boxShadow: selected ? `inset 3px 0 0 ${approvalTone.primary}` : 'none',
          '&:hover': { bgcolor: alpha(approvalTone.primary, 0.055) },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={750} noWrap>
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {t('admin.workflowRevision', {
              key: workflow.workflowKey,
              version: workflow.currentVersion,
            })}
          </Typography>
        </Box>
        <StatusChip status={workflow.lifecycleState} />
      </ButtonBase>
    </Box>
  );
}

function WorkflowInspector({
  detail,
  locale,
  canEdit,
  canPublish,
  publishing,
  onEdit,
  onPublish,
}: {
  detail: Awaited<ReturnType<typeof getApprovalStudioWorkflow>>;
  locale?: string;
  canEdit: boolean;
  canPublish: boolean;
  publishing: boolean;
  onEdit: () => void;
  onPublish: () => void;
}) {
  const { t } = useTranslation('approvals');
  const workflow = detail.workflow;
  const isDraft = workflow.lifecycleState === 'DRAFT';
  const name = locale?.startsWith('ko') ? workflow.nameKo : workflow.nameEn;
  const description = locale?.startsWith('ko') ? workflow.descriptionKo : workflow.descriptionEn;
  return (
    <Stack gap={2} minWidth={0}>
      <Box
        component="section"
        sx={{
          px: { xs: 2, md: 2.5 },
          py: 2.25,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
          <Box minWidth={0}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Typography component="h2" variant="h5">
                {name}
              </Typography>
              <StatusChip status={workflow.lifecycleState} />
              <Chip size="small" variant="outlined" label={workflow.dataClassification} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {description}
            </Typography>
          </Box>
          <Stack direction="row" gap={1} alignItems="flex-start">
            {canEdit && isDraft && (
              <ActionButton intent="secondary" onClick={onEdit}>
                {t('admin.studio.editDraft')}
              </ActionButton>
            )}
            {canPublish && isDraft && (
              <ActionButton intent="primary" loading={publishing} onClick={onPublish}>
                {t('actions.publish')}
              </ActionButton>
            )}
          </Stack>
        </Stack>
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' },
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          {[
            [t('admin.studio.owner'), workflow.ownerGroupRef ?? '-'],
            [t('admin.studio.category'), workflow.category],
            [t('admin.studio.workflowSla'), t('admin.minutes', { count: workflow.slaMinutes })],
            [t('admin.studio.definitionHash'), detail.definitionHash.slice(0, 12)],
          ].map(([label, value]) => (
            <Box key={String(label)} sx={{ pt: 1.5, pr: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={720} noWrap title={String(value)}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <ApprovalSurface
        title={t('admin.studio.routeTitle')}
        meta={t('admin.studio.routeMeta', { count: detail.definition.steps.length })}
      >
        <Box
          component="ol"
          sx={{
            m: 0,
            p: 2,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              xl: `repeat(${Math.min(detail.definition.steps.length, 4)}, minmax(0,1fr))`,
            },
            gap: 1.25,
            listStyle: 'none',
          }}
        >
          {detail.definition.steps.map((step, index) => (
            <Box
              component="li"
              key={step.key}
              sx={{
                position: 'relative',
                minHeight: 126,
                p: 1.75,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: index === 0 ? alpha(approvalTone.primary, 0.04) : 'background.paper',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Chip size="small" color="primary" label={String(index + 1).padStart(2, '0')} />
                <Typography variant="caption" color="text.secondary">
                  {step.mode}
                </Typography>
              </Stack>
              <Typography variant="subtitle2" sx={{ mt: 1.25 }}>
                {step.name || step.key}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {step.candidateRole}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('admin.minutes', { count: step.slaMinutes })}
              </Typography>
              {index < detail.definition.steps.length - 1 && (
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  style={{ position: 'absolute', right: -15, top: '50%', zIndex: 2 }}
                />
              )}
            </Box>
          ))}
        </Box>
      </ApprovalSurface>

      <Box
        component="section"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {['route', 'identity', 'concurrency'].map((item) => (
          <Stack
            key={item}
            direction="row"
            gap={1.25}
            sx={{ p: 2, borderRight: { md: 1 }, borderColor: 'divider' }}
          >
            {item === 'identity' ? (
              <ShieldCheck size={18} color={approvalTone.teal} />
            ) : (
              <CheckCircle2 size={18} color={approvalTone.teal} />
            )}
            <Box>
              <Typography variant="body2" fontWeight={740}>
                {t(`admin.studio.validation.${item}.title`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`admin.studio.validation.${item}.detail`)}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Box>
    </Stack>
  );
}

function WorkflowEditorDialog({
  open,
  creating,
  draft,
  valid,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  creating: boolean;
  draft: WorkflowDraft;
  valid: boolean;
  busy: boolean;
  onChange: (draft: WorkflowDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation('approvals');
  const updateStep = (index: number, patch: Partial<ApprovalWorkflowStep>) =>
    onChange({
      ...draft,
      steps: draft.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step
      ),
    });
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    onChange({ ...draft, steps });
  };
  return (
    <FormDialog
      open={open}
      title={t(creating ? 'admin.studio.createWorkflow' : 'admin.studio.editWorkflow')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.save')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={onSave}
      maxWidth="md"
    >
      <Stack gap={2.25}>
        <Typography variant="subtitle2">{t('admin.studio.definitionSection')}</Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: 1.5,
          }}
        >
          <FormField
            label={t('admin.studio.workflowKey')}
            value={draft.workflowKey}
            disabled={!creating}
            onChange={(event) =>
              onChange({
                ...draft,
                workflowKey: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
              })
            }
          />
          <SelectField
            label={t('admin.studio.category')}
            value={draft.category}
            options={CATEGORY_OPTIONS}
            onValueChange={(value) => value && onChange({ ...draft, category: value })}
          />
          <FormField
            label={t('admin.studio.nameKo')}
            value={draft.nameKo}
            onChange={(event) => onChange({ ...draft, nameKo: event.target.value })}
          />
          <FormField
            label={t('admin.studio.nameEn')}
            value={draft.nameEn}
            onChange={(event) => onChange({ ...draft, nameEn: event.target.value })}
          />
          <FormField
            multiline
            minRows={2}
            label={t('admin.studio.descriptionKo')}
            value={draft.descriptionKo}
            onChange={(event) => onChange({ ...draft, descriptionKo: event.target.value })}
          />
          <FormField
            multiline
            minRows={2}
            label={t('admin.studio.descriptionEn')}
            value={draft.descriptionEn}
            onChange={(event) => onChange({ ...draft, descriptionEn: event.target.value })}
          />
          <SelectField
            label={t('admin.studio.classification')}
            value={draft.dataClassification}
            options={CLASSIFICATION_OPTIONS}
            onValueChange={(value) => value && onChange({ ...draft, dataClassification: value })}
          />
          <FormField
            label={t('admin.studio.owner')}
            value={draft.ownerGroupRef}
            onChange={(event) =>
              onChange({ ...draft, ownerGroupRef: event.target.value.toUpperCase() })
            }
          />
          <FormField
            type="number"
            label={t('admin.studio.workflowSlaMinutes')}
            value={draft.slaMinutes}
            inputProps={{ min: 15 }}
            onChange={(event) => onChange({ ...draft, slaMinutes: Number(event.target.value) })}
          />
        </Box>
        <Divider />
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="subtitle2">{t('admin.studio.stepsSection')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('admin.studio.stepsHelp')}
            </Typography>
          </Box>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={() =>
              onChange({
                ...draft,
                steps: [
                  ...draft.steps,
                  {
                    key: `REVIEW_${draft.steps.length + 1}`,
                    name: `Review ${draft.steps.length + 1}`,
                    mode: 'ANY',
                    candidateRole: draft.ownerGroupRef || 'APPROVAL_OPERATOR',
                    slaMinutes: draft.slaMinutes,
                  },
                ],
              })
            }
          >
            {t('admin.studio.addStep')}
          </ActionButton>
        </Stack>
        <Stack gap={1.25}>
          {draft.steps.map((step, index) => (
            <Box
              key={`${step.key}-${index}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '44px 1fr 1.2fr 120px 120px 116px' },
                gap: 1,
                alignItems: 'center',
                p: 1.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Chip size="small" label={index + 1} />
              <FormField
                size="small"
                label={t('admin.studio.stepKey')}
                value={step.key}
                onChange={(event) =>
                  updateStep(index, {
                    key: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                  })
                }
              />
              <FormField
                size="small"
                label={t('admin.studio.stepName')}
                value={step.name}
                onChange={(event) => updateStep(index, { name: event.target.value })}
              />
              <SelectField
                size="small"
                label={t('admin.studio.mode')}
                value={step.mode}
                options={STEP_MODE_OPTIONS}
                supportingText={t('admin.studio.modeHelp')}
                onValueChange={(value) => value && updateStep(index, { mode: value })}
              />
              <FormField
                size="small"
                type="number"
                label={t('admin.studio.stepSla')}
                value={step.slaMinutes}
                inputProps={{ min: 15 }}
                onChange={(event) => updateStep(index, { slaMinutes: Number(event.target.value) })}
              />
              <Stack direction="row" justifyContent="flex-end">
                <ActionIconButton
                  label={t('admin.studio.moveUp')}
                  size="small"
                  disabled={index === 0}
                  onClick={() => moveStep(index, -1)}
                >
                  <ArrowUp size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={t('admin.studio.moveDown')}
                  size="small"
                  disabled={index === draft.steps.length - 1}
                  onClick={() => moveStep(index, 1)}
                >
                  <ArrowDown size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={t('admin.studio.removeStep')}
                  size="small"
                  intent="danger"
                  disabled={draft.steps.length === 1}
                  onClick={() =>
                    onChange({
                      ...draft,
                      steps: draft.steps.filter((_, stepIndex) => stepIndex !== index),
                    })
                  }
                >
                  <Trash2 size={16} />
                </ActionIconButton>
              </Stack>
              <FormField
                size="small"
                label={t('admin.studio.candidateRole')}
                value={step.candidateRole}
                onChange={(event) =>
                  updateStep(index, { candidateRole: event.target.value.toUpperCase() })
                }
                sx={{ gridColumn: { md: '2 / span 5' } }}
              />
            </Box>
          ))}
        </Stack>
        <Alert severity="info" icon={<ShieldCheck size={18} />}>
          {t('admin.studio.sodNotice')}
        </Alert>
      </Stack>
    </FormDialog>
  );
}
