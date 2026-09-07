import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkHubItem } from './work-hub-contracts';

export function WorkHubSourceOwnedDetail({ item }: { item: WorkHubItem }) {
  const { t } = useTranslation('work');
  const kind = item.reference.sourceSystem.startsWith('APPROVAL')
    ? 'approval'
    : item.reference.sourceSystem === 'SERVICE_REQUEST'
      ? 'service'
      : 'workspace';
  return (
    <Stack gap={2}>
      <Box>
        <Typography component="h3" variant="subtitle1">
          {t(`workHub.sourceDetail.${kind}.title`)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
          {t(`workHub.sourceDetail.${kind}.description`)}
        </Typography>
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(120px, 0.4fr) minmax(0, 1fr)',
          rowGap: 1.25,
        }}
      >
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workHub.sourceDetail.myRole')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {t(`workHub.responsibility.${item.waitingFor}`)}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workHub.sourceDetail.sourceState')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {t(`workHub.sourceStatuses.${item.sourceStatus}`, {
            defaultValue: t('workHub.sourceStatuses.UNKNOWN'),
          })}
        </Typography>
      </Box>
      <InlineFeedback severity="info">
        {t(`workHub.sourceDetail.${kind}.handoffNotice`)}
      </InlineFeedback>
    </Stack>
  );
}
