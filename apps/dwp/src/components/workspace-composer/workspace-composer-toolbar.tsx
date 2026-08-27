import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Focus,
  Maximize2,
  Monitor,
  Plus,
  Redo2,
  RotateCcw,
  Smartphone,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';

import type { HomePresentation } from '@dwp-frontend/shared-utils';

type WorkspaceComposerToolbarProps = {
  presentation: HomePresentation;
  placement?: 'sticky' | 'floating';
  busy?: boolean;
  onPresentationChange: (presentation: HomePresentation) => void;
  onAdd: () => void;
  addLabel?: string;
  addUnavailableReason?: string;
  onReset: () => void;
  onCancel: () => void;
  onDone: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canReset?: boolean;
  canSave?: boolean;
  dirtyCount?: number;
  previewDevice?: 'desktop' | 'mobile';
  onUndo?: () => void;
  onRedo?: () => void;
  onPreviewDeviceChange?: (device: 'desktop' | 'mobile') => void;
  widePresentation?: boolean;
};

const presentationIcons = {
  balanced: Check,
  expressive: Sparkles,
  focused: Focus,
} satisfies Record<HomePresentation, typeof Check>;

const toolbarDividerSx = {
  width: '1px',
  minWidth: '1px',
  height: 28,
  flex: '0 0 1px',
  mx: 0.25,
  bgcolor: 'divider',
  '@media (forced-colors: active)': { bgcolor: 'CanvasText' },
} as const;

