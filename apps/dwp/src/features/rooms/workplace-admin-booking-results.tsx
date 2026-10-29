import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { useTranslation } from 'react-i18next';
import { Ban, CalendarRange, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { OperationsPagination, ResultSkeleton } from './workplace-operations-ui';

import type {
  WorkplaceAdminBooking,
  WorkplaceAdminBookingPage,
  WorkplaceBookingStatus,
} from '@dwp-frontend/shared-utils';

export function canForceCancelBooking(status: WorkplaceBookingStatus) {
  return status === 'RESERVED' || status === 'CHECKED_IN';
}

function statusColor(status: WorkplaceBookingStatus) {
  if (status === 'RESERVED') return 'info';
  if (status === 'CHECKED_IN') return 'success';
  if (status === 'NO_SHOW') return 'warning';
  if (status === 'CANCELLED') return 'error';
  return 'default';
}

export function BookingResults({
  data,
  loading,
  mobile,
  canManage,
  actionsEnabled,
  page,
  size,
  formatInstant,
  onPage,
  onSize,
  onReview,
  onCancel,
  onLegalHold,
}: {
  data?: WorkplaceAdminBookingPage;
  loading: boolean;
  mobile: boolean;
  canManage: boolean;
  actionsEnabled: boolean;
  page: number;
  size: number;
  formatInstant: (value: string) => string;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  onReview: (booking: WorkplaceAdminBooking) => void;
  onCancel: (booking: WorkplaceAdminBooking) => void;
  onLegalHold: (booking: WorkplaceAdminBooking) => void;
}) {
  const { t } = useTranslation('rooms');
  if (loading && !data) return <ResultSkeleton />;
  if (!data?.content.length) {
    return (
      <EmptyState
        size="standard"
        icon={<CalendarRange size={28} />}
        title={t('workplace.admin.operations.bookings.empty')}
        description={t('workplace.admin.operations.bookings.emptyDescription')}
      />
    );
  }
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control + 'px',
        overflow: 'hidden',
      }}
    >
      {mobile ? (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {data.content.map((booking) => (
            <Box key={booking.bookingId} sx={{ p: 2, minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={foundationTokens.home.typography.weightEmphasis}>
                    {booking.resourceName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {booking.siteName} · {booking.floorName}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  color={statusColor(booking.status)}
                  label={t(`workplace.bookingStatus.${booking.status}`)}
                />
              </Stack>
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                {booking.bookedForDisplayName} · #{booking.userId}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {formatInstant(booking.startsAt)} - {formatInstant(booking.endsAt)}
              </Typography>
              {booking.legalHold && (
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  icon={<ShieldCheck size={14} />}
                  label={t('workplace.admin.operations.bookings.legalHold')}
                  sx={{ mt: 1 }}
                />
              )}
              {booking.purpose && (
                <Typography variant="body2" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                  {booking.purpose}
                </Typography>
              )}
              <ActionButton
                intent="secondary"
                disabled={!actionsEnabled || !booking.siteId || !booking.floorId}
                onClick={() => onReview(booking)}
                sx={{ mt: 1 }}
              >
                {t('workplace.experience.review')}
              </ActionButton>
              {canManage && canForceCancelBooking(booking.status) && (
                <ActionButton
                  intent="danger"
                  startIcon={<Ban size={16} />}
                  onClick={() => onCancel(booking)}
                  disabled={!actionsEnabled}
                  sx={{ mt: 1.5 }}
                >
                  {t('workplace.admin.operations.bookings.forceCancel')}
                </ActionButton>
              )}
              {canManage && !booking.anonymizedAt && (
                <ActionButton
                  intent="quiet"
                  startIcon={<ShieldCheck size={16} />}
                  onClick={() => onLegalHold(booking)}
                  disabled={!actionsEnabled}
                  sx={{ mt: 1.5, ml: canForceCancelBooking(booking.status) ? 1 : 0 }}
                >
                  {t(
                    booking.legalHold
                      ? 'workplace.admin.operations.bookings.releaseLegalHold'
                      : 'workplace.admin.operations.bookings.applyLegalHold'
                  )}
                </ActionButton>
              )}
            </Box>
          ))}
        </Stack>
      ) : (
        <TableContainer>
          <Table size="small" aria-label={t('workplace.admin.operations.bookings.tableLabel')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('workplace.admin.operations.bookings.resource')}</TableCell>
                <TableCell>{t('workplace.admin.operations.bookings.user')}</TableCell>
                <TableCell>{t('workplace.admin.operations.bookings.period')}</TableCell>
                <TableCell>{t('workplace.admin.operations.bookings.status')}</TableCell>
                {canManage && (
                  <TableCell align="right">
                    {t('workplace.admin.operations.bookings.action')}
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.content.map((booking) => (
                <TableRow key={booking.bookingId} hover>
                  <TableCell>
                    <Typography
                      variant="body2"
                      fontWeight={foundationTokens.home.typography.weightEmphasis}
                    >
                      <ActionButton
                        intent="quiet"
                        disabled={!actionsEnabled || !booking.siteId || !booking.floorId}
                        onClick={() => onReview(booking)}
                        sx={{ px: 0, justifyContent: 'start', textAlign: 'left' }}
                      >
                        {booking.resourceName}
                      </ActionButton>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {booking.siteName} · {booking.floorName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{booking.bookedForDisplayName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      #{booking.userId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatInstant(booking.startsAt)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('workplace.admin.operations.bookings.until', {
                        time: formatInstant(booking.endsAt),
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={statusColor(booking.status)}
                      label={t(`workplace.bookingStatus.${booking.status}`)}
                    />
                    {booking.legalHold && (
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={t('workplace.admin.operations.bookings.legalHold')}
                        sx={{ ml: 0.75 }}
                      />
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <Stack direction="row" gap={0.75} justifyContent="flex-end">
                        {canForceCancelBooking(booking.status) && (
                          <ActionButton
                            intent="danger"
                            disabled={!actionsEnabled}
                            onClick={() => onCancel(booking)}
                          >
                            {t('workplace.admin.operations.bookings.forceCancel')}
                          </ActionButton>
                        )}
                        {!booking.anonymizedAt && (
                          <ActionIconButton
                            label={t(
                              booking.legalHold
                                ? 'workplace.admin.operations.bookings.releaseLegalHold'
                                : 'workplace.admin.operations.bookings.applyLegalHold'
                            )}
                            disabled={!actionsEnabled}
                            onClick={() => onLegalHold(booking)}
                          >
                            <ShieldCheck size={16} />
                          </ActionIconButton>
                        )}
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <OperationsPagination
        count={data.totalElements}
        page={page}
        size={size}
        onPage={onPage}
        onSize={onSize}
      />
    </Box>
  );
}
