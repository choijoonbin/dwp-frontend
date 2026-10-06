import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import {
  Bell,
  Bot,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  FileText,
  LockKeyhole,
  Newspaper,
  Rows3,
  Sparkles,
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

function PreviewAppRail({ apps }: { apps: readonly HomeModeSharedApp[] }) {
  const { t } = useTranslation('homeStudio');
  const visibleApps = apps.slice(0, previewAppIcons.length);

  return (
    <Box sx={{ p: 1.25, borderRadius: previewRadius.rail, bgcolor: 'background.paper' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={0.5}
      >
        <Typography variant="caption" fontWeight={foundationTokens.home.typography.weightHeavy}>
          {t('modePreset.preview.appsTitle', { count: apps.length })}
        </Typography>
        <Typography
          variant="caption"
          color="primary.main"
          sx={{ fontSize: previewTypography.compact }}
        >
          {t('modePreset.preview.appsShown', {
            visible: visibleApps.length,
            count: apps.length,
          })}
        </Typography>
      </Stack>
      <Box
        sx={{
          mt: 0.75,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(3, minmax(0, 1fr))',
            sm: 'repeat(6, minmax(0, 1fr))',
          },
          gap: 0.75,
        }}
      >
        {visibleApps.map((app, index) => {
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
                bgcolor: 'action.hover',
              }}
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  color: index < 4 ? 'primary.main' : 'text.secondary',
                }}
              >
                <Icon size={15} color="currentColor" aria-hidden="true" />
              </Box>
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
        minHeight: { sm: 326 },
        p: 1.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
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
        sx={(theme) => ({
          p: 1.25,
          borderRadius: previewRadius.rail,
          borderLeft: actionOriented ? 0 : 4,
          borderLeftColor: 'primary.main',
          color: actionOriented ? 'common.white' : 'text.primary',
          bgcolor: actionOriented ? 'primary.main' : 'action.hover',
          overflowWrap: 'anywhere',
          wordBreak: 'keep-all',
          ...(theme.palette.mode === 'dark' && !actionOriented
            ? { bgcolor: alpha(theme.palette.primary.main, 0.12) }
            : {}),
        })}
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
            sx={(theme) => ({
              height: 22,
              color: flow
                ? theme.palette.error.contrastText
                : actionOriented
                  ? theme.palette.primary.main
                  : theme.palette.primary.contrastText,
              bgcolor: flow
                ? theme.palette.error.main
                : actionOriented
                  ? theme.palette.primary.contrastText
                  : theme.palette.primary.main,
              fontSize: previewTypography.compact,
              fontWeight: foundationTokens.home.typography.weightHeavy,
            })}
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
            fontWeight: foundationTokens.home.typography.weightHeavy,
            lineHeight: foundationTokens.home.typography.cardLineHeight,
            wordBreak: 'keep-all',
            overflowWrap: 'anywhere',
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
            sx={(theme) => ({
              px: 1,
              py: 0.5,
              borderRadius: previewRadius.action,
              bgcolor: actionOriented ? 'common.white' : 'primary.main',
              color: actionOriented ? theme.palette.primary.main : 'primary.contrastText',
              fontSize: previewTypography.compact,
              fontWeight: foundationTokens.home.typography.weightEmphasis,
            })}
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
          gridTemplateColumns: {
            xs: '1fr',
            sm: actionOriented ? '1.15fr 1fr 0.82fr' : '1.85fr 1fr',
          },
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
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Typography
                variant="caption"
                fontWeight={foundationTokens.home.typography.weightHeavy}
                sx={{
                  fontSize: previewTypography.compactHeading,
                  wordBreak: 'keep-all',
                  overflowWrap: 'anywhere',
                }}
              >
                {t(`modePreset.preview.${area}`)}
              </Typography>
            </Stack>
            <Stack gap={0.5} sx={{ mt: 0.75 }}>
              {[0, 1, 2].slice(0, index === 1 && !actionOriented ? 3 : 2).map((row) => (
                <Box
                  key={row}
                  sx={(theme) => ({
                    height: actionOriented ? 27 : 24,
                    px: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: previewRadius.action,
                    bgcolor:
                      row === 0 && actionOriented
                        ? alpha(
                            theme.palette.primary.main,
                            theme.palette.mode === 'dark' ? 0.22 : 0.08
                          )
                        : theme.palette.action.hover,
                    color:
                      row === 0 && actionOriented
                        ? theme.palette.primary.main
                        : theme.palette.text.secondary,
                    fontSize: previewTypography.micro,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  })}
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
  const selectionHelpId = useId();
  const preservationDescriptionId = useId();
  const choiceIdPrefix = useId();
  const selectedPreviewTitleId = useId();
  const sharedAppsId = useId();
  const statusId = useId();
  const hasApplicableChange = dirty && selectedMode !== currentMode;
  const controlsDisabled = disabled || applying;
  const selectedModeIsCurrent = selectedMode === currentMode;
  const selectedModeTitle = t(`modePreset.options.${selectedMode}.title`);
  const SelectedModeIcon =
    selectedMode === 'CLASSIC' ? Rows3 : selectedMode === 'FLOW_V1' ? Columns3 : Bot;

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
            mode: selectedModeTitle,
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
      <Stack component="header" gap={1}>
        <Typography
          id={headingId}
          component="h2"
          variant="h5"
          fontWeight={foundationTokens.home.typography.weightHeavy}
        >
          {t('modePreset.title')}
        </Typography>
        <Typography
          id={descriptionId}
          color="text.secondary"
          sx={{ maxWidth: '72ch', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
        >
          {t('modePreset.description')}
        </Typography>
        <Stack
          role="note"
          direction="row"
          alignItems="flex-start"
          gap={1.25}
          data-mode-layout-preservation
          sx={(theme) => ({
            mt: 0.5,
            p: 1.5,
            borderRadius: foundationTokens.home.radius.control,
            color: 'text.primary',
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.06),
          })}
        >
          <Box component="span" sx={{ mt: 0.15, display: 'inline-flex', color: 'primary.main' }}>
            <LockKeyhole size={18} color="currentColor" aria-hidden="true" />
          </Box>
          <Stack gap={0.25} sx={{ minWidth: 0 }}>
            <Typography
              component="p"
              variant="subtitle2"
              fontWeight={foundationTokens.home.typography.weightHeavy}
            >
              {t('modePreset.preservationTitle')}
            </Typography>
            <Typography
              id={preservationDescriptionId}
              variant="body2"
              color="text.secondary"
              sx={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
            >
              {t('modePreset.layoutPreservation', { count: sharedAppOrder.length })}
            </Typography>
          </Stack>
        </Stack>
      </Stack>

      <Box
        data-mode-comparison-layout
        sx={{
          mt: 2.5,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(18rem, 21rem) minmax(0, 1fr)',
          },
          alignItems: 'start',
          gap: { xs: 2, lg: 3 },
        }}
      >
        <FormControl component="fieldset" disabled={controlsDisabled} fullWidth data-mode-selector>
          <Typography
            component="legend"
            variant="subtitle2"
            fontWeight={foundationTokens.home.typography.weightEmphasis}
          >
            {t('modePreset.groupLabel')}
          </Typography>
          <Typography
            id={selectionHelpId}
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, mb: 1.25, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
          >
            {t('modePreset.selectionHelp')}
          </Typography>
          <RadioGroup
            aria-label={t('modePreset.groupLabel')}
            aria-describedby={selectionHelpId}
            value={selectedMode}
            onChange={(event) => onSelect(event.target.value as HomeExperienceVariant)}
            onKeyDown={handleKeyboardSelection}
            sx={{ display: 'grid', gap: 1 }}
          >
            {MODE_OPTIONS.map((mode) => {
              const isCurrent = currentMode === mode;
              const isSelected = selectedMode === mode;
              const isTenantAllowed = allowedModes.includes(mode);
              const isAllowed = isTenantAllowed && enabledModes.includes(mode);
              const isDefault = defaultMode === mode;
              const OptionIcon = mode === 'CLASSIC' ? Rows3 : mode === 'FLOW_V1' ? Columns3 : Bot;
              const titleId = `${choiceIdPrefix}-${mode}-title`;
              const modeDescriptionId = `${choiceIdPrefix}-${mode}-description`;
              const modeStatusId = `${choiceIdPrefix}-${mode}-status`;

              return (
                <FormControlLabel
                  key={mode}
                  value={mode}
                  labelPlacement="start"
                  data-mode-choice={mode}
                  data-mode-allowed={isAllowed ? 'true' : 'false'}
                  disabled={controlsDisabled || !isAllowed}
                  control={
                    <Radio
                      inputProps={{
                        'aria-labelledby': titleId,
                        'aria-describedby': `${modeDescriptionId} ${modeStatusId} ${preservationDescriptionId}`,
                      }}
                    />
                  }
                  label={
                    <Stack component="span" gap={0.75} sx={{ minWidth: 0, textAlign: 'left' }}>
                      <Stack component="span" direction="row" alignItems="center" gap={0.75}>
                        <Box
                          component="span"
                          sx={{ display: 'inline-flex', color: 'text.secondary' }}
                        >
                          <OptionIcon size={18} color="currentColor" aria-hidden="true" />
                        </Box>
                        <Typography
                          id={titleId}
                          component="span"
                          variant="subtitle1"
                          fontWeight={foundationTokens.home.typography.weightHeavy}
                          sx={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
                        >
                          {t(`modePreset.options.${mode}.title`)}
                        </Typography>
                      </Stack>
                      <Typography
                        id={modeDescriptionId}
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        data-mode-choice-description
                        sx={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
                      >
                        {t(`modePreset.options.${mode}.description`)}
                      </Typography>
                      <Stack
                        id={modeStatusId}
                        component="span"
                        direction="row"
                        flexWrap="wrap"
                        gap={0.5}
                      >
                        {isCurrent && (
                          <Chip
                            component="span"
                            size="small"
                            color="default"
                            label={t('modePreset.current')}
                            data-current-mode-indicator
                          />
                        )}
                        {isDefault && (
                          <Chip
                            component="span"
                            size="small"
                            variant="outlined"
                            label={t('modePreset.default')}
                            data-default-mode-indicator
                          />
                        )}
                        {!isAllowed && (
                          <Chip
                            component="span"
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
                      </Stack>
                    </Stack>
                  }
                  sx={(theme) => ({
                    width: 1,
                    minHeight: 132,
                    m: 0,
                    p: 1.5,
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 1,
                    border: isSelected ? 2 : 1,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    borderRadius: foundationTokens.home.radius.surface,
                    bgcolor: isSelected
                      ? alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === 'dark' ? 0.16 : 0.055
                        )
                      : 'background.paper',
                    cursor: controlsDisabled || !isAllowed ? 'default' : 'pointer',
                    transition: theme.transitions.create(['border-color', 'background-color'], {
                      duration: theme.transitions.duration.shortest,
                    }),
                    '& .MuiRadio-root': { minWidth: 44, minHeight: 44, p: 1.25, mt: -0.5 },
                    '& .MuiRadio-root.Mui-focusVisible': {
                      outline: '3px solid',
                      outlineColor: alpha(theme.palette.primary.main, 0.44),
                      outlineOffset: 2,
                    },
                    '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 },
                  })}
                />
              );
            })}
          </RadioGroup>
        </FormControl>

        <Box
          component="section"
          aria-labelledby={selectedPreviewTitleId}
          data-selected-mode-preview={selectedMode}
          sx={{
            minWidth: 0,
            p: { xs: 1.5, sm: 2 },
            border: 1,
            borderColor: 'divider',
            borderRadius: foundationTokens.home.radius.surface,
            bgcolor: 'background.paper',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            gap={1}
          >
            <Typography variant="overline" color="text.secondary">
              {t('modePreset.preview.selectedLabel')}
            </Typography>
            <Chip
              size="small"
              color={selectedModeIsCurrent ? 'default' : 'primary'}
              variant={selectedModeIsCurrent ? 'outlined' : 'filled'}
              label={t(
                selectedModeIsCurrent
                  ? 'modePreset.preview.currentBadge'
                  : 'modePreset.preview.pendingBadge'
              )}
            />
          </Stack>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.5 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
              <SelectedModeIcon size={21} color="currentColor" aria-hidden="true" />
            </Box>
            <Typography
              id={selectedPreviewTitleId}
              component="h3"
              variant="h6"
              fontWeight={foundationTokens.home.typography.weightHeavy}
              sx={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
            >
              {selectedModeTitle}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.75, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
          >
            {t(`modePreset.options.${selectedMode}.description`)}
          </Typography>

          <Box
            data-mode-features
            sx={{
              mt: 1.5,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            {(['firstQuestion', 'primaryAction'] as const).map((key) => (
              <Box
                key={key}
                sx={{
                  minWidth: 0,
                  p: 1.25,
                  borderRadius: foundationTokens.home.radius.control,
                  bgcolor: 'action.hover',
                }}
              >
                <Typography
                  display="block"
                  variant="caption"
                  color="text.secondary"
                  fontWeight={foundationTokens.home.typography.weightEmphasis}
                >
                  {t(`modePreset.preview.${key}`)}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.35,
                    fontSize: foundationTokens.workplace.typography.smallBody.fontSize,
                    fontWeight: foundationTokens.home.typography.weightSemibold,
                    wordBreak: 'keep-all',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {t(`modePreset.preview.${selectedMode}.${key}`)}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box
            component="figure"
            data-mode-preview-frame
            sx={{ m: 0, mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}
          >
            <Box component="figcaption">
              <Stack alignItems="flex-start" gap={0.35}>
                <Typography
                  component="span"
                  variant="subtitle2"
                  fontWeight={foundationTokens.home.typography.weightHeavy}
                  sx={{ flexShrink: 0, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
                >
                  {t('modePreset.preview.exampleLabel')}
                </Typography>
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
                >
                  {t('modePreset.preview.disclaimer')}
                </Typography>
              </Stack>
            </Box>
            <Box sx={{ mt: 1 }}>
              <ModePreview mode={selectedMode} apps={sharedAppOrder} />
            </Box>
          </Box>
        </Box>
      </Box>

      <Accordion
        disableGutters
        elevation={0}
        data-shared-app-order={sharedAppOrder.map(({ id }) => id).join(',')}
        sx={(theme) => ({
          mt: 2.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.home.radius.surface,
          bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.025),
          overflow: 'hidden',
          '&:before': { display: 'none' },
        })}
      >
        <AccordionSummary
          id={`${sharedAppsId}-summary`}
          aria-controls={`${sharedAppsId}-panel`}
          expandIcon={<ChevronDown size={18} aria-hidden="true" />}
          sx={{ px: { xs: 1.5, sm: 2 }, py: 0.5 }}
        >
          <Stack component="span" direction="row" alignItems="flex-start" gap={1.25}>
            <Box component="span" sx={{ mt: 0.25, display: 'inline-flex' }}>
              <LockKeyhole size={19} aria-hidden="true" />
            </Box>
            <Stack component="span" gap={0.25} sx={{ minWidth: 0, textAlign: 'left' }}>
              <Typography
                component="span"
                variant="subtitle2"
                fontWeight={foundationTokens.home.typography.weightHeavy}
              >
                {t('modePreset.sharedApps.title', { count: sharedAppOrder.length })}
              </Typography>
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
              >
                {t('modePreset.sharedApps.description')}
              </Typography>
            </Stack>
          </Stack>
        </AccordionSummary>
        <AccordionDetails
          id={`${sharedAppsId}-panel`}
          aria-labelledby={`${sharedAppsId}-summary`}
          sx={{ px: { xs: 1.5, sm: 2 }, pt: 0, pb: 2 }}
        >
          <Box
            component="ol"
            aria-label={t('modePreset.sharedApps.orderLabel')}
            sx={{
              m: 0,
              p: 0,
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                md: 'repeat(6, minmax(0, 1fr))',
                lg: 'repeat(9, minmax(0, 1fr))',
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
        </AccordionDetails>
      </Accordion>

      <Stack
        data-mode-actions
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{
          position: { xs: 'static', sm: 'sticky' },
          bottom: { sm: 0 },
          zIndex: 1,
          mt: 2.5,
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
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
              disabled={controlsDisabled || !hasApplicableChange}
              onClick={onCancel}
              data-mode-cancel
              sx={{ minHeight: 44, minWidth: { xs: 1, sm: 96 } }}
            >
              {t('modePreset.cancelSelection')}
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
            {applying
              ? t('modePreset.applyingMode', { mode: selectedModeTitle })
              : t('modePreset.applyMode', { mode: selectedModeTitle })}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}
