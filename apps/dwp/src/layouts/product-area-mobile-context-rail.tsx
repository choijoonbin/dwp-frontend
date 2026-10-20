import Box from '@mui/material/Box';

import ProductSurfaceHeaderControls from '../components/product-surface-header-controls';
import { ProductSurfaceContextBarSlot } from '../components/product-surface-context-bar-slot';

import type { ProductSurfaceNavigationEntry } from '../components/product-surface-header-control-model';
import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';

export function ProductAreaMobileContextRail({
  areaKey,
  currentSurfaceId,
  entries,
  label,
  presentationPlane,
  productLabel,
  resolveLabel,
  surface,
  tenantName,
}: Readonly<{
  areaKey: string;
  currentSurfaceId: string;
  entries: readonly ProductSurfaceNavigationEntry[];
  label: string;
  presentationPlane: 'work' | 'management' | undefined;
  productLabel: string;
  resolveLabel: (labelKey: string) => string;
  surface: ProductSurfaceLayoutRuntime | undefined;
  tenantName: string;
}>) {
  return (
    <Box
      sx={{
        width: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
      }}
    >
      <Box
        data-testid={`${areaKey}-mobile-surface-switcher`}
        sx={{ flex: '0 0 auto', minWidth: 0 }}
      >
        <ProductSurfaceHeaderControls
          variant="compact"
          currentSurfaceId={currentSurfaceId}
          entries={entries}
          label={label}
          productLabel={productLabel}
          resolveLabel={resolveLabel}
        />
      </Box>
      {presentationPlane === 'management' ? (
        surface ? (
          <ProductSurfaceContextBarSlot
            runtime={surface}
            variant="mobile-rail"
            tenantLabel={tenantName}
          />
        ) : (
          <Box
            component="span"
            data-testid="product-surface-compatibility-tenant"
            title={tenantName}
            sx={{
              flex: '1 1 auto',
              minWidth: 40,
              ml: 0.5,
              pl: 1,
              overflow: 'hidden',
              borderLeft: 1,
              borderColor: 'divider',
              color: 'text.secondary',
              typography: 'caption',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {tenantName}
          </Box>
        )
      ) : undefined}
    </Box>
  );
}
