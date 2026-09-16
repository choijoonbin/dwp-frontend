import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { StudioSectionHeading } from './home-studio-sections';

import type { HomeExperienceVariant, HomeView } from '@dwp-frontend/shared-utils';

export function HomeStudioOverviewSection({
  modeKey,
  selectedView,
  syncing,
  deviceCount,
}: {
  modeKey: HomeExperienceVariant;
  selectedView?: HomeView | null;
  syncing: boolean;
  deviceCount: number;
}) {
  const { t } = useTranslation('homeStudio');
  return (
    <Box data-testid="account-home-overview">
      <StudioSectionHeading title={t('overview.title')} description={t('overview.description')} />
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        gap={2}
        sx={{ borderBlock: 1, borderColor: 'divider', py: 2.5 }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline" color="text.secondary">
            {t('overview.mode')}
          </Typography>
          <Typography variant="h6">{t(`overview.modes.${modeKey}`)}</Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline" color="text.secondary">
            {t('overview.activeView')}
          </Typography>
          <Typography variant="h6">{selectedView?.name ?? t('common.noSelection')}</Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline" color="text.secondary">
            {t('overview.sync')}
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <Chip
              size="small"
              color={syncing ? 'warning' : 'success'}
              label={t(syncing ? 'overview.syncing' : 'overview.synchronized')}
            />
          </Box>
        </Box>
      </Stack>
      <InlineFeedback severity="info" sx={{ mt: 3 }}>
        {t('overview.deviceSummary', { count: deviceCount })}
      </InlineFeedback>
    </Box>
  );
}
