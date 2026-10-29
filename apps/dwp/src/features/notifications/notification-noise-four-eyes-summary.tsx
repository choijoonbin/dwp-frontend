import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, UserRoundCheck } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { formatDate } from '@dwp-frontend/shared-i18n/lib/formatters';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { NotificationFourEyesPolicy } from './notification-noise-quality-model';

export function NotificationNoiseFourEyesSummary({
  policy,
  onOpenPolicy,
}: {
  policy: NotificationFourEyesPolicy;
  onOpenPolicy?: () => void;
}) {
  const { t } = useTranslation('notifications');
  const titleId = useId();
  const color =
    policy.state === 'ENFORCED'
      ? 'success'
      : policy.state === 'NOT_CONFIGURED'
        ? 'warning'
        : 'default';
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ borderTop: 1, borderColor: 'divider', px: { xs: 1.25, sm: 1.5 }, py: 1.5 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        gap={1}
      >
        <Stack direction="row" gap={1} alignItems="flex-start">
          <UserRoundCheck size={19} aria-hidden />
          <Box minWidth={0}>
            <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
              <Typography id={titleId} component="h3" variant="subtitle2">
                {t('noiseQuality.fourEyes.title')}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={color}
                label={
                  policy.state === 'ENFORCED'
                    ? t('noiseQuality.fourEyes.states.ENFORCED')
                    : policy.state === 'NOT_CONFIGURED'
                      ? t('noiseQuality.fourEyes.states.NOT_CONFIGURED')
                      : t('noiseQuality.fourEyes.states.UNAVAILABLE')
                }
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {policy.summary}
            </Typography>
          </Box>
        </Stack>
        {onOpenPolicy && policy.canOpenPolicy && (
          <ActionButton
            intent="secondary"
            size="small"
            endIcon={<ArrowUpRight size={15} />}
            onClick={onOpenPolicy}
          >
            {t('noiseQuality.fourEyes.openPolicy')}
          </ActionButton>
        )}
      </Stack>
      <Box
        component="ol"
        sx={{
          p: 0,
          m: 0,
          mt: 1.25,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          border: 1,
          borderColor: 'divider',
          listStyle: 'none',
        }}
      >
        {[policy.draftLabel, policy.reviewLabel].map((label, index) => (
          <Box
            component="li"
            key={`${index}-${label}`}
            sx={{
              display: 'grid',
              gridTemplateColumns: '24px minmax(0, 1fr)',
              gap: 0.75,
              p: 1,
              borderRight: { sm: index === 0 ? 1 : 0 },
              borderBottom: { xs: index === 0 ? 1 : 0, sm: 0 },
              borderColor: 'divider',
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 22,
                height: 22,
                display: 'grid',
                placeItems: 'center',
                border: 1,
                borderColor: 'divider',
                borderRadius: '50%',
                typography: 'caption',
              }}
            >
              {index + 1}
            </Box>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {policy.state === 'UNAVAILABLE'
          ? t('noiseQuality.fourEyes.separationUnavailable')
          : policy.state === 'NOT_CONFIGURED'
            ? t('noiseQuality.fourEyes.separationNotConfigured')
            : policy.reviewerSeparationRequired
              ? t('noiseQuality.fourEyes.separationRequired')
              : t('noiseQuality.fourEyes.separationNotRequired')}
        {policy.updatedAt
          ? t('noiseQuality.fourEyes.updated', {
              date: formatDate(policy.updatedAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })
          : ''}
      </Typography>
    </Box>
  );
}
