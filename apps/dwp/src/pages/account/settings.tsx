import {
  Accessibility,
  Building2,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  Contrast,
  Hash,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  MoveHorizontal,
  Palette,
  PanelLeft,
  RotateCcw,
  Rows3,
  ScanLine,
  Send,
  SunMoon,
  Type,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatDate,
  formatNumber,
  productLocales,
  type SupportedLocale,
} from '@dwp-frontend/shared-i18n';
import {
  dateFormatOptions,
  defaultRegionalPreference,
  firstDayOfWeekOptions,
  numberFormatOptions,
  cancelPreferenceException,
  timeFormatOptions,
  timeZoneOptions,
  listMyPreferenceExceptions,
  requestPreferenceException,
  useToast,
  type DateFormatPreference,
  type FirstDayOfWeekPreference,
  type NumberFormatPreference,
  type RegionalPreference,
  type TimeFormatPreference,
  type TimeZonePreference,
  type ManagedPreferenceRule,
  type PreferenceExceptionRequest,
} from '@dwp-frontend/shared-utils';
import { LanguageIcon } from '@dwp-frontend/design-system/components/icons';
import {
  ActionButton,
  FormDialog,
  FormField,
  PageCanvas,
  SelectField,
  colorModeOptions,
  densityOptions,
  useAppearance,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import {
  isSettingsSection,
  type SettingsSection,
} from '../../features/account/settings-navigation';
import { usePreferredLanguage } from '../../components/use-preferred-language';
import { useSystemCodeOptions } from '../../components/use-system-code-options';
import { usePersonalPreference } from '../../features/account/personal-preference-provider';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PersonalPreferenceSaveState } from '../../features/account/personal-preference-provider';

type PreferenceRowProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
};

type PreferenceGroupProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

const sectionIcons: Record<SettingsSection, LucideIcon> = {
  appearance: Palette,
  accessibility: Accessibility,
  language: LanguageIcon,
  home: LayoutDashboard,
  managed: Building2,
};

function PreferenceRow({ icon: Icon, title, description, children }: PreferenceRowProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '36px minmax(0, 1fr)', sm: '40px minmax(220px, 1fr) auto' },
        columnGap: { xs: 1.5, sm: 2 },
        rowGap: 1.5,
        alignItems: 'center',
        px: { xs: 2, sm: 2.5 },
        py: 2.25,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: { xs: 36, sm: 40 },
          height: { xs: 36, sm: 40 },
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          bgcolor: 'action.hover',
          color: 'text.secondary',
        }}
      >
        <Icon size={19} strokeWidth={1.8} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h3" variant="subtitle2">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          minWidth: 0,
          gridColumn: { xs: '2', sm: '3' },
          justifySelf: { xs: 'start', sm: 'end' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function PreferenceGroup({ title, description, children }: PreferenceGroupProps) {
  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Box>
        <Typography component="h2" variant="h6">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>
      <Stack
        divider={<Divider flexItem />}
        sx={{
          mt: 1.5,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
        }}
      >
        {children}
      </Stack>
    </Box>
  );
}

function AutoSaveStatus({
  state,
  lastSavedAt,
}: {
  state: PersonalPreferenceSaveState;
  lastSavedAt: string | null;
}) {
  const { t } = useTranslation('account');
  const Icon = state === 'saving' ? LoaderCircle : state === 'error' ? CircleAlert : Check;
  const color =
    state === 'error' ? 'error.main' : state === 'saved' ? 'success.main' : 'text.secondary';
  const label =
    state === 'saving'
      ? t('personalPreferences.saving')
      : state === 'error'
        ? t('personalPreferences.saveStateError')
        : state === 'saved'
          ? t('personalPreferences.saved', {
              time: lastSavedAt
                ? formatDate(lastSavedAt, { timeStyle: 'short' })
                : t('personalPreferences.justNow'),
            })
          : t('personalPreferences.autoSave');

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-atomic="true"
      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color, minHeight: 32 }}
    >
      <Icon
        size={16}
        strokeWidth={1.9}
        aria-hidden="true"
        className={state === 'saving' ? 'dwp-spin' : undefined}
      />
      <Typography variant="caption" color="inherit" fontWeight={700}>
        {label}
      </Typography>
    </Box>
  );
}

