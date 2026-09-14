import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BellDot,
  BellRing,
  CalendarClock,
  MoonStar,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import {
  notificationPreferenceRadius,
  notificationPreferenceSelectedBackground,
  notificationPreferenceSoftBackground,
} from './notification-preference-styles';

export type PreferenceView = 'settings' | 'diagnostics';

export function NotificationPreferenceViewTabs({
  view,
  onViewChange,
}: {
  view: PreferenceView;
  onViewChange: (view: PreferenceView) => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Tabs
      value={view}
      onChange={(_event, next: PreferenceView) => onViewChange(next)}
      aria-label={t('preferences.title')}
      variant="fullWidth"
      sx={{
        mt: 2,
        p: 0.5,
        minHeight: 40,
        borderRadius: notificationPreferenceRadius,
        bgcolor: notificationPreferenceSelectedBackground,
        '& .MuiTabs-indicator': { display: 'none' },
        '& .MuiTab-root': {
          minWidth: 0,
          minHeight: 36,
          px: 1,
          py: 0.75,
          gap: 0.75,
          typography: 'body2',
          fontWeight: 'fontWeightMedium',
          borderRadius: notificationPreferenceRadius,
          textTransform: 'none',
          color: 'text.secondary',
          '&.Mui-selected': { bgcolor: 'background.paper', color: 'primary.main' },
          '&.Mui-focusVisible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -2,
          },
        },
      }}
    >
      <Tab
        id="notification-preference-settings-tab"
        aria-controls="notification-preference-settings-panel"
        value="settings"
        icon={<SlidersHorizontal size={16} />}
        iconPosition="start"
        label={t('preferences.title')}
      />
      <Tab
        id="notification-preference-diagnostics-tab"
        aria-controls="notification-preference-diagnostics-panel"
        value="diagnostics"
        icon={<ShieldCheck size={16} />}
        iconPosition="start"
        label={t('preferences.status.title')}
      />
    </Tabs>
  );
}

export const NOTIFICATION_PREFERENCE_SECTION_IDS = {
  presentation: 'notification-preferences-presentation',
  global: 'notification-preferences-channels',
  quiet: 'notification-preferences-quiet-hours',
  digest: 'notification-preferences-digest',
  apps: 'notification-preferences-apps',
} as const;

export type PreferenceSectionKey = keyof typeof NOTIFICATION_PREFERENCE_SECTION_IDS;

const PREFERENCE_SECTIONS = [
  { key: 'global', id: NOTIFICATION_PREFERENCE_SECTION_IDS.global, icon: BellRing },
  { key: 'apps', id: NOTIFICATION_PREFERENCE_SECTION_IDS.apps, icon: ShieldCheck },
  { key: 'quiet', id: NOTIFICATION_PREFERENCE_SECTION_IDS.quiet, icon: MoonStar },
  {
    key: 'presentation',
    id: NOTIFICATION_PREFERENCE_SECTION_IDS.presentation,
    icon: BellDot,
  },
  { key: 'digest', id: NOTIFICATION_PREFERENCE_SECTION_IDS.digest, icon: CalendarClock },
] as const;

export function NotificationPreferenceNavigation({
  activeSection,
  onSectionChange,
}: {
  activeSection: PreferenceSectionKey;
  onSectionChange: (section: PreferenceSectionKey) => void;
}) {
  const { t } = useTranslation('notifications');

  const activeSectionRef = useRef(activeSection);
  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    let frame = 0;
    let resizeFrame = 0;
    let width = window.innerWidth;
    let resizeSection: PreferenceSectionKey | null = null;
    const synchronizeActiveSection = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (
          !document.getElementById(NOTIFICATION_PREFERENCE_SECTION_IDS.global)?.getClientRects()
            .length
        )
          return;
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
          onSectionChange('digest');
          return;
        }
        const current = PREFERENCE_SECTIONS.reduce<PreferenceSectionKey>((visibleKey, section) => {
          const top = document.getElementById(section.id)?.getBoundingClientRect().top;
          return top != null && top <= 144 ? section.key : visibleKey;
        }, 'global');
        onSectionChange(current);
      });
    };
    const restoreResizeSection = () => {
      const section = resizeSection;
      if (!section) return;
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        document.getElementById(NOTIFICATION_PREFERENCE_SECTION_IDS[section])?.scrollIntoView({
          behavior: 'instant',
          block: 'start',
        });
        synchronizeActiveSection();
      });
    };
    const preserveSectionOnResize = () => {
      if (width === window.innerWidth) return;
      width = window.innerWidth;
      resizeSection = activeSectionRef.current;
      restoreResizeSection();
    };
    const releaseResizeSection = () => {
      resizeSection = null;
      window.cancelAnimationFrame(resizeFrame);
    };
    const resizeObserver = new ResizeObserver(restoreResizeSection);
    const panel = document
      .getElementById(NOTIFICATION_PREFERENCE_SECTION_IDS.global)
      ?.closest('[role="tabpanel"]');
    if (panel) resizeObserver.observe(panel);
    synchronizeActiveSection();
    window.addEventListener('scroll', synchronizeActiveSection, { passive: true });
    window.addEventListener('resize', preserveSectionOnResize);
    window.addEventListener('pointerdown', releaseResizeSection, { passive: true });
    window.addEventListener('wheel', releaseResizeSection, { passive: true });
    window.addEventListener('keydown', releaseResizeSection);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', synchronizeActiveSection);
      window.removeEventListener('resize', preserveSectionOnResize);
      window.removeEventListener('pointerdown', releaseResizeSection);
      window.removeEventListener('wheel', releaseResizeSection);
      window.removeEventListener('keydown', releaseResizeSection);
    };
  }, [onSectionChange]);

  const openSection = (key: PreferenceSectionKey, id: string) => {
    onSectionChange(key);
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };

  return (
    <Box
      component="nav"
      aria-label={t('preferences.sectionNavigation')}
      sx={{
        position: 'sticky',
        top: {
          xs: 'var(--dwp-shell-mobile-sticky-offset, 64px)',
          lg: 'var(--dwp-shell-desktop-sticky-offset, 64px)',
        },
        zIndex: 2,
        mt: 1.5,
        p: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      <Stack direction="row" gap={0.5} sx={{ minWidth: 'max-content' }}>
        {PREFERENCE_SECTIONS.map(({ key, id, icon: Icon }) => (
          <ActionButton
            key={key}
            intent="quiet"
            size="small"
            startIcon={<Icon size={16} />}
            aria-current={activeSection === key ? 'location' : undefined}
            onClick={() => openSection(key, id)}
            sx={{
              minHeight: 36,
              borderRadius: notificationPreferenceRadius,
              px: 1.25,
              justifyContent: 'flex-start',
              color: activeSection === key ? 'primary.main' : 'text.secondary',
              bgcolor: activeSection === key ? notificationPreferenceSoftBackground : 'transparent',
              whiteSpace: 'nowrap',
              '&[aria-current="location"]': {
                boxShadow: (theme) => `inset 0 -2px 0 ${theme.palette.primary.main}`,
              },
            }}
          >
            {t(`preferences.${key}.title`)}
          </ActionButton>
        ))}
      </Stack>
    </Box>
  );
}
