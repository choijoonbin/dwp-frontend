import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  ActionButton,
  ProgressMeter,
  SectionHeader,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { MeetingPrejoinSession } from './use-meeting-prejoin-session';
import { MeetingPreJoinSpeaker } from './meeting-prejoin-speaker';
import { meetingInsetSurface, meetingShape, meetingSurface } from './meeting-visual-system';
import { meetingBackgroundSupported } from './meeting-background-processor';

export function MeetingPrejoinDevices({
  session,
  busy,
  speakerDeviceId,
  onSpeakerDeviceChange,
}: {
  session: MeetingPrejoinSession;
  busy: boolean;
  speakerDeviceId: string;
  onSpeakerDeviceChange: (id: string) => void;
}) {
  const { t } = useTranslation('meetings');
  const { preview, choices } = session;
  const [backgroundSupport] = useState(() => ({
    blur: meetingBackgroundSupported('blur'),
    office: meetingBackgroundSupported('office'),
  }));
  const selectedBackgroundSupported =
    session.backgroundMode === 'original' || backgroundSupport[session.backgroundMode];
  const options = (kind: MediaDeviceKind, selected: string) => {
    const devices = preview.devices.filter(
      (item) => item.kind === kind && item.deviceId && item.deviceId !== 'default'
    );
    return [
      { value: 'default', label: t('preferences.devices.systemDefault') },
      ...devices.map((item, index) => ({
        value: item.deviceId,
        label: item.label || t('preferences.devices.unnamed', { count: index + 1 }),
      })),
      ...(selected !== 'default' && !devices.some((item) => item.deviceId === selected)
        ? [{ value: selected, label: t('preferences.devices.savedUnavailable') }]
        : []),
    ];
  };
  return (
    <Stack gap={2} sx={{ minWidth: 0 }}>
      <Box
        component="section"
        className="dwp-meeting-prejoin__stage"
        aria-labelledby="meeting-local-preview-heading"
        sx={(theme) => ({ ...meetingSurface(theme), p: { xs: 1.5, md: 2 }, color: 'text.primary' })}
      >
        <SectionHeader
          id="meeting-local-preview-heading"
          icon={Camera}
          glyph="plain"
          density="compact"
          title={t('preferences.video.preview')}
          meta={t('room.preJoin.localOnly')}
        />
        <Box
          className="lk-video-container"
          sx={(theme) => ({
            mt: 1.5,
            position: 'relative',
            minWidth: 0,
            width: '100%',
            maxWidth: '100%',
            aspectRatio: '16/9',
            minHeight: { xs: 180, md: 300 },
            overflow: 'hidden',
            bgcolor: theme.palette.grey[900],
            borderRadius: meetingShape.stage,
            color: theme.palette.common.white,
          })}
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
              position: 'absolute',
              inset: 0,
              objectFit: 'cover',
              transform: 'scaleX(-1)',
              visibility: choices.videoEnabled ? 'visible' : 'hidden',
            }}
          />
          {!choices.videoEnabled && (
            <Stack
              className="lk-camera-off-note"
              gap={1}
              alignItems="center"
              justifyContent="center"
              sx={{ position: 'absolute', inset: 0, pb: 5 }}
            >
              <Avatar
                sx={{
                  width: { xs: 56, md: 80 },
                  height: { xs: 56, md: 80 },
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontSize: 'h5.fontSize',
                  '@media (forced-colors: active)': {
                    color: 'CanvasText',
                    bgcolor: 'Canvas',
                    border: '1px solid CanvasText',
                  },
                }}
              >
                {session.username.trim().slice(0, 2) || <CameraOff aria-hidden="true" />}
              </Avatar>
              <Typography variant="caption">{t('room.preJoin.design.cameraOff')}</Typography>
            </Stack>
          )}
          <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={(theme) => ({
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              color: theme.palette.common.white,
            })}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            <Typography variant="caption">
              {t('room.preJoin.privatePreview')} · {t('room.preJoin.localOnly')}
            </Typography>
          </Stack>
          <Stack
            className="lk-button-group-container"
            direction="row"
            justifyContent="center"
            gap={1}
            sx={{ position: 'absolute', bottom: 12, left: 8, right: 8 }}
          >
            {(['audio', 'video'] as const).map((kind) => {
              const active = preview.states[kind] === 'active';
              const Icon = kind === 'audio' ? (active ? Mic : MicOff) : active ? Camera : CameraOff;
              return (
                <ActionButton
                  key={kind}
                  className="lk-button"
                  intent="secondary"
                  aria-pressed={active}
                  disabled={busy}
                  loading={preview.states[kind] === 'requesting'}
                  onClick={() => session.toggle(kind)}
                  startIcon={<Icon size={17} aria-hidden="true" />}
                  sx={(theme) => ({
                    minHeight: 44,
                    minWidth: 0,
                    borderRadius: meetingShape.control,
                    bgcolor: active ? theme.palette.success.dark : theme.palette.grey[800],
                    borderColor: active ? theme.palette.success.light : theme.palette.grey[500],
                    color: theme.palette.common.white,
                    '&:hover': {
                      bgcolor: active ? theme.palette.success.dark : theme.palette.grey[700],
                    },
                  })}
                >
                  {t(kind === 'audio' ? 'room.microphone' : 'room.camera')}
                </ActionButton>
              );
            })}
          </Stack>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
          {t('room.preJoin.privacyNote')}
        </Typography>
      </Box>
      <Box
        component="section"
        data-testid="meeting-prejoin-device-deck"
        sx={(theme) => ({ ...meetingSurface(theme), p: { xs: 2, md: 2.5 } })}
      >
        <SectionHeader
          icon={SlidersHorizontal}
          glyph="plain"
          density="compact"
          title={t('room.preJoin.design.deviceDeck')}
        />
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          <Stack gap={1.5} sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5, minWidth: 0 })}>
            <SectionHeader
              icon={Mic}
              glyph="plain"
              density="compact"
              title={t('preferences.audio.microphone')}
            />
            <SelectField
              label={t('preferences.audio.microphone')}
              value={choices.audioDeviceId}
              options={options('audioinput', choices.audioDeviceId)}
              disabled={busy}
              onValueChange={(id) => session.select('audio', id)}
            />
            <ProgressMeter
              label={t('preferences.audio.level')}
              valueLabel={t(`preferences.devices.states.${preview.states.audio}`)}
              tone="success"
              value={choices.audioEnabled ? preview.level : 0}
            />
            <Typography variant="caption" color="text.secondary">
              {t(
                session.noiseSuppression
                  ? 'room.preJoin.design.noiseEnabled'
                  : 'room.preJoin.design.noiseDisabled'
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('preferences.devices.permissionHint')}
            </Typography>
          </Stack>
          <Stack gap={1.5} sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5, minWidth: 0 })}>
            <SectionHeader
              icon={Camera}
              glyph="plain"
              density="compact"
              title={t('preferences.video.camera')}
            />
            <SelectField
              label={t('preferences.video.camera')}
              value={choices.videoDeviceId}
              options={options('videoinput', choices.videoDeviceId)}
              disabled={busy}
              onValueChange={(id) => session.select('video', id)}
            />
            <Stack direction="row" gap={1} alignItems="center">
              <Sparkles size={16} aria-hidden="true" />
              <Typography variant="subtitle2">{t('room.preJoin.design.background')}</Typography>
            </Stack>
            <Stack role="group" aria-label={t('room.preJoin.design.background')} gap={0.75}>
              <ActionButton
                size="small"
                intent={session.backgroundMode === 'original' ? 'primary' : 'secondary'}
                aria-pressed={session.backgroundMode === 'original'}
                disabled={busy}
                onClick={() => session.selectBackgroundMode('original')}
                sx={{ minHeight: 44 }}
              >
                {t('room.preJoin.design.backgroundOriginal')}
              </ActionButton>
              <Stack direction="row" gap={0.75}>
                <ActionButton
                  intent={session.backgroundMode === 'blur' ? 'primary' : 'secondary'}
                  aria-pressed={session.backgroundMode === 'blur'}
                  disabled={busy || !backgroundSupport.blur}
                  size="small"
                  onClick={() => session.selectBackgroundMode('blur')}
                  sx={{ flex: 1, minHeight: 44, minWidth: 0, whiteSpace: 'normal' }}
                >
                  {t('room.preJoin.design.backgroundBlur')}
                </ActionButton>
                <ActionButton
                  intent={session.backgroundMode === 'office' ? 'primary' : 'secondary'}
                  aria-pressed={session.backgroundMode === 'office'}
                  disabled={busy || !backgroundSupport.office}
                  size="small"
                  onClick={() => session.selectBackgroundMode('office')}
                  sx={{ flex: 1, minHeight: 44, minWidth: 0, whiteSpace: 'normal' }}
                >
                  {t('room.preJoin.design.backgroundOffice')}
                </ActionButton>
              </Stack>
            </Stack>
            {(!selectedBackgroundSupported ||
              preview.backgroundState === 'loading' ||
              preview.backgroundState === 'failed') && (
              <Typography
                variant="caption"
                color={preview.backgroundState === 'failed' ? 'error.main' : 'text.secondary'}
                role="status"
              >
                {t(
                  !selectedBackgroundSupported
                    ? 'preferences.video.backgroundUnsupported'
                    : preview.backgroundState === 'failed'
                      ? 'preferences.video.backgroundFailed'
                      : 'preferences.video.backgroundProcessing'
                )}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {t('preferences.video.backgroundHint')}
            </Typography>
          </Stack>
          <MeetingPreJoinSpeaker
            compact
            disabled={busy}
            speakerDeviceId={speakerDeviceId}
            onSpeakerDeviceChange={onSpeakerDeviceChange}
          />
        </Box>
      </Box>
    </Stack>
  );
}
