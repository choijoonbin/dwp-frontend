import { useTranslation } from 'react-i18next';
import { foundationTokens } from '@dwp-frontend/design-system';
import { CalendarDays, Database, ShieldCheck } from 'lucide-react';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard } from './workplace-member-surfaces';
import type { WorkplaceHomeSourceState } from './workplace-home-source-state';

export function WorkplaceHomeSourceSummary({
  workspaceState,
  calendarState,
  workspaceUpdatedAt,
  calendarUpdatedAt,
}: {
  workspaceState: WorkplaceHomeSourceState;
  calendarState: WorkplaceHomeSourceState;
  workspaceUpdatedAt?: string | null;
  calendarUpdatedAt?: string | null;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  return (
    <Box
      component="footer"
      data-testid="workplace-home-source-summary"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        gap: { xs: 0.5, md: foundationTokens.workplace.layout.cardGap + 'px' },
        mt: { xs: 2, md: foundationTokens.workplace.layout.sectionGap + 'px' },
      }}
    >
      {[
        {
          key: 'workspace',
          icon: Database,
          state: workspaceState,
          description: 'workspaceDescription',
          updatedAt: workspaceUpdatedAt,
        },
        {
          key: 'calendar',
          icon: CalendarDays,
          state: calendarState,
          description: 'calendarDescription',
          updatedAt: calendarUpdatedAt,
        },
        {
          key: 'externalPresence',
          icon: ShieldCheck,
          state: 'SKIPPED',
          description: 'externalDescription',
          updatedAt: null,
        },
      ].map(({ key, icon: Icon, state, description, updatedAt }) => (
        <Box
          key={key}
          sx={(theme) => ({
            ...workplaceMemberCard(theme),
            borderWidth: { xs: 0, md: 1 },
            bgcolor: { xs: 'transparent', md: 'background.paper' },
            p: { xs: 0.75, md: 2 },
          })}
        >
          <Stack direction="row" gap={0.75} alignItems="center" justifyContent="space-between">
            <Stack direction="row" gap={0.75} alignItems="center">
              <Icon size={16} aria-hidden="true" />
              <Typography sx={foundationTokens.workplace.typography.cardTitle}>
                {t(`workplace.home.sources.${key}`)}
              </Typography>
            </Stack>
            <Typography
              color={
                state === 'READY'
                  ? 'success.main'
                  : state === 'STALE'
                    ? 'warning.main'
                    : 'text.secondary'
              }
              sx={foundationTokens.workplace.typography.caption}
            >
              {t(
                state === 'READY'
                  ? 'workplace.home.live'
                  : state === 'STALE'
                    ? 'workplace.home.status.stale'
                    : 'workplace.home.sources.unverified'
              )}
            </Typography>
          </Stack>
          <Typography
            color="text.secondary"
            sx={{
              ...foundationTokens.workplace.typography.smallBody,
              display: { xs: 'none', md: 'block' },
              mt: 1,
            }}
          >
            {t(`workplace.home.sources.${description}`)}
          </Typography>
          {state === 'READY' && updatedAt ? (
            <Typography
              color="text.secondary"
              sx={{
                ...foundationTokens.workplace.typography.caption,
                display: { xs: 'none', md: 'block' },
                mt: 0.75,
              }}
            >
              {t('workplace.home.status.verifiedAt', {
                time: formatDate(updatedAt, { hour: '2-digit', minute: '2-digit' }, locale),
              })}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
