import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Scaling } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  WORKSPACE_WIDGET_HEIGHT_POLICY,
  workspaceWidgetFootprint,
} from './workspace-widget-layout-policy';

import type { HomeWidgetHeight, HomeWidgetSize } from '@dwp-frontend/shared-utils';

type WorkspaceWidgetFootprintPickerProps = {
  label: string;
  value: HomeWidgetSize;
  options: readonly HomeWidgetSize[];
  height: HomeWidgetHeight;
  heightOptions: readonly HomeWidgetHeight[];
  disabled: boolean;
  onChange: (size: HomeWidgetSize) => void;
  onHeightChange: (height: HomeWidgetHeight) => void;
};

export function WorkspaceWidgetFootprintGlyph({ size }: { size: HomeWidgetSize }) {
  const footprint = workspaceWidgetFootprint(size);

  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 32,
        height: 18,
        display: 'grid',
        gridTemplateColumns: `repeat(${footprint.denominator}, minmax(0, 1fr))`,
        gap: '2px',
        p: '2px',
        border: 1,
        borderColor: 'currentColor',
        borderRadius: 0.5,
        boxSizing: 'border-box',
      }}
    >
      {Array.from({ length: footprint.denominator }, (_, index) => (
        <Box
          key={index}
          sx={{
            minWidth: 0,
            borderRadius: '1px',
            border: 1,
            borderColor: 'currentColor',
            bgcolor: index < footprint.numerator ? 'currentColor' : 'transparent',
            opacity: index < footprint.numerator ? 1 : 0.28,
          }}
        />
      ))}
    </Box>
  );
}

export function WorkspaceWidgetHeightGlyph({ height }: { height: HomeWidgetHeight }) {
  const values = Object.values(WORKSPACE_WIDGET_HEIGHT_POLICY).map((rule) => rule.blockSize);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const current = WORKSPACE_WIDGET_HEIGHT_POLICY[height].blockSize;
  const fillHeight = 7 + ((current - minimum) / (maximum - minimum)) * 11;

  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 28,
        height: 22,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        p: '2px',
        border: 1,
        borderColor: 'currentColor',
        borderRadius: 0.5,
        boxSizing: 'border-box',
      }}
    >
      <Box
        sx={{
          width: 1,
          height: `${fillHeight}px`,
          borderRadius: '1px',
          bgcolor: 'currentColor',
        }}
      />
    </Box>
  );
}

export function WorkspaceWidgetFootprintPicker({
  label,
  value,
  options,
  height,
  heightOptions,
  disabled,
  onChange,
  onHeightChange,
}: WorkspaceWidgetFootprintPickerProps) {
  const { t } = useTranslation('composer');
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const popoverId = useId();
  const open = Boolean(anchor);

  return (
    <>
      <ActionIconButton
        label={t('resizeWidget', { widget: label })}
        size="small"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        data-widget-footprint-trigger={value}
        data-widget-height-trigger={height}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          width: 44,
          height: 44,
          bgcolor: 'background.paper',
          color: 'text.primary',
          border: 1,
          borderColor: 'divider',
          boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
          '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
        }}
      >
        <Scaling size={14} />
      </ActionIconButton>
      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': t('footprintPicker', { widget: label }),
            sx: { mt: 0.75, p: 1.25, borderRadius: 1 },
          },
        }}
      >
        <Stack gap={1.25}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {t('widthLabel')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={value}
              aria-label={t('widthPicker', { widget: label })}
              onChange={(_, nextSize: HomeWidgetSize | null) => nextSize && onChange(nextSize)}
              sx={pickerGroupSx}
            >
              {options.map((option) => {
                const optionLabel = t(`footprints.${option}`);
                return (
                  <Tooltip key={option} title={optionLabel} arrow>
                    <ToggleButton
                      value={option}
                      aria-label={optionLabel}
                      data-widget-footprint-option={option}
                    >
                      <Stack alignItems="center" gap={0.35}>
                        <WorkspaceWidgetFootprintGlyph size={option} />
                        <Typography variant="caption" fontWeight={700} lineHeight={1}>
                          {t(`footprintShort.${option}`)}
                        </Typography>
                      </Stack>
                    </ToggleButton>
                  </Tooltip>
                );
              })}
            </ToggleButtonGroup>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {t('heightLabel')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={height}
              aria-label={t('heightPicker', { widget: label })}
              onChange={(_, nextHeight: HomeWidgetHeight | null) =>
                nextHeight && onHeightChange(nextHeight)
              }
              sx={pickerGroupSx}
            >
              {heightOptions.map((option) => {
                const optionLabel = t(`heights.${option}`);
                return (
                  <Tooltip key={option} title={optionLabel} arrow>
                    <ToggleButton
                      value={option}
                      aria-label={optionLabel}
                      data-widget-height-option={option}
                    >
                      <Stack alignItems="center" gap={0.35}>
                        <WorkspaceWidgetHeightGlyph height={option} />
                        <Typography variant="caption" fontWeight={700} lineHeight={1}>
                          {t(`heightShort.${option}`)}
                        </Typography>
                      </Stack>
                    </ToggleButton>
                  </Tooltip>
                );
              })}
            </ToggleButtonGroup>
          </Box>
        </Stack>
      </Popover>
    </>
  );
}

const pickerGroupSx = {
  display: 'flex',
  flexWrap: 'wrap',
  maxWidth: 'min(300px, calc(100vw - 32px))',
  mt: 0.5,
  '& .MuiToggleButton-root': {
    width: 'auto',
    minWidth: 58,
    minHeight: 60,
    height: 'auto',
    px: 1,
    py: 0.5,
    color: 'text.secondary',
    '& .MuiTypography-root': { whiteSpace: 'nowrap' },
    '&.Mui-selected': {
      color: 'primary.main',
      bgcolor: 'primary.50',
    },
  },
} as const;
