import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import { ActionButton, SectionHeader } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type { VideoMeetingPreparation } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { meetingInsetSurface } from './meeting-visual-system';

/** A projection of the currently authorized preparation response, without model-generated claims. */
export function MeetingPreparationBriefing({
  preparation,
  timeZone,
}: {
  preparation: VideoMeetingPreparation;
  timeZone: string;
}) {
  const { t, i18n } = useTranslation('meetings');
  const timed = preparation.agendaItems.filter((item) => item.plannedMinutes !== null);
  const minutes = timed.reduce((sum, item) => sum + (item.plannedMinutes ?? 0), 0);
  const assigned = preparation.agendaItems.filter((item) => item.ownerUserId !== null);
  const focusSource = (id: string) => {
    const heading = document.getElementById(id);
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus();
    heading.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  return (
    <Stack
      gap={1.25}
      data-testid="meeting-preparation-briefing"
      sx={(theme) => ({ ...meetingInsetSurface(theme, 'primary'), p: 2 })}
    >
      <SectionHeader
        icon={ClipboardList}
        glyph="plain"
        density="compact"
        title={t('preparation.briefing.title')}
      />
      <Typography variant="body2" color="text.secondary">
        {t('preparation.briefing.source')}
      </Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto',
          gap: 1,
          '& dt': { typography: 'body2' },
          '& dd': { m: 0, typography: 'body2', fontWeight: 'fontWeightBold' },
        }}
      >
        <dt>{t('preparation.briefing.agenda')}</dt>
        <dd>{t('preparation.briefing.agendaCount', { count: preparation.agendaItems.length })}</dd>
        <dt>{t('preparation.briefing.duration')}</dt>
        <dd>{timed.length ? t('units.minutes', { count: minutes }) : t('preparation.noTime')}</dd>
        <dt>{t('preparation.briefing.assigned')}</dt>
        <dd>
          {t('preparation.briefing.assignmentCount', {
            assigned: assigned.length,
            count: preparation.agendaItems.length,
          })}
        </dd>
        <dt>{t('preparation.briefing.materials')}</dt>
        <dd>{t('preparation.briefing.materialCount', { count: preparation.materials.length })}</dd>
      </Box>
      {preparation.agendaItems.length > 0 ? (
        <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
          {preparation.agendaItems.slice(0, 3).map((item) => (
            <Typography
              component="li"
              key={item.itemId}
              variant="body2"
              sx={{ overflowWrap: 'anywhere', py: 0.25 }}
            >
              {item.title}
            </Typography>
          ))}
        </Box>
      ) : (
        <Typography variant="body2">{t('preparation.noAgenda')}</Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {t('preparation.briefing.revisions', {
          agenda: preparation.agendaVersion,
          materials: preparation.materialsVersion,
          time: formatDate(
            preparation.observedAt,
            { hour: '2-digit', minute: '2-digit', timeZone },
            resolveSupportedLocale(i18n.language)
          ),
        })}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('preparation.briefing.personalBoundary')}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <ActionButton
          intent="secondary"
          onClick={() => focusSource('preparation-agenda')}
          sx={{ minHeight: 44 }}
        >
          {t('preparation.briefing.openAgenda')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          onClick={() => focusSource('preparation-materials')}
          sx={{ minHeight: 44 }}
        >
          {t('preparation.briefing.openMaterials')}
        </ActionButton>
      </Stack>
    </Stack>
  );
}
