import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  GitBranch,
  List,
  PanelRight,
  PencilLine,
  RefreshCcw,
  Rocket,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton, ActionIconButton, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import { StatusChip } from './approval-ui';
import { ApprovalWorkflowDefinitionFields } from './approval-workflow-definition-fields';
import { focusApprovalLabeledControl, focusApprovalSelector } from './approval-focus-navigation';
import { ApprovalWorkflowStageCanvas } from './approval-workflow-stage-canvas';
import { ApprovalWorkflowStageInspector } from './approval-workflow-stage-inspector';
import {
  addApprovalWorkflowStep,
  approvalWorkflowDraftIssues,
  duplicateApprovalWorkflowStep,
  moveApprovalWorkflowStep,
  removeApprovalWorkflowStep,
  updateApprovalWorkflowStep,
} from './approval-workflow-model';

import type { ApprovalWorkflowDraft } from './approval-workflow-model';
import type { ApprovalWorkflowStep } from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

type Panel = 'library' | 'canvas' | 'inspector';

export function ApprovalWorkflowInlineEditor({
  workspaceKey,
  library,
  draft,
  editing,
  creating,
  busy,
  writeReady,
  sourceConflict,
  readRetrying,
  lifecycle,
  definitionHash,
  updatedAt,
  canEdit,
  canPublish,
  publishing,
  onChange,
  onEdit,
  onSave,
  onCancel,
  onPublish,
  onRetryRead,
}: {
  workspaceKey: string;
  library: ReactNode;
  draft: ApprovalWorkflowDraft;
  editing: boolean;
  creating: boolean;
  busy: boolean;
  writeReady: boolean;
  sourceConflict: boolean;
  readRetrying: boolean;
  lifecycle: string;
  definitionHash?: string;
  updatedAt?: string;
  canEdit: boolean;
  canPublish: boolean;
  publishing: boolean;
  onChange: (draft: ApprovalWorkflowDraft) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onPublish: () => void;
  onRetryRead: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [panel, setPanel] = useState<Panel>('canvas');
  const [definitionOpen, setDefinitionOpen] = useState(creating);
  const canvasRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const inspectorFocus = useRef<string | null | undefined>(undefined);
  const restoreCanvasFocus = useRef(false);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const selectedStep = draft.steps[selectedIndex];
  const issues = approvalWorkflowDraftIssues(draft);
  const editable = editing && !busy;
  const name = locale === 'ko' ? draft.nameKo : draft.nameEn;

  useEffect(() => {
    setSelectedIndex(0);
    setPanel(creating ? 'inspector' : 'canvas');
    setDefinitionOpen(creating);
    inspectorFocus.current = creating ? null : undefined;
    restoreCanvasFocus.current = false;
  }, [workspaceKey, creating]);
  useEffect(() => {
    if (selectedIndex >= draft.steps.length) setSelectedIndex(Math.max(0, draft.steps.length - 1));
  }, [draft.steps.length, selectedIndex]);

  const selectStage = (index: number) => {
    setSelectedIndex(index);
    inspectorFocus.current = t('admin.studio.stepKey');
    setPanel('inspector');
  };
  const changeStep = (patch: Partial<ApprovalWorkflowStep>) =>
    onChange(updateApprovalWorkflowStep(draft, selectedIndex, patch));
  const moveStage = (direction: -1 | 1) => {
    const next = moveApprovalWorkflowStep(draft, selectedIndex, direction);
    if (next !== draft) {
      onChange(next);
      setSelectedIndex(selectedIndex + direction);
    }
  };
  const duplicateStage = () => {
    const next = duplicateApprovalWorkflowStep(draft, selectedIndex);
    if (next !== draft) {
      onChange(next);
      setSelectedIndex(selectedIndex + 1);
    }
  };
  const addStage = () => {
    const next = addApprovalWorkflowStep(draft);
    if (next !== draft) {
      onChange(next);
      setSelectedIndex(next.steps.length - 1);
      inspectorFocus.current = t('admin.studio.stepKey');
      setPanel('inspector');
    }
  };
  const backToCanvas = () => {
    restoreCanvasFocus.current = true;
    setPanel('canvas');
  };
  useEffect(() => {
    if (panel === 'canvas' && restoreCanvasFocus.current) {
      restoreCanvasFocus.current = false;
      const frame = window.requestAnimationFrame(() => {
        focusApprovalSelector(canvasRef.current, `[data-approval-stage="${selectedIndex}"]`);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (panel !== 'inspector' || inspectorFocus.current === undefined) return;
    const label = inspectorFocus.current;
    inspectorFocus.current = undefined;
    const frame = window.requestAnimationFrame(() => {
      focusApprovalLabeledControl(inspectorRef.current, label, 'start');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [definitionOpen, panel, selectedIndex]);

  const issueLabel = (field: (typeof issues)[number]['field']) => {
    const key =
      field === 'slaMinutes'
        ? 'workflowSlaMinutes'
        : field === 'stepSlaMinutes'
          ? 'stepSla'
          : field === 'steps'
            ? null
            : field === 'stepMode'
              ? 'mode'
              : field === 'ownerGroupRef'
                ? 'owner'
                : field;
    return key ? t(`admin.studio.${key}`) : null;
  };

  return (
    <Box
      component="section"
      role="region"
      aria-label={t(
        editing
          ? creating
            ? 'admin.studio.createWorkflow'
            : 'admin.studio.editWorkflow'
          : 'admin.studio.routeTitle'
      )}
    >
      <Stack
        gap={1.5}
        sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1.5}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
              <Box component="h2" sx={{ m: 0, typography: 'h6', overflowWrap: 'anywhere' }}>
                {name || t('admin.studio.createWorkflow')}
              </Box>
              <StatusChip status={lifecycle} />
              <Chip
                size="small"
                variant="outlined"
                color={editing ? 'warning' : 'default'}
                label={t(editing ? 'admin.studio.draftEditing' : 'admin.studio.readOnly')}
              />
            </Stack>
            <Box
              sx={{
                mt: 0.5,
                typography: 'caption',
                color: 'text.secondary',
                overflowWrap: 'anywhere',
              }}
            >
              {draft.workflowKey}
              {!editing && definitionHash ? ` · ${definitionHash.slice(0, 12)}` : ''}
              {updatedAt
                ? ` · ${formatDate(updatedAt, { dateStyle: 'short', timeStyle: 'short' }, locale)}`
                : ''}
            </Box>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
            <ActionIconButton
              label={t('actions.retry')}
              tooltipDisablePortal
              disabled={readRetrying || busy}
              onClick={onRetryRead}
            >
              <RefreshCcw size={16} />
            </ActionIconButton>
            {editing ? (
              <>
                <ActionButton intent="quiet" disabled={busy} onClick={onCancel}>
                  {t('actions.cancel')}
                </ActionButton>
                <ActionButton
                  intent="primary"
                  startIcon={<Save size={16} />}
                  loading={busy}
                  disabled={!writeReady || issues.length > 0}
                  onClick={onSave}
                >
                  {t('actions.save')}
                </ActionButton>
              </>
            ) : (
              <>
                {canEdit && lifecycle === 'DRAFT' ? (
                  <ActionButton
                    intent="secondary"
                    startIcon={<PencilLine size={16} />}
                    onClick={onEdit}
                  >
                    {t('admin.studio.editDraft')}
                  </ActionButton>
                ) : null}
                {canPublish && lifecycle === 'DRAFT' ? (
                  <ActionButton
                    intent="primary"
                    startIcon={<Rocket size={16} />}
                    loading={publishing}
                    onClick={onPublish}
                  >
                    {t('actions.publish')}
                  </ActionButton>
                ) : null}
              </>
            )}
          </Stack>
        </Stack>
        {editing ? (
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
            {t('admin.studio.sodNotice')}
          </Box>
        ) : null}
        {!writeReady && editing ? (
          <InlineFeedback severity="warning">
            {t(sourceConflict ? 'admin.studio.saveConflict' : 'admin.loadError')}
          </InlineFeedback>
        ) : null}
      </Stack>

      <Stack
        direction="row"
        justifyContent="space-between"
        sx={{ display: { xs: 'flex', lg: 'none' }, mb: 1.5 }}
      >
        <Stack
          direction="row"
          gap={0.5}
          role="group"
          aria-label={t('admin.studio.workflowNavigation')}
        >
          {(
            [
              ['library', 'admin.workflows.title', List],
              ['canvas', 'admin.studio.routeTitle', GitBranch],
              ['inspector', 'admin.studio.processInspector', PanelRight],
            ] as const
          ).map(([value, label, Icon]) => (
            <ActionIconButton
              key={value}
              label={t(label)}
              intent={panel === value ? 'primary' : 'default'}
              aria-pressed={panel === value}
              onClick={() => {
                if (value === 'canvas') restoreCanvasFocus.current = true;
                if (value === 'inspector') inspectorFocus.current = null;
                setPanel(value);
              }}
            >
              <Icon size={18} />
            </ActionIconButton>
          ))}
        </Stack>
        {panel === 'inspector' ? (
          <ActionIconButton label={t('admin.studio.backToRoute')} onClick={backToCanvas}>
            <ArrowLeft size={18} />
          </ActionIconButton>
        ) : null}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0,1fr)',
            lg: 'minmax(190px,.65fr) minmax(0,1.35fr) minmax(260px,1fr)',
          },
          gap: 1.5,
          alignItems: 'start',
        }}
      >
        <Box
          sx={{ minWidth: 0, display: { xs: panel === 'library' ? 'block' : 'none', lg: 'block' } }}
        >
          {library}
        </Box>
        <Box
          ref={canvasRef}
          sx={{ minWidth: 0, display: { xs: panel === 'canvas' ? 'block' : 'none', lg: 'block' } }}
        >
          <Stack
            direction="row"
            gap={1}
            alignItems="center"
            justifyContent="space-between"
            sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}
          >
            <Box component="h3" sx={{ m: 0, typography: 'subtitle2' }}>
              {t('admin.studio.routeTitle')}
            </Box>
            <Chip size="small" label={t('admin.studio.routeMeta', { count: draft.steps.length })} />
          </Stack>
          <ApprovalWorkflowStageCanvas
            steps={draft.steps}
            selectedIndex={selectedIndex}
            editable={editable}
            onSelect={selectStage}
            onMove={moveStage}
            onDuplicate={duplicateStage}
            onRemove={() => onChange(removeApprovalWorkflowStep(draft, selectedIndex))}
            onAdd={addStage}
          />
        </Box>
        <Stack
          ref={inspectorRef}
          role="region"
          aria-label={t('admin.studio.processInspector')}
          tabIndex={-1}
          gap={2}
          sx={{
            p: 1.5,
            minWidth: 0,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            display: { xs: panel === 'inspector' ? 'flex' : 'none', lg: 'flex' },
          }}
        >
          <ActionButton
            intent="quiet"
            startIcon={definitionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            aria-expanded={definitionOpen}
            onClick={() => setDefinitionOpen(!definitionOpen)}
          >
            {t('admin.studio.definitionSection')}
          </ActionButton>
          {definitionOpen ? (
            <ApprovalWorkflowDefinitionFields
              draft={draft}
              creating={creating}
              disabled={!editable}
              onChange={onChange}
            />
          ) : null}
          {selectedStep ? (
            <ApprovalWorkflowStageInspector
              step={selectedStep}
              index={selectedIndex}
              disabled={!editable}
              onChange={changeStep}
            />
          ) : null}
        </Stack>
      </Box>

      {editing ? (
        <InlineFeedback
          severity={issues.length ? 'warning' : 'success'}
          icon={<ShieldCheck size={18} />}
          sx={{ mt: 1.5 }}
        >
          <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>
            {issues.length
              ? t('admin.studio.validationSummary', { count: issues.length })
              : t('admin.studio.validation.route.title')}
          </Box>
          <Box sx={{ typography: 'caption' }}>{t('admin.studio.validation.route.detail')}</Box>
          {issues.length ? (
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              {issues.map((issue, index) => (
                <ActionButton
                  key={`${issue.field}-${index}`}
                  size="small"
                  intent="quiet"
                  onClick={() => {
                    if (issue.stepIndex !== undefined) setSelectedIndex(issue.stepIndex);
                    else setDefinitionOpen(true);
                    inspectorFocus.current = issueLabel(issue.field);
                    setPanel('inspector');
                  }}
                >
                  {t('admin.studio.validationIssue', {
                    field: issueLabel(issue.field) ?? t('admin.studio.stepsSection'),
                  })}
                </ActionButton>
              ))}
            </Stack>
          ) : null}
        </InlineFeedback>
      ) : null}
    </Box>
  );
}
