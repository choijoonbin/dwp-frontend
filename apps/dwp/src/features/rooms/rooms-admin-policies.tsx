import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRoomsAdminOverview, updateRoomsPolicy, useToast } from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, PageCanvas, TimePickerField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { RoomsPageHeading } from './rooms-ui';

import type { CalendarPolicy } from '@dwp-frontend/shared-utils';

type NumericPolicyKey =
  'minimumEventMinutes' | 'maximumEventMinutes' | 'maximumAdvanceDays' | 'defaultBufferMinutes';

export function RoomsAdminPolicies() {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [policy, setPolicy] = useState<CalendarPolicy | null>(null);
  const overviewQuery = useQuery({
    queryKey: ['rooms', 'admin', 'overview'],
    queryFn: getRoomsAdminOverview,
    staleTime: 30_000,
    retry: 1,
  });
  useEffect(() => {
    if (overviewQuery.data?.policy) setPolicy(overviewQuery.data.policy);
  }, [overviewQuery.data?.policy]);
  const mutation = useMutation({
    mutationFn: (input: CalendarPolicy) => updateRoomsPolicy(input),
    onSuccess: async (saved) => {
      setPolicy(saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms', 'admin'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar', 'admin'] }),
      ]);
      toast.success(t('admin.policies.saved'));
    },
    onError: () => toast.error(t('admin.policies.saveError')),
  });
  const patchNumber = (key: NumericPolicyKey, value: string) =>
    setPolicy((current) => (current ? { ...current, [key]: Number(value) } : current));
  const valid = Boolean(
    policy &&
    policy.minimumEventMinutes >= 5 &&
    policy.maximumEventMinutes >= policy.minimumEventMinutes &&
    policy.maximumAdvanceDays >= 1 &&
    policy.defaultBufferMinutes >= 0 &&
    policy.workingDayStart < policy.workingDayEnd
  );

  return (
    <PageCanvas mode="focus">
      <RoomsPageHeading
        eyebrow={t('admin.policies.eyebrow')}
        title={t('admin.policies.title')}
        description={t('admin.policies.description')}
        actions={
          <ActionButton
            intent="primary"
            startIcon={<Save size={17} />}
            disabled={!valid || mutation.isPending}
            loading={mutation.isPending}
            loadingLabel={t('actions.saving')}
            onClick={() => policy && mutation.mutate(policy)}
          >
            {t('actions.save')}
          </ActionButton>
        }
      />
      {overviewQuery.isError ? (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => overviewQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('admin.policies.loadError')}
        </Alert>
      ) : overviewQuery.isLoading || !policy ? (
        <Stack gap={1}>
          <Skeleton height={220} />
          <Skeleton height={180} />
        </Stack>
      ) : (
        <Stack gap={2}>
          <Box
            sx={{
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: { xs: 2, md: 3 },
            }}
          >
            <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 2 }}>
              <ShieldCheck size={19} color="var(--dwp-product-accent)" />
              <Typography component="h2" variant="subtitle1" fontWeight={800}>
                {t('admin.policies.bookingWindowTitle')}
              </Typography>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 2,
              }}
            >
              <TimePickerField
                label={t('admin.policies.workingStart')}
                value={policy.workingDayStart}
                onValueChange={(value) =>
                  value &&
                  setPolicy((current) =>
                    current ? { ...current, workingDayStart: value } : current
                  )
                }
              />
              <TimePickerField
                label={t('admin.policies.workingEnd')}
                value={policy.workingDayEnd}
                onValueChange={(value) =>
                  value &&
                  setPolicy((current) => (current ? { ...current, workingDayEnd: value } : current))
                }
              />
              <FormField
                type="number"
                label={t('admin.policies.advanceDays')}
                value={String(policy.maximumAdvanceDays)}
                onChange={(change) => patchNumber('maximumAdvanceDays', change.target.value)}
                inputProps={{ min: 1, max: 1095 }}
              />
              <FormField
                type="number"
                label={t('admin.policies.bufferMinutes')}
                value={String(policy.defaultBufferMinutes)}
                onChange={(change) => patchNumber('defaultBufferMinutes', change.target.value)}
                inputProps={{ min: 0, max: 120 }}
              />
              <FormField
                type="number"
                label={t('admin.policies.minimumMinutes')}
                value={String(policy.minimumEventMinutes)}
                onChange={(change) => patchNumber('minimumEventMinutes', change.target.value)}
                inputProps={{ min: 5, max: 1440 }}
              />
              <FormField
                type="number"
                label={t('admin.policies.maximumMinutes')}
                value={String(policy.maximumEventMinutes)}
                onChange={(change) => patchNumber('maximumEventMinutes', change.target.value)}
                inputProps={{ min: 5, max: 1440 }}
              />
            </Box>
          </Box>
          <Box
            sx={{
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: { xs: 2, md: 3 },
            }}
          >
            <Typography component="h2" variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
              {t('admin.policies.governanceTitle')}
            </Typography>
            <Stack>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={policy.enforceMeetingAgenda}
                    onChange={(change) =>
                      setPolicy((current) =>
                        current
                          ? { ...current, enforceMeetingAgenda: change.target.checked }
                          : current
                      )
                    }
                  />
                }
                label={t('admin.policies.enforceAgenda')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={policy.allowExternalAttendees}
                    onChange={(change) =>
                      setPolicy((current) =>
                        current
                          ? { ...current, allowExternalAttendees: change.target.checked }
                          : current
                      )
                    }
                  />
                }
                label={t('admin.policies.allowExternal')}
              />
            </Stack>
          </Box>
        </Stack>
      )}
    </PageCanvas>
  );
}
