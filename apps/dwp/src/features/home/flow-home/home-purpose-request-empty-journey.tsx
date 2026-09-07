import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function RequestEmptyJourney() {
  const { t } = useTranslation('home');
  const stages = ['submitted', 'review', 'complete'] as const;
  return (
    <Stack
      data-home-request-empty-journey
      gap={0.55}
      sx={{
        mt: 1,
        display: { xs: 'none', sm: 'flex' },
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {t('flow.purpose.request.emptyJourneyLabel')}
      </Typography>
      <Box
        component="ol"
        aria-label={t('flow.purpose.request.emptyJourneyLabel')}
        sx={{
          p: 0,
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          listStyle: 'none',
        }}
      >
        {stages.map((stage, index) => (
          <Box
            component="li"
            key={stage}
            sx={{
              position: 'relative',
              minWidth: 0,
              display: 'grid',
              justifyItems: 'center',
              gap: 0.4,
              '&::after':
                index < stages.length - 1
                  ? {
                      content: '""',
                      position: 'absolute',
                      top: 5,
                      insetInlineStart: 'calc(50% + 7px)',
                      width: 'calc(100% - 14px)',
                      borderBlockStart: 1,
                      borderColor: 'divider',
                    }
                  : undefined,
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                zIndex: 1,
                width: 11,
                height: 11,
                borderRadius: '50%',
                bgcolor: 'action.disabledBackground',
                border: 2,
                borderColor: 'background.paper',
              }}
            />
            <Typography variant="caption" color="text.secondary" noWrap>
              {t(`flow.purpose.request.emptyJourney.${stage}`)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
