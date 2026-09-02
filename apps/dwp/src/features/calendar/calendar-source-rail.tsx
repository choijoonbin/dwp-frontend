import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Building2, ChevronLeft, Layers3, LockKeyhole, Star, Users } from 'lucide-react';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  calendarCanChangeSelection,
  calendarCanManageSharing,
  calendarIsRequired,
  groupCalendarSources,
  type CalendarSourceGroupKey,
} from './calendar-source-model';

import type { CalendarSummary } from '@dwp-frontend/shared-utils';

type CalendarSourcePanelProps = Readonly<{
  calendars: readonly CalendarSummary[];
  selectedCalendarIds: readonly string[];
  date: Date;
  loading: boolean;
  error: boolean;
  busy?: boolean;
  onDateChange: (date: Date) => void;
  onSelectionChange: (calendar: CalendarSummary, selected: boolean) => void;
  onFavoriteChange: (calendar: CalendarSummary, favorite: boolean) => void;
  onManageSharing: (calendar: CalendarSummary) => void;
  onRetry: () => void;
}>;

type CalendarSourcePickerProps = CalendarSourcePanelProps &
  Readonly<{
    open: boolean;
    mobile: boolean;
    onClose: () => void;
  }>;

function groupIcon(group: CalendarSourceGroupKey) {
  return group === 'company' ? <Building2 size={14} /> : <Layers3 size={14} />;
}

function CalendarSourceRow({
  calendar,
  selected,
  busy,
  onSelectionChange,
  onFavoriteChange,
  onManageSharing,
}: Readonly<{
  calendar: CalendarSummary;
  selected: boolean;
  busy: boolean;
  onSelectionChange: CalendarSourcePanelProps['onSelectionChange'];
  onFavoriteChange: CalendarSourcePanelProps['onFavoriteChange'];
  onManageSharing: CalendarSourcePanelProps['onManageSharing'];
}>) {
  const { t } = useTranslation('calendar');
  const required = calendarIsRequired(calendar);
  const canDeselect = calendarCanChangeSelection(calendar, false);
  const canShare = calendarCanManageSharing(calendar);
  const owner = calendar.sourceKind === 'SHARED' ? calendar.ownerDisplayName : null;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.25}
      sx={{ minHeight: 42, borderRadius: 1, px: 0.25, '&:hover': { bgcolor: 'action.hover' } }}
    >
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={required || selected}
            disabled={busy || (selected && !canDeselect)}
            onChange={(_, checked) => onSelectionChange(calendar, checked)}
            inputProps={{
              'aria-describedby': required ? `${calendar.calendarId}-policy` : undefined,
            }}
            sx={{
              color: calendar.color,
              '&.Mui-checked': { color: calendar.color },
              '@media (forced-colors: active)': {
                color: 'CanvasText',
                '&.Mui-checked': { color: 'Highlight' },
              },
            }}
          />
        }
        label={
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Typography variant="body2" noWrap title={calendar.name} sx={{ fontWeight: 600 }}>
                {calendar.name}
              </Typography>
              {required && (
                <Chip
                  id={`${calendar.calendarId}-policy`}
                  size="small"
                  icon={<LockKeyhole size={11} />}
                  label={t('sources.required')}
                  variant="outlined"
                  sx={{ height: 20, '& .MuiChip-label': { px: 0.65, fontSize: '0.66rem' } }}
                />
              )}
            </Stack>
            {(owner || calendar.accessLevel) && (
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                component="div"
                title={
                  owner ?? t(`sources.access.${calendar.accessLevel}`, calendar.accessLevel ?? '')
                }
              >
                {owner ?? t(`sources.access.${calendar.accessLevel}`, calendar.accessLevel ?? '')}
              </Typography>
            )}
          </Box>
        }
        sx={{ mx: 0, minWidth: 0, flex: 1, '& .MuiFormControlLabel-label': { minWidth: 0 } }}
      />
      {canShare && (
        <ActionIconButton
          size="small"
          label={t('sources.manageSharingFor', { name: calendar.name })}
          onClick={() => onManageSharing(calendar)}
          disabled={busy}
        >
          <Users size={16} />
        </ActionIconButton>
      )}
      <ActionIconButton
        size="small"
        label={
          calendar.favorite
            ? t('sources.removeFavoriteFor', { name: calendar.name })
            : t('sources.addFavoriteFor', { name: calendar.name })
        }
        intent={calendar.favorite ? 'primary' : 'default'}
        onClick={() => onFavoriteChange(calendar, !calendar.favorite)}
        disabled={busy}
      >
        <Star size={16} fill={calendar.favorite ? 'currentColor' : 'none'} />
      </ActionIconButton>
    </Stack>
  );
}

