import { lazy, Suspense, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, Eye, ShieldAlert } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

import type { ProductSurfaceEntryPoint } from '../features/shell/product-entry-point-model';
import type { ProductCompatibilityNavigationTarget } from '../features/shell/product-surface-compatibility-navigation';
import type {
  AllowedSurfaceDecision,
  EffectiveScope,
} from '../features/shell/product-surface-context';

const ProductSurfaceScopeDialog = lazy(() => import('./product-surface-scope-dialog'));

function SurfaceStatusBadge({
  children,
  outlined = false,
  ariaHidden,
  hideBelowXl = false,
  compact = false,
  label,
  testId,
}: {
  children: ReactNode;
  outlined?: boolean;
  ariaHidden?: boolean;
  hideBelowXl?: boolean;
  compact?: boolean;
  label?: string;
  testId?: string;
}) {
  return (
    <Box
      component="span"
      role={!ariaHidden && label ? 'img' : undefined}
      aria-hidden={ariaHidden ? 'true' : undefined}
      aria-label={ariaHidden ? undefined : label}
      title={label}
      data-testid={testId}
      sx={{
        minHeight: 24,
        minWidth: compact ? 28 : undefined,
        maxWidth: compact ? { xs: 96, md: 240 } : undefined,
        px: compact ? { xs: 0.5, md: 1 } : 1,
        display: hideBelowXl ? { xs: 'none', xl: 'inline-flex' } : 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 0.25 : 0.5,
        flex: '0 0 auto',
        overflow: 'hidden',
        border: 1,
        borderColor: outlined ? 'divider' : 'transparent',
        borderRadius: 999,
        bgcolor: outlined ? 'transparent' : 'action.selected',
        color: 'text.secondary',
        typography: 'caption',
        fontWeight: 650,
        '@media (forced-colors: active)': {
          borderColor: 'CanvasText',
          color: 'CanvasText',
        },
      }}
    >
      {children}
    </Box>
  );
}

export type ProductSurfaceLayoutRuntime = {
  decision: AllowedSurfaceDecision;
  label: string;
  /** Must be derived from the server-generated clock offset, never the local wall clock alone. */
  serverNowMs: number;
  entryPoints?: readonly ProductSurfaceEntryPoint[];
  availableScopes?: readonly EffectiveScope[];
  onScopeChange?: (contextScopeKey: string) => void;
  returnTarget?: { path: string; label: string };
  compatibilityNavigation?: boolean;
  compatibilityNavigationTargets?: ReadonlyMap<string, ProductCompatibilityNavigationTarget>;
};

export type SurfaceExpiryResolution = {
  state: 'hidden' | 'warning' | 'expired';
  warningDelayMs?: number;
};

export function resolveSurfaceExpiryIndicator(
  plane: string,
  revalidateAt: string,
  serverNowMs: number
): SurfaceExpiryResolution {
  if (plane !== 'management') return { state: 'hidden' };
  const expiryMs = Date.parse(revalidateAt);
  if (!Number.isFinite(expiryMs) || !Number.isFinite(serverNowMs)) return { state: 'expired' };
  const remaining = expiryMs - serverNowMs;
  if (remaining <= 0) return { state: 'expired' };
  if (remaining <= 5 * 60_000) return { state: 'warning' };
  return { state: 'hidden', warningDelayMs: remaining - 5 * 60_000 };
}

export function resolveSurfaceExpiryTransitionDelay(
  resolution: SurfaceExpiryResolution,
  remainingMs: number
): number | undefined {
  if (resolution.state === 'hidden') return resolution.warningDelayMs;
  if (resolution.state === 'warning' && remainingMs > 0) return remainingMs;
  return undefined;
}

export function surfaceExpiryAnnouncementKey(
  decisionRevision: string,
  revalidateAt: string,
  state: 'hidden' | 'warning' | 'expired'
): string {
  return `${decisionRevision}:${revalidateAt}:${state}`;
}

export type SurfaceExpiryClock = Readonly<{
  identity: string;
  elapsedMs: number;
}>;

export function surfaceExpiryClockIdentity(
  decisionRevision: string,
  serverNowMs: number,
  revalidateAt: string
): string {
  return `${decisionRevision}:${serverNowMs}:${revalidateAt}`;
}

export function resolveSurfaceExpiryClockElapsed(
  clock: SurfaceExpiryClock,
  identity: string
): number {
  return clock.identity === identity ? clock.elapsedMs : 0;
}

