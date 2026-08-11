import { useTranslation } from 'react-i18next';
import { Check, Plus, RotateCcw, X } from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';

type HomeEditToolbarProps = {
  busy?: boolean;
  onAdd: () => void;
  onReset: () => void;
  onCancel: () => void;
  onDone: () => void;
};

export function HomeEditToolbar({
  busy = false,
  onAdd,
  onReset,
  onCancel,
  onDone,
}: HomeEditToolbarProps) {
  const { t } = useTranslation('home');

  return (
    <Paper
      component="nav"
      aria-label={t('editor.toolbarLabel')}
      elevation={0}
      sx={{
        position: 'fixed',
        left: '50%',
        bottom: { xs: 'max(12px, env(safe-area-inset-bottom))', md: 24 },
        zIndex: 1200,
        transform: 'translateX(-50%)',
        width: 'max-content',
        maxWidth: 'calc(100vw - 24px)',
        minHeight: 56,
        px: { xs: 0.5, sm: 1 },
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.25, sm: 0.5 },
        border: 1,
        borderColor: 'rgba(148,163,184,0.42)',
        borderRadius: 1,
        bgcolor: 'rgba(255,255,255,0.90)',
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
          minWidth: { xs: 68, sm: 'auto' },
          flexShrink: 0,
          whiteSpace: 'nowrap',
          '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
        }}
      >
        {t('editor.addItems')}
      </ActionButton>
      <Box sx={{ width: 1, height: 26, bgcolor: 'divider', mx: 0.25 }} />
      <ActionIconButton label={t('editor.reset')} onClick={onReset} disabled={busy}>
        <RotateCcw size={18} />
      </ActionIconButton>
      <ActionIconButton label={t('editor.cancel')} onClick={onCancel} disabled={busy}>
        <X size={19} />
      </ActionIconButton>
      <ActionButton
        intent="primary"
        size="small"
        startIcon={<Check size={17} />}
        onClick={onDone}
        loading={busy}
        loadingLabel={t('editor.done')}
        sx={{
          minWidth: { xs: 76, sm: 'auto' },
          flexShrink: 0,
          whiteSpace: 'nowrap',
          '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
        }}
      >
        {t('editor.done')}
      </ActionButton>
    </Paper>
  );
}
