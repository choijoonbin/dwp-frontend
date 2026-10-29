import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellDot, CalendarClock, MoonStar, Eye, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createNotificationIdempotencyKey,
  deleteNotificationSubscriptionRule,
  getNotificationCapabilities,
  getNotificationDeliveryProfile,
  getNotificationDeliveryEndpoints,
  getNotificationEffectiveSettings,
  putNotificationSubscriptionRule,
  revokeNotificationDeliveryEndpoint,
  type NotificationAppSetting,
  type NotificationChannel,
  type NotificationDeliveryProfile,
  type NotificationDeliveryEndpoint,
  type NotificationTypeSetting,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { useToast } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  FormField,
  LoadingState,
  TimePickerField,
  resolveProductTimeZone,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { notificationQueryKeys } from './integration-contract';
import { NotificationChannelGrid } from './notification-channel-grid';
import { NotificationAttentionSettings } from './notification-attention-settings';
import {
  NOTIFICATION_PREFERENCE_SECTION_IDS,
  NotificationPreferenceNavigation,
  NotificationPreferenceViewTabs,
} from './notification-preference-navigation';
import { NotificationPreferenceSaveIndicator } from './notification-preference-save-indicator';
import type {
  NotificationSettingsNavigationChangeOptions,
  NotificationSettingsUrlState,
} from './notification-settings-url-state';
import {
  buildNotificationSubscriptionRuleInput,
  findNotificationTypeSetting,
  isNotificationPreferenceConflict,
  type NotificationRulePatch,
} from './notification-preference-save-policy';
import { TypeSettingRows } from './notification-type-setting-rows';
import {
  notificationPreferenceControlSx,
  notificationPreferenceRadius,
  notificationPreferenceSoftBackground,
} from './notification-preference-styles';
import { PreferenceRow, PreferenceSection } from './notification-preference-section';
import { NotificationPageHeading } from './notification-ui';
import { NotificationDeliveryStatusPanel } from './notification-delivery-status';
import { NotificationPageFrame } from './notification-page-frame';
import { NotificationErrorState } from './notification-error-support';
import { useOnlineStatus } from './use-notification-runtime';
import {
  useNotificationProfileSaveController,
  type NotificationProfileSaveState,
} from './use-notification-profile-save-controller';
import { useNotificationPreferenceNavigationState } from './use-notification-preference-navigation-state';
import { usePersonalPreference } from '../../providers/personal-preference-provider';

type SaveFailureSource = 'PROFILE' | 'RULE' | 'RESET' | null;

