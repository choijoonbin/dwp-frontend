import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BriefcaseBusiness,
  ChevronDown,
  Clock3,
  Eye,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';
import { FormDialog } from '@dwp-frontend/design-system/components/dialogs/form-dialog';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProductSurfaceEntryPoint } from '../features/shell/product-entry-point-model';
import type { ProductCompatibilityNavigationTarget } from '../features/shell/product-surface-compatibility-navigation';
import type {
  AllowedSurfaceDecision,
  EffectiveScope,
} from '../features/shell/product-surface-context';

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

/** Navigation needs no authority evidence; server and compatibility entries share this view. */
export type ProductSurfaceNavigationEntry = Pick<
  ProductSurfaceEntryPoint,
  'productId' | 'surfaceId' | 'plane' | 'labelKey' | 'path' | 'entryKind'
>;

export function productSurfaceContentInstanceKey(identity: {
  contextKey: string;
  surfaceKey: string;
  contextScopeKey: string;
  decisionRevision: string;
}): string {
  return [
    identity.contextKey,
    identity.surfaceKey,
    identity.contextScopeKey,
    identity.decisionRevision,
  ].join('\u0000');
}

export function resolveSurfaceExpiryIndicator(
  plane: string,
  revalidateAt: string,
  serverNowMs: number
): { state: 'hidden' | 'warning' | 'expired'; warningDelayMs?: number } {
  if (plane !== 'management') return { state: 'hidden' };
  const expiryMs = Date.parse(revalidateAt);
  if (!Number.isFinite(expiryMs) || !Number.isFinite(serverNowMs)) return { state: 'expired' };
  const remaining = expiryMs - serverNowMs;
  if (remaining <= 0) return { state: 'expired' };
  if (remaining <= 5 * 60_000) return { state: 'warning' };
  return { state: 'hidden', warningDelayMs: remaining - 5 * 60_000 };
}

export function SurfaceExpiryIndicator({ runtime }: { runtime: ProductSurfaceLayoutRuntime }) {
  const { t } = useTranslation('common');
  const [tick, setTick] = useState(0);
  const announcedFor = useRef<string | null>(null);
  const resolution = resolveSurfaceExpiryIndicator(
    runtime.decision.context.plane,
    runtime.decision.revalidateAt,
    runtime.serverNowMs + tick
  );
  useEffect(() => {
    if (resolution.state !== 'hidden' || resolution.warningDelayMs === undefined) return undefined;
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      setTick(Math.max(0, performance.now() - startedAt));
    }, resolution.warningDelayMs);
    return () => window.clearTimeout(timer);
  }, [resolution.state, resolution.warningDelayMs]);
  const announcementKey = `${runtime.decision.decisionRevision}:${runtime.decision.revalidateAt}`;
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
      <Chip
        aria-hidden="true"
        size="small"
        color="warning"
        icon={<ShieldAlert size={14} strokeWidth={1.8} />}
        label={label}
        sx={{ display: { xs: 'none', md: 'inline-flex' } }}
      />
    </>
  );
}

