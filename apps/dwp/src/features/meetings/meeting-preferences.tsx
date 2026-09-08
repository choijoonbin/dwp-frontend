import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Accessibility,
  ArrowLeft,
  Bell,
  Check,
  LockKeyhole,
  Mic,
  RotateCcw,
  Save,
  Settings2,
  Video,
} from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  InlineFeedback,
  FormDialog,
  FormField,
  LoadingState,
  PageCanvas,
  SectionHeader,
  SelectField,
} from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import {
  getVideoMeetingPreferences,
  updateVideoMeetingPreferences,
  type VideoMeetingPreferences,
} from '@dwp-frontend/shared-utils/api/video-meeting-preferences-api';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import { MeetingDeviceSettings } from './meeting-device-settings';
import {
  MeetingDeviceSettingsDiagnostics,
  type MeetingDeviceDiagnosticSnapshot,
} from './meeting-device-settings-diagnostics';
import {
  createMeetingIntelligenceAuthorizationFence,
  MeetingIntelligenceAuthorizationSupersededError,
} from './meeting-intelligence-authorization-fence';
import {
  DEFAULT_MEETING_DEVICE_PREFERENCES,
  DEFAULT_MEETING_PREFERENCE_VALUES,
  meetingPreferencesChanged,
  meetingPreferenceScope,
  meetingPreferenceValues,
  readMeetingDevicePreferences,
  writeMeetingDevicePreferences,
} from './meeting-preferences-model';
import { meetingSurface, meetingShape, meetingSoftShadow } from './meeting-visual-system';

export function MeetingPreferences() {
  const { user, isAuthenticated } = useAuth();
  const scope = meetingPreferenceScope({
    isAuthenticated,
    identityPlane: user?.identityPlane,
    tenantId: user?.tenantId,
    userId: user?.userId,
  });
  return (
    <MeetingPreferencesLoader
      key={scope}
      scope={scope}
      enabled={isAuthenticated && Boolean(user)}
    />
  );
}

