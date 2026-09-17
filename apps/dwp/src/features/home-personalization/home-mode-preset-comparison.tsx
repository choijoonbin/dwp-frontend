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
import { alpha, darken } from '@mui/material/styles';
import {
  Bell,
  Bot,
  Briefcase,
  CalendarDays,
  Check,
  Columns3,
  FileText,
  LockKeyhole,
  Newspaper,
  Rows3,
  Sparkles,
  Zap,
} from 'lucide-react';
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
  allowedModes: readonly HomeExperienceVariant[];
  enabledModes?: readonly HomeExperienceVariant[];
  disabledModeReasons?: Partial<Record<HomeExperienceVariant, string>>;
  defaultMode: HomeExperienceVariant;
  sharedAppOrder: readonly HomeModeSharedApp[];
  dirty: boolean;
  disabled?: boolean;
  applying?: boolean;
  onSelect: (mode: HomeExperienceVariant) => void;
  onCancel?: () => void;
  onApply: () => void;
}

const MODE_OPTIONS: readonly HomeExperienceVariant[] = ['CLASSIC', 'FLOW_V1', 'MZ_V1'];

const previewAppIcons = [Briefcase, Sparkles, FileText, Bell, Newspaper, CalendarDays] as const;

const previewRadius = {
  rail: foundationTokens.radius.compact + 1,
  tile: foundationTokens.radius.compact,
  surface: foundationTokens.radius.control,
  action: foundationTokens.radius.compact - 1,
} as const;

const previewTypography = {
  micro: `calc(${foundationTokens.home.typography.compactSize} - 0.03125rem)`,
  compact: foundationTokens.home.typography.compactSize,
  compactHeading: `calc(${foundationTokens.home.typography.captionSize} - 0.03125rem)`,
  hero: foundationTokens.workplace.typography.smallBody.fontSize,
} as const;

const previewColors = {
  appSurface: foundationTokens.color.neutral[50],
  appAccent: foundationTokens.color.product.primary,
  textSubdued: foundationTokens.color.neutral[500],
  classicAccent: foundationTokens.color.product.primary,
  classicHeroSurface: alpha(foundationTokens.color.product.primary, 0.08),
  flowHeroSurface: foundationTokens.color.product.primary,
  chipText: foundationTokens.color.neutral[0],
  attention: foundationTokens.color.status.error,
  flowRowSurface: alpha(foundationTokens.color.product.primary, 0.08),
  quietRowSurface: foundationTokens.color.neutral[25],
  selectedText: darken(foundationTokens.color.product.primary, 0.08),
} as const;

const flowPreviewGradient = `linear-gradient(120deg, ${foundationTokens.color.product.primary} 0%, ${darken(foundationTokens.color.product.primary, 0.18)} 100%)`;
const classicPreviewGradient = `linear-gradient(90deg, ${previewColors.classicHeroSurface} 0%, ${foundationTokens.color.neutral[25]} 100%)`;
const classicPreviewBorder = `4px solid ${previewColors.classicAccent}`;