export function CalendarSourcePanel(props: CalendarSourcePanelProps) {
  const { t } = useTranslation('calendar');
  const groups = groupCalendarSources(props.calendars);

  return (
    <Stack sx={{ minHeight: 0, height: 1 }}>
      <DateCalendar
        value={dayjs(props.date)}
        onChange={(value) => value && props.onDateChange(value.toDate())}
        sx={{ width: 1, '& .MuiPickersCalendarHeader-root': { px: 1 } }}
      />
      <Divider />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1, py: 1.5 }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Layers3 size={15} />
          <Typography variant="overline" color="text.secondary">
            {t('sources.title')}
          </Typography>
        </Stack>
        <Chip size="small" label={props.selectedCalendarIds.length} />
      </Stack>

      {props.error ? (
        <Alert
          severity="error"
          sx={{ mx: 1 }}
          action={
            <ActionButton intent="quiet" size="small" onClick={props.onRetry}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('sources.loadError')}
        </Alert>
      ) : (
        <Box sx={{ minHeight: 0, overflowY: 'auto', px: 0.75, pb: 2 }}>
          {props.loading ? (
            Array.from({ length: 6 }, (_, index) => <Skeleton key={index} height={42} />)
          ) : groups.length ? (
            groups.map((group) => (
              <Box
                component="section"
                key={group.key}
                aria-labelledby={`source-group-${group.key}`}
                sx={{ mb: 1.5 }}
              >
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1, py: 0.5 }}>
                  {groupIcon(group.key)}
                  <Typography
                    id={`source-group-${group.key}`}
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 700, letterSpacing: '0.02em' }}
                  >
                    {t(`sources.groups.${group.key}`)}
                  </Typography>
                </Stack>
                {group.calendars.map((calendar) => (
                  <CalendarSourceRow
                    key={calendar.calendarId}
                    calendar={calendar}
                    selected={props.selectedCalendarIds.includes(calendar.calendarId)}
                    busy={props.busy === true}
                    onSelectionChange={props.onSelectionChange}
                    onFavoriteChange={props.onFavoriteChange}
                    onManageSharing={props.onManageSharing}
                  />
                ))}
              </Box>
            ))
          ) : (
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle2">{t('sources.emptyTitle')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('sources.emptyDescription')}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Stack>
  );
}

export function CalendarSourcePicker({
  open,
  mobile,
  onClose,
  ...panelProps
}: CalendarSourcePickerProps) {
  const { t } = useTranslation('calendar');
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Drawer
      open={open}
      anchor="left"
      onClose={onClose}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': titleId,
          'aria-describedby': descriptionId,
          sx: {
            width: mobile ? '100%' : 360,
            maxWidth: '100%',
            height: '100dvh',
            borderRightColor: 'divider',
          },
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ minHeight: 64, px: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <ActionIconButton label={t('sources.closePicker')} onClick={onClose}>
          <ChevronLeft size={19} />
        </ActionIconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography id={titleId} variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t('sources.pickerTitle')}
          </Typography>
          <Typography id={descriptionId} variant="caption" color="text.secondary">
            {t('sources.pickerDescription')}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ minHeight: 0, flex: 1 }}>
        <CalendarSourcePanel {...panelProps} />
      </Box>
      <Stack
        direction="row"
        justifyContent="flex-end"
        sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}
      >
        <ActionButton intent="primary" onClick={onClose}>
          {t('actions.done')}
        </ActionButton>
      </Stack>
    </Drawer>
  );
}
