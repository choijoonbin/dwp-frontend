import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { shellHeaderHeight } from '../features/shell/shell-registry';

export function ProductSurfaceLoadingShell({
  productId,
  surfaceId,
}: {
  productId?: string;
  surfaceId?: string;
}) {
  const { t } = useTranslation('common');
  return (
    <Box
      data-testid="product-surface-loading-shell"
      data-loading-product={productId}
      data-loading-surface={surfaceId}
      role="status"
      aria-busy="true"
      aria-label={t('productSurface.loading.label')}
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      <Box
        component="header"
        sx={{
          position: 'fixed',
          inset: '0 0 auto 0',
          zIndex: (theme) => theme.zIndex.appBar,
          height: shellHeaderHeight,
          px: { xs: 2, lg: 3 },
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Skeleton variant="rounded" width={34} height={34} />
        <Skeleton variant="text" width={112} />
        <Skeleton
          variant="rounded"
          width={176}
          height={36}
          sx={{ display: { xs: 'none', sm: 'block' } }}
        />
        <Box sx={{ flex: 1 }} />
        <Skeleton variant="circular" width={36} height={36} />
      </Box>
      <Box
        component="aside"
        sx={{
          position: 'fixed',
          inset: `${shellHeaderHeight}px auto 0 0`,
          width: 272,
          p: 2.5,
          display: { xs: 'none', lg: 'block' },
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
        }}
      >
        <Skeleton variant="text" width="62%" />
        <Stack gap={1.25} sx={{ mt: 2.5 }}>
          {[72, 88, 76, 92].map((width) => (
            <Skeleton key={width} variant="rounded" width={`${width}%`} height={40} />
          ))}
        </Stack>
      </Box>
      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        sx={{
          ml: { xs: 0, lg: '272px' },
          minHeight: '100dvh',
          p: { xs: 2, md: 3 },
          pt: {
            xs: `calc(${shellHeaderHeight}px + 24px)`,
            md: `calc(${shellHeaderHeight}px + 32px)`,
          },
        }}
      >
        <Skeleton variant="text" width="min(360px, 70%)" height={44} />
        <Skeleton variant="text" width="min(560px, 90%)" />
        <Stack gap={1.5} sx={{ mt: 4 }}>
          {[1, 2, 3].map((row) => (
            <Skeleton key={row} variant="rounded" width="100%" height={72} />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
