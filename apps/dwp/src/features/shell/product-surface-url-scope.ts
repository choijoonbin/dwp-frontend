import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { safeReturnUrl } from '@dwp-frontend/shared-utils/auth/auth-redirect';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';

import type { EffectiveProductSurfaceContextEnvelope } from './product-surface-context';

type ActiveProductSurface = Readonly<{
  productId: string;
  surfaceId: string;
}>;

export type ProductSurfaceIdentity = Readonly<{
  identityPlane: string;
  tenantId: string;
  actorId: string;
}>;

export type ProductSurfaceUrlScopeResolution = Readonly<{
  requestedScope?: string;
  replacementSearch?: string;
  transitionHandled?: boolean;
}>;

type StoredAuthorityBoundary = Readonly<{
  version: 1;
  identity: ProductSurfaceIdentity;
  accessMode?: EffectiveProductSurfaceContextEnvelope['activeAccessMode'];
}>;

const AUTHORITY_BOUNDARY_STORAGE_KEY = 'dwp.product-surface.authority-boundary.v1';
const TRANSITION_SCOPE_STORAGE_KEY = 'dwp.product-surface.transition-scope.v1';
const ACCESS_MODES = new Set(['NORMAL', 'ELEVATED', 'PROVIDER_SUPPORT']);
const MAX_MARKER_LENGTH = 2_048;

function nonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_MARKER_LENGTH;
}

function parseStoredBoundary(value: string | null): StoredAuthorityBoundary | undefined {
  if (!value) return undefined;
  try {
    const candidate = JSON.parse(value) as Partial<StoredAuthorityBoundary>;
    const identity = candidate.identity;
    if (
      candidate.version !== 1 ||
      !identity ||
      !nonBlankString(identity.identityPlane) ||
      !nonBlankString(identity.tenantId) ||
      !nonBlankString(identity.actorId) ||
      (candidate.accessMode !== undefined && !ACCESS_MODES.has(candidate.accessMode))
    ) {
      return undefined;
    }
    return candidate as StoredAuthorityBoundary;
  } catch {
    return undefined;
  }
}

function readSessionValue(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string | undefined): void {
  try {
    if (value === undefined) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage is only a transition hint; the in-memory boundary remains authoritative this mount.
  }
}

function readStoredTransitionScope(): string | undefined {
  const value = readSessionValue(TRANSITION_SCOPE_STORAGE_KEY);
  return nonBlankString(value) ? value : undefined;
}

function identityKey(identity: ProductSurfaceIdentity | undefined): string | undefined {
  return identity
    ? JSON.stringify([identity.identityPlane, identity.tenantId, identity.actorId])
    : undefined;
}

function authorityKey(
  currentIdentityKey: string | undefined,
  accessMode: EffectiveProductSurfaceContextEnvelope['activeAccessMode'] | undefined
): string | undefined {
  return currentIdentityKey && accessMode
    ? JSON.stringify([currentIdentityKey, accessMode])
    : undefined;
}

function remainsFresh(value: string | undefined, nowMs: number): boolean {
  if (value === undefined) return true;
  const deadline = Date.parse(value);
  return Number.isFinite(deadline) && deadline > nowMs;
}

function exactScope(search: string): string | undefined {
  const values = new URLSearchParams(search).getAll('scope');
  return values.length === 1 && nonBlankString(values[0]) ? values[0] : undefined;
}

function isAuthenticationPath(pathname: string): boolean {
  return pathname === '/sign-in' || pathname === '/activate' || pathname.startsWith('/auth/');
}

function transitionScopeAtLocation(pathname: string, search: string): string | undefined {
  const directScope = exactScope(search);
  if (directScope || !isAuthenticationPath(pathname)) return directScope;
  const params = new URLSearchParams(search);
  const returnUrls = params.getAll('returnUrl');
  if (returnUrls.length !== 1) return undefined;
  const returnUrl = safeReturnUrl(returnUrls[0]);
  if (!returnUrl) return undefined;
  return exactScope(new URL(returnUrl, 'https://dwp.invalid').search);
}

/**
 * Explicit scopes stay opaque during ordinary navigation so an invalid key is denied by the
 * authority service. A proven identity transition may remove only the exact selector captured
 * at that boundary, and only after the new authority snapshot has loaded.
 */
export function resolveProductSurfaceUrlScope({
  search,
  activeProductId,
  activeSurface,
  envelope,
  nowMs,
  transitionScope,
}: {
  search: string;
  activeProductId?: string;
  activeSurface?: ActiveProductSurface;
  envelope?: EffectiveProductSurfaceContextEnvelope;
  nowMs?: number;
  transitionScope?: string;
}): ProductSurfaceUrlScopeResolution {
  const params = new URLSearchParams(search);
  const requestedValues = params.getAll('scope');
  const requestedScope = requestedValues[0];
  const preserveRequested = requestedValues.length === 0 ? {} : { requestedScope };
  if (
    !nonBlankString(transitionScope) ||
    !activeProductId ||
    !envelope ||
    typeof nowMs !== 'number' ||
    !Number.isFinite(nowMs)
  ) {
    return preserveRequested;
  }

  const exactRequestedScope =
    requestedValues.length === 1 && nonBlankString(requestedScope) ? requestedScope : undefined;
  if (exactRequestedScope !== transitionScope) {
    return { ...preserveRequested, transitionHandled: true };
  }
  if (!activeSurface) {
    params.delete('scope');
    return { replacementSearch: params.toString(), transitionHandled: true };
  }

  const validRequestedScope = envelope.contexts.some(
    (context) =>
      context.productKey === activeProductId &&
      activeSurface.productId === activeProductId &&
      context.surfaceKey === activeSurface.surfaceId &&
      context.accessMode === envelope.activeAccessMode &&
      remainsFresh(context.revalidateAt, nowMs) &&
      context.scopes.some(
        (scope) => scope.key === exactRequestedScope && remainsFresh(scope.validUntil, nowMs)
      )
  );
  if (validRequestedScope) {
    return { requestedScope: exactRequestedScope, transitionHandled: true };
  }

  params.delete('scope');
  return { replacementSearch: params.toString(), transitionHandled: true };
}

