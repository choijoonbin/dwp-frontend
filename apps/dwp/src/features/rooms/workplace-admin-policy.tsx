import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Armchair, CalendarRange, Clock3, Save, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getWorkplacePolicy, updateWorkplacePolicy, useToast } from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, PageCanvas, TimePickerField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { RoomsPageHeading } from './rooms-ui';

import type { WorkplacePolicy } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

function PolicySection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        p: { xs: 1.5, md: 2.25 },
      }}
    >
      <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 2 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'var(--dwp-product-soft)',
            color: 'var(--dwp-product-accent)',
          }}
        >
          <Icon size={18} />
        </Box>
        <Typography component="h2" variant="h6" fontWeight={750}>
          {title}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

function timeInMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function WorkplaceAdminPolicy() {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['workplace', 'admin', 'policy'],
    queryFn: getWorkplacePolicy,
    staleTime: 30_000,
    retry: 1,
  });
  const [form, setForm] = useState<WorkplacePolicy | null>(null);
  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);
  const patch = <K extends keyof WorkplacePolicy>(key: K, value: WorkplacePolicy[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));
  const patchBookingWindow = (days: number) =>
    setForm((current) =>
      current
        ? {
            ...current,
            bookingWindowDays: days,
            maximumConsecutiveDays: Math.min(current.maximumConsecutiveDays, days),
          }
        : current
    );
  const dirty = Boolean(form && query.data && JSON.stringify(form) !== JSON.stringify(query.data));
  const valid = Boolean(
    form &&
    form.bookingWindowDays >= 1 &&
    form.bookingWindowDays <= 365 &&
    form.maximumActiveBookings >= 1 &&
    form.maximumActiveBookings <= 100 &&
    form.maximumConsecutiveDays >= 1 &&
    form.maximumConsecutiveDays <= 31 &&
    form.maximumConsecutiveDays <= form.bookingWindowDays &&
    form.minimumBookingMinutes >= 15 &&
    form.minimumBookingMinutes <= 1440 &&
    form.maximumBookingMinutes >= form.minimumBookingMinutes &&
    form.maximumBookingMinutes <= 10080 &&
    timeInMinutes(form.workingDayStart) < timeInMinutes(form.workingDayEnd) &&
    form.checkInLeadMinutes >= 0 &&
    form.checkInLeadMinutes <= 240 &&
    form.autoReleaseMinutes >= 0 &&
    form.autoReleaseMinutes <= 240
  );
  const mutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error(t('workplace.admin.policy.loadError'));
      return updateWorkplacePolicy(form);
    },
    onSuccess: async (saved) => {
      setForm(saved);
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t('workplace.admin.policy.saved'));
    },
    onError: () => toast.error(t('workplace.admin.policy.saveError')),
  });

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.admin.policy.eyebrow')}
        title={t('workplace.admin.policy.title')}
        description={t('workplace.admin.policy.description')}
        actions={
          <ActionButton
            intent="primary"
            startIcon={<Save size={17} />}
            disabled={!dirty || !valid}
            loading={mutation.isPending}
            loadingLabel={t('actions.saving')}
            onClick={() => mutation.mutate()}
          >
            {t('actions.save')}
          </ActionButton>
        }
      />
      {query.isLoading && <Skeleton variant="rectangular" height={560} />}
      {query.isError && (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.admin.policy.loadError')}
        </Alert>
      )}
      {form && (
        <Stack spacing={1.5}>
          {!valid && (
            <Alert severity="warning">{t('workplace.admin.policy.validationError')}</Alert>
          )}
          <PolicySection
            icon={CalendarRange}
            title={t('workplace.admin.policy.bookingWindowTitle')}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('workplace.admin.policy.bookingWindowHint')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={form.bookingWindowDays}
              onChange={(_, value: number | null) => value && patchBookingWindow(value)}
              size="small"
              sx={{ flexWrap: 'wrap' }}
            >
              {[7, 14, 30, 60, 90].map((days) => (
                <ToggleButton key={days} value={days}>
                  {t('workplace.admin.policy.days', { count: days })}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Box sx={{ mt: 2, maxWidth: 420 }}>
              <FormField
                type="number"
                label={t('workplace.admin.policy.activeLimit')}
                value={form.maximumActiveBookings}
                onChange={(event) => patch('maximumActiveBookings', Number(event.target.value))}
                inputProps={{ min: 1, max: 100 }}
              />
            </Box>
          </PolicySection>

          <PolicySection icon={Armchair} title={t('workplace.admin.policy.fixedSeatTitle')}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.allowAssignedDeskLending}
                  onChange={(_, value) => patch('allowAssignedDeskLending', value)}
                />
              }
              label={t('workplace.admin.policy.allowAssignedDeskLending')}
            />
            <Typography variant="body2" color="text.secondary">
              {t('workplace.admin.policy.allowAssignedDeskLendingHint')}
            </Typography>
          </PolicySection>

          <PolicySection icon={Clock3} title={t('workplace.admin.policy.hoursTitle')}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
                gap: 1.5,
              }}
            >
              <TimePickerField
                label={t('workplace.admin.policy.workingStart')}
                value={form.workingDayStart}
                onValueChange={(value) => value && patch('workingDayStart', value)}
              />
              <TimePickerField
                label={t('workplace.admin.policy.workingEnd')}
                value={form.workingDayEnd}
                onValueChange={(value) => value && patch('workingDayEnd', value)}
              />
              <FormField
                type="number"
                label={t('workplace.admin.policy.minimumMinutes')}
                value={form.minimumBookingMinutes}
                onChange={(event) => patch('minimumBookingMinutes', Number(event.target.value))}
                inputProps={{ min: 15, max: 1440, step: 15 }}
              />
              <FormField
                type="number"
                label={t('workplace.admin.policy.maximumMinutes')}
                value={form.maximumBookingMinutes}
                onChange={(event) => patch('maximumBookingMinutes', Number(event.target.value))}
                inputProps={{ min: 15, max: 10080, step: 15 }}
              />
            </Box>
          </PolicySection>

          <PolicySection icon={UserRoundCheck} title={t('workplace.admin.policy.arrivalTitle')}>
            <Stack gap={1.25}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.requireCheckIn}
                    onChange={(_, value) => patch('requireCheckIn', value)}
                  />
                }
                label={t('workplace.admin.policy.requireCheckIn')}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                <FormField
                  type="number"
                  disabled={!form.requireCheckIn}
                  label={t('workplace.admin.policy.checkInLead')}
                  value={form.checkInLeadMinutes}
                  onChange={(event) => patch('checkInLeadMinutes', Number(event.target.value))}
                  inputProps={{ min: 0, max: 240 }}
                />
                <FormField
                  type="number"
                  disabled={!form.requireCheckIn}
                  label={t('workplace.admin.policy.autoRelease')}
                  value={form.autoReleaseMinutes}
                  onChange={(event) => patch('autoReleaseMinutes', Number(event.target.value))}
                  inputProps={{ min: 0, max: 240 }}
                />
              </Box>
            </Stack>
          </PolicySection>

          <PolicySection icon={ShieldCheck} title={t('workplace.admin.policy.privacyTitle')}>
            <Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.showColleagueNames}
                    onChange={(_, value) => patch('showColleagueNames', value)}
                  />
                }
                label={t('workplace.admin.policy.showNames')}
              />
            </Stack>
          </PolicySection>
        </Stack>
      )}
    </PageCanvas>
  );
}
