import { useTranslation } from 'react-i18next';
import { Mic, RefreshCw, ShieldCheck, Video, VideoOff, Volume2 } from 'lucide-react';
import {
  ActionButton,
  foundationTokens,
  InlineFeedback,
  ProgressMeter,
  SectionHeader,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import type { MeetingDevicePreferences } from './meeting-preferences-model';
import { useMeetingDevicePreview } from './use-meeting-device-preview';
import { meetingSurface } from './meeting-visual-system';

export function MeetingDeviceSettings({
  value,
  onChange,
  revocation,
}: {
  value: MeetingDevicePreferences;
  onChange: (value: MeetingDevicePreferences) => void;
  revocation?: AbortSignal;
}) {
  const { t } = useTranslation('meetings');
  const preview = useMeetingDevicePreview(revocation);
  const options = (kind: MediaDeviceKind) => {
    const selected =
      kind === 'audioinput'
        ? value.microphoneId
        : kind === 'audiooutput'
          ? value.speakerId
          : value.cameraId;
    return [
      { value: 'default', label: t('preferences.devices.systemDefault') },
      ...preview.devices
        .filter(
          (device) => device.kind === kind && device.deviceId && device.deviceId !== 'default'
        )
        .map((device, index) => ({
          value: device.deviceId,
          label: device.label || t('preferences.devices.unnamed', { count: index + 1 }),
        })),
      ...(selected !== 'default' &&
      !preview.devices.some((device) => device.kind === kind && device.deviceId === selected)
        ? [{ value: selected, label: t('preferences.devices.savedUnavailable') }]
        : []),
    ];
  };
  const selectDevice = (key: 'microphoneId' | 'cameraId' | 'speakerId', id: string) => {
    if (key !== 'speakerId') preview.stop(key === 'microphoneId' ? 'audio' : 'video');
    else preview.stopSpeaker();
    onChange({ ...value, [key]: id });
  };
  let noiseSupported = false;
  try {
    noiseSupported =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getSupportedConstraints?.().noiseSuppression);
  } catch {
    /* Browser device policy can reject capability access. */
  }
  return (
    <Stack gap={3}>
      {preview.error && (
        <InlineFeedback severity="warning">
          {t(`preferences.devices.errors.${preview.error}`)}
        </InlineFeedback>
      )}
      <Box
        component="section"
        id="meeting-preferences-audio"
        aria-labelledby="meeting-preferences-audio-heading"
        sx={(theme) => ({
          ...meetingSurface(theme),
          p: { xs: 2, md: 3 },
          scrollMarginTop: 12,
          boxShadow: theme.shadows[1],
        })}
      >
        <SectionHeader
          id="meeting-preferences-audio-heading"
          density="compact"
          glyph="plain"
          icon={Mic}
          title={t('preferences.audio.title')}
          meta={
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => void preview.refresh()}
              startIcon={<RefreshCw size={14} />}
            >
              {t('preferences.devices.refresh')}
            </ActionButton>
          }
        />
        <Stack gap={2} sx={{ mt: 2 }}>
          <SelectField
            label={t('preferences.audio.microphone')}
            value={value.microphoneId}
            options={options('audioinput')}
            onValueChange={(id) => selectDevice('microphoneId', id)}
            supportingText={t('preferences.devices.permissionHint')}
          />
          <Box
            sx={{
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: foundationTokens.radius.surface + 'px',
            }}
          >
            <ProgressMeter
              value={preview.level}
              label={t('preferences.audio.level')}
              valueLabel={t(`preferences.devices.states.${preview.states.audio}`)}
            />
            <ActionButton
              intent="secondary"
              size="small"
              onClick={() =>
                preview.states.audio === 'idle'
                  ? void preview.start('audio', value)
                  : preview.stop('audio')
              }
              startIcon={<Mic size={16} />}
              sx={{ mt: 1.5, minHeight: 44 }}
            >
              {t(
                preview.states.audio === 'idle'
                  ? 'preferences.audio.start'
                  : 'preferences.devices.stop'
              )}
            </ActionButton>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {t('preferences.audio.localOnly')}
            </Typography>
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1.5}
            alignItems={{ sm: 'flex-start' }}
          >
            <SelectField
              label={t('preferences.audio.speaker')}
              value={value.speakerId}
              options={options('audiooutput')}
              onValueChange={(id) => selectDevice('speakerId', id)}
              supportingText={t('preferences.audio.outputHint')}
            />
            <ActionButton
              intent="secondary"
              loading={preview.speakerActive}
              onClick={() => void preview.testSpeaker(value.speakerId)}
              startIcon={<Volume2 size={16} />}
              sx={{ minHeight: 44, flexShrink: 0 }}
            >
              {t('preferences.audio.testSpeaker')}
            </ActionButton>
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={value.noiseSuppression}
                disabled={!noiseSupported}
                onChange={(_, checked) => onChange({ ...value, noiseSuppression: checked })}
              />
            }
            label={t('preferences.audio.noiseSuppression')}
          />
          {!noiseSupported && (
            <Typography variant="caption" color="text.secondary">
              {t('preferences.devices.unsupportedFeature')}
            </Typography>
          )}
        </Stack>
      </Box>
      <Box
        component="section"
        id="meeting-preferences-video"
        aria-labelledby="meeting-preferences-video-heading"
        sx={(theme) => ({
          ...meetingSurface(theme),
          p: { xs: 2, md: 3 },
          scrollMarginTop: 12,
          boxShadow: theme.shadows[1],
        })}
      >
        <SectionHeader
          id="meeting-preferences-video-heading"
          density="compact"
          glyph="plain"
          icon={Video}
          title={t('preferences.video.title')}
        />
        <Stack gap={2} sx={{ mt: 2 }}>
          <SelectField
            label={t('preferences.video.camera')}
            value={value.cameraId}
            options={options('videoinput')}
            onValueChange={(id) => selectDevice('cameraId', id)}
          />
          <Box
            sx={{
              position: 'relative',
              aspectRatio: '16 / 9',
              width: '100%',
              minWidth: 0,
              minHeight: 160,
              bgcolor: 'grey.900',
              color: 'common.white',
              borderRadius: foundationTokens.radius.surface + 'px',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Box
              component="video"
              ref={preview.video}
              autoPlay
              playsInline
              muted
              aria-label={t('preferences.video.preview')}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: preview.states.video === 'active' ? 'block' : 'none',
              }}
            />
            {preview.states.video !== 'active' && (
              <Stack alignItems="center" gap={1}>
                <VideoOff size={32} aria-hidden="true" />
                <Typography variant="body2">
                  {t(`preferences.devices.states.${preview.states.video}`)}
                </Typography>
              </Stack>
            )}
            <Box
              sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              <ShieldCheck size={14} />
              <Typography variant="caption">{t('preferences.video.localOnly')}</Typography>
            </Box>
          </Box>
          <ActionButton
            intent="secondary"
            onClick={() =>
              preview.states.video === 'idle'
                ? void preview.start('video', value)
                : preview.stop('video')
            }
            startIcon={<Video size={16} />}
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            {t(
              preview.states.video === 'idle'
                ? 'preferences.video.start'
                : 'preferences.devices.stop'
            )}
          </ActionButton>
          <Typography variant="body2" color="text.secondary">
            {t('preferences.video.backgroundHint')}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}
