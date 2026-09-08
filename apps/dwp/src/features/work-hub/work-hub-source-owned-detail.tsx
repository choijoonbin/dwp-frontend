import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkHubItem } from './work-hub-contracts';
import { workHubStatusLabelKey } from './work-hub-presentation';

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
          {t(workHubStatusLabelKey(item))}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workHub.detail.priority')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {t(`workHub.priority.${item.priority}`)}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workHub.detail.due')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
          {item.dueAt
            ? formatDate(item.dueAt, { dateStyle: 'medium', timeStyle: 'short' })
            : t('workHub.urgency.NO_DUE_DATE')}
        </Typography>
      </Box>
      {(item.reason || item.summary) && (
        <Box
          sx={{
            p: 2,
            bgcolor: 'action.hover',
            borderInlineStart: 3,
            borderColor: 'primary.main',
            borderRadius: (theme) => `${theme.shape.borderRadius}px`,
          }}
        >
          {[
            ['workHub.detail.whyAssigned', item.reason],
            ['workHub.detail.summary', item.summary === item.reason ? null : item.summary],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <Box key={label} sx={{ '& + &': { mt: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  {t(label!)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
        </Box>
      )}
      <InlineFeedback severity="info">
        {t(`workHub.sourceDetail.${kind}.handoffNotice`)}
      </InlineFeedback>
    </Stack>
  );
}
