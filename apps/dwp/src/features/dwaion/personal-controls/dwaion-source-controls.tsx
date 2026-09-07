import { CircleAlert, Database, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { DWAION_PERSONAL_CONTROLS_COPY_KO } from './dwaion-personal-controls-copy';

import type { DwaionPersonalControlsCopy } from './dwaion-personal-controls-copy';
import type { DwaionSourcePreference } from './dwaion-personal-controls-model';

export function DwaionSourceControls({
  preferences,
  busySourceKeys = [],
  canManage = true,
  onChange,
  copy = DWAION_PERSONAL_CONTROLS_COPY_KO,
}: {
  preferences: readonly DwaionSourcePreference[];
  busySourceKeys?: readonly string[];
  canManage?: boolean;
  onChange: (sourceKey: string, expectedRevision: number, enabled: boolean) => void;
  copy?: DwaionPersonalControlsCopy;
}) {
  return (
    <Box component="section" aria-labelledby="dwaion-source-controls-title">
      <Stack direction="row" gap={1} alignItems="flex-start">
        <ShieldCheck size={19} aria-hidden="true" />
        <Box>
          <Typography id="dwaion-source-controls-title" component="h2" variant="h6">
            {copy.sourceTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {copy.sourceDescription}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}>
        {preferences.map((preference, index) => {
          const busy = busySourceKeys.includes(preference.sourceKey);
          return (
            <Box key={preference.sourceKey}>
              {index > 0 ? <Divider /> : null}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
                sx={{ minHeight: 64, py: 1, px: { xs: 0, sm: 1 } }}
              >
                <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      flexShrink: 0,
                      width: 40,
                      height: 40,
                      borderRadius: (theme) => theme.shape.borderRadius,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'action.hover',
                    }}
                  >
                    {preference.available ? <Database size={18} /> : <CircleAlert size={18} />}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {preference.label}
                      </Typography>
                      {!preference.available ? (
                        <Chip size="small" variant="outlined" label={copy.unavailable} />
                      ) : null}
                      {preference.available ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          color={preference.effective ? 'success' : 'default'}
                          label={preference.effective ? copy.effective : copy.notEffective}
                        />
                      ) : null}
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
                    >
                      {preference.unavailableReason ?? preference.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {copy.referenceOnly} {copy.separator} {preference.effectScope}
                    </Typography>
                  </Box>
                </Stack>
                <Switch
                  checked={preference.enabled}
                  disabled={!preference.available || busy || !canManage}
                  slotProps={{
                    input: {
                      'aria-label': `${preference.label}: ${
                        preference.enabled ? copy.enabled : copy.disabled
                      }`,
                    },
                  }}
                  onChange={(_, enabled) =>
                    onChange(preference.sourceKey, preference.revision, enabled)
                  }
                />
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
