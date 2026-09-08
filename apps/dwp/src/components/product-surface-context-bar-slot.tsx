import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';

import Box from '@mui/material/Box';

import type {
  ProductSurfaceContextBar as ProductSurfaceContextBarComponent,
  ProductSurfaceContextBarVariant,
  ProductSurfaceLayoutRuntime,
} from './product-surface-controls';

const loadProductSurfaceContextBar = () =>
  import('./product-surface-controls').then((module) => ({
    default: module.ProductSurfaceContextBar,
  }));
const ProductSurfaceContextBar = lazy(loadProductSurfaceContextBar);
const retryProductSurfaceControlModules = import.meta.glob<{
  ProductSurfaceContextBar: typeof ProductSurfaceContextBarComponent;
}>('./product-surface-controls.tsx', { query: { retry: 'context-bar' } });
const RetryProductSurfaceContextBar = lazy(() => {
  const load = retryProductSurfaceControlModules['./product-surface-controls.tsx'];
  if (!load) return Promise.reject(new Error('Product surface context retry module is missing.'));
  return load().then((module) => ({ default: module.ProductSurfaceContextBar }));
});
const PRODUCT_SURFACE_CONTEXT_RETRY_EVENT = 'dwp:product-surface-context-retry';

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
  onRecover?: (trigger: HTMLButtonElement) => void;
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
            onClick={(event) => onRecover?.(event.currentTarget)}
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
    // The shell stays usable: first load a distinct retry chunk, then offer a full reload if it fails.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ProductSurfaceContextBarResolved({
  children,
  onResolved,
}: {
  children: ReactNode;
  onResolved: () => void;
}) {
  useEffect(() => onResolved(), [onResolved]);
  return children;
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
  const [attempt, setAttempt] = useState<'primary' | 'retry'>('primary');
  const [recoveryAnnouncement, setRecoveryAnnouncement] = useState('');
  const slotRootRef = useRef<HTMLDivElement | null>(null);
  const recoveryRequestedRef = useRef(false);
  const recoveryFocusRequestedRef = useRef(false);
  const recoveryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const ContextBar =
    attempt === 'primary' ? ProductSurfaceContextBar : RetryProductSurfaceContextBar;
  const handleResolved = useCallback(() => {
    if (attempt !== 'retry' || !recoveryRequestedRef.current) return;
    recoveryRequestedRef.current = false;
    setRecoveryAnnouncement(t('productSurface.contextBar.recovered'));
    const trigger = recoveryTriggerRef.current;
    const focusWasRequested = recoveryFocusRequestedRef.current;
    recoveryFocusRequestedRef.current = false;
    recoveryTriggerRef.current = null;
    if (!focusWasRequested) return;
    const focusNeedsRestoring = () => {
      const activeElement = document.activeElement;
      return (
        activeElement === null ||
        activeElement === document.body ||
        activeElement === document.documentElement ||
        activeElement === trigger ||
        (activeElement instanceof HTMLElement && !activeElement.isConnected)
      );
    };
    if (!focusNeedsRestoring()) return;
    window.requestAnimationFrame(() => {
      if (!focusNeedsRestoring()) return;
      const target = slotRootRef.current?.querySelector<HTMLElement>(
        '[data-testid="product-surface-context-bar"]'
      );
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  }, [attempt, t]);
  useEffect(() => {
    const retry = () => setAttempt('retry');
    window.addEventListener(PRODUCT_SURFACE_CONTEXT_RETRY_EVENT, retry);
    return () => window.removeEventListener(PRODUCT_SURFACE_CONTEXT_RETRY_EVENT, retry);
  }, []);

  return (
    <Box ref={slotRootRef} sx={{ display: 'contents' }}>
      <ProductSurfaceContextBarErrorBoundary
        key={attempt}
        fallback={
          <ProductSurfaceContextBarPlaceholder
            loadingLabel={t('labels.loading')}
            failureLabel={t('productSurface.contextBar.loadError')}
            recoveryLabel={t(
              attempt === 'primary'
                ? 'productSurface.contextBar.retry'
                : 'productSurface.contextBar.reloadPage'
            )}
            onRecover={(trigger) => {
              if (attempt === 'retry') {
                window.location.reload();
                return;
              }
              recoveryRequestedRef.current = true;
              recoveryFocusRequestedRef.current = document.activeElement === trigger;
              recoveryTriggerRef.current = trigger;
              setRecoveryAnnouncement('');
              window.dispatchEvent(new Event(PRODUCT_SURFACE_CONTEXT_RETRY_EVENT));
            }}
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
          <ProductSurfaceContextBarResolved onResolved={handleResolved}>
            <ContextBar runtime={runtime} variant={variant} tenantLabel={tenantLabel} />
          </ProductSurfaceContextBarResolved>
        </Suspense>
      </ProductSurfaceContextBarErrorBoundary>
      <Box
        component="span"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="product-surface-context-bar-recovery-status"
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
        {recoveryAnnouncement}
      </Box>
    </Box>
  );
}
