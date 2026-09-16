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
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import { alpha, lighten } from '@mui/material/styles';

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

const toolbarColors = {
  surface: alpha(foundationTokens.color.neutral[900], 0.97),
  border: alpha(foundationTokens.color.neutral[700], 0.96),
  borderQuiet: alpha(foundationTokens.color.neutral[700], 0.94),
  icon: alpha(foundationTokens.color.neutral[100], 0.9),
  iconDisabled: alpha(foundationTokens.color.neutral[300], 0.38),
  quietText: alpha(foundationTokens.color.neutral[25], 0.96),
  quietSurface: alpha(foundationTokens.color.neutral[800], 0.92),
  quietBorder: alpha(foundationTokens.color.neutral[400], 0.72),
  quietHover: alpha(foundationTokens.color.neutral[700], 0.96),
  toggleBorder: alpha(foundationTokens.color.neutral[400], 0.8),
  toggleText: alpha(foundationTokens.color.neutral[300], 0.96),
  selectedText: foundationTokens.home.color.heroFocus,
  selectedSurface: alpha(foundationTokens.color.product.primary, 0.24),
  selectedBorder: alpha(lighten(foundationTokens.color.product.primary, 0.32), 0.64),
  selectedHover: alpha(foundationTokens.color.product.primary, 0.34),
  warningText: lighten(foundationTokens.color.data.saffron, 0.48),
  warningSurface: alpha(foundationTokens.color.data.saffron, 0.14),
  warningBorder: alpha(foundationTokens.color.data.saffron, 0.42),
  cancelText: alpha(foundationTokens.color.neutral[200], 0.9),
} as const;

