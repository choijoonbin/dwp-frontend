import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Copy, GitBranch, Plus, Trash2 } from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

import { analyzeApprovalTypedWorkflowGraph } from './approval-workflow-typed-graph';

import type { ApprovalTypedWorkflowDefinition } from './approval-workflow-typed-model';

export function ApprovalWorkflowTypedCanvas({
  definition,
  selectedKey,
  editable,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onAdd,
}: {
  definition: ApprovalTypedWorkflowDefinition;
  selectedKey: string;
  editable: boolean;
  onSelect: (key: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onAdd: (relation: 'SERIAL' | 'PARALLEL') => void;
}) {
  const { t } = useTranslation('approvals');
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const graph = analyzeApprovalTypedWorkflowGraph(definition.stages);
  const selected = definition.stages.find((stage) => stage.key === selectedKey);
  const canAdd = Boolean(
    selected &&
    /^[A-Z][A-Z0-9_]{1,49}$/.test(selected.candidateRole) &&
    definition.stages.length < 64
  );
  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
        sx={{ mb: 1.5 }}
      >
        <Box component="h3" sx={{ m: 0, typography: 'subtitle2' }}>
          {t('admin.studio.routeTitle')}
        </Box>
        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
          {t('admin.typedWorkflow.longestPath', { count: graph.longestPathMinutes })}
        </Box>
      </Stack>
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {graph.levels.map((keys, level) => (
          <Box component="li" key={keys.join('|')}>
            {level ? (
              <Box
                aria-hidden
                sx={{ height: 32, display: 'grid', placeItems: 'center', color: 'text.secondary' }}
              >
                <ArrowDown size={18} />
              </Box>
            ) : null}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))',
                gap: 1.5,
                alignItems: 'start',
              }}
            >
              {keys.map((key) => {
                const index = definition.stages.findIndex((stage) => stage.key === key);
                const stage = definition.stages[index];
                const selectedStage = key === selectedKey;
                const referenced = definition.stages.some((other) =>
                  other.predecessors.includes(key)
                );
                return (
                  <Box
                    key={key}
                    sx={{
                      minWidth: 0,
                      border: 1,
                      borderColor: selectedStage ? 'primary.main' : 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    {editable && selectedStage ? (
                      <Stack
                        direction="row"
                        gap={0.5}
                        justifyContent="flex-end"
                        sx={{ p: 0.5, borderBottom: 1, borderColor: 'divider' }}
                      >
                        <ActionIconButton
                          size="small"
                          label={t('admin.studio.moveUp')}
                          disabled={index === 0}
                          onClick={() => onMove(-1)}
                        >
                          <ArrowUp size={16} />
                        </ActionIconButton>
                        <ActionIconButton
                          size="small"
                          label={t('admin.studio.moveDown')}
                          disabled={index === definition.stages.length - 1}
                          onClick={() => onMove(1)}
                        >
                          <ArrowDown size={16} />
                        </ActionIconButton>
                        <ActionIconButton
                          size="small"
                          label={t('admin.studio.duplicateStep')}
                          disabled={definition.stages.length >= 64}
                          onClick={onDuplicate}
                        >
                          <Copy size={16} />
                        </ActionIconButton>
                        <ActionIconButton
                          size="small"
                          label={t('admin.studio.removeStep')}
                          intent="danger"
                          disabled={referenced || definition.stages.length <= 1}
                          onClick={onRemove}
                        >
                          <Trash2 size={16} />
                        </ActionIconButton>
                      </Stack>
                    ) : null}
                    <ButtonBase
                      ref={(element: HTMLButtonElement | null) => {
                        if (element) refs.current.set(key, element);
                        else refs.current.delete(key);
                      }}
                      data-approval-typed-stage={key}
                      aria-pressed={selectedStage}
                      onClick={() => onSelect(key)}
                      onKeyDown={(event) => {
                        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault();
                        const next =
                          event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? definition.stages.length - 1
                              : Math.max(
                                  0,
                                  Math.min(
                                    definition.stages.length - 1,
                                    index + (event.key === 'ArrowDown' ? 1 : -1)
                                  )
                                );
                        const nextKey = definition.stages[next].key;
                        refs.current.get(nextKey)?.focus();
                        onSelect(nextKey);
                      }}
                      sx={{
                        width: 1,
                        p: 1.5,
                        display: 'block',
                        textAlign: 'left',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Stack direction="row" gap={1} alignItems="start" flexWrap="wrap">
                        <Box
                          sx={{
                            width: 30,
                            height: 30,
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            color: 'primary.main',
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                            typography: 'caption',
                          }}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: '1 1 120px' }}>
                          <Box
                            data-approval-typed-stage-title
                            sx={{ typography: 'subtitle2', overflowWrap: 'anywhere' }}
                          >
                            {stage.name || key}
                          </Box>
                          <Box
                            sx={{
                              typography: 'caption',
                              color: 'text.secondary',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {key}
                          </Box>
                        </Box>
                        <Chip
                          sx={{ maxWidth: 1, ml: 'auto' }}
                          size="small"
                          variant="outlined"
                          label={
                            'value' in stage.quorum
                              ? `${stage.quorum.mode} ${stage.quorum.value}${stage.quorum.mode === 'PERCENT' ? '%' : ''}`
                              : stage.quorum.mode
                          }
                        />
                      </Stack>
                      <Box
                        sx={{
                          mt: 1.5,
                          p: 1,
                          bgcolor: 'action.hover',
                          typography: 'body2',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {stage.candidateRole || t('admin.integrations.notAvailable')}
                        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                          {t('admin.minutes', { count: stage.slaMinutes })}
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          mt: 1,
                          typography: 'caption',
                          color: 'text.secondary',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {stage.predecessors.length
                          ? stage.predecessors.join(' · ')
                          : t('admin.typedWorkflow.noPredecessors')}
                      </Box>
                      {stage.routeCondition ? (
                        <Chip
                          sx={{ mt: 1 }}
                          size="small"
                          variant="outlined"
                          label={t('admin.typedWorkflow.condition')}
                        />
                      ) : null}
                    </ButtonBase>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>
      {editable ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1.5 }}>
          <ActionButton
            intent="secondary"
            fullWidth
            startIcon={<Plus size={16} />}
            disabled={!canAdd}
            onClick={() => onAdd('SERIAL')}
          >
            {t('admin.typedWorkflow.addSerial')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            fullWidth
            startIcon={<GitBranch size={16} />}
            disabled={!canAdd}
            onClick={() => onAdd('PARALLEL')}
          >
            {t('admin.typedWorkflow.addParallel')}
          </ActionButton>
        </Stack>
      ) : null}
    </Box>
  );
}
