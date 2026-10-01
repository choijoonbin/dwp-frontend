import { useTranslation } from 'react-i18next';
import { formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderActionItem, ProviderMetric } from '@dwp-frontend/shared-utils';

import { providerActionSeverityPresentation } from './provider-command-center-presentation';

export function ProviderOverviewSeverityChip({
  severity,
}: {
  severity: ProviderActionItem['severity'];
}) {
  const { t } = useTranslation('provider');
  const presentation = providerActionSeverityPresentation(severity);
  const color =
    presentation === 'CRITICAL' ? 'error' : presentation === 'HIGH' ? 'warning' : 'default';

  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      label={t(`command.severity.${presentation}`)}
    />
  );
}

export function ProviderOverviewDistributionList({
  items,
  color,
  labelForKey = (key) => key,
}: {
  items: ProviderMetric[];
  color: string;
  labelForKey?: (key: string) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <Stack gap={1.15}>
      {items.map((item) => (
        <Box key={item.key}>
          <Stack direction="row" justifyContent="space-between" gap={2}>
            <Typography variant="body2" fontWeight={650} noWrap>
              {labelForKey(item.key)}
            </Typography>
            <Typography
              variant="body2"
              fontWeight={750}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatNumber(item.count)}
            </Typography>
          </Stack>
          <Box
            sx={{
              mt: 0.6,
              height: 5,
              overflow: 'hidden',
              bgcolor: 'action.hover',
              borderRadius: 0.5,
            }}
          >
            <Box
              sx={{
                width: `${(item.count / max) * 100}%`,
                height: 1,
                bgcolor: color,
                transition: (theme) => theme.transitions.create('width'),
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
