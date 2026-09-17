import { useTranslation } from 'react-i18next';
import { CalendarDays, CheckCircle2, Info, Link2, LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  DateTimePickerField,
  FormField,
  foundationTokens,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { CalendarSummary } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { WorkHubItem } from './work-hub-contracts';

type Feedback = Readonly<{
  severity: 'success' | 'warning' | 'error' | 'info';
  key: string;
}> | null;

type ReadinessState = 'preparing' | 'checking' | 'attention' | 'completed' | 'ready';

export function WorkHubScheduleDialogContent({
  item,
  plannedForToday,
  calendarsError,
  calendarsPending,
  editable,
  feedback,
  invalidReceipt,
  discardingIntent,
  onDiscardIntent,
  error,
  blockedIntent,
  calendarId,
  onCalendarChange,
  title,
  onTitleChange,
  busy,
  draftLocked,
  startsAt,
  onStartsAtChange,
  endsAt,
  onEndsAtChange,
  invalidRange,
  durationMinutes,
  timeZone,
  readinessState,
}: {
  item: WorkHubItem;
  plannedForToday: boolean;
  calendarsError: boolean;
  calendarsPending: boolean;
  editable: readonly CalendarSummary[];
  feedback: Feedback;
  invalidReceipt: boolean;
  discardingIntent: boolean;
  onDiscardIntent: () => void;
  error: string | null;
  blockedIntent: boolean;
  calendarId: string;
  onCalendarChange: (calendarId: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  busy: boolean;
  draftLocked: boolean;
  startsAt: string | null;
  onStartsAtChange: (startsAt: string | null) => void;
  endsAt: string | null;
  onEndsAtChange: (endsAt: string | null) => void;
  invalidRange: boolean;
  durationMinutes: number | null;
  timeZone: string;
  readinessState: ReadinessState;
}) {
  const { t } = useTranslation(['work', 'common']);
  const sourceLabel = t(`work:workHub.sources.${item.reference.sourceSystem}`, {
    defaultValue: t('work:workHub.sources.OTHER'),
  });
  const dueAt = item.dueAt ? Date.parse(item.dueAt) : Number.NaN;
  const dueLabel = Number.isFinite(dueAt)
    ? formatDate(item.dueAt!, { dateStyle: 'medium', timeStyle: 'short' })
    : t('work:workHub.schedule.noDueDate');
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'action.hover',
      borderRadius: foundationTokens.radius.surface + 'px',
      '& fieldset': { borderColor: 'transparent' },
      '&:hover fieldset': { borderColor: 'divider' },
      '&.Mui-focused': { bgcolor: 'background.paper' },
      '&.Mui-focused fieldset': { borderWidth: 2 },
    },
  } as const;

  return (
    <Stack gap={2}>
      <Box
        sx={(theme) => ({
          p: 2,
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.13 : 0.075),
          borderRadius: foundationTokens.radius.surface * 2 + 'px',
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.12),
          '@media (forced-colors: active)': { borderColor: 'CanvasText' },
        })}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" gap={0.75} alignItems="center" color="primary.main">
            <CheckCircle2 size={18} aria-hidden="true" />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 'fontWeightBold',
                letterSpacing: 'overline.letterSpacing',
                textTransform: 'uppercase',
              }}
            >
              {t('work:workHub.schedule.selectedWork')}
            </Typography>
          </Stack>
          {plannedForToday && (
            <Chip
              size="small"
              label={t('work:workHub.schedule.todayPlanPreserved')}
              sx={(theme) => ({
                bgcolor: alpha(theme.palette.primary.main, 0.09),
                color: 'text.secondary',
                fontWeight: 'fontWeightMedium',
              })}
            />
          )}
        </Stack>
        <Box sx={{ mt: 1, pl: { sm: 3 } }}>
          <Stack direction="row" gap={0.75} alignItems="baseline" flexWrap="wrap">
            {item.displayId && (
              <Typography
                variant="body2"
                sx={{ fontWeight: 'fontWeightBold', fontVariantNumeric: 'tabular-nums' }}
              >
                {item.displayId}
              </Typography>
            )}
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' }}
            >
              {item.title}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('work:workHub.schedule.workContext', {
              source: sourceLabel,
              due: dueLabel,
              status: t(`work:workHub.lifecycle.${item.lifecycle}`),
            })}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0.75,
            mt: 1.25,
            p: 1,
            borderRadius: foundationTokens.radius.surface + 'px',
            bgcolor: 'background.paper',
            color: 'text.secondary',
          }}
        >
          <ShieldCheck size={17} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 2 }} />
          <Typography variant="caption" sx={{ lineHeight: 'caption.lineHeight' }}>
            <Box component="strong" sx={{ color: 'text.primary' }}>
              {t('work:workHub.schedule.independenceTitle')}
            </Box>{' '}
            {t('work:workHub.schedule.independenceNotice')}
          </Typography>
        </Box>
      </Box>
      {calendarsError && (
        <InlineFeedback severity="warning">
          {t('work:workHub.schedule.calendarUnavailable')}
        </InlineFeedback>
      )}
      {!calendarsPending && !calendarsError && !editable.length && (
        <InlineFeedback severity="info">
          {t('work:workHub.schedule.noEditableCalendar')}
        </InlineFeedback>
      )}
      {feedback && (
        <InlineFeedback severity={feedback.severity}>
          <Stack gap={1} alignItems="flex-start">
            <span>
              {invalidReceipt
                ? t('work:workHub.schedule.invalidReceiptNeedsReview')
                : t(`work:workHub.schedule.results.${feedback.key}`)}
            </span>
            {invalidReceipt && (
              <ActionButton
                intent="quiet"
                size="small"
                disabled={discardingIntent}
                onClick={onDiscardIntent}
                sx={{ minHeight: 44 }}
              >
                {t('work:workHub.schedule.discardPreviousIntent')}
              </ActionButton>
            )}
          </Stack>
        </InlineFeedback>
      )}
      {error && (
        <InlineFeedback severity="error">
          <Stack gap={1} alignItems="flex-start">
            <span>{error}</span>
            {blockedIntent && (
              <ActionButton
                intent="quiet"
                size="small"
                disabled={discardingIntent}
                onClick={onDiscardIntent}
                sx={{ minHeight: 44 }}
              >
                {t('work:workHub.schedule.discardPreviousIntent')}
              </ActionButton>
            )}
          </Stack>
        </InlineFeedback>
      )}
      <SelectField
        label={t('work:workHub.schedule.calendar')}
        value={calendarId}
        onValueChange={(value) => onCalendarChange(String(value))}
        options={editable.map((calendar) => ({
          value: calendar.calendarId,
          label: calendar.name,
        }))}
        disabled={calendarsPending || busy || draftLocked}
        placeholder={t('work:workHub.schedule.chooseCalendar')}
        size="small"
        sx={fieldSx}
      />
      <FormField
        label={t('work:workHub.schedule.eventTitle')}
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        inputProps={{ maxLength: 300 }}
        supportingText={t('work:workHub.schedule.titleLength', { count: title.length })}
        disabled={busy || draftLocked}
        size="small"
        sx={fieldSx}
      />
      <Box>
        <Typography
          variant="caption"
          sx={{ display: 'block', mb: 0.75, fontWeight: 'fontWeightBold' }}
        >
          {durationMinutes
            ? t('work:workHub.schedule.reservationTime', { minutes: durationMinutes })
            : t('work:workHub.schedule.reservationTimeUnknown')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <DateTimePickerField
            label={t('work:workHub.schedule.startsAt')}
            value={startsAt}
            onValueChange={onStartsAtChange}
            disabled={busy || draftLocked}
            size="small"
            sx={fieldSx}
          />
          <DateTimePickerField
            label={t('work:workHub.schedule.endsAt')}
            value={endsAt}
            onValueChange={onEndsAtChange}
            errorMessage={invalidRange ? t('work:workHub.schedule.invalidRange') : undefined}
            disabled={busy || draftLocked}
            size="small"
            sx={fieldSx}
          />
        </Stack>
        <Stack
          direction="row"
          gap={0.75}
          alignItems="center"
          color="text.secondary"
          sx={{ mt: 0.75 }}
        >
          <CalendarDays size={15} aria-hidden="true" />
          <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {t('work:workHub.schedule.timeZone', { zone: timeZone })}
          </Typography>
        </Stack>
      </Box>
      <Box
        role="note"
        sx={(theme) => ({
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1,
          p: 1.25,
          borderRadius: foundationTokens.radius.surface + 'px',
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.065),
        })}
      >
        <Stack direction="row" gap={0.75} alignItems="flex-start">
          <Info size={17} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 1 }} />
          <Typography variant="caption" sx={{ lineHeight: 'caption.lineHeight' }}>
            {t('work:workHub.schedule.availabilityNotice')}
          </Typography>
        </Stack>
        <Chip
          size="small"
          label={t('work:workHub.schedule.referenceCandidate')}
          sx={{ flex: '0 0 auto' }}
        />
      </Box>
      <Box
        sx={(theme) => ({
          p: 2,
          borderRadius: foundationTokens.radius.surface * 2 + 'px',
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.13 : 0.07),
        })}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" gap={0.75} alignItems="center">
            <LockKeyhole size={17} color="currentColor" aria-hidden="true" />
            <Typography variant="body2" sx={{ fontWeight: 'fontWeightBold' }}>
              {t('work:workHub.schedule.privacyTitle')}
            </Typography>
          </Stack>
          <Chip
            size="small"
            color={calendarId ? 'success' : 'default'}
            label={
              calendarId
                ? t('work:workHub.schedule.personalCalendarConfirmed')
                : t('work:workHub.schedule.personalCalendarRequired')
            }
            sx={{ fontWeight: 'fontWeightBold' }}
          />
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.75, lineHeight: 'caption.lineHeight' }}
        >
          {t('work:workHub.schedule.privateScope')}
        </Typography>
        <Stack
          direction="row"
          gap={0.75}
          alignItems="flex-start"
          color="text.secondary"
          sx={{ mt: 1 }}
        >
          <Link2 size={16} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 1 }} />
          <Typography
            variant="caption"
            sx={{ fontWeight: 'fontWeightMedium', lineHeight: 'caption.lineHeight' }}
          >
            {t('work:workHub.schedule.privateReference')}
          </Typography>
        </Stack>
      </Box>
      <Box
        role="status"
        aria-live="polite"
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.25,
          py: 1,
          borderRadius: foundationTokens.radius.surface + 'px',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" gap={0.75} alignItems="flex-start">
          <Box
            aria-hidden="true"
            sx={{
              width: 10,
              height: 10,
              mt: 0.5,
              borderRadius: '50%',
              bgcolor:
                readinessState === 'ready' || readinessState === 'completed'
                  ? 'success.main'
                  : readinessState === 'attention'
                    ? 'warning.main'
                    : 'primary.main',
              '@media (forced-colors: active)': { border: '1px solid CanvasText' },
            }}
          />
          <Box>
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 'fontWeightBold' }}>
              {t(`work:workHub.schedule.readiness.${readinessState}.title`)}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', lineHeight: 'caption.lineHeight' }}
            >
              {t(`work:workHub.schedule.readiness.${readinessState}.description`)}
            </Typography>
          </Box>
        </Stack>
        <CheckCircle2
          size={19}
          aria-hidden="true"
          color="currentColor"
          style={{ flex: '0 0 auto' }}
        />
      </Box>
    </Stack>
  );
}
