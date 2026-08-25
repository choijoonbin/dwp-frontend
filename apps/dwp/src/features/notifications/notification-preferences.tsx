import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BellRing,
  BellDot,
  CalendarClock,
  Check,
  CircleAlert,
  LoaderCircle,
  Mail,
  MessageSquare,
  MoonStar,
  Eye,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createNotificationIdempotencyKey,
  deleteNotificationSubscriptionRule,
  getNotificationCapabilities,
  getNotificationDeliveryProfile,
  getNotificationEffectiveSettings,
  putNotificationSubscriptionRule,
  updateNotificationDeliveryProfile,
  type NotificationAppSetting,
  type NotificationChannel,
  type NotificationDeliveryProfile,
  type NotificationTypeSetting,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { useToast } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageCanvas,
  TimePickerField,
  resolveProductTimeZone,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { notificationQueryKeys } from './integration-contract';
import { USER_CHANNELS } from './notification-model';
import {
  buildNotificationSubscriptionRuleInput,
  findNotificationTypeSetting,
  isNotificationPreferenceConflict,
  rebaseNotificationDeliveryProfile,
  type NotificationRulePatch,
} from './notification-preference-save-policy';
import {
  ManagedChip,
  TypeSettingRows,
  UnavailableChannelChip,
} from './notification-type-setting-rows';
import { NotificationPageHeading } from './notification-ui';
import { useOnlineStatus } from './use-notification-runtime';
import { usePersonalPreference } from '../../providers/personal-preference-provider';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type SaveState = 'idle' | 'saving' | 'saved' | 'recovered' | 'error';

const CHANNEL_ICON: Record<NotificationChannel, LucideIcon> = {
  IN_APP: BellRing,
  EMAIL: Mail,
  WEB_PUSH: MessageSquare,
  MOBILE_PUSH: Smartphone,
  TEAMS: MessageSquare,
  SLACK: MessageSquare,
};

function PreferenceSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Box component="section" sx={{ mt: 3.5 }}>
      <Typography component="h2" variant="h6">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
        {description}
      </Typography>
      <Box
        sx={{
          mt: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  meta,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '36px minmax(0, 1fr)', sm: '40px minmax(240px, 1fr) auto' },
        gap: 1.5,
        alignItems: 'center',
        px: { xs: 1.5, sm: 2.25 },
        py: 1.75,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: { xs: 36, sm: 40 },
          height: { xs: 36, sm: 40 },
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          bgcolor: 'action.hover',
          color: 'text.secondary',
        }}
      >
        <Icon size={19} strokeWidth={1.8} />
      </Box>
      <Box minWidth={0}>
        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
          <Typography component="h3" variant="subtitle2">
            {title}
          </Typography>
          {meta}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {description}
        </Typography>
      </Box>
      <Box sx={{ gridColumn: { xs: '2', sm: '3' }, justifySelf: { xs: 'start', sm: 'end' } }}>
        {children}
      </Box>
    </Box>
  );
}

function AutoSaveIndicator({ state, savedAt }: { state: SaveState; savedAt?: string | null }) {
  const { t } = useTranslation('notifications');
  const Icon = state === 'saving' ? LoaderCircle : state === 'error' ? CircleAlert : Check;
  const label =
    state === 'saving'
      ? t('preferences.save.saving')
      : state === 'error'
        ? t('preferences.save.error')
        : state === 'recovered'
          ? t('preferences.save.recovered')
          : state === 'saved'
            ? t('preferences.save.saved', {
                time: savedAt
                  ? formatDate(savedAt, { timeStyle: 'short' })
                  : t('preferences.save.now'),
              })
            : t('preferences.save.auto');
  return (
    <Stack
      role="status"
      aria-live="polite"
      aria-atomic="true"
      direction="row"
      gap={0.75}
      alignItems="center"
      color={
        state === 'error'
          ? 'error.main'
          : state === 'saved' || state === 'recovered'
            ? 'success.main'
            : 'text.secondary'
      }
      minHeight={32}
    >
      <Icon size={16} className={state === 'saving' ? 'dwp-spin' : undefined} />
      <Typography variant="caption" color="inherit" fontWeight={700}>
        {label}
      </Typography>
    </Stack>
  );
}

