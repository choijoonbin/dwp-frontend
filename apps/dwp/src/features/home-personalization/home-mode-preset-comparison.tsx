import {
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Check, Columns3, LockKeyhole, Rows3 } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ActionButton } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';
import type { HomeExperienceVariant } from '@dwp-frontend/shared-utils';

export interface HomeModeSharedApp {
  id: string;
  label: string;
}

export interface HomeModePresetComparisonProps {
  currentMode: HomeExperienceVariant;
  selectedMode: HomeExperienceVariant;
  sharedAppOrder: readonly HomeModeSharedApp[];
  dirty: boolean;
  disabled?: boolean;
  applying?: boolean;
  onSelect: (mode: HomeExperienceVariant) => void;
  onCancel?: () => void;
  onApply: () => void;
}

const MODE_OPTIONS: readonly HomeExperienceVariant[] = ['CLASSIC', 'FLOW_V1'];

function ModePreview({ mode }: { mode: HomeExperienceVariant }) {
  const flow = mode === 'FLOW_V1';

  return (
    <Box
      aria-hidden="true"
      data-mode-preview={mode}
      sx={(theme) => ({
        height: 126,
        p: 1.25,
        display: 'grid',
        gridTemplateColumns: flow ? '1.25fr 0.75fr' : '0.28fr 1fr',
        gap: 1,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.home.radius.surface,
        bgcolor: flow
          ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08)
          : theme.palette.background.default,
      })}
    >
      {flow ? (
        <>
          <Stack gap={0.75}>
            <Box
              sx={{
                height: 38,
                borderRadius: foundationTokens.home.radius.control,
                bgcolor: 'primary.main',
              }}
            />
            <Box
              sx={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 0.5,
              }}
            >
              {[0, 1, 2].map((item) => (
                <Box
                  key={item}
                  sx={{
                    borderRadius: foundationTokens.home.radius.subtle,
                    bgcolor: 'background.paper',
                  }}
                />
              ))}
            </Box>
          </Stack>
          <Stack gap={0.75}>
            <Box
              sx={{
                flex: 1,
                borderRadius: foundationTokens.home.radius.control,
                bgcolor: 'background.paper',
              }}
            />
            <Box
              sx={{
                flex: 0.7,
                borderRadius: foundationTokens.home.radius.control,
                bgcolor: 'background.paper',
              }}
            />
          </Stack>
        </>
      ) : (
        <>
          <Stack gap={0.55}>
            {[0, 1, 2, 3].map((item) => (
              <Box
                key={item}
                sx={{
                  height: 10,
                  borderRadius: foundationTokens.home.radius.subtle,
                  bgcolor: item === 0 ? 'primary.main' : 'action.hover',
                }}
              />
            ))}
          </Stack>
          <Stack gap={0.75}>
            <Box
              sx={{
                height: 38,
                borderRadius: foundationTokens.home.radius.control,
                bgcolor: 'background.paper',
              }}
            />
            <Box
              sx={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1.35fr 1fr 1fr',
                gap: 0.5,
              }}
            >
              {[0, 1, 2].map((item) => (
                <Box
                  key={item}
                  sx={{
                    borderRadius: foundationTokens.home.radius.subtle,
                    bgcolor: 'background.paper',
                  }}
                />
              ))}
            </Box>
          </Stack>
        </>
      )}
    </Box>
  );
}

function nextModeFromKeyboard(
  event: KeyboardEvent<HTMLDivElement>,
  selectedMode: HomeExperienceVariant
): HomeExperienceVariant | null {
  const currentIndex = MODE_OPTIONS.indexOf(selectedMode);

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return MODE_OPTIONS[(currentIndex - 1 + MODE_OPTIONS.length) % MODE_OPTIONS.length] ?? null;
    case 'ArrowRight':
    case 'ArrowDown':
      return MODE_OPTIONS[(currentIndex + 1) % MODE_OPTIONS.length] ?? null;
    case 'Home':
      return MODE_OPTIONS[0] ?? null;
    case 'End':
      return MODE_OPTIONS.at(-1) ?? null;
    default:
      return null;
  }
}

