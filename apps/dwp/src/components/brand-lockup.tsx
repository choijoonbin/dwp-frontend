import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ProductMark } from '@dwp-frontend/design-system/components/product-mark';
import { getTenantBranding, resolveTenantLogoUrl } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import type { MouseEvent as ReactMouseEvent } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';

type BrandLockupVariant = 'full' | 'condensed' | 'product-full' | 'product-only';

type BrandLockupProps = {
  variant?: BrandLockupVariant;
  label?: string;
  description?: string;
  sx?: SxProps<Theme>;
};

export function BrandLockup({ variant = 'full', label, description, sx }: BrandLockupProps) {
  const { t } = useTranslation('shell');
  const navigate = useNavigate();
  const tenantBranded = variant === 'full' || variant === 'condensed';
  const brandingQuery = useQuery({
    queryKey: ['tenant-branding'],
    queryFn: getTenantBranding,
    enabled: tenantBranded,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const branding = brandingQuery.data;
  const logoUrl = resolveTenantLogoUrl(branding);
  const showTenantLogoSlot = tenantBranded && (brandingQuery.isPending || Boolean(logoUrl));
  const logoSlotWidth = variant === 'full' ? 92 : 56;
  const compact = variant === 'condensed' || variant === 'product-only';
  const accessibleName =
    tenantBranded && branding?.organizationName
      ? t('brand.tenantHomeLabel', { organization: branding.organizationName })
      : t('brand.homeLabel');

  return (
    <ProductMark
      compact={compact}
      label={label}
      description={description}
      aria-label={accessibleName}
      onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        navigate('/');
      }}
      prefix={
        showTenantLogoSlot ? (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: logoSlotWidth,
                height: variant === 'full' ? 30 : 26,
                display: 'flex',
                flex: `0 0 ${logoSlotWidth}px`,
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {logoUrl ? (
                <Box
                  component="img"
                  src={logoUrl}
                  alt=""
                  sx={{ display: 'block', maxWidth: 1, maxHeight: 1, objectFit: 'contain' }}
                />
              ) : (
                <Box
                  aria-hidden="true"
                  sx={{
                    width: '72%',
                    height: '58%',
                    bgcolor: 'action.hover',
                    borderRadius: 0.75,
                  }}
                />
              )}
            </Box>
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
