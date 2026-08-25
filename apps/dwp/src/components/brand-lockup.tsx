import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ProductMark } from '@dwp-frontend/design-system/components/product-mark';
import { resolveTenantLogoUrl } from '@dwp-frontend/shared-utils/api/tenant-branding-api';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { MouseEvent as ReactMouseEvent } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';

import { tenantBrandingQueryOptions } from '../features/shell/tenant-branding-query';

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
    ...tenantBrandingQueryOptions,
    enabled: tenantBranded,
  });
  const branding = brandingQuery.data;
  const logoUrl = resolveTenantLogoUrl(branding);
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const organizationName = branding?.organizationName?.trim() || null;
  const showTenantLogo = Boolean(logoUrl) && logoUrl !== failedLogoUrl;
  const showTenantBrandContext = tenantBranded && (showTenantLogo || Boolean(organizationName));
  const logoSlotWidth = variant === 'full' ? 80 : 64;
  const logoSlotHeight = variant === 'full' ? 40 : 32;
  const compact = variant === 'condensed' || variant === 'product-only';
  const accessibleName =
    tenantBranded && branding?.organizationName
      ? t('brand.tenantHomeLabel', { organization: branding.organizationName })
      : t('brand.homeLabel');
  const tenantBrandContext = showTenantBrandContext ? (
    <Box
      data-testid="tenant-brand-context"
      sx={{
        display: 'inline-flex',
        minWidth: 0,
        flex: '0 0 auto',
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <Box
        data-testid="tenant-brand-divider"
        aria-hidden="true"
        sx={{ width: '1px', height: 24, flex: '0 0 1px', bgcolor: 'divider' }}
      />
      <Box
        sx={{
          width: logoSlotWidth,
          height: logoSlotHeight,
          display: 'flex',
          flex: `0 0 ${logoSlotWidth}px`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showTenantLogo ? (
          <Box
            component="img"
            data-testid="tenant-brand-logo"
            src={logoUrl!}
            alt=""
            loading="eager"
            fetchPriority="high"
            onError={() => setFailedLogoUrl(logoUrl)}
            sx={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <Typography
            data-testid="tenant-brand-name-fallback"
            component="span"
            variant="subtitle2"
            title={organizationName ?? undefined}
            noWrap
            sx={{ maxWidth: 1, fontWeight: 750 }}
          >
            {organizationName}
          </Typography>
        )}
      </Box>
    </Box>
  ) : undefined;

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
      suffix={tenantBrandContext}
      sx={sx}
    />
  );
}