function MeetingPreferencesLoader({ scope, enabled }: { scope: string; enabled: boolean }) {
  const { t } = useTranslation('meetings');
  const [denied, setDenied] = useState(false);
  const authority = useMemo(
    () => ({
      fence: createMeetingIntelligenceAuthorizationFence(scope),
      media: new AbortController(),
    }),
    [scope]
  );
  const revoke = () => {
    authority.fence.revoke();
    authority.media.abort();
    setDenied(true);
  };
  const query = useQuery({
    queryKey: ['meetings', 'preferences', scope],
    queryFn: async () => {
      const validation = authority.fence.beginValidation();
      try {
        const preferences = await getVideoMeetingPreferences();
        if (!authority.fence.authorize(validation))
          throw new MeetingIntelligenceAuthorizationSupersededError();
        if (authority.media.signal.aborted) authority.media = new AbortController();
        setDenied(false);
        return preferences;
      } catch (error) {
        if (authority.fence.deny(validation) !== null) {
          authority.media.abort();
          setDenied(true);
        }
        throw error;
      }
    },
    enabled,
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  if (!enabled || query.isLoading)
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <LoadingState label={t('preferences.loading')} variant="skeleton" skeletonRows={6} />
      </PageCanvas>
    );
  if (denied || query.isError || !query.data)
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('preferences.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      </PageCanvas>
    );
  return (
    <MeetingPreferencesEditor
      scope={scope}
      initial={query.data}
      authority={authority}
      onRevoke={revoke}
    />
  );
}

type PreferenceAuthority = {
  fence: ReturnType<typeof createMeetingIntelligenceAuthorizationFence>;
  media: AbortController;
};

function authorizationFailure(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status =
    'status' in error
      ? error.status
      : 'response' in error &&
          error.response &&
          typeof error.response === 'object' &&
          'status' in error.response
        ? error.response.status
        : null;
  return status === 401 || status === 403;
}

function MeetingPreferencesEditor({
  scope,
  initial,
  authority,
  onRevoke,
}: {
  scope: string;
  initial: VideoMeetingPreferences;
  authority: PreferenceAuthority;
  onRevoke: () => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const [baseline, setBaseline] = useState(initial);
  const [values, setValues] = useState(() => meetingPreferenceValues(initial));
  const [devices, setDevices] = useState(() => {
    try {
      return readMeetingDevicePreferences(window.localStorage, scope);
    } catch {
      return { ...DEFAULT_MEETING_DEVICE_PREFERENCES };
    }
  });
  const [deviceBaseline, setDeviceBaseline] = useState(devices);
  const [notice, setNotice] = useState<'saved' | 'saveError' | 'localSaveError' | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<MeetingDeviceDiagnosticSnapshot>({
    audio: 'idle',
    video: 'idle',
    failure: false,
  });
  const [activeSection, setActiveSection] = useState('audio');
  const mounted = useRef(false);
  const command = useRef<{ fingerprint: string; key: string } | null>(null);
  const accountDirty = meetingPreferencesChanged(values, meetingPreferenceValues(baseline));
  const localDirty = JSON.stringify(devices) !== JSON.stringify(deviceBaseline);
  const dirty = accountDirty || localDirty;
  const mutation = useMutation({
    mutationFn: async () => {
      const authorization = authority.fence.capture();
      if (!authority.fence.canCommit(authorization))
        throw new MeetingIntelligenceAuthorizationSupersededError();
      const localDevices = { ...devices };
      const fingerprint = JSON.stringify({ ...values, expectedVersion: baseline.version });
      if (command.current?.fingerprint !== fingerprint)
        command.current = { fingerprint, key: crypto.randomUUID() };
      const saved = accountDirty
        ? updateVideoMeetingPreferences({
            ...values,
            expectedVersion: baseline.version,
            idempotencyKey: command.current.key,
          })
        : baseline;
      return { saved: await saved, authorization, localDevices };
    },
    onSuccess: ({ saved, authorization, localDevices }) => {
      if (!mounted.current || !authority.fence.canCommit(authorization)) return;
      setBaseline(saved);
      setValues(meetingPreferenceValues(saved));
      command.current = null;
      queryClient.setQueryData(['meetings', 'preferences', scope], saved);
      try {
        writeMeetingDevicePreferences(window.localStorage, scope, localDevices);
        setDeviceBaseline(localDevices);
        setNotice('saved');
      } catch {
        setNotice('localSaveError');
      }
    },
    onError: (error) => {
      if (!mounted.current) return;
      if (authorizationFailure(error)) onRevoke();
      else setNotice('saveError');
    },
  });
  const blocker = useBlocker(dirty || mutation.isPending);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty && !mutation.isPending) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, mutation.isPending]);
  const sections = [
    { id: 'audio', icon: Mic },
    { id: 'video', icon: Video },
    { id: 'join', icon: Settings2 },
    { id: 'notifications', icon: Bell },
    { id: 'accessibility', icon: Accessibility },
  ] as const;
  const advancedSections = new Set(['notifications', 'accessibility']);
  const revealSection = (id: (typeof sections)[number]['id']) => {
    setActiveSection(id);
    const target = advancedSections.has(id)
      ? 'meeting-preferences-advanced'
      : `meeting-preferences-${id}`;
    if (compact && advancedSections.has(id)) setAdvancedOpen(true);
    document.getElementById(target)?.scrollIntoView({ block: 'start' });
  };
  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Box
        data-testid="meeting-preferences-workspace"
        sx={{
          containerType: 'inline-size',
          minWidth: 0,
          color: 'text.primary',
          overflowWrap: 'anywhere',
          pb: { xs: 15, sm: 0 },
          '& .MuiButton-root': { maxWidth: '100%', minWidth: 0, whiteSpace: 'normal' },
          '& .MuiOutlinedInput-root': {
            borderRadius: meetingShape.control,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025),
          },
          '@media (forced-colors: active)': {
            '&& .MuiTypography-root': {
              color: 'CanvasText',
              WebkitTextFillColor: 'CanvasText',
              backgroundColor: 'Canvas',
            },
            '&& button': {
              color: 'ButtonText',
              WebkitTextFillColor: 'ButtonText',
              backgroundColor: 'ButtonFace',
              borderColor: 'ButtonText',
            },
            '&& button:disabled': { color: 'GrayText', WebkitTextFillColor: 'GrayText' },
          },
        }}
      >
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<ArrowLeft size={15} />}
          onClick={() => navigate('/meetings/mine')}
          sx={{ mb: 1, display: { xs: 'none', md: 'inline-flex' } }}
        >
          {t('navigation.items.meetings.mine.label')}
        </ActionButton>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap={1}
          sx={{ mb: { xs: 2, md: 3 } }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h5" component="h1" sx={{ typography: { xs: 'h6', md: 'h5' } }}>
              {t('preferences.title')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.75, display: { xs: 'none', md: 'block' } }}
            >
              {t('preferences.description')}
            </Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ maxWidth: '100%' }}>
            <ActionButton
              intent="quiet"
              disabled={mutation.isPending}
              startIcon={<RotateCcw size={16} />}
              onClick={() => setResetOpen(true)}
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
            >
              {t('preferences.reset')}
            </ActionButton>
            <ActionButton
              intent="primary"
              disabled={!dirty}
              loading={mutation.isPending}
              startIcon={<Save size={16} />}
              aria-label={t(compact ? 'stitch.devices.saveShort' : 'preferences.save')}
              onClick={() => {
                setNotice(null);
                mutation.mutate();
              }}
            >
              {t(compact ? 'stitch.devices.saveShort' : 'preferences.save')}
            </ActionButton>
          </Stack>
        </Stack>
        {notice && (
          <InlineFeedback severity={notice === 'saved' ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {t(`preferences.${notice}`)}
          </InlineFeedback>
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr)',
            '@container (min-width: 850px)': {
              gridTemplateColumns: 'minmax(0,8fr) minmax(260px,4fr)',
            },
            gap: { xs: 2, md: 3 },
            alignItems: 'start',
          }}
        >
          <Box
            component="nav"
            aria-label={t('preferences.sections')}
            sx={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              bgcolor: 'action.hover',
              p: 0.5,
              borderRadius: meetingShape.control,
              gap: 0.5,
            }}
          >
            {sections.map((section) => (
              <ActionButton
                key={section.id}
                intent="quiet"
                size="small"
                startIcon={<section.icon size={16} />}
                onClick={() => revealSection(section.id)}
                aria-current={activeSection === section.id ? 'location' : undefined}
                sx={{
                  justifyContent: 'center',
                  flex: { xs: '0 0 auto', md: 1 },
                  minHeight: 44,
                  px: 1.25,
                  whiteSpace: 'nowrap',
                  bgcolor: activeSection === section.id ? 'background.paper' : 'transparent',
                  color: activeSection === section.id ? 'primary.main' : 'text.secondary',
                  borderRadius: meetingShape.inset,
                }}
              >
                {t(`preferences.${section.id}.title`)}
              </ActionButton>
            ))}
          </Box>
          <Stack
            direction="row"
            alignItems="start"
            gap={1.25}
            data-testid="meeting-device-storage-banner"
            sx={{
              gridColumn: '1 / -1',
              p: 2,
              bgcolor: 'action.selected',
              borderRadius: meetingShape.card,
            }}
          >
            <LockKeyhole size={21} style={{ flexShrink: 0 }} />
            <Box>
              <Typography variant="subtitle2">{t('stitch.devices.storageTitle')}</Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, display: { xs: 'none', md: 'block' } }}
              >
                {t('preferences.privacy.deviceHint')} {t('preferences.privacy.accountHint')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: { xs: 'block', md: 'none' } }}
              >
                {t('stitch.devices.storageMobile')}
              </Typography>
            </Box>
          </Stack>
          <Box
            component="fieldset"
            disabled={mutation.isPending}
            sx={{
              minWidth: 0,
              m: 0,
              p: 0,
              border: 0,
            }}
          >
            <MeetingDeviceSettings
              value={devices}
              onChange={setDevices}
              revocation={authority.media.signal}
              onDiagnostics={setDiagnostics}
            />
            <Box
              component="section"
              id="meeting-preferences-join"
              aria-labelledby="meeting-preferences-join-heading"
              sx={(theme) => ({
                ...meetingSurface(theme),
                borderRadius: meetingShape.group,
                p: { xs: 2, md: 3 },
                mt: 2,
                scrollMarginTop: 12,
                boxShadow: theme.shadows[1],
              })}
            >
              <SectionHeader
                density="compact"
                glyph="surface"
                id="meeting-preferences-join-heading"
                icon={Settings2}
                title={t('preferences.join.title')}
              />
              <FormField
                label={t('preferences.join.displayName')}
                value={values.displayName}
                inputProps={{ maxLength: 100 }}
                onChange={(event) =>
                  setValues((current) => ({ ...current, displayName: event.target.value }))
                }
                sx={{ mt: 2 }}
              />
              <Stack gap={1} sx={{ mt: 1.5, mb: 1.5 }}>
                {(['microphoneOff', 'cameraOff', 'prejoinEnabled'] as const).map((key) => (
                  <FormControlLabel
                    key={key}
                    labelPlacement="start"
                    sx={{
                      m: 0,
                      p: 1.5,
                      justifyContent: 'space-between',
                      bgcolor: 'action.hover',
                      borderRadius: meetingShape.control,
                      '& .MuiFormControlLabel-label': {
                        fontSize: 'body2.fontSize',
                        fontWeight: 'fontWeightMedium',
                      },
                    }}
                    control={
                      <Switch
                        checked={values[key]}
                        onChange={(_, checked) =>
                          setValues((current) => ({ ...current, [key]: checked }))
                        }
                      />
                    }
                    label={t(`preferences.join.${key}`)}
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {t('preferences.join.applyHint')}
              </Typography>
            </Box>
            <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 2 }}>
              <MeetingDeviceSettingsDiagnostics value={diagnostics} />
            </Box>
            <Box
              component="details"
              id="meeting-preferences-advanced"
              open={!compact || advancedOpen}
              onToggle={(event) => {
                if (compact) setAdvancedOpen(event.currentTarget.open);
              }}
              sx={(theme) => ({
                ...meetingSurface(theme),
                borderRadius: meetingShape.group,
                mt: 2,
                p: { xs: 0, sm: 3 },
                boxShadow: theme.shadows[1],
                scrollMarginTop: 12,
                '& > summary': {
                  display: { xs: 'flex', sm: 'none' },
                  minHeight: 52,
                  px: 2,
                  py: 1,
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  listStyle: 'none',
                },
                '& > summary::-webkit-details-marker': { display: 'none' },
                '& > summary:focus-visible': {
                  outline: `3px solid ${theme.palette.primary.main}`,
                  outlineOffset: -3,
                },
                '&[open] > summary': { borderBottom: 1, borderColor: 'divider' },
              })}
            >
              <Stack component="summary">
                <Bell size={18} aria-hidden="true" />
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                  {t('preferences.notifications.title')} · {t('preferences.accessibility.title')}
                </Typography>
                <Typography component="span" color="primary.main" aria-hidden="true">
                  +
                </Typography>
              </Stack>
              <Box sx={{ p: { xs: 2, sm: 0 } }}>
                <Box
                  component="section"
                  id="meeting-preferences-notifications"
                  aria-labelledby="meeting-preferences-notifications-heading"
                  sx={{ scrollMarginTop: 12 }}
                >
                  <SectionHeader
                    density="compact"
                    glyph="plain"
                    id="meeting-preferences-notifications-heading"
                    icon={Bell}
                    title={t('preferences.notifications.title')}
                  />
                  <Stack gap={1} sx={{ mt: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={values.reminderEnabled}
                          onChange={(_, checked) =>
                            setValues((current) => ({ ...current, reminderEnabled: checked }))
                          }
                        />
                      }
                      label={t('preferences.notifications.reminder')}
                    />
                    <SelectField<number>
                      label={t('preferences.notifications.reminderTime')}
                      value={values.reminderMinutes}
                      disabled={!values.reminderEnabled}
                      options={[...new Set([0, 5, 10, 15, 30, values.reminderMinutes])]
                        .sort((a, b) => a - b)
                        .map((value) => ({
                          value,
                          label: t('preferences.notifications.minutesBefore', { count: value }),
                        }))}
                      onValueChange={(value) => {
                        if (typeof value === 'number')
                          setValues((current) => ({ ...current, reminderMinutes: value }));
                      }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={values.recapNotifications}
                          onChange={(_, checked) =>
                            setValues((current) => ({ ...current, recapNotifications: checked }))
                          }
                        />
                      }
                      label={t('preferences.notifications.recap')}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t('preferences.notifications.deliveryHint')}
                    </Typography>
                  </Stack>
                </Box>
                <Box
                  component="section"
                  id="meeting-preferences-accessibility"
                  aria-labelledby="meeting-preferences-accessibility-heading"
                  sx={{ pt: 3, mt: 3, borderTop: 1, borderColor: 'divider', scrollMarginTop: 12 }}
                >
                  <SectionHeader
                    density="compact"
                    glyph="plain"
                    id="meeting-preferences-accessibility-heading"
                    icon={Accessibility}
                    title={t('preferences.accessibility.title')}
                  />
                  <FormField
                    label={t('preferences.accessibility.language')}
                    value={i18n.resolvedLanguage ?? i18n.language}
                    disabled
                    sx={{ mt: 2 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t('preferences.accessibility.globalHint')}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
          <Stack gap={2.5} component="aside" aria-label={t('preferences.privacy.title')}>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <MeetingDeviceSettingsDiagnostics value={diagnostics} />
            </Box>
            <Box
              sx={(theme) => ({
                ...meetingSurface(theme),
                borderRadius: meetingShape.group,
                p: { xs: 0, sm: 2.5 },
                boxShadow: theme.shadows[1],
              })}
            >
              <Box component="details" open={!compact || undefined}>
                <Stack
                  component="summary"
                  direction="row"
                  alignItems="center"
                  gap={1}
                  sx={(theme) => ({
                    display: { xs: 'flex', sm: 'none' },
                    minHeight: 52,
                    px: 2,
                    py: 1,
                    cursor: 'pointer',
                    listStyle: 'none',
                    '&::-webkit-details-marker': { display: 'none' },
                    '&:focus-visible': {
                      outline: `3px solid ${theme.palette.primary.main}`,
                      outlineOffset: -3,
                    },
                  })}
                >
                  <LockKeyhole size={18} aria-hidden="true" />
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    {t('preferences.privacy.title')}
                  </Typography>
                  <Typography component="span" color="primary.main" aria-hidden="true">
                    +
                  </Typography>
                </Stack>
                <Box sx={{ p: { xs: 2, sm: 0 } }}>
                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                    <SectionHeader
                      density="compact"
                      glyph="plain"
                      icon={LockKeyhole}
                      title={t('preferences.privacy.title')}
                    />
                  </Box>
                  <Stack gap={2} sx={{ mt: { xs: 0, sm: 2 } }}>
                    {['device', 'account', 'consent'].map((key) => (
                      <Box key={key}>
                        <Typography variant="subtitle2">
                          {t(`preferences.privacy.${key}Title`)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {t(`preferences.privacy.${key}Hint`)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                  <Stack direction="row" gap={0.75} alignItems="center" sx={{ mt: 2.5 }}>
                    <Check size={16} />
                    <Typography variant="caption">
                      {t('preferences.version', { version: baseline.version })}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            </Box>
          </Stack>
        </Box>
      </Box>
      <Stack
        data-testid="meeting-preferences-save-dock"
        component="footer"
        gap={0.5}
        sx={{
          display: { xs: 'flex', sm: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          p: 2,
          pb: 'max(12px, env(safe-area-inset-bottom))',
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderTop: 1,
          borderColor: 'divider',
          boxShadow: (theme) => meetingSoftShadow(theme),
        }}
      >
        <ActionButton
          intent="primary"
          disabled={!dirty}
          loading={mutation.isPending}
          startIcon={<Save size={17} />}
          onClick={() => {
            setNotice(null);
            mutation.mutate();
          }}
          sx={{ minHeight: 44 }}
        >
          {t('preferences.save')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          disabled={mutation.isPending}
          onClick={() => setResetOpen(true)}
          sx={{ minHeight: 44 }}
        >
          {t('preferences.reset')}
        </ActionButton>
      </Stack>
      <FormDialog
        open={resetOpen}
        title={t('preferences.reset')}
        description={t('preferences.resetHint')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('preferences.reset')}
        onClose={() => setResetOpen(false)}
        onSubmit={() => {
          setValues({ ...DEFAULT_MEETING_PREFERENCE_VALUES });
          setDevices({ ...DEFAULT_MEETING_DEVICE_PREFERENCES });
          setResetOpen(false);
          setNotice(null);
        }}
      >
        {null}
      </FormDialog>
      <FormDialog
        open={blocker.state === 'blocked'}
        title={t('preferences.unsavedTitle')}
        description={t('preferences.unsavedDescription')}
        cancelLabel={t('preferences.keepEditing')}
        submitLabel={t('preferences.leave')}
        submitDisabled={mutation.isPending}
        onClose={() => blocker.reset?.()}
        onSubmit={() => blocker.proceed?.()}
      >
        {null}
      </FormDialog>
    </PageCanvas>
  );
}
