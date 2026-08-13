import { useTranslation } from 'react-i18next';
import { Check, Focus, Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';

import type { HomePresentation } from '@dwp-frontend/shared-utils';

type WorkspaceComposerToolbarProps = {
  presentation: HomePresentation;
  busy?: boolean;
  onPresentationChange: (presentation: HomePresentation) => void;
  onAdd: () => void;
  onReset: () => void;
  onCancel: () => void;
  onDone: () => void;
};

const presentationIcons = {
  balanced: Check,
  expressive: Sparkles,
  focused: Focus,
} satisfies Record<HomePresentation, typeof Check>;

export function WorkspaceComposerToolbar({
  presentation,
  busy = false,
  onPresentationChange,
  onAdd,
  onReset,
  onCancel,
  onDone,
}: WorkspaceComposerToolbarProps) {
  const { t } = useTranslation('composer');

  return (
    <Paper
      component="nav"
      aria-label={t('toolbarLabel')}
      elevation={0}
      sx={{
        position: 'sticky',
        top: { xs: 8, md: 12 },
        zIndex: 20,
        width: 'max-content',
        maxWidth: 'calc(100vw - 24px)',
        minHeight: 58,
        mx: 'auto',
        mb: 2,
        px: { xs: 0.5, sm: 1 },
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.25, sm: 0.5 },
        border: 1,
        borderColor: 'rgba(148,163,184,0.46)',
        borderRadius: 1,
        bgcolor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(22px) saturate(145%)',
        WebkitBackdropFilter: 'blur(22px) saturate(145%)',
        boxShadow: '0 18px 46px rgba(15,23,42,0.24)',
        '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': {
          bgcolor: 'background.paper',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
      }}
    >
      <ActionButton
        intent="quiet"
        size="small"
        startIcon={<Plus size={17} />}
        onClick={onAdd}
        disabled={busy}
        sx={{
          minWidth: { xs: 60, sm: 'auto' },
          whiteSpace: 'nowrap',
          '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
        }}
      >
        {t('addWidget')}
      </ActionButton>
      <Box sx={{ width: 1, height: 28, bgcolor: 'divider', mx: 0.25 }} />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={presentation}
        aria-label={t('presentationLabel')}
        onChange={(_, value: HomePresentation | null) => {
          if (value) onPresentationChange(value);
        }}
        sx={{
          '& .MuiToggleButton-root': { width: 34, height: 34, px: 0, borderRadius: 1 },
        }}
      >
        {(Object.keys(presentationIcons) as HomePresentation[]).map((value) => {
          const Icon = presentationIcons[value];
          return (
            <Tooltip key={value} title={t(`presentations.${value}`)}>
              <ToggleButton value={value} aria-label={t(`presentations.${value}`)}>
                <Icon size={16} />
              </ToggleButton>
            </Tooltip>
          );
        })}
      </ToggleButtonGroup>
      <Box sx={{ width: 1, height: 28, bgcolor: 'divider', mx: 0.25 }} />
      <ActionIconButton label={t('reset')} onClick={onReset} disabled={busy}>
        <RotateCcw size={18} />
      </ActionIconButton>
      <ActionIconButton label={t('cancel')} onClick={onCancel} disabled={busy}>
        <X size={19} />
      </ActionIconButton>
      <ActionButton
        intent="primary"
        size="small"
        startIcon={<Check size={17} />}
        onClick={onDone}
        loading={busy}
        loadingLabel={t('done')}
        sx={{
          minWidth: { xs: 68, sm: 'auto' },
          whiteSpace: 'nowrap',
          '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
        }}
      >
        {t('done')}
      </ActionButton>
    </Paper>
  );
}