export function resetSurfaceExpiryClock(
  clock: SurfaceExpiryClock,
  identity: string
): SurfaceExpiryClock {
  return clock.identity === identity ? clock : { identity, elapsedMs: 0 };
}

export function advanceSurfaceExpiryClock(
  clock: SurfaceExpiryClock,
  identity: string,
  elapsedMs: number
): SurfaceExpiryClock {
  if (clock.identity !== identity) return clock;
  return { identity, elapsedMs: clock.elapsedMs + Math.max(0, elapsedMs) };
}

export function SurfaceExpiryIndicator({
  runtime,
  compact = false,
}: {
  runtime: ProductSurfaceLayoutRuntime;
  compact?: boolean;
}) {
  const { t } = useTranslation('common');
  const clockIdentity = surfaceExpiryClockIdentity(
    runtime.decision.decisionRevision,
    runtime.serverNowMs,
    runtime.decision.revalidateAt
  );
  const [clock, setClock] = useState<SurfaceExpiryClock>(() => ({
    identity: clockIdentity,
    elapsedMs: 0,
  }));
  const announcedFor = useRef<string | null>(null);
  const elapsedMs = resolveSurfaceExpiryClockElapsed(clock, clockIdentity);
  const resolution = resolveSurfaceExpiryIndicator(
    runtime.decision.context.plane,
    runtime.decision.revalidateAt,
    runtime.serverNowMs + elapsedMs
  );
  const remainingMs = Date.parse(runtime.decision.revalidateAt) - (runtime.serverNowMs + elapsedMs);
  const nextTransitionDelayMs = resolveSurfaceExpiryTransitionDelay(resolution, remainingMs);
  useEffect(() => {
    setClock((current) => resetSurfaceExpiryClock(current, clockIdentity));
  }, [clockIdentity]);
  useEffect(() => {
    if (nextTransitionDelayMs === undefined) return undefined;
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      const elapsed = Math.max(0, performance.now() - startedAt);
      setClock((current) => advanceSurfaceExpiryClock(current, clockIdentity, elapsed));
    }, nextTransitionDelayMs);
    return () => window.clearTimeout(timer);
  }, [clockIdentity, nextTransitionDelayMs]);
  const announcementKey = surfaceExpiryAnnouncementKey(
    runtime.decision.decisionRevision,
    runtime.decision.revalidateAt,
    resolution.state
  );
  const shouldAnnounce = announcedFor.current !== announcementKey;
  useEffect(() => {
    if (resolution.state !== 'hidden' && shouldAnnounce) {
      announcedFor.current = announcementKey;
    }
  }, [announcementKey, resolution.state, shouldAnnounce]);
  if (resolution.state === 'hidden') return null;
  const label = t(
    resolution.state === 'expired'
      ? 'productSurface.expiry.revalidating'
      : 'productSurface.expiry.warning'
  );
  const compactLabel = t(
    resolution.state === 'expired'
      ? 'productSurface.expiry.revalidatingCompact'
      : 'productSurface.expiry.warningCompact'
  );
  return (
    <>
      <Box
        component="span"
        role={shouldAnnounce ? 'status' : undefined}
        aria-live={shouldAnnounce ? 'polite' : undefined}
        aria-hidden={shouldAnnounce ? undefined : true}
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
        {label}
      </Box>
      <SurfaceStatusBadge
        outlined
        hideBelowXl={!compact}
        compact={compact}
        label={label}
        testId={compact ? 'product-surface-expiry-status' : undefined}
      >
        <ShieldAlert size={14} strokeWidth={1.8} />
        {compact ? <Box component="span">{compactLabel}</Box> : label}
      </SurfaceStatusBadge>
    </>
  );
}

export type ProductSurfaceContextBarVariant = 'header' | 'mobile-rail';

