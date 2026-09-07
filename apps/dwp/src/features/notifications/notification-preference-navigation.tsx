import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellDot, BellRing, CalendarClock, MoonStar, ShieldCheck } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

export const NOTIFICATION_PREFERENCE_SECTION_IDS = {
  presentation: 'notification-preferences-presentation',
  global: 'notification-preferences-channels',
  quiet: 'notification-preferences-quiet-hours',
  digest: 'notification-preferences-digest',
  apps: 'notification-preferences-apps',
} as const;

type PreferenceSectionKey = keyof typeof NOTIFICATION_PREFERENCE_SECTION_IDS;

const PREFERENCE_SECTIONS = [
  {
    key: 'presentation',
    id: NOTIFICATION_PREFERENCE_SECTION_IDS.presentation,
    icon: BellDot,
  },
  { key: 'global', id: NOTIFICATION_PREFERENCE_SECTION_IDS.global, icon: BellRing },
  { key: 'quiet', id: NOTIFICATION_PREFERENCE_SECTION_IDS.quiet, icon: MoonStar },
  { key: 'digest', id: NOTIFICATION_PREFERENCE_SECTION_IDS.digest, icon: CalendarClock },
  { key: 'apps', id: NOTIFICATION_PREFERENCE_SECTION_IDS.apps, icon: ShieldCheck },
] as const;

export function NotificationPreferenceNavigation() {
  const { t } = useTranslation('notifications');
  const [activeSection, setActiveSection] = useState<PreferenceSectionKey>('presentation');

  useEffect(() => {
    let frame = 0;
    const synchronizeActiveSection = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
          setActiveSection('apps');
          return;
        }
        const current = PREFERENCE_SECTIONS.reduce<PreferenceSectionKey>((visibleKey, section) => {
          const top = document.getElementById(section.id)?.getBoundingClientRect().top;
          return top != null && top <= 144 ? section.key : visibleKey;
        }, 'presentation');
        setActiveSection(current);
      });
    };
    synchronizeActiveSection();
    window.addEventListener('scroll', synchronizeActiveSection, { passive: true });
    window.addEventListener('resize', synchronizeActiveSection);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', synchronizeActiveSection);
      window.removeEventListener('resize', synchronizeActiveSection);
    };
  }, []);

  const openSection = (key: PreferenceSectionKey, id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    setActiveSection(key);
    section.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <Box
      component="nav"
      aria-label={t('preferences.sectionNavigation')}
      sx={{
        position: 'sticky',
        top: { xs: 56, md: 60 },
        zIndex: 2,
        mt: 2.25,
        py: 0.75,
        borderTop: 1,
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
              minHeight: 38,
              px: 1.25,
              color: activeSection === key ? 'primary.main' : 'text.secondary',
              bgcolor: activeSection === key ? 'action.selected' : 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {t(`preferences.${key}.title`)}
          </ActionButton>
        ))}
      </Stack>
    </Box>
  );
}