function ExperiencePreview({ kind }: { kind: 'appearance' | 'accessibility' }) {
  const { t } = useTranslation('account');
  return (
    <Box
      component="section"
      aria-label={t(`preview.${kind}.label`)}
      sx={{
        mt: 3,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="overline" color="text.secondary">
          {t('preview.live')}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
          alignItems: 'center',
          gap: 2,
          px: 2.5,
          py: 2.25,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">{t(`preview.${kind}.title`)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t(`preview.${kind}.description`)}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Chip size="small" color="success" label={t('preview.ready')} />
          <ActionButton intent="secondary" size="small">
            {t('preview.action')}
          </ActionButton>
          {kind === 'accessibility' && (
            <Typography component="a" href="#dwp-main-content" variant="body2">
              {t('preview.link')}
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

function RegionalPreview({ regional }: { regional: RegionalPreference }) {
  const { t, i18n } = useTranslation('account');
  const locale: SupportedLocale = (i18n.resolvedLanguage ?? i18n.language).startsWith('ko')
    ? 'ko'
    : 'en';
  const previewDate = new Date('2026-08-12T09:30:00+09:00');
  return (
    <Box
      component="section"
      aria-label={t('preview.regional.label')}
      data-time-zone={regional.timeZone}
      sx={{
        mt: 3,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {[
        [
          CalendarDays,
          t('preview.regional.date'),
          formatDate(previewDate, { dateStyle: 'full' }, locale),
        ],
        [
          Clock3,
          t('preview.regional.time'),
          formatDate(previewDate, { timeStyle: 'short' }, locale),
        ],
        [
          Hash,
          t('preview.regional.number'),
          formatNumber(1234567.89, { maximumFractionDigits: 2 }, locale),
        ],
      ].map(([Icon, label, value], index) => {
        const PreviewIcon = Icon as LucideIcon;
        return (
          <Box
            key={String(label)}
            sx={{
              display: 'grid',
              gridTemplateColumns: '32px minmax(0, 1fr)',
              gap: 1.25,
              alignItems: 'center',
              px: 2,
              py: 2,
              borderLeft: { xs: 0, md: index === 0 ? 0 : 1 },
              borderTop: { xs: index === 0 ? 0 : 1, md: 0 },
              borderColor: 'divider',
            }}
          >
            <PreviewIcon size={18} aria-hidden="true" />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {String(label)}
              </Typography>
              <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                {String(value)}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function PageHeading({
  section,
  title,
  description,
  action,
}: {
  section: SettingsSection;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const Icon = sectionIcons[section];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'stretch', sm: 'flex-start' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0 }}>
        <Box aria-hidden="true" sx={{ color: 'primary.main', mt: 0.5, flex: '0 0 auto' }}>
          <Icon size={24} strokeWidth={1.8} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" variant="h4">
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        </Box>
      </Box>
      {action}
    </Box>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation('account');
  const { section } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [exceptionRule, setExceptionRule] = useState<ManagedPreferenceRule | null>(null);
  const [requestedValue, setRequestedValue] = useState('');
  const [businessJustification, setBusinessJustification] = useState('');
  const [businessImpact, setBusinessImpact] = useState('');
  const [exceptionBusy, setExceptionBusy] = useState(false);
  const appearance = useAppearance();
  const personalPreference = usePersonalPreference();
  const {
    language,
    setLanguage,
    isSaving: isLanguageSaving,
    saveState: languageSaveState,
    lastSavedAt: languageLastSavedAt,
  } = usePreferredLanguage();
  const registeredColorModes = useSystemCodeOptions(
    'PLATFORM.PREFERENCE.COLOR_MODE',
    colorModeOptions
  );
  const registeredDensities = useSystemCodeOptions('PLATFORM.PREFERENCE.DENSITY', densityOptions);
  const registeredTimeZones = useSystemCodeOptions(
    'PLATFORM.PREFERENCE.TIME_ZONE',
    timeZoneOptions
  );
  const registeredDateFormats = useSystemCodeOptions(
    'PLATFORM.PREFERENCE.DATE_FORMAT',
    dateFormatOptions
  );
  const registeredTimeFormats = useSystemCodeOptions(
    'PLATFORM.PREFERENCE.TIME_FORMAT',
    timeFormatOptions
  );
  const registeredFirstDays = useSystemCodeOptions(
    'PLATFORM.PREFERENCE.FIRST_DAY_OF_WEEK',
    firstDayOfWeekOptions
  );
  const registeredNumberFormats = useSystemCodeOptions(
    'PLATFORM.PREFERENCE.NUMBER_FORMAT',
    numberFormatOptions
  );
  const managedFontName = appearance.tenant.fontFamily ?? t('managed.systemFont');
  const preferenceValues = personalPreference.preference?.preferences;
  const regional = preferenceValues?.regional ?? defaultRegionalPreference;
  const managedPolicy = personalPreference.preference?.managedPolicy;
  const managedRules = managedPolicy?.rules ?? [];
  const managedExceptionsQuery = useQuery({
    queryKey: ['personal-preferences', 'managed-exceptions'],
    queryFn: listMyPreferenceExceptions,
    enabled: section === 'managed',
  });
  const managedExceptions = managedExceptionsQuery.data ?? [];
  const pendingExceptionPaths = new Set(
    managedExceptions
      .filter((request) => request.requestState === 'PENDING')
      .map((request) => request.preferencePath)
  );
  const languageRegionSaveState = isLanguageSaving
    ? 'saving'
    : personalPreference.saveState !== 'idle'
      ? personalPreference.saveState
      : languageSaveState;
  const languageRegionSavedAt = personalPreference.lastSavedAt ?? languageLastSavedAt;
  const preferenceControlsDisabled = personalPreference.isLoading || personalPreference.loadFailed;
  const preferenceError = personalPreference.loadFailed ? (
    <Alert
      severity="warning"
      action={
        <ActionButton intent="quiet" size="small" onClick={personalPreference.retry}>
          {t('personalPreferences.retry')}
        </ActionButton>
      }
      sx={{ mb: 3 }}
    >
      {t('personalPreferences.loadError')}
    </Alert>
  ) : null;

  const closeExceptionDialog = () => {
    if (exceptionBusy) return;
    setExceptionRule(null);
    setRequestedValue('');
    setBusinessJustification('');
    setBusinessImpact('');
  };

  const submitExceptionRequest = async () => {
    if (!exceptionRule) return;
    setExceptionBusy(true);
    try {
      await requestPreferenceException({
        preferencePath: exceptionRule.preferencePath,
        requestedValue: requestedValue.trim(),
        businessJustification: businessJustification.trim(),
        businessImpact: businessImpact.trim(),
      });
      await queryClient.invalidateQueries({
        queryKey: ['personal-preferences', 'managed-exceptions'],
      });
      toast.success(t('managed.exceptions.toasts.requested'));
      setExceptionRule(null);
      setRequestedValue('');
      setBusinessJustification('');
      setBusinessImpact('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('managed.exceptions.toasts.failed'));
    } finally {
      setExceptionBusy(false);
    }
  };

  const cancelException = async (request: PreferenceExceptionRequest) => {
    setExceptionBusy(true);
    try {
      await cancelPreferenceException(request.requestId, request.version);
      await queryClient.invalidateQueries({
        queryKey: ['personal-preferences', 'managed-exceptions'],
      });
      toast.success(t('managed.exceptions.toasts.cancelled'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('managed.exceptions.toasts.failed'));
    } finally {
      setExceptionBusy(false);
    }
  };

  if (!isSettingsSection(section)) {
    return <Navigate to="/account/settings/appearance" replace />;
  }

  const resetAction = (
    <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
      <AutoSaveStatus
        state={personalPreference.saveState}
        lastSavedAt={personalPreference.lastSavedAt}
      />
      <ActionButton
        intent="secondary"
        startIcon={<RotateCcw size={17} />}
        disabled={preferenceControlsDisabled || personalPreference.isSaving}
        onClick={personalPreference.reset}
      >
        {t('actions.resetPreferences')}
      </ActionButton>
    </Stack>
  );

  if (section === 'appearance') {
    return (
      <PageCanvas mode="focus">
        {preferenceError}
        <PageHeading
          section={section}
          title={t('sections.appearance.title')}
          description={t('sections.appearance.description')}
          action={resetAction}
        />
        <PreferenceGroup
          title={t('sections.appearance.groupTitle')}
          description={t('sections.appearance.groupDescription')}
        >
          <PreferenceRow
            icon={SunMoon}
            title={t('settings.colorMode.title')}
            description={t('settings.colorMode.description')}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={appearance.preference.mode}
              aria-label={t('settings.colorMode.title')}
              disabled={preferenceControlsDisabled}
              onChange={(_, value) =>
                value && personalPreference.update({ appearance: { mode: value } })
              }
            >
              {registeredColorModes.map((mode) => (
                <ToggleButton key={mode} value={mode}>
                  {t(`options.colorMode.${mode}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </PreferenceRow>
          <PreferenceRow
            icon={Rows3}
            title={t('settings.density.title')}
            description={t('settings.density.description')}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={appearance.preference.density}
              aria-label={t('settings.density.ariaLabel')}
              disabled={preferenceControlsDisabled}
              onChange={(_, value) =>
                value && personalPreference.update({ appearance: { density: value } })
              }
            >
              {registeredDensities.map((density) => (
                <ToggleButton key={density} value={density}>
                  {t(`options.density.${density}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </PreferenceRow>
        </PreferenceGroup>
        <ExperiencePreview kind="appearance" />
      </PageCanvas>
    );
  }

  if (section === 'accessibility') {
    return (
      <PageCanvas mode="focus">
        {preferenceError}
        <PageHeading
          section={section}
          title={t('sections.accessibility.title')}
          description={t('sections.accessibility.description')}
          action={resetAction}
        />
        <PreferenceGroup
          title={t('sections.accessibility.groupTitle')}
          description={t('sections.accessibility.groupDescription')}
        >
          <PreferenceRow
            icon={Contrast}
            title={t('settings.highContrast.title')}
            description={t('settings.highContrast.description')}
          >
            <Switch
              checked={appearance.preference.highContrast}
              disabled={preferenceControlsDisabled}
              slotProps={{ input: { 'aria-label': t('settings.highContrast.title') } }}
              onChange={(_, checked) =>
                personalPreference.update({ accessibility: { highContrast: checked } })
              }
            />
          </PreferenceRow>
          <PreferenceRow
            icon={MoveHorizontal}
            title={t('settings.reduceMotion.title')}
            description={t('settings.reduceMotion.description')}
          >
            <Switch
              checked={appearance.preference.reduceMotion}
              disabled={preferenceControlsDisabled}
              slotProps={{ input: { 'aria-label': t('settings.reduceMotion.title') } }}
              onChange={(_, checked) =>
                personalPreference.update({ accessibility: { reduceMotion: checked } })
              }
            />
          </PreferenceRow>
          <PreferenceRow
            icon={Link2}
            title={t('settings.underlineLinks.title')}
            description={t('settings.underlineLinks.description')}
          >
            <Switch
              checked={preferenceValues?.accessibility.underlineLinks ?? false}
              disabled={preferenceControlsDisabled}
              slotProps={{ input: { 'aria-label': t('settings.underlineLinks.title') } }}
              onChange={(_, checked) =>
                personalPreference.update({ accessibility: { underlineLinks: checked } })
              }
            />
          </PreferenceRow>
          <PreferenceRow
            icon={ScanLine}
            title={t('settings.reduceTransparency.title')}
            description={t('settings.reduceTransparency.description')}
          >
            <Switch
              checked={preferenceValues?.accessibility.reduceTransparency ?? false}
              disabled={preferenceControlsDisabled}
              slotProps={{ input: { 'aria-label': t('settings.reduceTransparency.title') } }}
              onChange={(_, checked) =>
                personalPreference.update({ accessibility: { reduceTransparency: checked } })
              }
            />
          </PreferenceRow>
        </PreferenceGroup>
        <ExperiencePreview kind="accessibility" />
      </PageCanvas>
    );
  }

  if (section === 'language') {
    return (
      <PageCanvas mode="focus">
        <PageHeading
          section={section}
          title={t('sections.language.title')}
          description={t('sections.language.description')}
          action={
            <AutoSaveStatus state={languageRegionSaveState} lastSavedAt={languageRegionSavedAt} />
          }
        />
        <PreferenceGroup
          title={t('sections.language.groupTitle')}
          description={t('sections.language.groupDescription')}
        >
          <PreferenceRow
            icon={LanguageIcon}
            title={t('settings.language.title')}
            description={t('settings.language.description')}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={language}
              disabled={isLanguageSaving}
              aria-label={t('settings.language.title')}
              onChange={(_, value: SupportedLocale | null) => value && void setLanguage(value)}
            >
              {productLocales.map((locale) => (
                <ToggleButton key={locale.code} value={locale.code} lang={locale.code}>
                  {locale.nativeName}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </PreferenceRow>
          <PreferenceRow
            icon={Clock3}
            title={t('settings.timeZone.title')}
            description={t('settings.timeZone.description')}
          >
            <Box sx={{ width: { xs: 'min(100%, 280px)', sm: 280 } }}>
              <SelectField<TimeZonePreference>
                size="small"
                aria-label={t('settings.timeZone.title')}
                value={regional.timeZone}
                disabled={preferenceControlsDisabled}
                options={registeredTimeZones.map((value) => ({
                  value,
                  label: t(`options.timeZone.${value.replace(/\//g, '_')}`),
                }))}
                onValueChange={(value) =>
                  value && personalPreference.update({ regional: { timeZone: value } })
                }
              />
            </Box>
          </PreferenceRow>
          <PreferenceRow
            icon={CalendarDays}
            title={t('settings.dateFormat.title')}
            description={t('settings.dateFormat.description')}
          >
            <Box sx={{ width: { xs: 'min(100%, 240px)', sm: 240 } }}>
              <SelectField<DateFormatPreference>
                size="small"
                aria-label={t('settings.dateFormat.title')}
                value={regional.dateFormat}
                disabled={preferenceControlsDisabled}
                options={registeredDateFormats.map((value) => ({
                  value,
                  label: t(`options.dateFormat.${value}`),
                }))}
                onValueChange={(value) =>
                  value && personalPreference.update({ regional: { dateFormat: value } })
                }
              />
            </Box>
          </PreferenceRow>
          <PreferenceRow
            icon={Clock3}
            title={t('settings.timeFormat.title')}
            description={t('settings.timeFormat.description')}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={regional.timeFormat}
              disabled={preferenceControlsDisabled}
              aria-label={t('settings.timeFormat.title')}
              onChange={(_, value: TimeFormatPreference | null) =>
                value && personalPreference.update({ regional: { timeFormat: value } })
              }
            >
              {registeredTimeFormats.map((value) => (
                <ToggleButton key={value} value={value}>
                  {t(`options.timeFormat.${value}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </PreferenceRow>
          <PreferenceRow
            icon={CalendarDays}
            title={t('settings.firstDayOfWeek.title')}
            description={t('settings.firstDayOfWeek.description')}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={regional.firstDayOfWeek}
              disabled={preferenceControlsDisabled}
              aria-label={t('settings.firstDayOfWeek.title')}
              onChange={(_, value: FirstDayOfWeekPreference | null) =>
                value && personalPreference.update({ regional: { firstDayOfWeek: value } })
              }
            >
              {registeredFirstDays.map((value) => (
                <ToggleButton key={value} value={value}>
                  {t(`options.firstDayOfWeek.${value}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </PreferenceRow>
          <PreferenceRow
            icon={Hash}
            title={t('settings.numberFormat.title')}
            description={t('settings.numberFormat.description')}
          >
            <Box sx={{ width: { xs: 'min(100%, 240px)', sm: 240 } }}>
              <SelectField<NumberFormatPreference>
                size="small"
                aria-label={t('settings.numberFormat.title')}
                value={regional.numberFormat}
                disabled={preferenceControlsDisabled}
                options={registeredNumberFormats.map((value) => ({
                  value,
                  label: t(`options.numberFormat.${value}`),
                }))}
                onValueChange={(value) =>
                  value && personalPreference.update({ regional: { numberFormat: value } })
                }
              />
            </Box>
          </PreferenceRow>
        </PreferenceGroup>
        <RegionalPreview regional={regional} />
      </PageCanvas>
    );
  }

  if (section === 'home') {
    return (
      <PageCanvas mode="focus">
        <PageHeading
          section={section}
          title={t('sections.home.title')}
          description={t('sections.home.description')}
        />
        <PreferenceGroup
          title={t('sections.home.groupTitle')}
          description={t('sections.home.groupDescription')}
        >
          <PreferenceRow
            icon={LayoutDashboard}
            title={t('settings.homeWorkspace.title')}
            description={t('settings.homeWorkspace.description')}
          >
            <ActionButton
              intent="secondary"
              startIcon={<LayoutDashboard size={17} />}
              onClick={() => navigate('/?edit=home')}
            >
              {t('actions.editHome')}
            </ActionButton>
          </PreferenceRow>
        </PreferenceGroup>
      </PageCanvas>
    );
  }

  return (
    <PageCanvas mode="focus">
      <PageHeading
        section={section}
        title={t('sections.managed.title')}
        description={t('sections.managed.description')}
      />
      <Alert severity="info" sx={{ mt: 3 }}>
        {t('sections.managed.notice', {
          owner: managedPolicy?.ownerDisplayName ?? t('managed.ownerFallback'),
        })}
      </Alert>
      <PreferenceGroup
        title={t('sections.managed.groupTitle')}
        description={t('sections.managed.groupDescription')}
      >
        <PreferenceRow icon={Type} title={t('settings.productFont.title')}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Typography variant="body2" sx={{ maxWidth: 360 }} noWrap>
              {managedFontName}
            </Typography>
            <Chip size="small" label={t('labels.managed')} variant="outlined" />
            {managedRules.find((rule) => rule.preferencePath === 'appearance.fontFamily')
              ?.exceptionAllowed && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<Send size={15} />}
                disabled={pendingExceptionPaths.has('appearance.fontFamily')}
                onClick={() =>
                  setExceptionRule(
                    managedRules.find((rule) => rule.preferencePath === 'appearance.fontFamily') ??
                      null
                  )
                }
              >
                {pendingExceptionPaths.has('appearance.fontFamily')
                  ? t('managed.exceptions.pending')
                  : t('managed.exceptions.request')}
              </ActionButton>
            )}
          </Stack>
        </PreferenceRow>
        <PreferenceRow icon={Palette} title={t('settings.brandAccent.title')}>
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Box
              role="img"
              aria-label={t('settings.brandAccent.ariaLabel', { color: appearance.accentColor })}
              sx={{
                width: 24,
                height: 24,
                borderRadius: 1,
                bgcolor: appearance.accentColor,
                border: 1,
                borderColor: 'divider',
              }}
            />
            <Typography variant="body2">{appearance.accentColor}</Typography>
            <Chip size="small" label={t('labels.managed')} variant="outlined" />
            {managedRules.find((rule) => rule.preferencePath === 'appearance.accentColor')
              ?.exceptionAllowed && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<Send size={15} />}
                disabled={pendingExceptionPaths.has('appearance.accentColor')}
                onClick={() =>
                  setExceptionRule(
                    managedRules.find((rule) => rule.preferencePath === 'appearance.accentColor') ??
                      null
                  )
                }
              >
                {pendingExceptionPaths.has('appearance.accentColor')
                  ? t('managed.exceptions.pending')
                  : t('managed.exceptions.request')}
              </ActionButton>
            )}
          </Stack>
        </PreferenceRow>
        <PreferenceRow icon={PanelLeft} title={t('settings.navigationPattern.title')}>
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Typography variant="body2">
              {t(`options.navigationPattern.${appearance.navigationPattern}`)}
            </Typography>
            <Chip size="small" label={t('labels.managed')} variant="outlined" />
            {managedRules.find((rule) => rule.preferencePath === 'navigation.pattern')
              ?.exceptionAllowed && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<Send size={15} />}
                disabled={pendingExceptionPaths.has('navigation.pattern')}
                onClick={() =>
                  setExceptionRule(
                    managedRules.find((rule) => rule.preferencePath === 'navigation.pattern') ??
                      null
                  )
                }
              >
                {pendingExceptionPaths.has('navigation.pattern')
                  ? t('managed.exceptions.pending')
                  : t('managed.exceptions.request')}
              </ActionButton>
            )}
          </Stack>
        </PreferenceRow>
        <PreferenceRow
          icon={Building2}
          title={t('settings.policySource.title')}
          description={t('settings.policySource.description')}
        >
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="body2">
              {t(`managed.sources.${managedPolicy?.source ?? 'TENANT_EXPERIENCE_POLICY'}`)}
            </Typography>
            <Chip size="small" label={t('managed.tenantScope')} variant="outlined" />
          </Stack>
        </PreferenceRow>
        <PreferenceRow
          icon={Accessibility}
          title={t('settings.policyOwner.title')}
          description={t('settings.policyOwner.description')}
        >
          <Typography variant="body2">
            {managedPolicy?.ownerDisplayName ?? t('managed.ownerFallback')}
          </Typography>
        </PreferenceRow>
      </PreferenceGroup>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        {t('managed.paths', {
          paths:
            managedPolicy?.managedPaths.join(', ') ??
            'appearance.fontFamily, appearance.accentColor, navigation.pattern',
        })}
      </Typography>
      <Box component="section" sx={{ mt: 4 }}>
        <Typography component="h2" variant="h6">
          {t('managed.exceptions.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('managed.exceptions.description')}
        </Typography>
        {managedExceptionsQuery.isError ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {t('managed.exceptions.loadError')}
          </Alert>
        ) : managedExceptions.length === 0 ? (
          <Box sx={{ mt: 1.5, px: 2.5, py: 3, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Typography component="h3" variant="subtitle2">
              {t('managed.exceptions.emptyTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('managed.exceptions.emptyDescription')}
            </Typography>
          </Box>
        ) : (
          <Stack
            divider={<Divider flexItem />}
            sx={{ mt: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
          >
            {managedExceptions.map((request) => (
              <Box
                key={request.requestId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                  gap: 1.5,
                  alignItems: 'center',
                  px: 2.5,
                  py: 2,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle2">
                      {t(`managed.pathLabels.${request.preferencePath}`)}
                    </Typography>
                    <Chip
                      size="small"
                      color={
                        request.requestState === 'APPROVED'
                          ? 'success'
                          : request.requestState === 'REJECTED'
                            ? 'error'
                            : request.requestState === 'PENDING'
                              ? 'warning'
                              : 'default'
                      }
                      variant={request.requestState === 'PENDING' ? 'filled' : 'outlined'}
                      label={t(`managed.exceptions.states.${request.requestState}`)}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('managed.exceptions.requestedValue', {
                      value:
                        typeof request.requestedValue === 'string'
                          ? request.requestedValue
                          : JSON.stringify(request.requestedValue),
                      date: formatDate(request.createdAt, { dateStyle: 'medium' }),
                    })}
                  </Typography>
                  {request.decisionReason && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {t('managed.exceptions.decisionReason', {
                        reason: request.decisionReason,
                      })}
                    </Typography>
                  )}
                </Box>
                {request.requestState === 'PENDING' && (
                  <ActionButton
                    intent="secondary"
                    size="small"
                    startIcon={<X size={15} />}
                    disabled={exceptionBusy}
                    onClick={() => void cancelException(request)}
                  >
                    {t('managed.exceptions.cancel')}
                  </ActionButton>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Box>
      <FormDialog
        open={Boolean(exceptionRule)}
        title={t('managed.exceptions.dialog.title', {
          setting: exceptionRule ? t(`managed.pathLabels.${exceptionRule.preferencePath}`) : '',
        })}
        description={t('managed.exceptions.dialog.description', {
          owner: managedPolicy?.ownerDisplayName ?? t('managed.ownerFallback'),
        })}
        cancelLabel={t('managed.exceptions.dialog.cancel')}
        submitLabel={t('managed.exceptions.dialog.submit')}
        submittingLabel={t('managed.exceptions.dialog.submitting')}
        busy={exceptionBusy}
        submitDisabled={
          requestedValue.trim().length === 0 ||
          businessJustification.trim().length < 10 ||
          businessImpact.trim().length < 10
        }
        onClose={closeExceptionDialog}
        onSubmit={submitExceptionRequest}
      >
        <Stack gap={2}>
          <FormField
            autoFocus
            required
            label={t('managed.exceptions.dialog.requestedValue')}
            value={requestedValue}
            onChange={(event) => setRequestedValue(event.target.value)}
            supportingText={t('managed.exceptions.dialog.requestedValueHelp')}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <FormField
            required
            multiline
            minRows={3}
            label={t('managed.exceptions.dialog.justification')}
            value={businessJustification}
            onChange={(event) => setBusinessJustification(event.target.value)}
            supportingText={t('managed.exceptions.dialog.justificationHelp')}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
          <FormField
            required
            multiline
            minRows={3}
            label={t('managed.exceptions.dialog.impact')}
            value={businessImpact}
            onChange={(event) => setBusinessImpact(event.target.value)}
            supportingText={t('managed.exceptions.dialog.impactHelp')}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Stack>
      </FormDialog>
    </PageCanvas>
  );
}