function SingleScopeDisclosure({
  fullLabel,
  mobileRail,
}: {
  fullLabel: string;
  mobileRail: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip
      arrow
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      title={fullLabel}
      enterDelay={400}
      enterTouchDelay={0}
      leaveTouchDelay={4_000}
    >
      <Box
        component="button"
        type="button"
        data-testid="product-surface-single-scope"
        aria-label={fullLabel}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        sx={{
          display: mobileRail ? 'block' : { xs: 'none', xl: 'block' },
          flex: mobileRail ? '1 1 auto' : undefined,
          minWidth: 0,
          maxWidth: mobileRail ? 'none' : { xs: 92, sm: 180 },
          p: 0,
          overflow: 'hidden',
          border: 0,
          borderRadius: 0.5,
          color: 'text.secondary',
          bgcolor: 'transparent',
          typography: 'caption',
          textAlign: 'start',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          appearance: 'none',
          cursor: 'help',
          '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
          '@media (forced-colors: active)': {
            '&:focus-visible': { outlineColor: 'Highlight' },
          },
        }}
      >
        {fullLabel}
      </Box>
    </Tooltip>
  );
}

export function ProductSurfaceContextBar({
  runtime,
  variant = 'header',
  tenantLabel,
}: {
  runtime: ProductSurfaceLayoutRuntime;
  variant?: ProductSurfaceContextBarVariant;
  tenantLabel?: string;
}) {
  const { t } = useTranslation('common');
  const telemetry = useProductSurfaceTelemetry();
  const { decision } = runtime;
  const scopes = runtime.availableScopes ?? decision.context.scopes;
  const scopeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const policyLockCapturedRef = useRef<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState(decision.scope.key);
  const scopeDialogId = useId();
  const mobileRail = variant === 'mobile-rail';
  const mobileContextPrefix = mobileRail && tenantLabel ? `${tenantLabel} · ` : '';
  const expiresAt = Date.parse(decision.revalidateAt);
  const expiryLabel = Number.isFinite(expiresAt)
    ? formatDate(decision.revalidateAt, { dateStyle: 'medium', timeStyle: 'short' })
    : undefined;
  const scopeLabel =
    decision.context.plane === 'management'
      ? t('productSurface.labels.managementScope')
      : t('productSurface.labels.workScope');

  useEffect(() => setSelectedScope(decision.scope.key), [decision.scope.key]);

  useEffect(() => {
    if (!decision.effectiveReadOnly) return;
    if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/u.test(decision.context.surfaceKey)) return;
    const identity = `${decision.context.surfaceKey}:${decision.decisionRevision}`;
    if (policyLockCapturedRef.current === identity) return;
    policyLockCapturedRef.current = identity;
    telemetry.capturePolicyLockViewed(
      decision.context.productKey,
      decision.context.surfaceKey,
      decision.context.accessMode === 'PROVIDER_SUPPORT' ? 'SUPPORT' : 'READ_ONLY'
    );
  }, [
    decision.context.accessMode,
    decision.context.productKey,
    decision.context.surfaceKey,
    decision.decisionRevision,
    decision.effectiveReadOnly,
    telemetry,
  ]);

  const closeScope = () => {
    setScopeOpen(false);
    window.requestAnimationFrame(() => scopeTriggerRef.current?.focus());
  };

  return (
    <>
      <Box
        data-testid="product-surface-context-bar"
        data-placement={mobileRail ? 'mobile-rail' : 'header'}
        sx={{
          display: mobileRail ? 'flex' : scopes.length <= 1 ? { xs: 'none', lg: 'flex' } : 'flex',
          alignItems: 'center',
          gap: mobileRail ? 0.25 : 0.75,
          flex: mobileRail ? '1 1 auto' : undefined,
          minWidth: 0,
          ml: mobileRail ? 0.5 : 1.5,
          pl: mobileRail ? 0.5 : 1.5,
          borderLeft: 1,
          borderColor: 'divider',
        }}
      >
        {scopes.length > 1 && runtime.onScopeChange ? (
          <>
            <Box sx={{ display: mobileRail ? 'none' : { xs: 'none', lg: 'block' } }}>
              <Box
                component="select"
                aria-label={scopeLabel}
                value={decision.scope.key}
                onChange={(event) => runtime.onScopeChange?.(event.target.value)}
                sx={{
                  minWidth: 168,
                  maxWidth: 220,
                  minHeight: 40,
                  px: 1.25,
                  color: 'text.primary',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  font: 'inherit',
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 2,
                  },
                }}
              >
                {scopes.map((scope) => (
                  <option
                    key={scope.key}
                    value={scope.key}
                    disabled={
                      scope.validUntil ? Date.parse(scope.validUntil) <= runtime.serverNowMs : false
                    }
                  >
                    {scope.displayName}
                  </option>
                ))}
              </Box>
            </Box>
            <Box
              sx={{
                display: mobileRail ? 'block' : { xs: 'block', lg: 'none' },
                minWidth: 0,
                flex: mobileRail ? '1 1 auto' : undefined,
              }}
            >
              <Box
                component="button"
                type="button"
                ref={scopeTriggerRef}
                onClick={() => setScopeOpen(true)}
                aria-label={`${mobileContextPrefix}${scopeLabel}: ${decision.scope.displayName}`}
                aria-haspopup="dialog"
                aria-expanded={scopeOpen}
                aria-controls={scopeOpen ? scopeDialogId : undefined}
                sx={{
                  minHeight: 44,
                  width: mobileRail ? 1 : undefined,
                  maxWidth: mobileRail ? 'none' : { xs: 112, sm: 176 },
                  minWidth: 0,
                  px: mobileRail ? 0.5 : 1,
                  border: 0,
                  borderRadius: 1,
                  color: 'text.primary',
                  bgcolor: 'transparent',
                  font: 'inherit',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 2,
                  },
                }}
              >
                <Box
                  component="span"
                  sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {mobileContextPrefix}
                  {mobileRail ? `${t('productSurface.labels.scope')}: ` : ''}
                  {decision.scope.displayName}
                </Box>
              </Box>
            </Box>
            {scopeOpen && (
              <Suspense
                fallback={
                  <Box
                    role="status"
                    aria-live="polite"
                    data-testid="product-surface-scope-dialog-loading"
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
                    {t('labels.loading')}
                  </Box>
                }
              >
                <Box id={scopeDialogId}>
                  <ProductSurfaceScopeDialog
                    open
                    title={t('productSurface.scopeChooser.title')}
                    description={t('productSurface.scopeChooser.description')}
                    cancelLabel={t('actions.cancel')}
                    submitLabel={t('productSurface.actions.selectScope')}
                    scopeLabel={scopeLabel}
                    scopes={scopes}
                    selectedScope={selectedScope}
                    serverNowMs={runtime.serverNowMs}
                    readOnlyLabel={t('productSurface.labels.readOnly')}
                    onSelectedScopeChange={setSelectedScope}
                    onClose={closeScope}
                    onSubmit={() => {
                      if (!selectedScope) return;
                      runtime.onScopeChange?.(selectedScope);
                      closeScope();
                    }}
                  />
                </Box>
              </Suspense>
            )}
          </>
        ) : (
          <SingleScopeDisclosure
            fullLabel={`${mobileContextPrefix}${mobileRail ? t('productSurface.labels.scope') : scopeLabel}: ${decision.scope.displayName}`}
            mobileRail={mobileRail}
          />
        )}
        <Box
          sx={{
            display: mobileRail ? 'flex' : { xs: 'none', lg: 'flex' },
            alignItems: 'center',
            gap: mobileRail ? 0.25 : 0.75,
          }}
        >
          {decision.effectiveReadOnly && (
            <SurfaceStatusBadge
              compact={mobileRail}
              label={t('productSurface.labels.readOnly')}
              testId="product-surface-read-only-status"
            >
              <Eye size={14} strokeWidth={1.8} />
              {mobileRail ? (
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                  {t('productSurface.labels.readOnly')}
                </Box>
              ) : (
                t('productSurface.labels.readOnly')
              )}
            </SurfaceStatusBadge>
          )}
          {expiryLabel && (
            <SurfaceStatusBadge
              outlined
              compact={mobileRail}
              label={t('productSurface.labels.revalidateAt', { time: expiryLabel })}
              testId="product-surface-revalidation-status"
            >
              <Clock3 size={14} strokeWidth={1.8} />
              {mobileRail ? (
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                  {t('productSurface.labels.revalidateAt', { time: expiryLabel })}
                </Box>
              ) : (
                <>
                  <Box component="span" sx={{ display: { lg: 'inline', xl: 'none' } }}>
                    {t('productSurface.labels.revalidation')}
                  </Box>
                  <Box component="span" sx={{ display: { lg: 'none', xl: 'inline' } }}>
                    {t('productSurface.labels.revalidateAt', { time: expiryLabel })}
                  </Box>
                </>
              )}
            </SurfaceStatusBadge>
          )}
        </Box>
      </Box>
      <SurfaceExpiryIndicator runtime={runtime} compact={mobileRail} />
    </>
  );
}