export function NotificationPreferences({
  navigationState,
  onNavigationStateChange,
}: {
  navigationState?: NotificationSettingsUrlState;
  onNavigationStateChange?: (
    state: NotificationSettingsUrlState,
    options?: NotificationSettingsNavigationChangeOptions
  ) => void;
} = {}) {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const personalPreference = usePersonalPreference();
  const [draft, setDraft] = useState<NotificationDeliveryProfile | null>(null);
  const [saveState, setSaveState] = useState<NotificationProfileSaveState>('idle');
  const [saveFailureSource, setSaveFailureSource] = useState<SaveFailureSource>(null);
  const [busyType, setBusyType] = useState<string | null>(null);

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
  const endpointsQuery = useQuery({
    queryKey: notificationQueryKeys.deliveryEndpoints(),
    queryFn: ({ signal }) => getNotificationDeliveryEndpoints(signal),
    staleTime: 30_000,
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
  const {
    view,
    section: mobileSection,
    selectedApp,
    selectedAppKey,
    update: updateNavigationState,
  } = useNotificationPreferenceNavigationState({
    apps: effectiveQuery.data?.apps,
    navigationState,
    onNavigationStateChange,
  });
  const effectivePolicyLocked =
    effectiveQuery.isLoading ||
    effectiveQuery.isError ||
    !effectiveQuery.data ||
    effectiveQuery.data.partial;
  const scheduleTimeZone = resolveProductTimeZone(
    personalPreference.preference?.preferences.regional.timeZone,
    draft?.quietHours.timeZone
  );

  const endpointRevokeMutation = useMutation({
    mutationFn: (endpoint: NotificationDeliveryEndpoint) =>
      revokeNotificationDeliveryEndpoint(
        endpoint.endpointId,
        endpoint.version,
        createNotificationIdempotencyKey('delivery-endpoint-revoke')
      ),
    onSuccess: (revoked) => {
      queryClient.setQueryData<NotificationDeliveryEndpoint[]>(
        notificationQueryKeys.deliveryEndpoints(),
        (current) =>
          current?.map((endpoint) =>
            endpoint.endpointId === revoked.endpointId ? revoked : endpoint
          ) ?? [revoked]
      );
      toast.success(t('preferences.endpoints.feedback.revoked'));
    },
    onError: async () => {
      await endpointsQuery.refetch();
      toast.error(t('preferences.endpoints.feedback.revokeFailed'));
    },
  });

  const {
    pending: profileSavePending,
    saveProfile,
    lastError: profileSaveError,
  } = useNotificationProfileSaveController({
    profile: profileQuery.data,
    scheduleTimeZone,
    online,
    onDraftChange: setDraft,
    onSaveStateChange: (state) => {
      setSaveState(state);
      setSaveFailureSource(state === 'error' ? 'PROFILE' : null);
    },
    refetchProfile: () => {
      void profileQuery.refetch();
    },
  });

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
    onMutate: () => {
      setSaveState('saving');
      setSaveFailureSource(null);
    },
    onSuccess: async ({ recovered }) => {
      setSaveState(recovered ? 'recovered' : 'saved');
      setSaveFailureSource(null);
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.effectiveSettings() });
      if (recovered) toast.success(t('preferences.feedback.conflictRecovered'));
    },
    onError: () => {
      setSaveState('error');
      setSaveFailureSource('RULE');
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
    onMutate: () => {
      setSaveState('saving');
      setSaveFailureSource(null);
    },
    onSuccess: async () => {
      setSaveState('saved');
      setSaveFailureSource(null);
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.effectiveSettings() });
    },
    onError: () => {
      setSaveState('error');
      setSaveFailureSource('RESET');
      toast.error(t('preferences.feedback.ruleError'));
    },
    onSettled: () => setBusyType(null),
  });

  if (profileQuery.isLoading) {
    return (
      <NotificationPageFrame>
        <LoadingState
          label={t('states.loadingPreferences')}
          variant="skeleton"
          skeletonRows={8}
          size="page"
        />
      </NotificationPageFrame>
    );
  }
  if (profileQuery.isError || !draft) {
    return (
      <NotificationPageFrame>
        <NotificationErrorState
          error={profileQuery.error}
          title={t('states.preferencesErrorTitle')}
          description={t('states.preferencesErrorDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => void profileQuery.refetch()}
          retrying={profileQuery.isFetching}
          size="page"
        />
      </NotificationPageFrame>
    );
  }

  return (
    <NotificationPageFrame>
      <NotificationPageHeading
        title={t('preferences.title')}
        description={t('preferences.description')}
        actions={
          <NotificationPreferenceSaveIndicator
            state={saveState}
            savedAt={draft.updatedAt}
            error={
              saveFailureSource === 'PROFILE'
                ? profileSaveError
                : saveFailureSource === 'RULE'
                  ? ruleMutation.error
                  : resetMutation.error
            }
            onRetry={saveFailureSource === 'PROFILE' ? () => saveProfile(draft) : undefined}
            retryDisabled={!online || profileSavePending}
          />
        }
      />
      {!online && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t('preferences.offline')}
        </Alert>
      )}
      {(effectiveQuery.isError || effectiveQuery.data?.partial) && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t('preferences.apps.effectivePolicyUnavailable')}
        </Alert>
      )}
      <NotificationPreferenceViewTabs
        view={view}
        onViewChange={(nextView) => updateNavigationState({ view: nextView })}
      />
      <Box
        id="notification-preference-diagnostics-panel"
        role="tabpanel"
        aria-labelledby="notification-preference-diagnostics-tab"
        hidden={view !== 'diagnostics'}
      >
        <NotificationDeliveryStatusPanel
          defaultDiagnosticsOpen
          capabilities={capabilitiesQuery.data}
          profile={draft}
          effectiveSettings={effectiveQuery.data}
          effectiveSettingsFailed={effectiveQuery.isError}
          refreshing={
            profileQuery.isFetching ||
            effectiveQuery.isFetching ||
            capabilitiesQuery.isFetching ||
            endpointsQuery.isFetching
          }
          onRefresh={() => {
            void Promise.all([
              profileQuery.refetch(),
              effectiveQuery.refetch(),
              capabilitiesQuery.refetch(),
              endpointsQuery.refetch(),
            ]);
          }}
          endpoints={endpointsQuery.data}
          endpointsLoading={endpointsQuery.isLoading}
          endpointsFailed={endpointsQuery.isError}
          revokingEndpointId={endpointRevokeMutation.variables?.endpointId}
          onRetryEndpoints={() => void endpointsQuery.refetch()}
          onRevokeEndpoint={async (endpoint) => {
            await endpointRevokeMutation.mutateAsync(endpoint);
          }}
        />
      </Box>
      <Box
        id="notification-preference-settings-panel"
        role="tabpanel"
        aria-labelledby="notification-preference-settings-tab"
        hidden={view !== 'settings'}
        sx={{
          minWidth: 0,
          containerType: 'inline-size',
          containerName: 'notification-preferences',
        }}
      >
        <NotificationPreferenceNavigation
          activeSection={mobileSection}
          onSectionChange={(section) => updateNavigationState({ section })}
        />
        <Box minWidth={0}>
          <PreferenceSection
            id={NOTIFICATION_PREFERENCE_SECTION_IDS.global}
            title={t('preferences.global.title')}
            description={t('preferences.global.description')}
            hidden={mobileSection !== 'global'}
          >
            <NotificationChannelGrid
              profile={draft}
              effectiveSettings={effectiveQuery.data}
              enabledChannels={enabledChannels}
              disabled={!online || effectivePolicyLocked}
              profileIsPending={profileSavePending}
              onChange={(channel, enabled) =>
                saveProfile({ ...draft, channels: { ...draft.channels, [channel]: enabled } })
              }
            />
            {!externalDeliveryEnabled && (
              <Alert
                severity="info"
                sx={{ mt: 1.5, bgcolor: notificationPreferenceSoftBackground }}
              >
                {t('preferences.externalChannelsUnavailable')}
              </Alert>
            )}
          </PreferenceSection>

          <PreferenceSection
            id={NOTIFICATION_PREFERENCE_SECTION_IDS.apps}
            title={t('preferences.apps.title')}
            description={t('preferences.apps.description')}
            hidden={mobileSection !== 'apps'}
          >
            {effectiveQuery.isLoading ? (
              <LoadingState
                label={t('states.loadingAppSettings')}
                variant="skeleton"
                skeletonRows={6}
              />
            ) : effectiveQuery.isError ? (
              <NotificationErrorState
                error={effectiveQuery.error}
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
                    minWidth: 0,
                  }}
                >
                  <Box
                    component="nav"
                    aria-label={t('preferences.apps.navigation')}
                    sx={{
                      borderBottom: 1,
                      borderColor: 'divider',
                      px: { xs: 1.5, md: 2 },
                      py: 0.75,
                      display: 'flex',
                      gap: 0.5,
                      overflowX: 'auto',
                      bgcolor: notificationPreferenceSoftBackground,
                    }}
                  >
                    {(effectiveQuery.data?.apps ?? []).map((app) => (
                      <ActionButton
                        key={app.appKey}
                        intent="quiet"
                        aria-current={app.appKey === selectedAppKey ? 'page' : undefined}
                        onClick={() => updateNavigationState({ appKey: app.appKey })}
                        sx={{
                          width: 'auto',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                          justifyContent: 'flex-start',
                          minHeight: 36,
                          borderRadius: notificationPreferenceRadius,
                          color: app.appKey === selectedAppKey ? 'primary.main' : 'text.secondary',
                          bgcolor: app.appKey === selectedAppKey ? 'background.paper' : undefined,
                        }}
                      >
                        {t(`sources.${app.appKey.toLowerCase()}`, { defaultValue: app.appName })}
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

          <Box hidden={mobileSection !== 'attention'}>
            <NotificationAttentionSettings
              sectionId={NOTIFICATION_PREFERENCE_SECTION_IDS.attention}
            />
          </Box>

          <PreferenceSection
            id={NOTIFICATION_PREFERENCE_SECTION_IDS.quiet}
            title={t('preferences.quiet.title')}
            description={t('preferences.quiet.description')}
            hidden={mobileSection !== 'quiet'}
          >
            <Stack divider={<Divider flexItem />}>
              <PreferenceRow
                icon={MoonStar}
                inlineControl
                title={t('preferences.quiet.enabled')}
                description={t('preferences.quiet.enabledDescription')}
              >
                <Switch
                  checked={draft.quietHours.enabled}
                  disabled={!online}
                  onChange={(event) =>
                    saveProfile({
                      ...draft,
                      quietHours: { ...draft.quietHours, enabled: event.target.checked },
                    })
                  }
                  slotProps={{ input: { 'aria-label': t('preferences.quiet.enabled') } }}
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
                    fullWidth={false}
                    sx={notificationPreferenceControlSx}
                    label={t('preferences.quiet.start')}
                    value={draft.quietHours.start}
                    disabled={!draft.quietHours.enabled || !online}
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
                    fullWidth={false}
                    sx={notificationPreferenceControlSx}
                    label={t('preferences.quiet.end')}
                    value={draft.quietHours.end}
                    disabled={!draft.quietHours.enabled || !online}
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
                  disabled={!online}
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
                inlineControl
                title={t('preferences.quiet.urgentBypass')}
                description={t('preferences.quiet.urgentBypassDescription')}
              >
                <Switch
                  checked={draft.quietHours.allowUrgentBypass}
                  disabled={!online}
                  onChange={(event) =>
                    saveProfile({
                      ...draft,
                      quietHours: {
                        ...draft.quietHours,
                        allowUrgentBypass: event.target.checked,
                      },
                    })
                  }
                  slotProps={{ input: { 'aria-label': t('preferences.quiet.urgentBypass') } }}
                />
              </PreferenceRow>
            </Stack>
          </PreferenceSection>

          <PreferenceSection
            id={NOTIFICATION_PREFERENCE_SECTION_IDS.presentation}
            title={t('preferences.presentation.title')}
            description={t('preferences.presentation.description')}
            hidden={mobileSection !== 'presentation'}
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
                  disabled={!online}
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
                  fullWidth={false}
                  sx={notificationPreferenceControlSx}
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
                  disabled={!online}
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
                  fullWidth={false}
                  sx={notificationPreferenceControlSx}
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
            id={NOTIFICATION_PREFERENCE_SECTION_IDS.digest}
            title={t('preferences.digest.title')}
            description={t('preferences.digest.description')}
            hidden={mobileSection !== 'digest'}
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
                  fullWidth={false}
                  label={t('preferences.digest.mode')}
                  value={draft.digest.mode}
                  disabled={!externalDeliveryEnabled || !online}
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
                  sx={notificationPreferenceControlSx}
                >
                  {(['OFF', 'DAILY', 'WEEKLY'] as const).map((mode) => (
                    <MenuItem key={mode} value={mode}>
                      {t(`preferences.digest.modes.${mode}`)}
                    </MenuItem>
                  ))}
                </FormField>
                <TimePickerField
                  size="small"
                  fullWidth={false}
                  sx={notificationPreferenceControlSx}
                  label={t('preferences.digest.time')}
                  value={draft.digest.deliveryTime}
                  disabled={!externalDeliveryEnabled || draft.digest.mode === 'OFF' || !online}
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
                    fullWidth={false}
                    label={t('preferences.digest.day')}
                    value={draft.digest.dayOfWeek ?? 1}
                    disabled={!externalDeliveryEnabled || !online}
                    onChange={(event) =>
                      saveProfile({
                        ...draft,
                        digest: { ...draft.digest, dayOfWeek: Number(event.target.value) },
                      })
                    }
                    sx={notificationPreferenceControlSx}
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
        </Box>
      </Box>
    </NotificationPageFrame>
  );
}