const toolbarMobileRadius = `${foundationTokens.home.radius.heroSurface} ${foundationTokens.home.radius.heroSurface} 0 0`;

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
      data-home-content-state={dirtyCount > 0 ? 'dirty' : undefined}
      data-home-draft-preserved={dirtyCount > 0 ? 'true' : undefined}
      elevation={0}
      sx={{
        position: floating ? 'fixed' : 'sticky',
        top: floating ? 'auto' : { xs: 8, md: 12 },
        bottom: floating ? { xs: 'env(safe-area-inset-bottom)', sm: 16 } : 'auto',
        left: floating
          ? { xs: '50%', lg: 'calc((100vw + var(--dwp-shell-navigation-offset, 0px)) / 2)' }
          : 'auto',
        transform: floating ? 'translateX(-50%)' : 'none',
        // Dialogs and menus must always own both focus and pointer input while open.
        zIndex: floating ? (theme) => theme.zIndex.modal - 1 : 20,
        width: floating ? { xs: '100vw', sm: 'max-content' } : 'max-content',
        maxWidth: floating ? { xs: 390, sm: 'calc(100vw - 24px)' } : 'calc(100vw - 24px)',
        minHeight: { xs: 112, sm: 64 },
        mx: floating ? 0 : 'auto',
        mb: floating ? 0 : 2,
        p: { xs: 1.5, sm: 1.25 },
        display: { xs: 'grid', sm: 'flex' },
        gridTemplateColumns: { xs: 'auto auto minmax(0, 1fr) auto', sm: undefined },
        gridTemplateRows: { xs: '44px 44px', sm: undefined },
        flexWrap: { sm: 'nowrap' },
        alignItems: 'center',
        justifyContent: 'center',
        columnGap: { xs: 0.75, sm: 0.5 },
        rowGap: { xs: 1, sm: 0 },
        border: 1,
        borderColor: { xs: toolbarColors.border, sm: toolbarColors.borderQuiet },
        borderRadius: { xs: toolbarMobileRadius, sm: foundationTokens.home.radius.card },
        bgcolor: toolbarColors.surface,
        color: 'common.white',
        backdropFilter: 'blur(22px) saturate(145%)',
        WebkitBackdropFilter: 'blur(22px) saturate(145%)',
        boxShadow: (theme) => theme.shadows[12],
        '& .MuiIconButton-root': {
          minWidth: 44,
          minHeight: 44,
          color: toolbarColors.icon,
          '&.Mui-disabled': { color: toolbarColors.iconDisabled },
        },
        '& [data-composer-control="add"]': { gridColumn: { xs: 1, sm: 'auto' }, gridRow: 1 },
        '& [data-composer-control="presentation"]': {
          gridColumn: { xs: 2, sm: 'auto' },
          gridRow: 1,
        },
        '& [data-composer-control="undo"]': { gridColumn: { xs: 1, sm: 'auto' }, gridRow: 2 },
        '& [data-composer-control="redo"]': { gridColumn: { xs: 2, sm: 'auto' }, gridRow: 2 },
        '& [data-composer-control="status"]': {
          gridColumn: { xs: 3, sm: 'auto' },
          gridRow: 1,
          justifySelf: 'end',
        },
        '& [data-composer-control="reset"]': { display: { xs: 'none', sm: 'inline-flex' } },
        '& [data-composer-control="cancel"]': {
          gridColumn: { xs: 4, sm: 'auto' },
          gridRow: 1,
        },
        '& [data-composer-control="save"]': {
          gridColumn: { xs: '3 / 5', sm: 'auto' },
          gridRow: 2,
        },
        '& [data-composer-divider]': { display: { xs: 'none', sm: 'block' } },
        '@media (prefers-reduced-transparency: reduce)': {
          bgcolor: foundationTokens.color.neutral[900],
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
          data-composer-control="add"
          intent="quiet"
          size="small"
          aria-label={addLabel ?? t('addWidget')}
          aria-describedby={addUnavailableReason ? addUnavailableDescriptionId : undefined}
          aria-disabled={addUnavailableReason ? true : undefined}
          startIcon={<Plus size={17} />}
          onClick={addUnavailableReason ? undefined : onAdd}
          disabled={busy}
          sx={{
            width: { xs: 'auto', sm: 'auto' },
            minWidth: { xs: 64, sm: 'auto' },
            minHeight: 44,
            px: { xs: 1.25, sm: 1.25 },
            whiteSpace: 'nowrap',
            color: toolbarColors.quietText,
            bgcolor: toolbarColors.quietSurface,
            border: 1,
            borderColor: toolbarColors.quietBorder,
            '&:hover': { bgcolor: toolbarColors.quietHover },
            cursor: addUnavailableReason ? 'not-allowed' : undefined,
            opacity: addUnavailableReason ? 0.56 : 1,
            '& .MuiButton-startIcon': { mr: 0.75 },
          }}
        >
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
            {t('addShort')}
          </Box>
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
      <Box aria-hidden="true" data-composer-divider sx={toolbarDividerSx} />
      <ToggleButtonGroup
        data-composer-control="presentation"
        exclusive
        size="small"
        value={presentation}
        aria-label={t('presentationLabel')}
        onChange={(_, value: HomePresentation | null) => {
          if (value) onPresentationChange(value);
        }}
        sx={{
          '& .MuiToggleButton-root': {
            minWidth: { xs: 44, sm: 74 },
            width: { xs: 44, sm: 'auto' },
            height: 44,
            px: 1,
            gap: 0.625,
            borderRadius: foundationTokens.home.radius.subtle,
            borderColor: toolbarColors.toggleBorder,
            color: toolbarColors.toggleText,
            '&.Mui-selected': {
              color: toolbarColors.selectedText,
              bgcolor: toolbarColors.selectedSurface,
              borderColor: toolbarColors.selectedBorder,
            },
            '&.Mui-selected:hover': { bgcolor: toolbarColors.selectedHover },
          },
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
                <Box
                  component="span"
                  sx={{
                    display: { xs: 'none', sm: 'inline' },
                    fontSize: foundationTokens.home.typography.captionSize,
                    fontWeight: foundationTokens.home.typography.weightBold,
                  }}
                >
                  {t(labelKey)}
                </Box>
              </ToggleButton>
            </Tooltip>
          );
        })}
      </ToggleButtonGroup>
      {onUndo && onRedo && (
        <>
          <Box aria-hidden="true" data-composer-divider sx={toolbarDividerSx} />
          <ActionIconButton
            data-composer-control="undo"
            label={t('undo')}
            onClick={onUndo}
            disabled={busy || !canUndo}
          >
            <Undo2 size={17} />
          </ActionIconButton>
          <ActionIconButton
            data-composer-control="redo"
            label={t('redo')}
            onClick={onRedo}
            disabled={busy || !canRedo}
          >
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
          data-composer-control="status"
          data-home-content-state="dirty"
          size="small"
          color="warning"
          aria-live="polite"
          label={`${t('changeCount', { count: dirtyCount })} ${t('draftSuffix')}`}
          sx={{
            display: 'inline-flex',
            maxWidth: { xs: 100, sm: 'none' },
            color: toolbarColors.warningText,
            bgcolor: toolbarColors.warningSurface,
            border: 1,
            borderColor: toolbarColors.warningBorder,
            fontWeight: foundationTokens.home.typography.weightBold,
            '& .MuiChip-label': { px: { xs: 0.75, sm: 1.25 } },
          }}
        />
      )}
      <Box aria-hidden="true" data-composer-divider sx={toolbarDividerSx} />
      <ActionIconButton
        data-composer-control="reset"
        label={t('reset')}
        onClick={onReset}
        disabled={busy || !canReset}
      >
        <RotateCcw size={18} />
      </ActionIconButton>
      <ActionButton
        data-composer-control="cancel"
        intent="quiet"
        size="small"
        aria-label={t('cancel')}
        startIcon={<X size={17} />}
        onClick={onCancel}
        disabled={busy}
        sx={{
          minWidth: { xs: 44, sm: 'auto' },
          minHeight: 44,
          px: { xs: 0.75, sm: 1.25 },
          color: toolbarColors.cancelText,
          '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
        }}
      >
        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
          {t('cancelShort')}
        </Box>
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          {t('cancel')}
        </Box>
      </ActionButton>
      <ActionButton
        data-composer-control="save"
        intent="primary"
        size="small"
        aria-label={t('done')}
        startIcon={<Check size={17} />}
        onClick={onDone}
        disabled={!canSave}
        loading={busy}
        loadingLabel={t('done')}
        sx={{
          width: { xs: 1, sm: 'auto' },
          minWidth: { xs: 0, sm: 112 },
          minHeight: 44,
          px: { xs: 1.5, sm: 2.25 },
          whiteSpace: 'nowrap',
          '& .MuiButton-startIcon': { mr: 0.75 },
          bgcolor: foundationTokens.color.product.primary,
          boxShadow: (theme) => theme.shadows[4],
        }}
      >
        <Box component="span">{t('doneWithEnglish')}</Box>
      </ActionButton>
    </Paper>
  );
}
