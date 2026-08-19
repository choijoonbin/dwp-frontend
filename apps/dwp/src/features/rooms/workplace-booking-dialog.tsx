import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, Eye, MapPin, ShieldCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWorkplaceBooking, useToast } from '@dwp-frontend/shared-utils';
import {
  DateTimePickerField,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { validateWorkplaceBookingRange } from './workplace-time-policy';

import type {
  WorkplaceBooking,
  WorkplacePolicy,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function WorkplaceBookingDialog({
  open,
  resource,
  siteName,
  floorName,
  siteTimeZone,
  serverNow,
  policy,
  initialStart,
  initialEnd,
  onClose,
  onSaved,
}: {
  open: boolean;
  resource: WorkplaceResource | null;
  siteName: string;
  floorName: string;
  siteTimeZone: string;
  serverNow: string;
  policy: WorkplacePolicy | null;
  initialStart: string;
  initialEnd: string;
  onClose: () => void;
  onSaved?: (booking: WorkplaceBooking) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [startsAt, setStartsAt] = useState(initialStart);
  const [endsAt, setEndsAt] = useState(initialEnd);
  const [purpose, setPurpose] = useState('');
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!open) return;
    setStartsAt(initialStart);
    setEndsAt(initialEnd);
    setPurpose('');
    setVisible(true);
  }, [initialEnd, initialStart, open, resource?.resourceId]);

  const rangeError =
    !startsAt || !endsAt || !policy
      ? 'invalid'
      : validateWorkplaceBookingRange(startsAt, endsAt, siteTimeZone, policy, serverNow);
  const mutation = useMutation({
    mutationFn: () => {
      if (!resource) throw new Error(t('workplace.booking.resourceRequired'));
      return createWorkplaceBooking({
        resourceId: resource.resourceId,
        startsAt,
        endsAt,
        purpose: purpose.trim(),
        visibleToColleagues: visible,
      });
    },
    onSuccess: async (booking) => {
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t('workplace.booking.created'));
      onSaved?.(booking);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, t('workplace.booking.saveError'))),
  });

  return (
    <FormDialog
      open={open}
      title={t('workplace.booking.title')}
      description={t('workplace.booking.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.book')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!resource || Boolean(rangeError)}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      maxWidth="sm"
    >
      <Stack spacing={2}>
        {resource && (
          <Box
            sx={{
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'var(--dwp-product-soft)',
            }}
          >
            <Stack direction="row" justifyContent="space-between" gap={1.5}>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={750}>{resource.name}</Typography>
                <Stack direction="row" gap={0.6} alignItems="center" sx={{ mt: 0.35 }}>
                  <MapPin size={14} />
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {siteName} · {floorName} · {resource.neighborhood}
                  </Typography>
                </Stack>
              </Box>
              <Chip size="small" label={t(`workplace.resourceTypes.${resource.type}`)} />
            </Stack>
          </Box>
        )}

        <DwpDateTimeProvider locale={i18n.resolvedLanguage} timeZone={siteTimeZone}>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}
          >
            <DateTimePickerField
              required
              label={t('workplace.booking.start')}
              value={startsAt}
              onValueChange={(value) => value && setStartsAt(value)}
              supportingText={siteTimeZone}
            />
            <DateTimePickerField
              required
              label={t('workplace.booking.end')}
              value={endsAt}
              onValueChange={(value) => value && setEndsAt(value)}
              errorMessage={
                rangeError ? t(`workplace.booking.rangeErrors.${rangeError}`) : undefined
              }
            />
          </Box>
        </DwpDateTimeProvider>
        <FormField
          label={t('workplace.booking.purpose')}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          inputProps={{ maxLength: 500 }}
        />
        <FormControlLabel
          control={<Switch checked={visible} onChange={(_, checked) => setVisible(checked)} />}
          label={
            <Stack direction="row" gap={0.8} alignItems="center">
              <Eye size={16} />
              <Typography variant="body2">{t('workplace.booking.visible')}</Typography>
            </Stack>
          }
        />
        <Alert severity="info" icon={<ShieldCheck size={18} />}>
          <Stack gap={0.35}>
            <Typography variant="body2">
              {policy
                ? t('workplace.booking.policySummary', {
                    minimum: policy.minimumBookingMinutes,
                    maximum: policy.maximumBookingMinutes,
                    start: policy.workingDayStart.slice(0, 5),
                    end: policy.workingDayEnd.slice(0, 5),
                    days: policy.bookingWindowDays,
                  })
                : t('workplace.booking.policyNotice')}
            </Typography>
            {policy?.requireCheckIn && (
              <Stack direction="row" gap={0.6} alignItems="center">
                <Clock3 size={14} />
                <Typography variant="caption">
                  {t('workplace.booking.autoReleaseSummary', {
                    lead: policy.checkInLeadMinutes,
                    release: policy.autoReleaseMinutes,
                  })}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Alert>
      </Stack>
    </FormDialog>
  );
}