/**
 * A controlled comparison surface for choosing the user's Home mode.
 *
 * The component deliberately owns no persistence or provider activation. The caller keeps
 * current, selected, dirty, and applying state and decides how an approved change is saved.
 */
export function HomeModePresetComparison({
  currentMode,
  selectedMode,
  sharedAppOrder,
  dirty,
  disabled = false,
  applying = false,
  onSelect,
  onCancel,
  onApply,
}: HomeModePresetComparisonProps) {
  const { t } = useTranslation('homeStudio');
  const headingId = useId();
  const descriptionId = useId();
  const sharedAppsId = useId();
  const statusId = useId();
  const hasApplicableChange = dirty && selectedMode !== currentMode;
  const controlsDisabled = disabled || applying;

  const handleKeyboardSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    if (controlsDisabled) return;
    const nextMode = nextModeFromKeyboard(event, selectedMode);
    if (!nextMode) return;

    event.preventDefault();
    const nextInput = event.currentTarget.querySelector<HTMLInputElement>(
      `input[type="radio"][value="${nextMode}"]`
    );
    nextInput?.focus();
    if (nextMode !== selectedMode) onSelect(nextMode);
  };

  const statusMessage = applying
    ? t('modePreset.status.applying')
    : disabled
      ? t('modePreset.status.disabled')
      : hasApplicableChange
        ? t('modePreset.status.dirty', {
            mode: t(`modePreset.options.${selectedMode}.title`),
          })
        : t('modePreset.status.saved');

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      aria-describedby={`${descriptionId} ${statusId}`}
      data-home-mode-preset-comparison
      data-current-mode={currentMode}
      data-selected-mode={selectedMode}
      data-dirty={hasApplicableChange ? 'true' : 'false'}
      sx={{
        width: 1,
        maxWidth: 1120,
        mx: 'auto',
        p: { xs: 2, sm: 3 },
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.home.radius.heroSurface,
        bgcolor: 'background.paper',
      }}
    >
      <Stack gap={0.75}>
        <Typography
          id={headingId}
          component="h2"
          variant="h5"
          fontWeight={foundationTokens.home.typography.weightHeavy}
        >
          {t('modePreset.title')}
        </Typography>
        <Typography id={descriptionId} color="text.secondary">
          {t('modePreset.description')}
        </Typography>
      </Stack>

      <FormControl component="fieldset" disabled={controlsDisabled} fullWidth sx={{ mt: 3 }}>
        <Typography
          component="legend"
          variant="subtitle2"
          fontWeight={foundationTokens.home.typography.weightEmphasis}
          sx={{ mb: 1.25 }}
        >
          {t('modePreset.groupLabel')}
        </Typography>
        <RadioGroup
          row
          aria-label={t('modePreset.groupLabel')}
          value={selectedMode}
          onChange={(event) => onSelect(event.target.value as HomeExperienceVariant)}
          onKeyDown={handleKeyboardSelection}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {MODE_OPTIONS.map((mode) => {
            const isCurrent = currentMode === mode;
            const isSelected = selectedMode === mode;
            const OptionIcon = mode === 'CLASSIC' ? Rows3 : Columns3;

            return (
              <FormControlLabel
                key={mode}
                value={mode}
                data-mode-choice={mode}
                control={
                  <Radio inputProps={{ 'aria-describedby': `${descriptionId} ${sharedAppsId}` }} />
                }
                label={
                  <Stack component="span" gap={1.25} sx={{ width: 1, minWidth: 0 }}>
                    <ModePreview mode={mode} />
                    <Stack
                      component="span"
                      direction="row"
                      alignItems="center"
                      gap={1}
                      flexWrap="wrap"
                    >
                      <OptionIcon size={19} aria-hidden="true" />
                      <Typography
                        component="span"
                        variant="subtitle1"
                        fontWeight={foundationTokens.home.typography.weightHeavy}
                      >
                        {t(`modePreset.options.${mode}.title`)}
                      </Typography>
                      {isCurrent && (
                        <Chip
                          size="small"
                          color="default"
                          label={t('modePreset.current')}
                          data-current-mode-indicator
                        />
                      )}
                      {isSelected && (
                        <Chip
                          size="small"
                          color="primary"
                          icon={<Check size={14} aria-hidden="true" />}
                          label={t('modePreset.selected')}
                          data-selected-mode-indicator
                        />
                      )}
                    </Stack>
                    <Typography component="span" variant="body2" color="text.secondary">
                      {t(`modePreset.options.${mode}.description`)}
                    </Typography>
                  </Stack>
                }
                sx={(theme) => ({
                  minHeight: 248,
                  m: 0,
                  px: 2,
                  py: 1.75,
                  alignItems: 'flex-start',
                  gap: 0.75,
                  border: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  borderRadius: foundationTokens.home.radius.surface,
                  bgcolor: isSelected
                    ? alpha(theme.palette.primary.main, 0.055)
                    : 'background.paper',
                  cursor: controlsDisabled ? 'default' : 'pointer',
                  transition: theme.transitions.create(['border-color', 'background-color'], {
                    duration: theme.transitions.duration.shortest,
                  }),
                  '&:focus-within': {
                    outline: '3px solid',
                    outlineColor: alpha(theme.palette.primary.main, 0.44),
                    outlineOffset: 2,
                  },
                  '& .MuiRadio-root': {
                    minWidth: 44,
                    minHeight: 44,
                    p: 1.25,
                    mt: -0.25,
                  },
                  '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 },
                })}
              />
            );
          })}
        </RadioGroup>
      </FormControl>

      <Box
        id={sharedAppsId}
        data-shared-app-order={sharedAppOrder.map(({ id }) => id).join(',')}
        sx={(theme) => ({
          mt: 2.5,
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.home.radius.surface,
          bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.025),
        })}
      >
        <Stack direction="row" alignItems="flex-start" gap={1.25}>
          <LockKeyhole size={20} aria-hidden="true" />
          <Stack gap={0.25} sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              fontWeight={foundationTokens.home.typography.weightHeavy}
            >
              {t('modePreset.sharedApps.title', { count: sharedAppOrder.length })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('modePreset.sharedApps.description')}
            </Typography>
          </Stack>
        </Stack>
        <Box
          component="ol"
          aria-label={t('modePreset.sharedApps.orderLabel')}
          sx={{
            m: 0,
            mt: 1.5,
            p: 0,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(3, minmax(0, 1fr))',
              sm: 'repeat(6, 1fr)',
              md: 'repeat(9, 1fr)',
            },
            gap: 0.75,
            listStyle: 'none',
          }}
        >
          {sharedAppOrder.map((app, index) => (
            <Box
              component="li"
              key={app.id}
              data-shared-app-id={app.id}
              sx={{
                minWidth: 0,
                px: 0.75,
                py: 0.75,
                border: 1,
                borderColor: 'divider',
                borderRadius: foundationTokens.home.radius.control,
                bgcolor: 'background.paper',
              }}
            >
              <Typography display="block" variant="caption" color="text.secondary">
                {t('modePreset.sharedApps.position', { position: index + 1 })}
              </Typography>
              <Typography
                display="block"
                variant="caption"
                fontWeight={foundationTokens.home.typography.weightEmphasis}
                noWrap
                title={app.label}
              >
                {app.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ mt: 2.5 }}
      >
        <Typography
          id={statusId}
          role="status"
          aria-live="polite"
          variant="body2"
          color={hasApplicableChange ? 'warning.main' : 'text.secondary'}
          fontWeight={
            hasApplicableChange
              ? foundationTokens.home.typography.weightEmphasis
              : 'fontWeightMedium'
          }
        >
          {statusMessage}
        </Typography>
        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} gap={1}>
          {onCancel && (
            <ActionButton
              type="button"
              intent="quiet"
              disabled={controlsDisabled}
              onClick={onCancel}
              data-mode-cancel
              sx={{ minHeight: 44, minWidth: { xs: 1, sm: 96 } }}
            >
              {t('common.cancel')}
            </ActionButton>
          )}
          <ActionButton
            type="button"
            intent="primary"
            disabled={controlsDisabled || !hasApplicableChange}
            onClick={onApply}
            startIcon={<Check size={18} aria-hidden="true" />}
            data-mode-apply
            sx={{ minHeight: 44, minWidth: { xs: 1, sm: 184 } }}
          >
            {applying ? t('modePreset.applying') : t('modePreset.apply')}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}