export function ProductSurfaceSwitcher({
  currentSurfaceId,
  entries,
  label,
  resolveLabel,
  onNavigate,
}: {
  currentSurfaceId: string;
  entries: readonly ProductSurfaceNavigationEntry[];
  label: string;
  resolveLabel?: (labelKey: string) => string;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation('common');
  const telemetry = useProductSurfaceTelemetry();
  if (entries.length < 2) return null;
  return (
    <Stack component="nav" aria-label={label} direction="row" gap={0.5} flexWrap="wrap">
      {entries.map((entry) => {
        const Icon = entry.plane === 'management' ? ShieldCheck : BriefcaseBusiness;
        const selected = entry.surfaceId === currentSurfaceId;
        const entryLabel =
          entry.entryKind === 'management-entry'
            ? t('productSurface.labels.appManagement')
            : entry.entryKind === 'work-return'
              ? t('productSurface.labels.returnToWork')
              : (resolveLabel?.(entry.labelKey) ?? entry.labelKey);
        return (
          <ActionButton
            key={entry.surfaceId}
            component={NavLink}
            to={entry.path}
            intent={selected ? 'secondary' : 'quiet'}
            size="small"
            startIcon={<Icon size={15} strokeWidth={1.8} aria-hidden="true" />}
            aria-current={selected ? 'page' : undefined}
            onClick={() => {
              if (!selected) {
                if (entry.entryKind === 'work-return') {
                  telemetry.captureReturn(entry.productId, currentSurfaceId, entry.surfaceId);
                } else {
                  telemetry.beginSurfaceSwitch(entry.productId, currentSurfaceId, entry.surfaceId);
                }
              }
              onNavigate?.();
            }}
          >
            {entryLabel}
          </ActionButton>
        );
      })}
    </Stack>
  );
}

export function ProductSurfaceDisclosure({
  currentSurfaceId,
  entries,
  label,
  resolveLabel,
}: {
  currentSurfaceId: string;
  entries: readonly ProductSurfaceNavigationEntry[];
  label: string;
  resolveLabel?: (labelKey: string) => string;
}) {
  const { t } = useTranslation('common');
  const telemetry = useProductSurfaceTelemetry();
  const disclosureId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const current = entries.find((entry) => entry.surfaceId === currentSurfaceId) ?? entries[0];
  const currentLabel = current
    ? (resolveLabel?.(current.labelKey) ?? current.labelKey)
    : t('productSurface.labels.unknownSurface');

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const firstLink = panelRef.current?.querySelector<HTMLAnchorElement>(
      'a[aria-current="page"], a'
    );
    firstLink?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(true);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  if (!current) return null;
  if (entries.length < 2) {
    return (
      <Typography variant="body2" fontWeight={750} noWrap title={currentLabel}>
        {currentLabel}
      </Typography>
    );
  }

  return (
    <Box sx={{ position: 'relative', minWidth: 0 }}>
      <ActionButton
        ref={triggerRef}
        size="small"
        intent="quiet"
        aria-expanded={open}
        aria-controls={disclosureId}
        aria-label={t('productSurface.labels.currentSurface', { surface: currentLabel })}
        endIcon={<ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />}
        onClick={() => setOpen((value) => !value)}
        sx={{ minHeight: 44, maxWidth: 150, px: 1 }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {currentLabel}
        </Box>
      </ActionButton>
      {open && (
        <Paper
          ref={panelRef}
          id={disclosureId}
          data-testid="product-surface-mobile-disclosure"
          elevation={8}
          sx={{
            position: 'fixed',
            zIndex: (theme) => theme.zIndex.tooltip,
            inset: '72px 12px auto 12px',
            width: 'auto',
            maxWidth: 360,
            p: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography component="p" variant="overline" color="text.secondary" sx={{ pl: 1 }}>
              {label}
            </Typography>
            <ActionIconButton
              label={t('productSurface.actions.closeSurfaceNavigation')}
              onClick={() => close(true)}
              sx={{ width: 40, height: 40 }}
            >
              <X size={18} strokeWidth={1.8} aria-hidden="true" />
            </ActionIconButton>
          </Stack>
          <Box component="nav" aria-label={label}>
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.5 }}>
              {entries.map((entry) => {
                const Icon = entry.plane === 'management' ? ShieldCheck : BriefcaseBusiness;
                const selected = entry.surfaceId === currentSurfaceId;
                const entryLabel =
                  entry.entryKind === 'management-entry'
                    ? t('productSurface.labels.appManagement')
                    : entry.entryKind === 'work-return'
                      ? t('productSurface.labels.returnToWork')
                      : (resolveLabel?.(entry.labelKey) ?? entry.labelKey);
                return (
                  <Box component="li" key={entry.surfaceId}>
                    <ActionButton
                      component={NavLink}
                      to={entry.path}
                      intent={selected ? 'secondary' : 'quiet'}
                      fullWidth
                      startIcon={<Icon size={16} strokeWidth={1.8} aria-hidden="true" />}
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => {
                        if (!selected) {
                          if (entry.entryKind === 'work-return') {
                            telemetry.captureReturn(
                              entry.productId,
                              currentSurfaceId,
                              entry.surfaceId
                            );
                          } else {
                            telemetry.beginSurfaceSwitch(
                              entry.productId,
                              currentSurfaceId,
                              entry.surfaceId
                            );
                          }
                        }
                        close(selected);
                      }}
                      sx={{ minHeight: 44, justifyContent: 'flex-start' }}
                    >
                      {entryLabel}
                    </ActionButton>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
}

export function ProductSurfaceContextBar({ runtime }: { runtime: ProductSurfaceLayoutRuntime }) {
  const { t } = useTranslation('common');
  const telemetry = useProductSurfaceTelemetry();
  const { decision } = runtime;
  const scopes = runtime.availableScopes ?? decision.context.scopes;
  const scopeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const policyLockCapturedRef = useRef<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState(decision.scope.key);
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
    <Stack
      data-testid="product-surface-context-bar"
      data-placement="header"
      direction="row"
      alignItems="center"
      gap={0.75}
      sx={{
        minWidth: 0,
        ml: 1.5,
        pl: 1.5,
        borderLeft: 1,
        borderColor: 'divider',
      }}
    >
      {scopes.length > 1 && runtime.onScopeChange ? (
        <>
          <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            <FormField
              select
              size="small"
              label={scopeLabel}
              value={decision.scope.key}
              onChange={(event) => runtime.onScopeChange?.(event.target.value)}
              sx={{ minWidth: 168, maxWidth: 220 }}
            >
              {scopes.map((scope) => (
                <MenuItem
                  key={scope.key}
                  value={scope.key}
                  disabled={
                    scope.validUntil ? Date.parse(scope.validUntil) <= runtime.serverNowMs : false
                  }
                >
                  {scope.displayName}
                </MenuItem>
              ))}
            </FormField>
          </Box>
          <Box sx={{ display: { xs: 'block', lg: 'none' }, minWidth: 0 }}>
            <ActionButton
              ref={scopeTriggerRef}
              size="small"
              intent="quiet"
              onClick={() => setScopeOpen(true)}
              aria-label={`${scopeLabel}: ${decision.scope.displayName}`}
              sx={{ minHeight: 44, maxWidth: { xs: 112, sm: 176 }, px: 1 }}
            >
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {decision.scope.displayName}
              </Box>
            </ActionButton>
          </Box>
          <FormDialog
            open={scopeOpen}
            title={t('productSurface.scopeChooser.title')}
            description={t('productSurface.scopeChooser.description')}
            cancelLabel={t('actions.cancel')}
            submitLabel={t('productSurface.actions.selectScope')}
            submitDisabled={!selectedScope}
            onClose={closeScope}
            onSubmit={() => {
              if (!selectedScope) return;
              runtime.onScopeChange?.(selectedScope);
              closeScope();
            }}
          >
            <FormField
              select
              label={scopeLabel}
              value={selectedScope}
              onChange={(event) => setSelectedScope(event.target.value)}
            >
              {scopes.map((scope) => (
                <MenuItem
                  key={scope.key}
                  value={scope.key}
                  disabled={
                    scope.validUntil ? Date.parse(scope.validUntil) <= runtime.serverNowMs : false
                  }
                >
                  {scope.displayName}
                  {scope.readOnly ? ` · ${t('productSurface.labels.readOnly')}` : ''}
                </MenuItem>
              ))}
            </FormField>
          </FormDialog>
        </>
      ) : (
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          title={`${scopeLabel}: ${decision.scope.displayName}`}
          sx={{ maxWidth: { xs: 92, sm: 180 } }}
        >
          {scopeLabel}: {decision.scope.displayName}
        </Typography>
      )}
      <Stack
        direction="row"
        alignItems="center"
        gap={0.75}
        sx={{ display: { xs: 'none', xl: 'flex' } }}
      >
        {decision.effectiveReadOnly && (
          <Chip
            size="small"
            icon={<Eye size={14} strokeWidth={1.8} />}
            label={t('productSurface.labels.readOnly')}
          />
        )}
        {expiryLabel && (
          <Chip
            size="small"
            variant="outlined"
            icon={<Clock3 size={14} strokeWidth={1.8} />}
            label={t('productSurface.labels.revalidateAt', { time: expiryLabel })}
          />
        )}
      </Stack>
      <SurfaceExpiryIndicator runtime={runtime} />
    </Stack>
  );
}