export function resolveProductSurfaceEvaluationScopeKey(
  routeContractKey: string,
  activeRouteContractKey: string | undefined,
  requestedScope: string | undefined
): string | undefined {
  return routeContractKey === activeRouteContractKey ? requestedScope : undefined;
}

export function useProductSurfaceUrlScope({
  activeProductId,
  activeSurface,
  envelope,
  nowMs,
}: {
  activeProductId?: string;
  activeSurface?: ActiveProductSurface;
  envelope?: EffectiveProductSurfaceContextEnvelope;
  nowMs?: number;
}): string | undefined {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const identity = useMemo(
    () =>
      auth.user
        ? {
            identityPlane: String(auth.user.identityPlane ?? ''),
            tenantId: String(auth.user.tenantId),
            actorId: String(auth.user.userId),
          }
        : undefined,
    [auth.user]
  );
  const identityLoading = auth.isLoading;
  const [storedBoundary] = useState(() =>
    parseStoredBoundary(readSessionValue(AUTHORITY_BOUNDARY_STORAGE_KEY))
  );
  const [storedTransitionScope] = useState(readStoredTransitionScope);
  const storedIdentityKey = identityKey(storedBoundary?.identity);
  const currentIdentityKey = identityKey(identity);
  const currentAuthorityKey = authorityKey(currentIdentityKey, envelope?.activeAccessMode);
  const committedIdentityRef = useRef<string | undefined>(storedIdentityKey);
  const committedAuthorityRef = useRef<string | undefined>(
    authorityKey(storedIdentityKey, storedBoundary?.accessMode)
  );
  const transitionScopeRef = useRef<string | undefined>(storedTransitionScope);
  const identityTransitionNow =
    !identityLoading &&
    committedIdentityRef.current !== undefined &&
    committedIdentityRef.current !== currentIdentityKey;
  const accessModeTransitionNow =
    !identityLoading &&
    committedAuthorityRef.current !== undefined &&
    currentAuthorityKey !== undefined &&
    committedAuthorityRef.current !== currentAuthorityKey;
  const observedTransition = identityTransitionNow || accessModeTransitionNow;
  const capturedScope = observedTransition
    ? transitionScopeAtLocation(location.pathname, location.search)
    : undefined;
  const transitionScope = transitionScopeRef.current ?? capturedScope;
  const resolution = useMemo(
    () =>
      resolveProductSurfaceUrlScope({
        search: location.search,
        activeProductId,
        activeSurface,
        envelope,
        nowMs,
        transitionScope: currentIdentityKey ? transitionScope : undefined,
      }),
    [
      activeProductId,
      activeSurface,
      currentIdentityKey,
      envelope,
      location.search,
      nowMs,
      transitionScope,
    ]
  );
  const consumeOutsideProductSurface = Boolean(
    transitionScope &&
    currentIdentityKey &&
    !identityLoading &&
    !isAuthenticationPath(location.pathname) &&
    !activeProductId &&
    !activeSurface
  );

  useEffect(() => {
    if (!transitionScopeRef.current && capturedScope) {
      transitionScopeRef.current = capturedScope;
      writeSessionValue(TRANSITION_SCOPE_STORAGE_KEY, capturedScope);
    }
    if (!identityLoading && currentIdentityKey) committedIdentityRef.current = currentIdentityKey;
    if (!identityLoading && currentAuthorityKey)
      committedAuthorityRef.current = currentAuthorityKey;
    if (
      !identityLoading &&
      identity &&
      nonBlankString(identity.identityPlane) &&
      nonBlankString(identity.tenantId) &&
      nonBlankString(identity.actorId)
    ) {
      const retainedAccessMode =
        envelope?.activeAccessMode ??
        (storedIdentityKey === currentIdentityKey ? storedBoundary?.accessMode : undefined);
      writeSessionValue(
        AUTHORITY_BOUNDARY_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          identity,
          ...(retainedAccessMode ? { accessMode: retainedAccessMode } : {}),
        } satisfies StoredAuthorityBoundary)
      );
    }
    if (resolution.transitionHandled || consumeOutsideProductSurface) {
      transitionScopeRef.current = undefined;
      writeSessionValue(TRANSITION_SCOPE_STORAGE_KEY, undefined);
    }
    if (resolution.replacementSearch === undefined) return;
    navigate(
      {
        pathname: location.pathname,
        search: resolution.replacementSearch,
        hash: location.hash,
      },
      { replace: true, state: location.state }
    );
  }, [
    capturedScope,
    consumeOutsideProductSurface,
    currentAuthorityKey,
    currentIdentityKey,
    envelope,
    identity,
    identityLoading,
    location.hash,
    location.pathname,
    location.state,
    navigate,
    resolution.replacementSearch,
    resolution.transitionHandled,
    storedBoundary?.accessMode,
    storedIdentityKey,
  ]);

  return resolution.requestedScope;
}