function PreviewAppRail({ apps }: { apps: readonly HomeModeSharedApp[] }) {
  const { t } = useTranslation('homeStudio');
  return (
    <Box sx={{ p: 1.25, borderRadius: previewRadius.rail, bgcolor: 'background.paper' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" fontWeight={foundationTokens.home.typography.weightHeavy}>
          {t('modePreset.preview.appsTitle')}
        </Typography>
        <Typography
          variant="caption"
          color="primary.main"
          sx={{ fontSize: previewTypography.compact }}
        >
          {t('modePreset.preview.appsSynced')}
        </Typography>
      </Stack>
      <Box
        sx={{
          mt: 0.75,
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: 0.75,
        }}
      >
        {apps.slice(0, 6).map((app, index) => {
          const Icon = previewAppIcons[index] ?? Briefcase;
          return (
            <Stack
              key={app.id}
              alignItems="center"
              justifyContent="center"
              gap={0.35}
              sx={{
                minWidth: 0,
                height: 46,
                borderRadius: previewRadius.tile,
                bgcolor: previewColors.appSurface,
              }}
            >
              <Icon
                size={15}
                color={index < 4 ? previewColors.appAccent : previewColors.textSubdued}
                aria-hidden="true"
              />
              <Typography
                variant="caption"
                title={app.label}
                sx={{
                  maxWidth: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: previewTypography.micro,
                }}
                noWrap
              >
                {app.label}
              </Typography>
            </Stack>
          );
        })}
      </Box>
    </Box>
  );
}

function ModePreview({
  mode,
  apps,
}: {
  mode: HomeExperienceVariant;
  apps: readonly HomeModeSharedApp[];
}) {
  const { t } = useTranslation('homeStudio');
  const flow = mode === 'FLOW_V1';
  const mz = mode === 'MZ_V1';
  const actionOriented = flow || mz;

  return (
    <Box
      aria-hidden="true"
      data-mode-preview={mode}
      sx={(theme) => ({
        height: 326,
        p: 1.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        borderRadius: previewRadius.surface,
        bgcolor: actionOriented
          ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08)
          : theme.palette.background.default,
      })}
    >
      <PreviewAppRail apps={apps} />
      <Box
        sx={{
          p: 1.25,
          borderRadius: previewRadius.rail,
          borderLeft: actionOriented ? 0 : classicPreviewBorder,
          color: actionOriented ? 'common.white' : 'text.primary',
          bgcolor: actionOriented
            ? previewColors.flowHeroSurface
            : previewColors.classicHeroSurface,
          background: mz
            ? previewColors.flowHeroSurface
            : flow
              ? flowPreviewGradient
              : classicPreviewGradient,
        }}
      >
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Chip
            size="small"
            label={t(
              mz
                ? 'modePreset.preview.mzTag'
                : flow
                  ? 'modePreset.preview.flowTag'
                  : 'modePreset.preview.classicTag'
            )}
            sx={{
              height: 22,
              color: previewColors.chipText,
              bgcolor: actionOriented ? previewColors.attention : previewColors.classicAccent,
              fontSize: previewTypography.compact,
              fontWeight: foundationTokens.home.typography.weightHeavy,
            }}
          />
          <Typography variant="caption" sx={{ opacity: 0.82, fontSize: previewTypography.compact }}>
            {t(
              mz
                ? 'modePreset.preview.mzMeta'
                : flow
                  ? 'modePreset.preview.flowMeta'
                  : 'modePreset.preview.classicMeta'
            )}
          </Typography>
        </Stack>
        <Typography
          sx={{
            mt: 0.75,
            fontSize: previewTypography.hero,
            fontWeight: foundationTokens.home.typography.weightHeavy + 50,
            lineHeight: foundationTokens.home.typography.cardLineHeight,
          }}
        >
          {t(
            mz
              ? 'modePreset.preview.mzHero'
              : flow
                ? 'modePreset.preview.flowHero'
                : 'modePreset.preview.classicHero'
          )}
        </Typography>
        <Stack direction="row" gap={0.75} sx={{ mt: 1 }}>
          <Box
            component="span"
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: previewRadius.action,
              bgcolor: actionOriented ? 'common.white' : previewColors.classicAccent,
              color: actionOriented ? previewColors.flowHeroSurface : 'common.white',
              fontSize: previewTypography.compact,
              fontWeight: foundationTokens.home.typography.weightEmphasis,
            }}
          >
            {t(
              mz
                ? 'modePreset.preview.mzAction'
                : flow
                  ? 'modePreset.preview.flowAction'
                  : 'modePreset.preview.classicAction'
            )}
          </Box>
        </Stack>
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: actionOriented ? '1.15fr 1fr 0.82fr' : '1.85fr 1fr',
          gap: 1,
        }}
      >
        {(mz
          ? ['evidence', 'plan', 'handoff']
          : flow
            ? ['queue', 'timeline', 'requests']
            : ['news', 'handbook']
        ).map((area, index) => (
          <Box
            key={area}
            sx={{
              p: 1,
              minWidth: 0,
              borderRadius: previewRadius.tile,
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={0.5}>
              <Typography
                variant="caption"
                fontWeight={foundationTokens.home.typography.weightHeavy}
                sx={{ fontSize: previewTypography.compactHeading }}
              >
                {t(`modePreset.preview.${area}`)}
              </Typography>
              {actionOriented && (
                <Typography
                  variant="caption"
                  color="primary.main"
                  sx={{ fontSize: previewTypography.micro }}
                >
                  {index === 0 ? '3건' : index === 1 ? '10:30' : '2건'}
                </Typography>
              )}
            </Stack>
            <Stack gap={0.5} sx={{ mt: 0.75 }}>
              {[0, 1, 2].slice(0, index === 1 && !actionOriented ? 3 : 2).map((row) => (
                <Box
                  key={row}
                  sx={{
                    height: actionOriented ? 27 : 24,
                    px: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: previewRadius.action,
                    bgcolor:
                      row === 0 && actionOriented
                        ? previewColors.flowRowSurface
                        : previewColors.quietRowSurface,
                    color:
                      row === 0 && actionOriented
                        ? previewColors.selectedText
                        : previewColors.textSubdued,
                    fontSize: previewTypography.micro,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {t(`modePreset.preview.${area}Item${row + 1}`)}
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function nextModeFromKeyboard(
  event: KeyboardEvent<HTMLDivElement>,
  selectedMode: HomeExperienceVariant,
  allowedModes: readonly HomeExperienceVariant[]
): HomeExperienceVariant | null {
  if (allowedModes.length === 0) return null;
  const currentIndex = Math.max(0, allowedModes.indexOf(selectedMode));

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return allowedModes[(currentIndex - 1 + allowedModes.length) % allowedModes.length] ?? null;
    case 'ArrowRight':
    case 'ArrowDown':
      return allowedModes[(currentIndex + 1) % allowedModes.length] ?? null;
    case 'Home':
      return allowedModes[0] ?? null;
    case 'End':
      return allowedModes.at(-1) ?? null;
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
  allowedModes,
  enabledModes = allowedModes,
  disabledModeReasons,
  defaultMode,
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
    const nextMode = nextModeFromKeyboard(event, selectedMode, enabledModes);
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
        maxWidth: 1240,
        mx: 'auto',
        p: { xs: 2, sm: 2.5 },
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
        <Typography variant="caption" color="text.secondary" data-mode-layout-preservation>
          {t('modePreset.layoutPreservation')}
        </Typography>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
          gap={1}
          sx={{
            mt: 0.75,
            px: 1.25,
            py: 0.75,
            border: 1,
            borderColor: 'divider',
            borderRadius: previewRadius.rail,
            bgcolor: 'action.hover',
          }}
        >
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Zap size={16} color={previewColors.appAccent} aria-hidden="true" />
            <Typography
              variant="caption"
              fontWeight={foundationTokens.home.typography.weightHeavy}
              color="primary.main"
            >
              {t('modePreset.preview.blindTestTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('modePreset.preview.blindTestDescription')}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('modePreset.preview.axisIntegrity')}
          </Typography>
        </Stack>
      </Stack>

      <FormControl component="fieldset" disabled={controlsDisabled} fullWidth sx={{ mt: 2 }}>
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
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          {MODE_OPTIONS.map((mode) => {
            const isCurrent = currentMode === mode;
            const isSelected = selectedMode === mode;
            const isTenantAllowed = allowedModes.includes(mode);
            const isAllowed = isTenantAllowed && enabledModes.includes(mode);
            const isDefault = defaultMode === mode;
            const OptionIcon = mode === 'CLASSIC' ? Rows3 : mode === 'FLOW_V1' ? Columns3 : Bot;

            return (
              <FormControlLabel
                key={mode}
                value={mode}
                data-mode-choice={mode}
                data-mode-allowed={isAllowed ? 'true' : 'false'}
                disabled={controlsDisabled || !isAllowed}
                control={
                  <Radio inputProps={{ 'aria-describedby': `${descriptionId} ${sharedAppsId}` }} />
                }
                label={
                  <Stack component="span" gap={1.1} sx={{ width: 1, minWidth: 0 }}>
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
                      {isDefault && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('modePreset.default')}
                          data-default-mode-indicator
                        />
                      )}
                      {!isAllowed && (
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          label={t(
                            isTenantAllowed && disabledModeReasons?.[mode]
                              ? 'modePreset.rolloutUnavailable'
                              : 'modePreset.policyUnavailable'
                          )}
                          data-mode-policy-unavailable
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
                    <Box
                      component="span"
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 0.5,
                        p: 0.75,
                        borderRadius: previewRadius.tile,
                        bgcolor: 'action.hover',
                      }}
                    >
                      {(['firstQuestion', 'primaryAction', 'sharedApps'] as const).map((key) => (
                        <Typography
                          component="span"
                          key={key}
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: previewTypography.compactHeading }}
                        >
                          <Box component="strong" sx={{ color: 'text.primary' }}>
                            {t(`modePreset.preview.${key}`)}
                          </Box>{' '}
                          {t(`modePreset.preview.${mode}.${key}`)}
                        </Typography>
                      ))}
                    </Box>
                    <ModePreview mode={mode} apps={sharedAppOrder} />
                  </Stack>
                }
                sx={(theme) => ({
                  minHeight: 480,
                  m: 0,
                  px: 1.5,
                  py: 1.5,
                  alignItems: 'flex-start',
                  gap: 0,
                  position: 'relative',
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
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                  },
                  '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0, pr: 4.5 },
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
