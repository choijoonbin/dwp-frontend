import {
  Accessibility,
  Building2,
  Contrast,
  LayoutDashboard,
  MoveHorizontal,
  Palette,
  PanelLeft,
  RotateCcw,
  Rows3,
  SunMoon,
  Type,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { productLocales, type SupportedLocale } from '@dwp-frontend/shared-i18n';
import { LanguageIcon } from '@dwp-frontend/design-system/components/icons';
import {
  ActionButton,
  PageCanvas,
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
  const appearance = useAppearance();
  const personalPreference = usePersonalPreference();
  const { language, setLanguage, isSaving: isLanguageSaving } = usePreferredLanguage();
  const registeredColorModes = useSystemCodeOptions(
    'PLATFORM.PREFERENCE.COLOR_MODE',
    colorModeOptions
  );
  const registeredDensities = useSystemCodeOptions('PLATFORM.PREFERENCE.DENSITY', densityOptions);
  const managedFontName = appearance.tenant.fontFamily ?? t('managed.systemFont');
  const preferenceControlsDisabled =
    personalPreference.isLoading || personalPreference.isSaving || personalPreference.loadFailed;
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

  if (!isSettingsSection(section)) {
    return <Navigate to="/account/settings/appearance" replace />;
  }

  const resetAction = (
    <ActionButton
      intent="secondary"
      startIcon={<RotateCcw size={17} />}
      disabled={preferenceControlsDisabled}
      onClick={personalPreference.reset}
    >
      {t('actions.resetPreferences')}
    </ActionButton>
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
        </PreferenceGroup>
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
        </PreferenceGroup>
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
        {t('sections.managed.notice')}
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
          </Stack>
        </PreferenceRow>
        <PreferenceRow icon={PanelLeft} title={t('settings.navigationPattern.title')}>
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Typography variant="body2">
              {t(`options.navigationPattern.${appearance.navigationPattern}`)}
            </Typography>
            <Chip size="small" label={t('labels.managed')} variant="outlined" />
          </Stack>
        </PreferenceRow>
      </PreferenceGroup>
    </PageCanvas>
  );
}
