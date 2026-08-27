import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck2, Clock3, Focus, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCalendarAdminOverview,
  updateCalendarPolicy,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ErrorState,
  FormField,
  SelectField,
  TimePickerField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AdminLoading, errorMessage, ScopeNotice } from './calendar-admin-support';
import { CalendarPageHeading } from './calendar-components';
import { CalendarCanvas, CalendarSectionHeader } from './calendar-experience';

import type { CalendarPolicy } from '@dwp-frontend/shared-utils';

export function CalendarAdminPolicies() {
  const { t } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['calendar', 'admin', 'overview'],
    queryFn: getCalendarAdminOverview,
    staleTime: 20_000,
    retry: 1,
  });
  const [form, setForm] = useState<CalendarPolicy | null>(null);
  const canManage = hasPermission('ADMIN.CALENDAR', 'MANAGE');

  useEffect(() => {
    if (query.data?.policy) setForm(query.data.policy);
  }, [query.data?.policy]);

  const valid = Boolean(
    form &&
    form.workingDayStart < form.workingDayEnd &&
    form.minimumEventMinutes <= form.defaultEventMinutes &&
    form.defaultEventMinutes <= form.maximumEventMinutes
  );
  const dirty = Boolean(
    form && query.data?.policy && JSON.stringify(form) !== JSON.stringify(query.data.policy)
  );
  const mutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error(t('admin.policies.missing'));
      return updateCalendarPolicy(form);
    },
    onSuccess: async (saved) => {
      setForm(saved);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('admin.policies.saved'));
    },
    onError: (error) => toast.error(errorMessage(error, t('admin.policies.saveError'))),
  });

  return (
    <CalendarCanvas archetype="policy">
      <CalendarPageHeading
        icon={SlidersHorizontal}
        eyebrow={t('admin.policies.eyebrow')}
        title={t('admin.policies.title')}
        description={t('admin.policies.description')}
        actions={
          canManage ? (
            <ActionButton
              intent="primary"
              startIcon={<SlidersHorizontal size={17} />}
              loading={mutation.isPending}
              disabled={!valid || !dirty}
              onClick={() => mutation.mutate()}
            >
              {t('actions.save')}
            </ActionButton>
          ) : undefined
        }
      />
      {query.isError ? (
        <ErrorState
          title={t('admin.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : query.isLoading || !form ? (
        <AdminLoading />
      ) : (
        <Stack component="section" spacing={2} aria-label={t('admin.policies.title')}>
          {!valid && <Alert severity="error">{t('admin.policies.validationError')}</Alert>}
          {dirty && valid && canManage && (
            <Alert severity="warning">
              <Typography fontWeight={600}>{t('admin.policies.impactTitle')}</Typography>
              <Typography variant="body2" sx={{ mt: 0.3 }}>
                {t('admin.policies.impactDescription')}
              </Typography>
            </Alert>
          )}
          {!canManage && (
            <Alert severity="info" sx={{ borderRadius: 1 }}>
              {t('admin.policies.readOnlyHint')}
            </Alert>
          )}
          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <CalendarSectionHeader
              icon={CalendarCheck2}
              title={t('admin.policies.scheduleSection')}
              description={t('admin.policies.scheduleSectionDescription')}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(240px, 0.75fr) minmax(0, 1.25fr)' },
                gap: 2,
                mt: 2.5,
              }}
            >
              <SelectField
                disabled={!canManage}
                label={t('admin.policies.weekStart')}
                value={form.weekStart}
                onValueChange={(value) => setForm({ ...form, weekStart: Number(value) })}
                options={[1, 7].map((value) => ({
                  value,
                  label: t(value === 1 ? 'admin.policies.monday' : 'admin.policies.sunday'),
                }))}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <TimePickerField
                  disabled={!canManage}
                  label={t('admin.policies.workStart')}
                  value={form.workingDayStart}
                  onValueChange={(value) => value && setForm({ ...form, workingDayStart: value })}
                />
                <TimePickerField
                  disabled={!canManage}
                  label={t('admin.policies.workEnd')}
                  value={form.workingDayEnd}
                  onValueChange={(value) => value && setForm({ ...form, workingDayEnd: value })}
                />
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <CalendarSectionHeader
              icon={Clock3}
              title={t('admin.policies.durationSection')}
              description={t('admin.policies.durationSectionDescription')}
            />
            <Box
              sx={{
                mt: 2.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <FormField
                disabled={!canManage}
                type="number"
                label={t('admin.policies.defaultDuration')}
                value={form.defaultEventMinutes}
                onChange={(event) =>
                  setForm({ ...form, defaultEventMinutes: Number(event.target.value) })
                }
                inputProps={{ min: 5, max: 1440, step: 5 }}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <FormField
                  disabled={!canManage}
                  type="number"
                  label={t('admin.policies.minimumDuration')}
                  value={form.minimumEventMinutes}
                  onChange={(event) =>
                    setForm({ ...form, minimumEventMinutes: Number(event.target.value) })
                  }
                  inputProps={{ min: 5, max: 1440, step: 5 }}
                />
                <FormField
                  disabled={!canManage}
                  type="number"
                  label={t('admin.policies.maximumDuration')}
                  value={form.maximumEventMinutes}
                  onChange={(event) =>
                    setForm({ ...form, maximumEventMinutes: Number(event.target.value) })
                  }
                  inputProps={{ min: 5, max: 1440, step: 5 }}
                />
              </Box>
              <FormField
                disabled={!canManage}
                type="number"
                label={t('admin.policies.advanceDays')}
                value={form.maximumAdvanceDays}
                onChange={(event) =>
                  setForm({ ...form, maximumAdvanceDays: Number(event.target.value) })
                }
                inputProps={{ min: 1, max: 1095 }}
              />
              <FormField
                disabled={!canManage}
                type="number"
                label={t('admin.policies.bufferMinutes')}
                value={form.defaultBufferMinutes}
                onChange={(event) =>
                  setForm({ ...form, defaultBufferMinutes: Number(event.target.value) })
                }
                inputProps={{ min: 0, max: 120, step: 5 }}
              />
            </Box>
          </Box>

          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <CalendarSectionHeader
              icon={Focus}
              title={t('admin.policies.wellbeingSection')}
              description={t('admin.policies.wellbeingSectionDescription')}
            />
            <Box
              sx={{
                mt: 2.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <FormField
                disabled={!canManage}
                type="number"
                label={t('admin.policies.focusTarget')}
                value={form.weeklyFocusTargetMinutes}
                onChange={(event) =>
                  setForm({ ...form, weeklyFocusTargetMinutes: Number(event.target.value) })
                }
                inputProps={{ min: 0, max: 6000, step: 30 }}
              />
              <FormField
                disabled={!canManage}
                type="number"
                label={t('admin.policies.meetingLimit')}
                value={form.dailyMeetingLimitMinutes}
                onChange={(event) =>
                  setForm({ ...form, dailyMeetingLimitMinutes: Number(event.target.value) })
                }
                inputProps={{ min: 30, max: 1440, step: 30 }}
              />
            </Box>
          </Box>

          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <CalendarSectionHeader
              icon={ShieldCheck}
              title={t('admin.policies.governanceSection')}
              description={t('admin.policies.governanceSectionDescription')}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ mt: 1.5 }}>
              <FormControlLabel
                disabled={!canManage}
                control={
                  <Checkbox
                    checked={form.enforceMeetingAgenda}
                    onChange={(event) =>
                      setForm({ ...form, enforceMeetingAgenda: event.target.checked })
                    }
                  />
                }
                label={t('admin.policies.enforceAgenda')}
              />
              <FormControlLabel
                disabled={!canManage}
                control={
                  <Checkbox
                    checked={form.allowExternalAttendees}
                    onChange={(event) =>
                      setForm({ ...form, allowExternalAttendees: event.target.checked })
                    }
                  />
                }
                label={t('admin.policies.externalAttendees')}
              />
            </Stack>
          </Box>
        </Stack>
      )}
      <ScopeNotice />
    </CalendarCanvas>
  );
}
