import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

import { StatusChip } from './approval-ui';

import type { ApprovalWorkflow } from '@dwp-frontend/shared-utils';

export function ApprovalWorkflowListItem({
  workflow,
  selected,
  disabled,
  locale,
  onSelect,
}: {
  workflow: ApprovalWorkflow;
  selected: boolean;
  disabled: boolean;
  locale?: string;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(locale, i18n.resolvedLanguage, i18n.language) === 'ko';
  return (
    <Box component="li">
      <ButtonBase
        aria-current={selected ? 'true' : undefined}
        disabled={disabled}
        onClick={onSelect}
        sx={{
          width: 1,
          px: 1.5,
          py: 1.5,
          display: 'block',
          textAlign: 'left',
          borderBottom: 1,
          borderColor: 'divider',
          borderInlineStart: 3,
          borderInlineStartColor: selected ? 'primary.main' : 'transparent',
          bgcolor: selected ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Stack gap={0.5}>
          <Box sx={{ typography: 'subtitle2', overflowWrap: 'anywhere' }}>
            {korean ? workflow.nameKo : workflow.nameEn}
          </Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
            {t('admin.workflowRevision', {
              key: workflow.workflowKey,
              version: workflow.currentVersion,
            })}
          </Box>
          <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
            <StatusChip status={workflow.lifecycleState} />
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
              {t('admin.minutes', { count: workflow.slaMinutes })}
            </Box>
          </Stack>
          <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
            {workflow.ownerGroupRef ?? t('admin.integrations.notAvailable')}
          </Box>
        </Stack>
      </ButtonBase>
    </Box>
  );
}
