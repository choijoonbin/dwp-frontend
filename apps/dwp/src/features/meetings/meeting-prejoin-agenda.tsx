import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@dwp-frontend/shared-utils';
import { getVideoMeetingPreparation } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import { SectionHeader } from '@dwp-frontend/design-system';
import { ListChecks } from 'lucide-react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { meetingInsetSurface, meetingSurface } from './meeting-visual-system';

export function MeetingPrejoinAgenda({ meetingId }: { meetingId: string }) {
  const { t } = useTranslation('meetings');
  const { user, isAuthenticated } = useAuth();
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
    meetingId,
  ]);
  const query = useQuery({
    queryKey: ['meetings', 'prejoin-agenda', scope],
    queryFn: () => getVideoMeetingPreparation(meetingId),
    enabled: isAuthenticated,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true },
  });
  const data =
    !query.isError && isAuthenticated && query.data?.meetingId === meetingId ? query.data : null;
  return (
    <Stack
      component="section"
      gap={1.5}
      data-testid="meeting-prejoin-agenda"
      sx={(theme) => ({ ...meetingSurface(theme), p: { xs: 2, md: 2.5 } })}
    >
      <SectionHeader
        icon={ListChecks}
        glyph="plain"
        density="compact"
        title={t('room.preJoin.design.agenda')}
      />
      {data?.agendaItems.length ? (
        <Stack component="ol" gap={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {[...data.agendaItems]
            .sort((a, b) => a.position - b.position)
            .map((item, index) => (
              <Stack
                component="li"
                key={item.itemId}
                direction="row"
                gap={1.25}
                sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5 })}
              >
                <Typography variant="caption" color="primary.main">
                  {String(index + 1).padStart(2, '0')}
                </Typography>
                <Stack gap={0.5} sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                    {item.title}
                  </Typography>
                  {item.objective && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {item.objective}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {item.ownerDisplayName ?? t('preparation.unassigned')} ·{' '}
                    {item.plannedMinutes
                      ? t('units.minutes', { count: item.plannedMinutes })
                      : t('preparation.noTime')}
                  </Typography>
                </Stack>
              </Stack>
            ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t(
            query.isPending
              ? 'preparation.loading'
              : query.isError
                ? 'preparation.loadErrorHint'
                : 'preparation.noAgenda'
          )}
        </Typography>
      )}
    </Stack>
  );
}
