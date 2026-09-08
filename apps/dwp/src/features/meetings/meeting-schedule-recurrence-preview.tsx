import { useTranslation } from 'react-i18next';
import { ErrorState, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type { VideoMeetingSeriesPreview } from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

/** Review the exact server calendar projection again whenever the authored rule changes. */
export function MeetingScheduleRecurrencePreview({
  previewing,
  failed,
  preview,
  reviewed,
  timeZone,
  onRetry,
  onReviewed,
}: {
  previewing: boolean;
  failed: boolean;
  preview: VideoMeetingSeriesPreview | null;
  reviewed: boolean;
  timeZone: string;
  onRetry: () => void;
  onReviewed: (value: boolean) => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  return (
    <Box aria-live="polite">
      {previewing ? (
        <LoadingState label={t('scheduleWorkspace.previewingRecurrence')} />
      ) : failed ? (
        <ErrorState
          title={t('scheduleWorkspace.recurrencePreviewError')}
          retryLabel={t('actions.retry')}
          onRetry={onRetry}
        />
      ) : preview ? (
        <Stack gap={1.5}>
          {preview.hasCalendarAdjustments && (
            <InlineFeedback severity="warning">
              {t('scheduleWorkspace.calendarAdjustments')}
            </InlineFeedback>
          )}
          <Stack component="ol" gap={1} sx={{ m: 0, pl: 2.5, maxHeight: 240, overflowY: 'auto' }}>
            {preview.occurrences.map((occurrence) => (
              <Typography component="li" variant="caption" key={occurrence.occurrenceIndex}>
                {formatDate(
                  occurrence.startsAt,
                  { dateStyle: 'medium', timeStyle: 'short', timeZone },
                  resolveSupportedLocale(i18n.language)
                )}
                {occurrence.adjustment !== 'NONE'
                  ? ' · ' + t('scheduleWorkspace.adjustments.' + occurrence.adjustment)
                  : ''}
              </Typography>
            ))}
          </Stack>
          <FormControlLabel
            control={<Checkbox checked={reviewed} onChange={(_, value) => onReviewed(value)} />}
            label={t('scheduleWorkspace.confirmRecurrencePreview')}
          />
        </Stack>
      ) : null}
    </Box>
  );
}
