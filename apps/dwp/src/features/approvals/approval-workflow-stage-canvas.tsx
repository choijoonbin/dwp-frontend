import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

import type { ApprovalWorkflowStep } from '@dwp-frontend/shared-utils';

export function ApprovalWorkflowStageCanvas({
  steps,
  selectedIndex,
  editable,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onAdd,
}: {
  steps: readonly ApprovalWorkflowStep[];
  selectedIndex: number;
  editable: boolean;
  onSelect: (index: number) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation('approvals');
  const refs = useRef(new Map<number, HTMLButtonElement>());
  return (
    <Box>
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {steps.map((step, index) => (
          <Box component="li" key={`${step.key}-${index}`}>
            <Box
              sx={{
                border: 1,
                borderColor: selectedIndex === index ? 'primary.main' : 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {editable && selectedIndex === index ? (
                <Stack
                  direction="row"
                  justifyContent="flex-end"
                  gap={0.5}
                  sx={{ p: 0.5, borderBottom: 1, borderColor: 'divider' }}
                >
                  <ActionIconButton
                    label={t('admin.studio.moveUp')}
                    size="small"
                    disabled={index === 0}
                    onClick={() => onMove(-1)}
                  >
                    <ArrowUp size={16} />
                  </ActionIconButton>
                  <ActionIconButton
                    label={t('admin.studio.moveDown')}
                    size="small"
                    disabled={index === steps.length - 1}
                    onClick={() => onMove(1)}
                  >
                    <ArrowDown size={16} />
                  </ActionIconButton>
                  <ActionIconButton
                    label={t('admin.studio.duplicateStep')}
                    size="small"
                    disabled={steps.length >= 20}
                    onClick={onDuplicate}
                  >
                    <Copy size={16} />
                  </ActionIconButton>
                  <ActionIconButton
                    label={t('admin.studio.removeStep')}
                    size="small"
                    intent="danger"
                    disabled={steps.length <= 1}
                    onClick={onRemove}
                  >
                    <Trash2 size={16} />
                  </ActionIconButton>
                </Stack>
              ) : null}
              <ButtonBase
                ref={(element: HTMLButtonElement | null) => {
                  if (element) refs.current.set(index, element);
                  else refs.current.delete(index);
                }}
                aria-pressed={selectedIndex === index}
                data-approval-stage={index}
                onClick={() => onSelect(index)}
                onKeyDown={(event) => {
                  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? steps.length - 1
                        : Math.max(
                            0,
                            Math.min(steps.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))
                          );
                  refs.current.get(next)?.focus();
                  onSelect(next);
                }}
                sx={{
                  width: 1,
                  p: 1.5,
                  textAlign: 'left',
                  display: 'block',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Stack direction="row" gap={1} alignItems="flex-start">
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 30,
                      height: 30,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                      typography: 'caption',
                      fontWeight: 'fontWeightBold',
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ typography: 'subtitle2', overflowWrap: 'anywhere' }}>
                      {step.name || step.key}
                    </Box>
                    <Box
                      sx={{
                        typography: 'caption',
                        color: 'text.secondary',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {step.key}
                    </Box>
                  </Box>
                  <Chip size="small" variant="outlined" label={step.mode} />
                </Stack>
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1,
                    bgcolor: 'action.hover',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
                    gap: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                      {t('admin.studio.candidateRole')}
                    </Box>
                    <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>
                      {step.candidateRole}
                    </Box>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                      {t('admin.studio.stepSla')}
                    </Box>
                    <Box sx={{ typography: 'body2' }}>
                      {t('admin.minutes', { count: step.slaMinutes })}
                    </Box>
                  </Box>
                </Box>
              </ButtonBase>
            </Box>
            {index < steps.length - 1 ? (
              <Box
                aria-hidden
                sx={{ height: 36, display: 'grid', placeItems: 'center', color: 'text.secondary' }}
              >
                <ArrowDown size={18} />
              </Box>
            ) : null}
          </Box>
        ))}
      </Box>
      {editable ? (
        <ActionButton
          intent="quiet"
          fullWidth
          startIcon={<Plus size={16} />}
          disabled={steps.length >= 20}
          onClick={onAdd}
          sx={{ mt: 1.5 }}
        >
          {t('admin.studio.addStep')}
        </ActionButton>
      ) : null}
    </Box>
  );
}
