import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { meetingSurface } from './meeting-visual-system';

export function MeetingAdminPolicySection({
  title,
  forceOpen = false,
  children,
}: {
  title: string;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [mobileOpen, setMobileOpen] = useState(forceOpen);
  useEffect(() => {
    if (forceOpen) setMobileOpen(true);
  }, [forceOpen]);
  return (
    <Box
      component="details"
      role="region"
      aria-label={title}
      open={!compact || mobileOpen}
      onToggle={(event) => {
        if (compact) setMobileOpen(event.currentTarget.open);
      }}
      sx={(currentTheme) => ({
        ...meetingSurface(currentTheme),
        overflow: 'hidden',
      })}
    >
      <Box
        component="summary"
        onClick={(event) => {
          if (!compact) event.preventDefault();
        }}
        sx={{
          display: 'flex',
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 2, sm: 2.5 },
          py: 1.5,
          bgcolor: 'action.hover',
          cursor: { xs: 'pointer', md: 'default' },
          listStyle: 'none',
          '&::-webkit-details-marker': { display: 'none' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <Box component="h2" sx={{ m: 0, typography: 'subtitle1' }}>
          {title}
        </Box>
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            display: { xs: 'inline-flex', md: 'none' },
            flex: '0 0 auto',
            transform: mobileOpen ? 'rotate(180deg)' : undefined,
          }}
        >
          <ChevronDown size={18} />
        </Box>
      </Box>
      <Divider />
      {children}
    </Box>
  );
}

export function MeetingAdminPolicyImpact({
  version,
  changedCount,
}: {
  version: number;
  changedCount: number;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Box
      component="aside"
      aria-label={t('admin.policy.impactTitle')}
      sx={(theme) => ({
        ...meetingSurface(theme, { tone: 'primary' }),
        gridArea: 'impact',
        p: 2.5,
      })}
    >
      <Box component="h2" sx={{ m: 0, typography: 'subtitle1' }}>
        {t('admin.policy.impactTitle')}
      </Box>
      <Box component="p" sx={{ m: 0, color: 'text.secondary', typography: 'caption' }}>
        {t('admin.policy.version', { version })}
      </Box>
      <Box component="p" sx={{ m: 0, mt: 1.5, typography: 'body2' }}>
        {changedCount > 0
          ? t('admin.policy.impactChanged', { count: changedCount })
          : t('admin.policy.impactUnchanged')}
      </Box>
      <Box component="p" sx={{ m: 0, mt: 1, color: 'text.secondary', typography: 'caption' }}>
        {t('admin.policy.impactBoundary')}
      </Box>
    </Box>
  );
}

export function MeetingAdminPolicyBoundaries({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('meetings');
  return (
    <Stack
      component="section"
      aria-label={t('admin.policy.boundariesTitle')}
      gap={2}
      sx={{ gridArea: 'boundaries' }}
    >
      {!canManage && (
        <InlineFeedback severity="warning">{t('admin.policy.readOnly')}</InlineFeedback>
      )}
      <InlineFeedback severity="info">{t('admin.policy.overrideUnavailable')}</InlineFeedback>
      <InlineFeedback severity="info">{t('admin.policy.auditUnavailable')}</InlineFeedback>
      <InlineFeedback severity="info">{t('admin.policy.unmuteRequestOnly')}</InlineFeedback>
    </Stack>
  );
}