export function NotificationPreferences() {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const personalPreference = usePersonalPreference();
  const [draft, setDraft] = useState<NotificationDeliveryProfile | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [selectedAppKey, setSelectedAppKey] = useState<string | null>(null);
  const [busyType, setBusyType] = useState<string | null>(null);
  const timeZoneSyncAttempt = useRef<string | null>(null);

  const profileQuery = useQuery({
    queryKey: notificationQueryKeys.preferences(),
    queryFn: ({ signal }) => getNotificationDeliveryProfile(signal),
    staleTime: 30_000,
    retry: 1,
  });
  const effectiveQuery = useQuery({
    queryKey: notificationQueryKeys.effectiveSettings(),
    queryFn: ({ signal }) => getNotificationEffectiveSettings(signal),
    staleTime: 30_000,
    retry: 1,
  });
  const capabilitiesQuery = useQuery({
    queryKey: notificationQueryKeys.capabilities(),
    queryFn: ({ signal }) => getNotificationCapabilities(signal),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const enabledChannels = useMemo<ReadonlySet<NotificationChannel>>(
    () => new Set(capabilitiesQuery.data?.enabledChannels ?? ['IN_APP']),
    [capabilitiesQuery.data?.enabledChannels]
  );
  const externalDeliveryEnabled = useMemo(
    () => [...enabledChannels].some((channel) => channel !== 'IN_APP'),
    [enabledChannels]
  );
  const effectivePolicyLocked =
    effectiveQuery.isLoading ||
    effectiveQuery.isError ||
    !effectiveQuery.data ||
    effectiveQuery.data.partial;
  const scheduleTimeZone = resolveProductTimeZone(
    personalPreference.preference?.preferences.regional.timeZone,
    draft?.quietHours.timeZone
  );

  useEffect(() => {
    if (profileQuery.data) setDraft(profileQuery.data);
  }, [profileQuery.data]);
  useEffect(() => {
    if (!selectedAppKey && effectiveQuery.data?.apps[0]) {
      setSelectedAppKey(effectiveQuery.data.apps[0].appKey);
    }
  }, [effectiveQuery.data?.apps, selectedAppKey]);

  const profileMutation = useMutation({
    mutationFn: async ({
      base,
      next,
    }: {
      base: NotificationDeliveryProfile;
      next: NotificationDeliveryProfile;
    }) => {
      try {
        return {
          saved: await updateNotificationDeliveryProfile(
            next,
            createNotificationIdempotencyKey('delivery-profile')
          ),
          recovered: false,
        };
      } catch (error) {
        if (!isNotificationPreferenceConflict(error)) throw error;
        const latest = await getNotificationDeliveryProfile();
        const rebased = rebaseNotificationDeliveryProfile(base, next, latest);
        return {
          saved: await updateNotificationDeliveryProfile(
            rebased,
            createNotificationIdempotencyKey('delivery-profile-retry')
          ),
          recovered: true,
        };
      }
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: ({ saved, recovered }) => {
      setDraft(saved);
      setSaveState(recovered ? 'recovered' : 'saved');
      queryClient.setQueryData(notificationQueryKeys.preferences(), saved);
      if (recovered) toast.success(t('preferences.feedback.conflictRecovered'));
    },
    onError: async () => {
      const latest = await profileQuery.refetch();
      setDraft(latest.data ?? profileQuery.data ?? null);
      setSaveState('error');
      toast.error(t('preferences.feedback.profileError'));
    },
  });

  const saveProfile = (next: NotificationDeliveryProfile) => {
    const synchronized = {
      ...next,
      quietHours: { ...next.quietHours, timeZone: scheduleTimeZone },
    };
    const base = draft ?? next;
    setDraft(synchronized);
    profileMutation.mutate({ base, next: synchronized });
  };

  useEffect(() => {
    const persisted = profileQuery.data;
    const syncKey = persisted ? `${persisted.version}:${scheduleTimeZone}` : null;
    if (
      !persisted ||
      !online ||
      profileMutation.isPending ||
      persisted.quietHours.timeZone === scheduleTimeZone ||
      timeZoneSyncAttempt.current === syncKey
    ) {
      return;
    }
    timeZoneSyncAttempt.current = syncKey;
    profileMutation.mutate({
      base: persisted,
      next: {
        ...persisted,
        quietHours: { ...persisted.quietHours, timeZone: scheduleTimeZone },
      },
    });
  }, [online, profileMutation, profileQuery.data, scheduleTimeZone]);

  const ruleMutation = useMutation({
    mutationFn: async ({
      app,
      setting,
      patch,
    }: {
      app: NotificationAppSetting;
      setting: NotificationTypeSetting;
      patch: NotificationRulePatch;
    }) => {
      setBusyType(setting.typeKey);
      const save = (current: NotificationTypeSetting, retry: boolean) =>
        putNotificationSubscriptionRule(
          current.ruleId ?? crypto.randomUUID(),
          buildNotificationSubscriptionRuleInput(app.appKey, current, patch),
          createNotificationIdempotencyKey(retry ? 'subscription-rule-retry' : 'subscription-rule')
        );
      try {
        return { saved: await save(setting, false), recovered: false };
      } catch (error) {
        if (!isNotificationPreferenceConflict(error)) throw error;
        const latest = await getNotificationEffectiveSettings();
        const current = findNotificationTypeSetting(latest, app.appKey, setting.typeKey);
        if (!current) throw error;
        return { saved: await save(current, true), recovered: true };
      }
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: async ({ recovered }) => {
      setSaveState(recovered ? 'recovered' : 'saved');
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.effectiveSettings() });
      if (recovered) toast.success(t('preferences.feedback.conflictRecovered'));
    },
    onError: () => {
      setSaveState('error');
      toast.error(t('preferences.feedback.ruleError'));
    },
    onSettled: () => setBusyType(null),
  });

  const resetMutation = useMutation({
    mutationFn: async ({
      appKey,
      setting,
    }: {
      appKey: string;
      setting: NotificationTypeSetting;
    }) => {
      if (!setting.ruleId || setting.ruleVersion == null) return Promise.resolve();
      setBusyType(setting.typeKey);
      try {
        await deleteNotificationSubscriptionRule(
          setting.ruleId,
          setting.ruleVersion,
          createNotificationIdempotencyKey('subscription-rule-reset')
        );
      } catch (error) {
        if (!isNotificationPreferenceConflict(error)) throw error;
        const latest = await getNotificationEffectiveSettings();
        const current = findNotificationTypeSetting(latest, appKey, setting.typeKey);
        if (!current?.ruleId || current.ruleVersion == null) return;
        await deleteNotificationSubscriptionRule(
          current.ruleId,
          current.ruleVersion,
          createNotificationIdempotencyKey('subscription-rule-reset-retry')
        );
      }
    },
    onSuccess: async () => {
      setSaveState('saved');
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.effectiveSettings() });
    },
    onError: () => {
      setSaveState('error');
      toast.error(t('preferences.feedback.ruleError'));
    },
    onSettled: () => setBusyType(null),
  });

  const selectedApp = useMemo(
    () => effectiveQuery.data?.apps.find((app) => app.appKey === selectedAppKey) ?? null,
    [effectiveQuery.data?.apps, selectedAppKey]
  );

  if (profileQuery.isLoading) {
    return (
      <PageCanvas mode="focus">
        <LoadingState
          label={t('states.loadingPreferences')}
          variant="skeleton"
          skeletonRows={8}
          size="page"
        />
      </PageCanvas>
    );
  }
  if (profileQuery.isError || !draft) {
    return (
      <PageCanvas mode="focus">
        <ErrorState
          title={t('states.preferencesErrorTitle')}
          description={t('states.preferencesErrorDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => void profileQuery.refetch()}
          retrying={profileQuery.isFetching}
          size="page"
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas mode="focus">
      <NotificationPageHeading
        title={t('preferences.title')}
        description={t('preferences.description')}
        actions={<AutoSaveIndicator state={saveState} savedAt={draft.updatedAt} />}
      />
      {!online && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t('preferences.offline')}
        </Alert>
      )}
      {!externalDeliveryEnabled && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('preferences.externalChannelsUnavailable')}
        </Alert>
      )}
      {(effectiveQuery.isError || effectiveQuery.data?.partial) && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t('preferences.apps.effectivePolicyUnavailable')}
        </Alert>
      )}

      <PreferenceSection
        title={t('preferences.presentation.title')}
        description={t('preferences.presentation.description')}
      >
        <Stack divider={<Divider flexItem />}>
          <PreferenceRow
            icon={BellDot}
            title={t('preferences.presentation.banner')}
            description={t('preferences.presentation.bannerDescription')}
          >
            <FormField
              select
              size="small"
              label={t('preferences.presentation.banner')}
              value={draft.presentation.bannerMode}
              disabled={!online || profileMutation.isPending}
              onChange={(event) =>
                saveProfile({
                  ...draft,
                  presentation: {
                    ...draft.presentation,
                    bannerMode: event.target
                      .value as NotificationDeliveryProfile['presentation']['bannerMode'],
                  },
                })
              }
              sx={{ minWidth: 190 }}
            >
              {(['SMART', 'HIGH_PRIORITY_ONLY', 'OFF'] as const).map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {t(`preferences.presentation.bannerModes.${mode}`)}
                </MenuItem>
              ))}
            </FormField>
          </PreferenceRow>
          <PreferenceRow
            icon={Eye}
            title={t('preferences.presentation.preview')}
            description={t('preferences.presentation.previewDescription')}
          >
            <FormField
              select
              size="small"
              label={t('preferences.presentation.preview')}
              value={draft.presentation.previewMode}
              disabled={!online || profileMutation.isPending}
              onChange={(event) =>
                saveProfile({
                  ...draft,
                  presentation: {
                    ...draft.presentation,
                    previewMode: event.target
                      .value as NotificationDeliveryProfile['presentation']['previewMode'],
                  },
                })
              }
              sx={{ minWidth: 190 }}
            >
              {(['FULL', 'TITLE_ONLY', 'HIDDEN'] as const).map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {t(`preferences.presentation.previewModes.${mode}`)}
                </MenuItem>
              ))}
            </FormField>
          </PreferenceRow>
        </Stack>
      </PreferenceSection>

      <PreferenceSection
        title={t('preferences.global.title')}
        description={t('preferences.global.description')}
      >
        <Stack divider={<Divider flexItem />}>
          {USER_CHANNELS.map((channel) => {
            const Icon = CHANNEL_ICON[channel];
            const managed = effectiveQuery.data?.globalChannels[channel];
            const available = enabledChannels.has(channel);
            return (
              <PreferenceRow
                key={channel}
                icon={Icon}
                title={t(`channels.${channel}`)}
                description={t(`preferences.global.channelDescription.${channel}`)}
                meta={
                  !available ? (
                    <UnavailableChannelChip />
                  ) : managed?.managed ? (
                    <ManagedChip owner={managed.ownerLabel} />
                  ) : undefined
                }
              >
                <Switch
                  checked={available && (managed?.effectiveValue ?? draft.channels[channel])}
                  disabled={
                    !online ||
                    !available ||
                    profileMutation.isPending ||
                    effectivePolicyLocked ||
                    managed?.managed
                  }
                  onChange={(event) =>
                    saveProfile({
                      ...draft,
                      channels: { ...draft.channels, [channel]: event.target.checked },
                    })
                  }
                  inputProps={{
                    'aria-label': t('preferences.global.channelToggle', {
                      channel: t(`channels.${channel}`),
                    }),
                  }}
                />
              </PreferenceRow>
            );
          })}
        </Stack>
      </PreferenceSection>

      <PreferenceSection
        title={t('preferences.quiet.title')}
        description={t('preferences.quiet.description')}
      >
        <Stack divider={<Divider flexItem />}>
          <PreferenceRow
            icon={MoonStar}
            title={t('preferences.quiet.enabled')}
            description={t('preferences.quiet.enabledDescription')}
          >
            <Switch
              checked={draft.quietHours.enabled}
              disabled={!online || profileMutation.isPending}
              onChange={(event) =>
                saveProfile({
                  ...draft,
                  quietHours: { ...draft.quietHours, enabled: event.target.checked },
                })
              }
              inputProps={{ 'aria-label': t('preferences.quiet.enabled') }}
            />
          </PreferenceRow>
          <PreferenceRow
            icon={CalendarClock}
            title={t('preferences.quiet.schedule')}
            description={t('preferences.quiet.scheduleDescription', {
              timeZone: scheduleTimeZone,
            })}
          >
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <TimePickerField
                size="small"
                label={t('preferences.quiet.start')}
                value={draft.quietHours.start}
                disabled={!draft.quietHours.enabled || !online || profileMutation.isPending}
                onValueChange={(value) => {
                  if (!value) return;
                  saveProfile({
                    ...draft,
                    quietHours: { ...draft.quietHours, start: value.slice(0, 5) },
                  });
                }}
              />
              <TimePickerField
                size="small"
                label={t('preferences.quiet.end')}
                value={draft.quietHours.end}
                disabled={!draft.quietHours.enabled || !online || profileMutation.isPending}
                onValueChange={(value) => {
                  if (!value) return;
                  saveProfile({
                    ...draft,
                    quietHours: { ...draft.quietHours, end: value.slice(0, 5) },
                  });
                }}
              />
            </Stack>
          </PreferenceRow>
          <PreferenceRow
            icon={CalendarClock}
            title={t('preferences.quiet.days')}
            description={t('preferences.quiet.daysDescription')}
          >
            <ToggleButtonGroup
              size="small"
              value={draft.quietHours.days}
              disabled={!online || profileMutation.isPending}
              onChange={(_event, days: number[]) =>
                saveProfile({ ...draft, quietHours: { ...draft.quietHours, days } })
              }
              aria-label={t('preferences.quiet.days')}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <ToggleButton key={day} value={day} aria-label={t(`preferences.days.${day}`)}>
                  {t(`preferences.daysShort.${day}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </PreferenceRow>
          <PreferenceRow
            icon={ShieldCheck}
            title={t('preferences.quiet.urgentBypass')}
            description={t('preferences.quiet.urgentBypassDescription')}
          >
            <Switch
              checked={draft.quietHours.allowUrgentBypass}
              disabled={!online || profileMutation.isPending}
              onChange={(event) =>
                saveProfile({
                  ...draft,
                  quietHours: {
                    ...draft.quietHours,
                    allowUrgentBypass: event.target.checked,
                  },
                })
              }
              inputProps={{ 'aria-label': t('preferences.quiet.urgentBypass') }}
            />
          </PreferenceRow>
        </Stack>
      </PreferenceSection>

      <PreferenceSection
        title={t('preferences.digest.title')}
        description={t('preferences.digest.description')}
      >
        <PreferenceRow
          icon={CalendarClock}
          title={t('preferences.digest.mode')}
          description={t('preferences.digest.modeDescription')}
        >
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <FormField
              select
              size="small"
              label={t('preferences.digest.mode')}
              value={draft.digest.mode}
              disabled={!externalDeliveryEnabled || !online || profileMutation.isPending}
              onChange={(event) =>
                saveProfile({
                  ...draft,
                  digest: {
                    ...draft.digest,
                    mode: event.target.value as NotificationDeliveryProfile['digest']['mode'],
                    dayOfWeek:
                      event.target.value === 'WEEKLY' ? (draft.digest.dayOfWeek ?? 1) : null,
                  },
                })
              }
              sx={{ minWidth: 160 }}
            >
              {(['OFF', 'DAILY', 'WEEKLY'] as const).map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {t(`preferences.digest.modes.${mode}`)}
                </MenuItem>
              ))}
            </FormField>
            <TimePickerField
              size="small"
              label={t('preferences.digest.time')}
              value={draft.digest.deliveryTime}
              disabled={
                !externalDeliveryEnabled ||
                draft.digest.mode === 'OFF' ||
                !online ||
                profileMutation.isPending
              }
              onValueChange={(value) => {
                if (!value) return;
                saveProfile({
                  ...draft,
                  digest: { ...draft.digest, deliveryTime: value.slice(0, 5) },
                });
              }}
            />
            {draft.digest.mode === 'WEEKLY' && (
              <FormField
                select
                size="small"
                label={t('preferences.digest.day')}
                value={draft.digest.dayOfWeek ?? 1}
                disabled={!externalDeliveryEnabled || !online || profileMutation.isPending}
                onChange={(event) =>
                  saveProfile({
                    ...draft,
                    digest: { ...draft.digest, dayOfWeek: Number(event.target.value) },
                  })
                }
                sx={{ minWidth: 140 }}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <MenuItem key={day} value={day}>
                    {t(`preferences.days.${day}`)}
                  </MenuItem>
                ))}
              </FormField>
            )}
          </Stack>
        </PreferenceRow>
      </PreferenceSection>

      <PreferenceSection
        title={t('preferences.apps.title')}
        description={t('preferences.apps.description')}
      >
        {effectiveQuery.isLoading ? (
          <LoadingState
            label={t('states.loadingAppSettings')}
            variant="skeleton"
            skeletonRows={6}
          />
        ) : effectiveQuery.isError ? (
          <ErrorState
            title={t('states.appSettingsErrorTitle')}
            description={t('states.appSettingsErrorDescription')}
            retryLabel={t('actions.retry')}
            onRetry={() => void effectiveQuery.refetch()}
            retrying={effectiveQuery.isFetching}
          />
        ) : effectiveQuery.data?.apps.length === 0 ? (
          <EmptyState
            title={t('preferences.apps.emptyTitle')}
            description={t('preferences.apps.emptyDescription')}
          />
        ) : (
          <>
            {effectiveQuery.data?.partial && (
              <Alert severity="info" sx={{ borderRadius: 0 }}>
                {t('preferences.apps.effectivePolicyUnavailable')}
              </Alert>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' },
              }}
            >
              <Box
                component="nav"
                aria-label={t('preferences.apps.navigation')}
                sx={{
                  borderRight: { md: 1 },
                  borderBottom: { xs: 1, md: 0 },
                  borderColor: 'divider',
                  p: 1,
                }}
              >
                {(effectiveQuery.data?.apps ?? []).map((app) => (
                  <ActionButton
                    key={app.appKey}
                    intent="quiet"
                    fullWidth
                    aria-current={app.appKey === selectedAppKey ? 'page' : undefined}
                    onClick={() => setSelectedAppKey(app.appKey)}
                    sx={{
                      justifyContent: 'flex-start',
                      minHeight: 42,
                      bgcolor: app.appKey === selectedAppKey ? 'action.selected' : undefined,
                    }}
                  >
                    {app.appName}
                  </ActionButton>
                ))}
              </Box>
              <Box minWidth={0}>
                {selectedApp && (
                  <TypeSettingRows
                    app={selectedApp}
                    disabled={!online || effectivePolicyLocked}
                    busyType={busyType}
                    enabledChannels={enabledChannels}
                    externalDeliveryEnabled={externalDeliveryEnabled}
                    onUpdate={(setting, patch) =>
                      ruleMutation.mutate({ app: selectedApp, setting, patch })
                    }
                    onReset={(setting) =>
                      resetMutation.mutate({ appKey: selectedApp.appKey, setting })
                    }
                  />
                )}
              </Box>
            </Box>
          </>
        )}
      </PreferenceSection>
    </PageCanvas>
  );
}
