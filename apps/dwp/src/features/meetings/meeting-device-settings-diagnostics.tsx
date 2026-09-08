import { meetingShape, meetingSoftShadow } from './meeting-visual-system';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Gauge, ShieldCheck, Wifi } from 'lucide-react';
import { SectionHeader } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export type MeetingDeviceDiagnosticSnapshot = {
  audio: 'idle' | 'requesting' | 'active';
  video: 'idle' | 'requesting' | 'active';
  failure: boolean;
};

export function MeetingDeviceSettingsDiagnostics({
  value,
}: {
  value: MeetingDeviceDiagnosticSnapshot;
}) {
  const { t } = useTranslation('meetings');
  const active = Number(value.audio === 'active') + Number(value.video === 'active');
  return (
    <Box
      component="section"
      data-testid="meeting-device-diagnostics"
      aria-label={t('stitch.devices.diagnostics')}
      sx={{
        bgcolor: 'background.paper',
        p: { xs: 2, md: 2.5 },
        borderRadius: meetingShape.group,
        border: 1,
        borderColor: 'divider',
        boxShadow: (theme) => meetingSoftShadow(theme),
      }}
    >
      <SectionHeader
        icon={ShieldCheck}
        glyph="surface"
        density="compact"
        title={t('stitch.devices.diagnostics')}
      />
      <Stack gap={1.25} sx={{ mt: 2 }}>
        <Chip
          size="small"
          color={value.failure ? 'warning' : active === 2 ? 'success' : 'default'}
          label={t(
            value.failure
              ? 'stitch.devices.checkFailed'
              : active === 2
                ? 'stitch.devices.localChecked'
                : 'stitch.devices.checkRequired'
          )}
          sx={{ alignSelf: 'flex-start' }}
        />
        {(
          [
            { key: 'audio', icon: CircleCheck },
            { key: 'video', icon: CircleCheck },
          ] as const
        ).map(({ key, icon: Icon }) => (
          <Stack
            key={key}
            direction="row"
            alignItems="center"
            gap={1}
            sx={(theme) => ({
              p: 1.25,
              bgcolor: alpha(theme.palette.primary.main, 0.045),
              borderRadius: meetingShape.control,
            })}
          >
            <Icon size={18} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {t('preferences.' + key + '.title')}
              </Typography>
              <Typography variant="body2">
                {t('preferences.devices.states.' + value[key])}
              </Typography>
            </Box>
          </Stack>
        ))}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 1 }}>
          {[
            { key: 'latency', icon: Gauge },
            { key: 'loss', icon: Wifi },
          ].map(({ key, icon: Icon }) => (
            <Box
              key={key}
              sx={(theme) => ({
                p: 1.25,
                bgcolor: alpha(theme.palette.primary.main, 0.045),
                borderRadius: meetingShape.control,
              })}
            >
              <Icon size={18} />
              <Typography variant="caption" component="p" color="text.secondary">
                {t('stitch.devices.' + key)}
              </Typography>
              <Typography variant="body2">{t('stitch.devices.unmeasured')}</Typography>
            </Box>
          ))}
        </Box>
        <Box
          sx={(theme) => ({
            p: 1.25,
            bgcolor: alpha(theme.palette.primary.main, 0.055),
            borderRadius: meetingShape.control,
          })}
        >
          <Typography variant="subtitle2">{t('stitch.devices.mediaQuality')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t('stitch.devices.diagnosticsHint')}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
