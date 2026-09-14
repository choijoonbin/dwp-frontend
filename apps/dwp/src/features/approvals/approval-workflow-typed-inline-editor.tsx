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
} from 'lucide-react';
import { ActionButton, ActionIconButton, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import { StatusChip } from './approval-ui';
import { ApprovalWorkflowDefinitionFields } from './approval-workflow-definition-fields';
import { ApprovalWorkflowTypedCanvas } from './approval-workflow-typed-canvas';
import { ApprovalWorkflowTypedInspector } from './approval-workflow-typed-inspector';
import { ApprovalWorkflowTypedConditionPanel } from './approval-workflow-typed-condition-panel';
import { approvalTypedWorkflowDraftValid } from './approval-workflow-typed-workspace-model';
import {
  addApprovalTypedWorkflowStage,
  duplicateApprovalTypedWorkflowStage,
  moveApprovalTypedWorkflowStage,
  removeApprovalTypedWorkflowStage,
  renameApprovalTypedWorkflowStage,
  setApprovalTypedWorkflowCondition,
  setApprovalTypedWorkflowPredecessors,
  setApprovalTypedWorkflowQuorum,
  updateApprovalTypedWorkflowStage,
} from './approval-workflow-typed-editor-model';

import type { ApprovalTypedWorkflowDefinition } from './approval-workflow-typed-model';
import type { ApprovalTypedWorkflowDraft } from './approval-workflow-typed-workspace-model';
import type { ApprovalWorkflowConditionSource } from './approval-workflow-typed-source';
import type { ReactNode } from 'react';

type Panel = 'library' | 'canvas' | 'inspector';

export function ApprovalWorkflowTypedInlineEditor({
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
  source,
  onChange,
  onEdit,
  onSave,
  onCancel,
  onPublish,
  onRetryRead,
}: {
  workspaceKey: string;
  library: ReactNode;
  draft: ApprovalTypedWorkflowDraft;
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
  source: ApprovalWorkflowConditionSource;
  onChange: (draft: ApprovalTypedWorkflowDraft) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onPublish: () => void;
  onRetryRead: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const [selectedKey, setSelectedKey] = useState(draft.typedDefinition.stages[0].key);
  const [panel, setPanel] = useState<Panel>('canvas');
  const [definitionOpen, setDefinitionOpen] = useState(creating);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const firstKey = useRef(draft.typedDefinition.stages[0].key);
  firstKey.current = draft.typedDefinition.stages[0].key;
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const selectedStage =
    draft.typedDefinition.stages.find((stage) => stage.key === selectedKey) ??
    draft.typedDefinition.stages[0];
  const editable = editing && !busy && writeReady;
  const valid = approvalTypedWorkflowDraftValid(draft, source.compiled) && !pending;
  useEffect(() => {
    setSelectedKey(firstKey.current);
    setPanel(creating ? 'inspector' : 'canvas');
    setDefinitionOpen(creating);
    setError(false);
  }, [workspaceKey, creating]);
  const change = (action: () => ApprovalTypedWorkflowDefinition, nextSelection?: string) => {
    if (!editable) return;
    try {
      const definition = action();
      onChange({ ...draft, typedDefinition: definition });
      if (nextSelection) setSelectedKey(nextSelection);
      setError(false);
    } catch {
      setError(true);
    }
  };
  const select = (key: string) => {
    setSelectedKey(key);
    setPanel('inspector');
  };
  const back = () => {
    setPanel('canvas');
    window.requestAnimationFrame(() =>
      canvasRef.current
        ?.querySelector<HTMLElement>(`[data-approval-typed-stage="${selectedStage.key}"]`)
        ?.focus()
    );
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
                {(locale === 'ko' ? draft.nameKo : draft.nameEn) ||
                  t('admin.studio.createWorkflow')}
              </Box>
              <StatusChip status={lifecycle} />
              <Chip
                size="small"
                variant="outlined"
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
                  disabled={!writeReady || !valid}
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
                    disabled={publishing}
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
        {!writeReady && editing ? (
          <InlineFeedback severity="warning">
            {t(sourceConflict ? 'admin.studio.saveConflict' : 'admin.loadError')}
          </InlineFeedback>
        ) : null}
        {error ? (
          <InlineFeedback severity="warning">{t('admin.typedWorkflow.graphError')}</InlineFeedback>
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
              onClick={() => setPanel(value)}
            >
              <Icon size={18} />
            </ActionIconButton>
          ))}
        </Stack>
        {panel === 'inspector' ? (
          <ActionIconButton label={t('admin.studio.backToRoute')} onClick={back}>
            <ArrowLeft size={18} />
          </ActionIconButton>
        ) : null}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0,1fr)',
            lg: 'minmax(190px,.65fr) minmax(0,1.55fr) minmax(260px,1fr)',
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
          <ApprovalWorkflowTypedCanvas
            definition={draft.typedDefinition}
            selectedKey={selectedStage.key}
            editable={editable}
            onSelect={select}
            onMove={(direction) =>
              change(() =>
                moveApprovalTypedWorkflowStage(draft.typedDefinition, selectedStage.key, direction)
              )
            }
            onDuplicate={() => {
              if (!editable) return;
              const next = duplicateApprovalTypedWorkflowStage(
                draft.typedDefinition,
                selectedStage.key
              );
              const index = next.stages.findIndex((stage) => stage.key === selectedStage.key);
              onChange({ ...draft, typedDefinition: next });
              select(next.stages[index + 1].key);
            }}
            onRemove={() =>
              change(() =>
                removeApprovalTypedWorkflowStage(draft.typedDefinition, selectedStage.key)
              )
            }
            onAdd={(relation) => {
              if (!editable) return;
              try {
                const next = addApprovalTypedWorkflowStage(
                  draft.typedDefinition,
                  selectedStage.candidateRole,
                  relation,
                  selectedStage.key
                );
                onChange({ ...draft, typedDefinition: next });
                select(next.stages[next.stages.length - 1].key);
                setError(false);
              } catch {
                setError(true);
              }
            }}
          />
        </Box>
        <Stack
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
              onChange={(next) =>
                onChange({
                  ...next,
                  typedDefinition: { ...next.typedDefinition, slaMinutes: next.slaMinutes },
                })
              }
            />
          ) : null}
          <ApprovalWorkflowTypedInspector
            key={selectedStage.key}
            definition={draft.typedDefinition}
            stage={selectedStage}
            disabled={!editable}
            onPendingChange={setPending}
            onRename={(key) =>
              change(
                () =>
                  renameApprovalTypedWorkflowStage(draft.typedDefinition, selectedStage.key, key),
                key
              )
            }
            onUpdate={(patch) =>
              change(() =>
                updateApprovalTypedWorkflowStage(draft.typedDefinition, selectedStage.key, patch)
              )
            }
            onQuorum={(quorum) =>
              change(() =>
                setApprovalTypedWorkflowQuorum(draft.typedDefinition, selectedStage.key, quorum)
              )
            }
            onPredecessors={(keys) =>
              change(() =>
                setApprovalTypedWorkflowPredecessors(draft.typedDefinition, selectedStage.key, keys)
              )
            }
          />
          <ApprovalWorkflowTypedConditionPanel
            condition={selectedStage.routeCondition}
            source={source}
            sourceLocked={busy}
            disabled={!editing || busy}
            onChange={(condition) =>
              change(() =>
                setApprovalTypedWorkflowCondition(
                  draft.typedDefinition,
                  selectedStage.key,
                  condition
                )
              )
            }
          />
        </Stack>
      </Box>
      {editing && !valid ? (
        <InlineFeedback severity="warning" sx={{ mt: 1.5 }}>
          {t('admin.typedWorkflow.validationFailed')}
        </InlineFeedback>
      ) : null}
    </Box>
  );
}
