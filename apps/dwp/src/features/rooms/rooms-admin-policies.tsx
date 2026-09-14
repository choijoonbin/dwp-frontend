import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from 'react-router-dom';
import {
  getRoomsAdminOverview,
  updateRoomsPolicy,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  FormField,
  PageCanvas,
  TimePickerField,
} from '@dwp-frontend/design-system';

import { InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceHomeSourceData, workplaceHomeSourceState } from './workplace-home-source-state';
import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';

import type { CalendarPolicy } from '@dwp-frontend/shared-utils';

type NumericPolicyKey =
  'minimumEventMinutes' | 'maximumEventMinutes' | 'maximumAdvanceDays' | 'defaultBufferMinutes';

export function RoomsAdminPolicies() {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const auth = useAuth();
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  const [review, setReview] = useState<{ identityKey: string; policy: CalendarPolicy } | null>(
    null
  );
  const [reconcileIdentity, setReconcileIdentity] = useState<string | null>(null);
  const [draftIdentity, setDraftIdentity] = useState(identityKey);
  const queryClient = useQueryClient();
  const capabilities = useRoomsCapabilities();
  const [policy, setPolicy] = useState<CalendarPolicy | null>(null);
  const [baseline, setBaseline] = useState<CalendarPolicy | null>(null);
  const overviewQuery = useQuery({
    queryKey: ['rooms', 'admin', 'overview', identityKey],
    enabled: capabilities.isLoaded && capabilities.canViewRoomsAdmin,
    queryFn: getRoomsAdminOverview,
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const sourceState = workplaceHomeSourceState({
    ...overviewQuery,
    required: capabilities.isLoaded && capabilities.canViewRoomsAdmin,
  });
  const overview = workplaceHomeSourceData(sourceState, overviewQuery.data);
  const sourceRef = useRef(sourceState);
  sourceRef.current = sourceState;
  const canWrite =
    draftIdentity === identityKey &&
    sourceState === 'READY' &&
    !overviewQuery.isFetching &&
    reconcileIdentity !== identityKey &&
    capabilities.canManageRoomsAdmin;
  useEffect(() => {
    setPolicy(null);
    setBaseline(null);
    setDraftIdentity(identityKey);
    setReview(null);
    setReconcileIdentity(null);
  }, [identityKey]);
  const dirty = Boolean(
    draftIdentity === identityKey &&
    policy &&
    baseline &&
    JSON.stringify(policy) !== JSON.stringify(baseline)
  );
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (overview?.policy && !dirtyRef.current) {
      setPolicy(overview.policy);
      setBaseline(overview.policy);
    }
  }, [dirty, overview?.policy]);
  const navigationBlocker = useBlocker(dirty);
  useEffect(() => {
    if (!dirty) return undefined;
    const preventUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty]);
  const mutation = useMutation({
    mutationFn: ({
      input,
      identityKey: commandIdentity,
    }: {
      input: CalendarPolicy;
      identityKey: string;
    }) => {
      if (
        !capabilities.canManageRoomsAdmin ||
        commandIdentity !== identityRef.current ||
        sourceRef.current !== 'READY' ||
        !canWrite ||
        input.version !== overview?.policy.version
      ) {
        throw new Error(t('permissions.roomAdminPolicyReadOnly'));
      }
      return updateRoomsPolicy(input);
    },
    onSuccess: async (saved, command) => {
      if (command.identityKey !== identityRef.current) return;
      setReview(null);
      setPolicy(saved);
      setBaseline(saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms', 'admin'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar', 'admin'] }),
      ]);
      if (command.identityKey !== identityRef.current) return;
      toast.success(t('admin.policies.saved'));
    },
    onError: (_, command) => {
      if (command.identityKey !== identityRef.current) return;
      setReconcileIdentity(command.identityKey);
      setReview(null);
      toast.error(t('admin.policies.saveError'));
    },
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
            disabled={!valid || !dirty || mutation.isPending || !canWrite}
            loading={mutation.isPending}
            loadingLabel={t('actions.saving')}
            onClick={() => policy && canWrite && setReview({ identityKey, policy: { ...policy } })}
          >
            {t('actions.save')}
          </ActionButton>
        }
      />
      {capabilities.isLoaded && !capabilities.canManageRoomsAdmin && (
        <RoomsPermissionNotice>{t('permissions.roomAdminPolicyReadOnly')}</RoomsPermissionNotice>
      )}
      {sourceState === 'DENIED' ||
      sourceState === 'UNAVAILABLE' ||
      sourceState === 'STALE' ||
      reconcileIdentity === identityKey ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton
              intent="quiet"
              onClick={async () => {
                const expected = identityKey;
                const result = await overviewQuery.refetch();
                if (!result.isError && identityRef.current === expected) {
                  setReconcileIdentity(null);
                  setBaseline(result.data?.policy ?? null);
                }
              }}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t(
            reconcileIdentity === identityKey
              ? 'workplace.experience.changeUnknown'
              : 'admin.policies.loadError'
          )}
        </InlineFeedback>
      ) : overviewQuery.isLoading || !policy || draftIdentity !== identityKey ? (
        <Stack gap={1}>
          <Skeleton height={220} />
          <Skeleton height={180} />
        </Stack>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1.5fr) minmax(0, .9fr)' },
            gap: 2.5,
            alignItems: 'start',
          }}
        >
          <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 2, md: 3 } })}>
            <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 2 }}>
              <ShieldCheck size={19} color="var(--dwp-product-accent)" />
              <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
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
                disabled={!canWrite || mutation.isPending}
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
                disabled={!canWrite || mutation.isPending}
                onValueChange={(value) =>
                  value &&
                  setPolicy((current) => (current ? { ...current, workingDayEnd: value } : current))
                }
              />
              <FormField
                type="number"
                label={t('admin.policies.advanceDays')}
                value={String(policy.maximumAdvanceDays)}
                disabled={!canWrite || mutation.isPending}
                onChange={(change) => patchNumber('maximumAdvanceDays', change.target.value)}
                inputProps={{ min: 1, max: 1095 }}
              />
              <FormField
                type="number"
                label={t('admin.policies.bufferMinutes')}
                value={String(policy.defaultBufferMinutes)}
                disabled={!canWrite || mutation.isPending}
                onChange={(change) => patchNumber('defaultBufferMinutes', change.target.value)}
                inputProps={{ min: 0, max: 120 }}
              />
              <FormField
                type="number"
                label={t('admin.policies.minimumMinutes')}
                value={String(policy.minimumEventMinutes)}
                disabled={!canWrite || mutation.isPending}
                onChange={(change) => patchNumber('minimumEventMinutes', change.target.value)}
                inputProps={{ min: 5, max: 1440 }}
              />
              <FormField
                type="number"
                label={t('admin.policies.maximumMinutes')}
                value={String(policy.maximumEventMinutes)}
                disabled={!canWrite || mutation.isPending}
                onChange={(change) => patchNumber('maximumEventMinutes', change.target.value)}
                inputProps={{ min: 5, max: 1440 }}
              />
            </Box>
          </Box>
          <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 2, md: 3 } })}>
            <Typography
              component="h2"
              variant="subtitle1"
              fontWeight="fontWeightBold"
              sx={{ mb: 1 }}
            >
              {t('admin.policies.governanceTitle')}
            </Typography>
            <Stack>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={policy.enforceMeetingAgenda}
                    disabled={!canWrite || mutation.isPending}
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
                    disabled={!canWrite || mutation.isPending}
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
        </Box>
      )}
      <ConfirmDialog
        open={Boolean(review && review.identityKey === identityKey && canWrite)}
        title={t('admin.policies.reviewTitle')}
        description={t('admin.policies.reviewDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('actions.save')}
        confirmingLabel={t('actions.saving')}
        busy={mutation.isPending}
        focusCancelAfterOpen
        minimumActionHeight={44}
        onClose={() => setReview(null)}
        onConfirm={() => {
          if (review && canWrite)
            mutation.mutate({
              input: {
                ...review.policy,
                version: overview?.policy.version ?? review.policy.version,
              },
              identityKey,
            });
        }}
        details={
          <Stack gap={1.5} sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
            {baseline && review
              ? (
                  [
                    'workingDayStart',
                    'workingDayEnd',
                    'minimumEventMinutes',
                    'maximumEventMinutes',
                    'maximumAdvanceDays',
                    'defaultBufferMinutes',
                    'enforceMeetingAgenda',
                    'allowExternalAttendees',
                  ] as const
                )
                  .filter((key) => baseline[key] !== review.policy[key])
                  .map((key) => (
                    <Box key={key}>
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {t(
                          `admin.policies.${({ workingDayStart: 'workingStart', workingDayEnd: 'workingEnd', minimumEventMinutes: 'minimumMinutes', maximumEventMinutes: 'maximumMinutes', maximumAdvanceDays: 'advanceDays', defaultBufferMinutes: 'bufferMinutes', enforceMeetingAgenda: 'enforceAgenda', allowExternalAttendees: 'allowExternal' } as const)[key]}`
                        )}
                      </Typography>
                      <Typography variant="body2">
                        {t('admin.policies.current')}:{' '}
                        {typeof baseline[key] === 'boolean' ? (
                          <Checkbox
                            checked={Boolean(baseline[key])}
                            disabled
                            size="small"
                            slotProps={{ input: { 'aria-label': t('admin.policies.current') } }}
                          />
                        ) : (
                          String(baseline[key])
                        )}{' '}
                        → {t('admin.policies.proposed')}:{' '}
                        {typeof review.policy[key] === 'boolean' ? (
                          <Checkbox
                            checked={Boolean(review.policy[key])}
                            disabled
                            size="small"
                            slotProps={{ input: { 'aria-label': t('admin.policies.proposed') } }}
                          />
                        ) : (
                          String(review.policy[key])
                        )}
                      </Typography>
                    </Box>
                  ))
              : null}
          </Stack>
        }
      />
      <ConfirmDialog
        open={navigationBlocker.state === 'blocked'}
        title={t('admin.policies.unsavedTitle')}
        description={t('admin.policies.unsavedDescription')}
        cancelLabel={t('actions.keep')}
        confirmLabel={t('admin.policies.discardChanges')}
        intent="danger"
        onClose={() => navigationBlocker.reset?.()}
        onConfirm={() => navigationBlocker.proceed?.()}
      />
    </PageCanvas>
  );
}
