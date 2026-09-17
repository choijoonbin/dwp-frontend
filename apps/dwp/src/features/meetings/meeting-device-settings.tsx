import { foundationTokens } from '@dwp-frontend/design-system';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  CircleOff,
  ImagePlus,
  Mic,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import {
  ActionButton,
  InlineFeedback,
  SectionHeader,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import {
  resolveMeetingBackgroundMode,
  type MeetingDevicePreferences,
} from './meeting-preferences-model';
import type { MeetingBackgroundMode } from './meeting-background-types';
import { useMeetingDevicePreview } from './use-meeting-device-preview';
import { isMeetingBackgroundSupported } from './meeting-background-processor';
import { meetingSurface, meetingShape } from './meeting-visual-system';
import { isMeetingHdVideoSupported } from './meeting-video-quality';
import type { MeetingDeviceDiagnosticSnapshot } from './meeting-device-settings-diagnostics';
import { alpha } from '@mui/material/styles';

export function MeetingDeviceSettings({
  value,
  onChange,
  revocation,
  onDiagnostics,
}: {
  value: MeetingDevicePreferences;
  onChange: (value: MeetingDevicePreferences) => void;
  revocation?: AbortSignal;
  onDiagnostics?: (value: MeetingDeviceDiagnosticSnapshot) => void;
}) {
  const { t } = useTranslation('meetings');
  const preview = useMeetingDevicePreview(revocation);
  const backgroundMode = resolveMeetingBackgroundMode(value);
  const backgroundSupport = {
    blur: isMeetingBackgroundSupported('blur'),
    office: isMeetingBackgroundSupported('office'),
  };
  const selectedBackgroundSupported =
    backgroundMode === 'original' || backgroundSupport[backgroundMode];
  const selectBackground = (nextMode: MeetingBackgroundMode) => {
    const wasPreviewing = preview.states.video !== 'idle';
    preview.stop('video');
    const next = { ...value, backgroundMode: nextMode };
    Reflect.deleteProperty(next, 'backgroundBlur');
    onChange(next);
    if (wasPreviewing) void preview.start('video', next);
  };
  useEffect(() => {
    onDiagnostics?.({
      audio: preview.states.audio,
      video: preview.states.video,
      failure: Boolean(preview.error),
    });
  }, [onDiagnostics, preview.states.audio, preview.states.video, preview.error]);
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
  const hdSupported = isMeetingHdVideoSupported();
  try {
    const constraints =
      typeof navigator === 'undefined'
        ? undefined
        : navigator.mediaDevices?.getSupportedConstraints?.();
    noiseSupported = Boolean(constraints?.noiseSuppression);
  } catch {
    /* Browser device policy can reject capability access. */
  }
  return (
    <Stack gap={{ xs: 2, md: 3 }}>
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
          borderRadius: meetingShape.group,
          p: { xs: 2, md: 3 },
          scrollMarginTop: 12,
          boxShadow: theme.shadows[1],
        })}
      >
        <SectionHeader
          id="meeting-preferences-audio-heading"
          density="compact"
          glyph="surface"
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
            sx={(theme) => ({
              p: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              borderRadius: meetingShape.control,
            })}
          >
            <Stack direction="row" justifyContent="space-between" gap={1}>
              <Typography variant="caption" color="text.secondary">
                {t('preferences.audio.level')}
              </Typography>
              <Typography variant="caption" color="primary.main">
                {t(`preferences.devices.states.${preview.states.audio}`)}
              </Typography>
            </Stack>
            <Box
              role="meter"
              aria-label={t('preferences.audio.level')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={preview.level}
              sx={{
                display: 'flex',
                gap: 0.4,
                p: 0.3,
                my: 1,
                height: 14,
                bgcolor: 'action.hover',
                borderRadius: foundationTokens.radius.compact + 'px',
              }}
            >
              {Array.from({ length: 16 }, (_, index) => (
                <Box
                  key={index}
                  sx={{
                    flex: 1,
                    borderRadius: foundationTokens.radius.compact + 'px',
                    bgcolor:
                      index >= 14
                        ? 'error.main'
                        : index >= 12
                          ? 'warning.main'
                          : index >= 10
                            ? 'primary.main'
                            : 'success.main',
                    opacity:
                      preview.states.audio === 'active' && index < preview.level / 6.25 ? 1 : 0.16,
                  }}
                />
              ))}
            </Box>
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
          <Stack direction="row" gap={1.5} alignItems="center">
            <SelectField
              label={t('preferences.audio.speaker')}
              value={value.speakerId}
              options={options('audiooutput')}
              onValueChange={(id) => selectDevice('speakerId', id)}
              supportingText={t('preferences.audio.outputHint')}
              sx={{ minWidth: 0, flex: 1 }}
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
            labelPlacement="start"
            sx={(theme) => ({
              m: 0,
              p: 1.5,
              justifyContent: 'space-between',
              borderRadius: meetingShape.control,
              bgcolor: alpha(theme.palette.primary.main, 0.045),
            })}
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
          borderRadius: meetingShape.group,
          p: { xs: 2, md: 3 },
          scrollMarginTop: 12,
          boxShadow: theme.shadows[1],
        })}
      >
        <SectionHeader
          id="meeting-preferences-video-heading"
          density="compact"
          glyph="surface"
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
              borderRadius: meetingShape.card,
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
          <Box data-testid="meeting-background-options">
            <Typography variant="caption" color="text.secondary">
              {t('stitch.devices.background')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
                gap: 0.75,
                mt: 0.75,
              }}
            >
              {(
                [
                  { key: 'none', icon: CircleOff },
                  { key: 'blur', icon: Sparkles },
                  { key: 'office', icon: Building2 },
                  { key: 'image', icon: ImagePlus },
                ] as const
              ).map(({ key, icon: Icon }) => {
                const optionMode = key === 'none' ? 'original' : key;
                const selected = optionMode === backgroundMode;
                const supported =
                  optionMode === 'original' ||
                  optionMode === 'image' ||
                  backgroundSupport[optionMode];
                return (
                  <ActionButton
                    key={key}
                    intent={selected ? 'secondary' : 'quiet'}
                    disabled={key === 'image' || !supported}
                    aria-pressed={selected}
                    aria-label={t('stitch.devices.' + key)}
                    onClick={() => {
                      if (optionMode !== 'image') selectBackground(optionMode);
                    }}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.75,
                      py: 1.25,
                      px: 0.5,
                      fontSize: 'caption.fontSize',
                      lineHeight: 'caption.lineHeight',
                      borderRadius: meetingShape.control,
                      border: 1,
                      borderStyle: key === 'image' ? 'dashed' : 'solid',
                      minHeight: 64,
                      borderColor: selected ? 'primary.main' : 'divider',
                      bgcolor: selected ? 'action.selected' : 'action.hover',
                    }}
                  >
                    <Icon size={19} />
                    {t('stitch.devices.' + key)}
                  </ActionButton>
                );
              })}
            </Box>
          </Box>
          {preview.backgroundState === 'loading' && (
            <Typography role="status" variant="caption">
              {t('preferences.video.backgroundProcessing')}
            </Typography>
          )}
          {preview.backgroundState === 'failed' && (
            <InlineFeedback severity="warning">
              {t('preferences.video.backgroundFailed')}
            </InlineFeedback>
          )}
          {!selectedBackgroundSupported && (
            <Typography variant="caption" color="text.secondary">
              {t('preferences.video.backgroundUnsupported')}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {t('preferences.video.backgroundHint')}
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            gap={1}
            sx={(theme) => ({
              p: 1.5,
              borderRadius: meetingShape.control,
              bgcolor: alpha(theme.palette.primary.main, 0.045),
            })}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2">{t('stitch.devices.hd')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('stitch.devices.hdHint')}
              </Typography>
            </Box>
            <Switch
              disabled={!hdSupported && value.hdVideo !== true}
              checked={value.hdVideo === true}
              onChange={(_, checked) => {
                const wasPreviewing = preview.states.video !== 'idle';
                preview.stop('video');
                const next = { ...value, hdVideo: checked };
                onChange(next);
                if (wasPreviewing) void preview.start('video', next);
              }}
              slotProps={{ input: { 'aria-label': t('stitch.devices.hd') } }}
            />
          </Stack>
          {!hdSupported && (
            <Typography variant="caption" color="text.secondary">
              {t('stitch.devices.hdUnsupported')}
            </Typography>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
