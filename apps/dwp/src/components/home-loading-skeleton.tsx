import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { shellHeaderHeight } from '../features/shell/shell-registry';

type HomeLoadingSkeletonProps = {
  reserveHeader?: boolean;
};

const skeletonSurface = {
  bgcolor: 'action.hover',
  borderRadius: 0.75,
} as const;

export function HomeLoadingSkeleton({ reserveHeader = false }: HomeLoadingSkeletonProps) {
  return (
    <Box
      aria-hidden="true"
      data-testid="home-loading-skeleton"
      sx={{ pt: reserveHeader ? `${shellHeaderHeight}px` : 0 }}
    >
      <Box sx={{ minHeight: { xs: 720, md: 438 }, bgcolor: 'action.hover' }}>
        <Box
          sx={{
            width: 1,
            maxWidth: 2240,
            minHeight: 'inherit',
            mx: 'auto',
            px: { xs: 2, md: '50px' },
            py: { xs: 2, md: 3 },
          }}
        >
          <Box sx={{ ...skeletonSurface, width: { xs: 136, md: 176 }, height: 14 }} />
          <Box sx={{ ...skeletonSurface, mt: 1.25, width: { xs: '82%', md: 420 }, height: 32 }} />
          <Box sx={{ ...skeletonSurface, mt: 1, width: { xs: '94%', md: 640 }, height: 18 }} />
          <Box
            sx={{
              mt: { xs: 4, md: 5 },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
              gap: { xs: 1.5, md: 2 },
            }}
          >
            {[0, 1, 2, 3].map((index) => (
              <Box
                key={index}
                sx={{
                  height: { xs: 124, md: 222 },
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  opacity: 0.58,
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          width: 1,
          maxWidth: 2240,
          mx: 'auto',
          px: { xs: 2, md: '50px' },
          py: { xs: 3, md: 4 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 2fr 1fr' },
          gap: 2,
        }}
      >
        {[240, 240, 240].map((height, index) => (
          <Box key={index} sx={{ ...skeletonSurface, height }} />
        ))}
      </Box>
    </Box>
  );
}

export function HomeRouteFallback() {
  const { t } = useTranslation('common');

  return (
    <Box role="status" aria-live="polite">
      <HomeLoadingSkeleton />
      <Typography
        sx={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      >
        {t('labels.loadingPage')}
      </Typography>
    </Box>
  );
}
