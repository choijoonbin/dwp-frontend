import { useQuery } from '@tanstack/react-query';
import { ProductMark } from '@dwp-frontend/design-system';
import { getTenantBranding, resolveTenantLogoUrl } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import type { SxProps, Theme } from '@mui/material/styles';

type BrandLockupVariant = 'full' | 'condensed' | 'product-only';

type BrandLockupProps = {
  variant?: BrandLockupVariant;
  sx?: SxProps<Theme>;
};

export function BrandLockup({ variant = 'full', sx }: BrandLockupProps) {
  const brandingQuery = useQuery({
    queryKey: ['tenant-branding'],
    queryFn: getTenantBranding,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const branding = brandingQuery.data;
  const logoUrl = resolveTenantLogoUrl(branding);
  const showTenantLogo = variant !== 'product-only' && Boolean(logoUrl);
  const accessibleName = branding?.organizationName
    ? `${branding.organizationName} Digital Workplace home`
    : 'Digital Workplace home';

  return (
    <ProductMark
      compact={variant !== 'full'}
      aria-label={accessibleName}
      prefix={
        showTenantLogo ? (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box
              component="img"
              src={logoUrl as string}
              alt=""
              sx={{
                display: 'block',
                width: 'auto',
                maxWidth: variant === 'full' ? 92 : 56,
                height: variant === 'full' ? 30 : 26,
                objectFit: 'contain',
                flexShrink: 1,
              }}
            />
            <Box
              aria-hidden="true"
              sx={{ width: 1, height: 24, flex: '0 0 1px', bgcolor: 'divider' }}
            />
          </Box>
        ) : undefined
      }
      sx={sx}
    />
  );
}
