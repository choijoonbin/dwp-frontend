import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';

import Box from '@mui/material/Box';

import type {
  ProductSurfaceContextBarVariant,
  ProductSurfaceLayoutRuntime,
} from './product-surface-controls';

const loadProductSurfaceContextBar = () =>
  import('./product-surface-controls').then((module) => ({
    default: module.ProductSurfaceContextBar,
  }));
const ProductSurfaceContextBar = lazy(loadProductSurfaceContextBar);

function ProductSurfaceContextBarPlaceholder({
  loadingLabel,
  failureLabel,
  recoveryLabel,
  onRecover,
  variant,
}: {
  loadingLabel: string;
  failureLabel?: string;
  recoveryLabel?: string;
  onRecover?: () => void;
  variant: ProductSurfaceContextBarVariant;
}) {
  const mobileRail = variant === 'mobile-rail';
  const failed = Boolean(failureLabel && recoveryLabel && onRecover);
  return (
    <Box
      data-testid={
        failed ? 'product-surface-context-bar-recovery' : 'product-surface-context-bar-loading'
      }
      role={failed ? undefined : 'status'}
      aria-live={failed ? undefined : 'polite'}
      aria-busy={failed ? undefined : 'true'}
      sx={{
        minWidth: mobileRail ? 64 : { xs: 112, sm: 180, lg: 220, xl: 456 },
        flex: mobileRail ? '1 1 auto' : undefined,
        minHeight: 44,
        ml: mobileRail ? 0.5 : 1.5,
        pl: mobileRail ? 0.5 : 1.5,
        borderLeft: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {failed ? (
        <>
          <Box
            component="span"
            role="alert"
            sx={{
              position: 'absolute',
              width: 1,
              height: 1,
              p: 0,
              m: -1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {failureLabel}
          </Box>
          <ActionButton
            intent="quiet"
            size="small"
            onClick={onRecover}
            sx={{ minWidth: 44, minHeight: 44, px: 1 }}
          >
            {recoveryLabel}
          </ActionButton>
        </>
      ) : (
        <>
          <Box
            component="span"
            sx={{
              position: 'absolute',
              width: 1,
              height: 1,
              p: 0,
              m: -1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {loadingLabel}
          </Box>
          <Box
            aria-hidden="true"
            sx={{
              width: mobileRail ? '100%' : { xs: 80, sm: 132, lg: 148, xl: 384 },
              maxWidth: mobileRail ? 132 : undefined,
              height: 24,
              borderRadius: 999,
              bgcolor: 'action.hover',
            }}
          />
        </>
      )}
    </Box>
  );
}

class ProductSurfaceContextBarErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The shell remains usable. Reload is required because failed module imports may be cached.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ProductSurfaceContextBarSlot({
  runtime,
  variant = 'header',
  tenantLabel,
}: {
  runtime: ProductSurfaceLayoutRuntime;
  variant?: ProductSurfaceContextBarVariant;
  tenantLabel?: string;
}) {
  const { t } = useTranslation('common');

  return (
    <ProductSurfaceContextBarErrorBoundary
      fallback={
        <ProductSurfaceContextBarPlaceholder
          loadingLabel={t('labels.loading')}
          failureLabel={t('productSurface.contextBar.loadError')}
          recoveryLabel={t('productSurface.contextBar.reloadPage')}
          onRecover={() => window.location.reload()}
          variant={variant}
        />
      }
    >
      <Suspense
        fallback={
          <ProductSurfaceContextBarPlaceholder
            loadingLabel={t('labels.loading')}
            variant={variant}
          />
        }
      >
        <ProductSurfaceContextBar runtime={runtime} variant={variant} tenantLabel={tenantLabel} />
      </Suspense>
    </ProductSurfaceContextBarErrorBoundary>
  );
}
