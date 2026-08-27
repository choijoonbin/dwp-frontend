import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck2, Check, X } from 'lucide-react';
import { ActionButton, ActionIconButton, EmptyState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { calendarDate, calendarTime } from './calendar-components';
import { CalendarSectionHeader } from './calendar-experience';

import type { CalendarBooking } from '@dwp-frontend/shared-utils';

type CalendarBookingDecision = 'APPROVE' | 'DECLINE';

export function CalendarAdminBookingInbox({
  bookings,
  canDecide,
  language,
  onDecide,
}: {
  bookings: readonly CalendarBooking[];
  canDecide: boolean;
  language: string;
  onDecide: (booking: CalendarBooking, decision: CalendarBookingDecision) => void;
}) {
  const { t } = useTranslation('calendar');
  const [visibleCount, setVisibleCount] = useState(10);
  const visibleBookings = bookings.slice(0, visibleCount);
  const remainingCount = Math.max(0, bookings.length - visibleCount);

  return (
    <Box
      component="section"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <CalendarSectionHeader
        icon={CalendarCheck2}
        title={t('admin.pending.title')}
        description={t('admin.pending.description')}
        action={
          <Chip
            size="small"
            variant="outlined"
            color={bookings.length ? 'warning' : 'success'}
            label={t('admin.pending.count', { count: bookings.length })}
          />
        }
      />
      <Divider />
      {bookings.length ? (
        <>
          <Stack divider={<Divider flexItem />} sx={{ display: { xs: 'flex', md: 'none' } }}>
            {visibleBookings.map((booking) => (
              <Box
                component="article"
                aria-label={booking.resourceName}
                key={booking.bookingId}
                sx={{ p: 2 }}
              >
                <Typography component="h3" variant="subtitle2" fontWeight={600}>
                  {booking.resourceName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {booking.eventTitle}
                </Typography>
                <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {t('admin.pending.schedule')}
                    </Typography>
                    <Typography variant="body2">
                      {calendarDate(booking.startsAt, language)} ·{' '}
                      {calendarTime(booking.startsAt, language)} –{' '}
                      {calendarTime(booking.endsAt, language)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {t('admin.pending.requester')}
                    </Typography>
                    <Typography variant="body2">{booking.organizerName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {booking.organizerEmail ?? t('admin.pending.internal')}
                    </Typography>
                  </Box>
                </Stack>
                {canDecide ? (
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <ActionButton
                      fullWidth
                      size="small"
                      intent="primary"
                      startIcon={<Check size={16} />}
                      onClick={() => onDecide(booking, 'APPROVE')}
                    >
                      {t('admin.pending.approve')}
                    </ActionButton>
                    <ActionButton
                      fullWidth
                      size="small"
                      intent="secondary"
                      startIcon={<X size={16} />}
                      onClick={() => onDecide(booking, 'DECLINE')}
                    >
                      {t('admin.pending.decline')}
                    </ActionButton>
                  </Stack>
                ) : (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t('admin.readOnly')}
                    sx={{ mt: 1.5 }}
                  />
                )}
              </Box>
            ))}
          </Stack>

          <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table size="small" aria-label={t('admin.pending.title')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.pending.resource')}</TableCell>
                  <TableCell>{t('admin.pending.schedule')}</TableCell>
                  <TableCell>{t('admin.pending.requester')}</TableCell>
                  <TableCell align="right">{t('admin.pending.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleBookings.map((booking) => (
                  <TableRow key={booking.bookingId} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {booking.resourceName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {booking.eventTitle}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {calendarDate(booking.startsAt, language)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {calendarTime(booking.startsAt, language)} –{' '}
                        {calendarTime(booking.endsAt, language)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{booking.organizerName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {booking.organizerEmail ?? t('admin.pending.internal')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {canDecide ? (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <ActionIconButton
                            label={t('admin.pending.approveFor', {
                              resource: booking.resourceName,
                            })}
                            intent="primary"
                            onClick={() => onDecide(booking, 'APPROVE')}
                          >
                            <Check size={17} />
                          </ActionIconButton>
                          <ActionIconButton
                            label={t('admin.pending.declineFor', {
                              resource: booking.resourceName,
                            })}
                            onClick={() => onDecide(booking, 'DECLINE')}
                          >
                            <X size={17} />
                          </ActionIconButton>
                        </Stack>
                      ) : (
                        <Chip size="small" variant="outlined" label={t('admin.readOnly')} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {remainingCount > 0 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                p: 1.5,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <ActionButton intent="quiet" onClick={() => setVisibleCount((count) => count + 10)}>
                {t('admin.pending.showMore', { count: remainingCount })}
              </ActionButton>
            </Box>
          )}
        </>
      ) : (
        <EmptyState
          title={t('admin.pending.emptyTitle')}
          description={t('admin.pending.emptyDescription')}
        />
      )}
    </Box>
  );
}