export function WorkspaceComposerToolbar({
  presentation,
  placement = 'sticky',
  busy = false,
  onPresentationChange,
  onAdd,
  addLabel,
  addUnavailableReason,
  onReset,
  onCancel,
  onDone,
  canUndo = false,
  canRedo = false,
  canReset = true,
  canSave = true,
  dirtyCount = 0,
  previewDevice,
  onUndo,
  onRedo,
  onPreviewDeviceChange,
  widePresentation = false,
}: WorkspaceComposerToolbarProps) {
  const { t } = useTranslation('composer');
  const floating = placement === 'floating';
  const addUnavailableDescriptionId = useId();

  return (
    <Paper
      component="nav"
      aria-label={t('toolbarLabel')}
      data-workspace-composer-placement={placement}
      elevation={0}
      sx={{
        position: floating ? 'fixed' : 'sticky',
        top: floating ? 'auto' : { xs: 8, md: 12 },
        bottom: floating ? { xs: 'max(12px, env(safe-area-inset-bottom))', sm: 16 } : 'auto',
        left: floating
          ? { xs: '50%', lg: 'calc((100vw + var(--dwp-shell-navigation-offset, 0px)) / 2)' }
          : 'auto',
        transform: floating ? 'translateX(-50%)' : 'none',
        // Dialogs and menus must always own both focus and pointer input while open.
        zIndex: floating ? (theme) => theme.zIndex.modal - 1 : 20,
        width: 'max-content',
        maxWidth: 'calc(100vw - 24px)',
        minHeight: 58,
        mx: floating ? 0 : 'auto',
        mb: floating ? 0 : 2,
        px: { xs: 0.5, sm: 1 },
        display: 'flex',
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 0.25, sm: 0.5 },
        border: 1,
        borderColor: 'rgba(148,163,184,0.46)',
        borderRadius: 1,
        bgcolor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(22px) saturate(145%)',
        WebkitBackdropFilter: 'blur(22px) saturate(145%)',
        boxShadow: '0 18px 46px rgba(15,23,42,0.24)',
        '& .MuiIconButton-root': { minWidth: 44, minHeight: 44 },
        '@media (prefers-reduced-transparency: reduce)': {
          bgcolor: 'background.paper',
          boxShadow: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          color: 'CanvasText',
          borderColor: 'CanvasText',
          boxShadow: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
      }}
    >
      <Tooltip title={addUnavailableReason ?? ''} describeChild>
        <ActionButton
          intent="quiet"
          size="small"
          aria-label={addLabel ?? t('addWidget')}
          aria-describedby={addUnavailableReason ? addUnavailableDescriptionId : undefined}
          aria-disabled={addUnavailableReason ? true : undefined}
          startIcon={<Plus size={17} />}
          onClick={addUnavailableReason ? undefined : onAdd}
          disabled={busy}
          sx={{
            width: { xs: 44, sm: 'auto' },
            minWidth: { xs: 44, sm: 'auto' },
            minHeight: 44,
            px: { xs: 0, sm: 1.25 },
            whiteSpace: 'nowrap',
            cursor: addUnavailableReason ? 'not-allowed' : undefined,
            opacity: addUnavailableReason ? 0.56 : 1,
            '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {addLabel ?? t('addWidget')}
          </Box>
        </ActionButton>
      </Tooltip>
      {addUnavailableReason && (
        <Box
          component="span"
          id={addUnavailableDescriptionId}
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            p: 0,
            m: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {addUnavailableReason}
        </Box>
      )}
      <Box aria-hidden="true" sx={toolbarDividerSx} />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={presentation}
        aria-label={t('presentationLabel')}
        onChange={(_, value: HomePresentation | null) => {
          if (value) onPresentationChange(value);
        }}
        sx={{
          '& .MuiToggleButton-root': { width: 44, height: 44, px: 0, borderRadius: 1 },
        }}
      >
        {(Object.keys(presentationIcons) as HomePresentation[]).map((value) => {
          const Icon =
            widePresentation && value === 'expressive' ? Maximize2 : presentationIcons[value];
          const labelKey =
            widePresentation && value === 'expressive'
              ? 'presentations.wide'
              : `presentations.${value}`;
          return (
            <Tooltip key={value} title={t(labelKey)}>
              <ToggleButton value={value} aria-label={t(labelKey)}>
                <Icon size={16} />
              </ToggleButton>
            </Tooltip>
          );
        })}
      </ToggleButtonGroup>
      {onUndo && onRedo && (
        <>
          <Box aria-hidden="true" sx={toolbarDividerSx} />
          <ActionIconButton label={t('undo')} onClick={onUndo} disabled={busy || !canUndo}>
            <Undo2 size={17} />
          </ActionIconButton>
          <ActionIconButton label={t('redo')} onClick={onRedo} disabled={busy || !canRedo}>
            <Redo2 size={17} />
          </ActionIconButton>
        </>
      )}
      {previewDevice && onPreviewDeviceChange && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={previewDevice}
          aria-label={t('previewLabel')}
          onChange={(_, value: 'desktop' | 'mobile' | null) => {
            if (value) onPreviewDeviceChange(value);
          }}
          sx={{
            display: { xs: 'none', sm: 'inline-flex' },
            ml: 0.25,
            '& .MuiToggleButton-root': { width: 44, height: 44, px: 0 },
          }}
        >
          <Tooltip title={t('previewDesktop')}>
            <ToggleButton value="desktop" aria-label={t('previewDesktop')}>
              <Monitor size={16} />
            </ToggleButton>
          </Tooltip>
          <Tooltip title={t('previewMobile')}>
            <ToggleButton value="mobile" aria-label={t('previewMobile')}>
              <Smartphone size={16} />
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      )}
      {dirtyCount > 0 && (
        <Chip
          size="small"
          color="warning"
          aria-live="polite"
          label={t('changeCount', { count: dirtyCount })}
          sx={{ display: { xs: 'none', md: 'inline-flex' } }}
        />
      )}
      <Box aria-hidden="true" sx={toolbarDividerSx} />
      <ActionIconButton label={t('reset')} onClick={onReset} disabled={busy || !canReset}>
        <RotateCcw size={18} />
      </ActionIconButton>
      <ActionIconButton label={t('cancel')} onClick={onCancel} disabled={busy}>
        <X size={19} />
      </ActionIconButton>
      <ActionButton
        intent="primary"
        size="small"
        aria-label={t('done')}
        startIcon={<Check size={17} />}
        onClick={onDone}
        disabled={!canSave}
        loading={busy}
        loadingLabel={t('done')}
        sx={{
          width: { xs: 44, sm: 'auto' },
          minWidth: { xs: 44, sm: 'auto' },
          minHeight: 44,
          px: { xs: 0, sm: 1.25 },
          whiteSpace: 'nowrap',
          '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
        }}
      >
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          {t('done')}
        </Box>
      </ActionButton>
    </Paper>
  );
}
