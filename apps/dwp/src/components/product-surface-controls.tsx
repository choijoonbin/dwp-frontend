import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BriefcaseBusiness, Clock3, Eye, ShieldAlert, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProductSurfaceEntryPoint } from '../features/shell/product-entry-point-model';
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
};

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
  return (
    <Chip
      size="small"
      color="warning"
      icon={<ShieldAlert size={14} strokeWidth={1.8} />}
      label={t(
        resolution.state === 'expired'
          ? 'productSurface.expiry.revalidating'
          : 'productSurface.expiry.warning'
      )}
      role={shouldAnnounce ? 'status' : undefined}
      aria-live={shouldAnnounce ? 'polite' : undefined}
    />
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
  entries: readonly ProductSurfaceEntryPoint[];
  label: string;
  resolveLabel?: (labelKey: string) => string;
  onNavigate?: () => void;
}) {
  const telemetry = useProductSurfaceTelemetry();
  if (entries.length < 2) return null;
  return (
    <Stack component="nav" aria-label={label} direction="row" gap={0.5} flexWrap="wrap">
      {entries.map((entry) => {
        const Icon = entry.plane === 'management' ? ShieldCheck : BriefcaseBusiness;
        const selected = entry.surfaceId === currentSurfaceId;
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
                telemetry.beginSurfaceSwitch(entry.productId, currentSurfaceId, entry.surfaceId);
              }
              onNavigate?.();
            }}
          >
            {resolveLabel?.(entry.labelKey) ?? entry.labelKey}
          </ActionButton>
        );
      })}
    </Stack>
  );
}

export function ProductSurfaceContextBar({ runtime }: { runtime: ProductSurfaceLayoutRuntime }) {
  const { t } = useTranslation('common');
  const { decision } = runtime;
  const scopes = runtime.availableScopes ?? decision.context.scopes;
  const expiresAt = Date.parse(decision.revalidateAt);
  const expiryLabel = Number.isFinite(expiresAt)
    ? formatDate(decision.revalidateAt, { dateStyle: 'medium', timeStyle: 'short' })
    : undefined;

  return (
    <Box
      data-testid="product-surface-context-bar"
      sx={{
        minWidth: 0,
        px: { xs: 2, md: 3 },
        py: 1,
        display: 'flex',
        alignItems: { xs: 'stretch', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography component="p" variant="overline" color="text.secondary">
          {decision.context.plane === 'management'
            ? t('productSurface.labels.management')
            : t('productSurface.labels.work')}
        </Typography>
        <Typography variant="body2" fontWeight={700} noWrap title={runtime.label}>
          {runtime.label}
        </Typography>
      </Box>
      <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
        {scopes.length > 1 && runtime.onScopeChange ? (
          <FormField
            select
            size="small"
            label={t('productSurface.labels.scope')}
            value={decision.scope.key}
            onChange={(event) => runtime.onScopeChange?.(event.target.value)}
            sx={{ minWidth: 180 }}
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
        ) : (
          <Chip
            size="small"
            variant="outlined"
            label={`${t('productSurface.labels.scope')}: ${decision.scope.displayName}`}
          />
        )}
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
        <SurfaceExpiryIndicator runtime={runtime} />
      </Stack>
    </Box>
  );
}
