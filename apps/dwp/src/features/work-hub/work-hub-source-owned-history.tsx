import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WorkSourceDetailSection } from './work-hub-source-detail-section';
import type { WorkHubSourceHistoryEvent } from './work-hub-source-owned-detail-model';

export function WorkHubSourceOwnedHistory({ events }: { events: WorkHubSourceHistoryEvent[] }) {
  const { t } = useTranslation('work');
  const key = 'workHub.sourceOwned.history';
  return (
    <WorkSourceDetailSection
      title={t(`${key}.title`)}
      description={t(`${key}.description`)}
      icon={History}
    >
      {events.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t(`${key}.empty`)}
        </Typography>
      ) : (
        <Stack component="ol" gap={2} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {events.map((event) => (
            <Box
              component="li"
              key={event.id}
              sx={{
                minWidth: 0,
                borderInlineStart: 2,
                borderColor: 'divider',
                pl: 1.5,
                overflowWrap: 'anywhere',
              }}
            >
              <Typography component="h4" variant="subtitle2">
                {t(`${key}.events.${event.event}`)}
              </Typography>
              <Typography
                component="time"
                dateTime={event.occurredAt}
                variant="caption"
                color="text.secondary"
              >
                {formatDate(event.occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}
              </Typography>
              <Box
                component="dl"
                sx={{
                  m: 0,
                  mt: 0.75,
                  display: 'grid',
                  gridTemplateColumns: 'max-content minmax(0, 1fr)',
                  columnGap: 1,
                  rowGap: 0.5,
                }}
              >
                <Typography component="dt" variant="caption" color="text.secondary">
                  {t(`${key}.actor`)}
                </Typography>
                <Typography component="dd" variant="caption" sx={{ m: 0 }}>
                  {event.actorName || t(`${key}.actors.${event.actor}`)}
                  {event.delegated ? ` · ${t(`${key}.delegated`)}` : ''}
                </Typography>
                {(event.stepName || event.stepSequence) && (
                  <>
                    <Typography component="dt" variant="caption" color="text.secondary">
                      {t(`${key}.step`)}
                    </Typography>
                    <Typography component="dd" variant="caption" sx={{ m: 0 }}>
                      {event.stepSequence
                        ? t(`${key}.stepNumber`, { count: event.stepSequence })
                        : ''}
                      {event.stepSequence && event.stepName ? ' · ' : ''}
                      {event.stepName}
                    </Typography>
                  </>
                )}
                {(event.outcome || event.status) && (
                  <>
                    <Typography component="dt" variant="caption" color="text.secondary">
                      {t(`${key}.result`)}
                    </Typography>
                    <Typography component="dd" variant="caption" sx={{ m: 0 }}>
                      {event.status
                        ? t(`${key}.statuses.${event.status}`)
                        : t(`${key}.outcomes.${event.outcome}`)}
                    </Typography>
                  </>
                )}
              </Box>
              {event.message && (
                <Typography
                  variant="body2"
                  sx={{ mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {event.message}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </WorkSourceDetailSection>
  );
}
