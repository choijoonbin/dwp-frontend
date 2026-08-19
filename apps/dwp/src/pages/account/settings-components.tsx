import {
  Accessibility,
  BellRing,
  Building2,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  Hash,
  LayoutDashboard,
  LoaderCircle,
  Palette,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber, type SupportedLocale } from '@dwp-frontend/shared-i18n';
import type { RegionalPreference } from '@dwp-frontend/shared-utils';
import { LanguageIcon } from '@dwp-frontend/design-system/components/icons';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SettingsSection } from '../../features/account/settings-navigation';
import type { PersonalPreferenceSaveState } from '../../providers/personal-preference-provider';

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
  notifications: BellRing,
  managed: Building2,
};

export function PreferenceRow({ icon: Icon, title, description, children }: PreferenceRowProps) {
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

export function PreferenceGroup({ title, description, children }: PreferenceGroupProps) {
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

export function AutoSaveStatus({
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

export function ExperiencePreview({ kind }: { kind: 'appearance' | 'accessibility' }) {
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

export function RegionalPreview({ regional }: { regional: RegionalPreference }) {
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

export function PageHeading({
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
