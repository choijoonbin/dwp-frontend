import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import {
  createProductSurfaceAttemptRotator,
  createProductSurfaceTelemetryClient,
  productSurfaceTelemetryEvent,
  toProductSurfaceElapsedBucket,
} from './product-surface-telemetry';

import type {
  ProductSurfaceReasonCode,
  ProductSurfaceScopeKind,
  ProductSurfaceTelemetryEvent,
} from '@dwp-frontend/shared-utils/api/observability-api';
import type { ProductSurfaceAttemptId } from './product-surface-telemetry';

export const PRODUCT_SURFACE_TELEMETRY_CONSENT_KEY =
  'dwp:privacy:product-surface-telemetry-consent:v1';

type PendingJourney = {
  attemptId: ProductSurfaceAttemptId;
  startedAtMs: number;
  productKey: string;
  fromSurfaceKey: `${string}.${string}`;
  toSurfaceKey: `${string}.${string}`;
};

export type ProductSurfaceTelemetryContextValue = {
  enabled: boolean;
  capture: (event: ProductSurfaceTelemetryEvent) => void;
  newAttempt: () => ProductSurfaceAttemptId;
  beginSurfaceSwitch: (productKey: string, fromSurfaceKey: string, toSurfaceKey: string) => void;
  completeSurfaceSwitch: (productKey: string, surfaceKey: string) => void;
  failSurfaceSwitch: (
    productKey: string,
    surfaceKey: string,
    reasonCode: ProductSurfaceReasonCode
  ) => void;
  captureReturn: (productKey: string, fromSurfaceKey: string, toSurfaceKey: string) => void;
  beginScopeSwitch: (
    productKey: string,
    surfaceKey: string,
    scopeKind: ProductSurfaceScopeKind
  ) => { attemptId: ProductSurfaceAttemptId; startedAtMs: number };
  completeScopeSwitch: (
    productKey: string,
    surfaceKey: string,
    scopeKind: ProductSurfaceScopeKind,
    attemptId: ProductSurfaceAttemptId,
    startedAtMs: number
  ) => void;
  failScopeSwitch: (
    productKey: string,
    surfaceKey: string,
    scopeKind: ProductSurfaceScopeKind,
    attemptId: ProductSurfaceAttemptId,
    reasonCode: ProductSurfaceReasonCode
  ) => void;
};

const noopAttempt = '00000000-0000-4000-8000-000000000000' as ProductSurfaceAttemptId;
const noop = () => undefined;
const ProductSurfaceTelemetryContext = createContext<ProductSurfaceTelemetryContextValue>({
  enabled: false,
  capture: noop,
  newAttempt: () => noopAttempt,
  beginSurfaceSwitch: noop,
  completeSurfaceSwitch: noop,
  failSurfaceSwitch: noop,
  captureReturn: noop,
  beginScopeSwitch: () => ({ attemptId: noopAttempt, startedAtMs: 0 }),
  completeScopeSwitch: noop,
  failScopeSwitch: noop,
});

function canonicalSurfaceKey(value: string): `${string}.${string}` | null {
  return /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/u.test(value)
    ? (value as `${string}.${string}`)
    : null;
}

function monotonicNow(): number {
  return typeof performance === 'undefined' ? 0 : performance.now();
}

export function readProductSurfaceTelemetryConsent(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    return storage.getItem(PRODUCT_SURFACE_TELEMETRY_CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function ProductSurfaceTelemetryProvider({
  children,
  privacyConsentGranted = false,
  productionCollectionEnabled = false,
  report,
}: {
  children: ReactNode;
  privacyConsentGranted?: boolean;
  productionCollectionEnabled?: boolean;
  report?: (event: ProductSurfaceTelemetryEvent) => Promise<void>;
}) {
  const client = useMemo(
    () =>
      createProductSurfaceTelemetryClient({
        privacyConsentGranted,
        productionCollectionEnabled,
        report,
      }),
    [privacyConsentGranted, productionCollectionEnabled, report]
  );
  const attempts = useRef(createProductSurfaceAttemptRotator());
  const pendingSwitch = useRef<PendingJourney | null>(null);
  const value = useMemo<ProductSurfaceTelemetryContextValue>(() => {
    const rotate = (): ProductSurfaceAttemptId | null => {
      if (!client.enabled) return null;
      try {
        return attempts.current.rotate();
      } catch {
        return null;
      }
    };
    return {
      enabled: client.enabled,
      capture: client.capture,
      newAttempt: () => rotate() ?? noopAttempt,
      beginSurfaceSwitch(productKey, fromValue, toValue) {
        const fromSurfaceKey = canonicalSurfaceKey(fromValue);
        const toSurfaceKey = canonicalSurfaceKey(toValue);
        if (!fromSurfaceKey || !toSurfaceKey) return;
        const attemptId = rotate();
        if (!attemptId) return;
        pendingSwitch.current = {
          attemptId,
          startedAtMs: monotonicNow(),
          productKey,
          fromSurfaceKey,
          toSurfaceKey,
        };
        client.capture(
          productSurfaceTelemetryEvent.switchStarted({
            productKey,
            fromSurfaceKey,
            toSurfaceKey,
            attemptId,
          })
        );
      },
      completeSurfaceSwitch(productKey, surfaceValue) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        const pending = pendingSwitch.current;
        if (!surfaceKey || !pending || pending.productKey !== productKey) return;
        if (pending.toSurfaceKey !== surfaceKey) return;
        client.capture(
          productSurfaceTelemetryEvent.switchCompleted({
            productKey,
            fromSurfaceKey: pending.fromSurfaceKey,
            toSurfaceKey: pending.toSurfaceKey,
            attemptId: pending.attemptId,
            elapsedBucket: toProductSurfaceElapsedBucket(
              Math.max(0, monotonicNow() - pending.startedAtMs)
            ),
          })
        );
        pendingSwitch.current = null;
      },
      failSurfaceSwitch(productKey, surfaceValue, reasonCode) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        const pending = pendingSwitch.current;
        if (!surfaceKey || !pending || pending.productKey !== productKey) return;
        if (pending.toSurfaceKey !== surfaceKey) return;
        client.capture(
          productSurfaceTelemetryEvent.switchFailed({
            productKey,
            targetSurfaceKey: surfaceKey,
            attemptId: pending.attemptId,
            reasonCode,
          })
        );
        pendingSwitch.current = null;
      },
      captureReturn(productKey, fromValue, toValue) {
        const fromSurfaceKey = canonicalSurfaceKey(fromValue);
        const toSurfaceKey = canonicalSurfaceKey(toValue);
        if (!fromSurfaceKey || !toSurfaceKey) return;
        const attemptId = rotate();
        if (!attemptId) return;
        client.capture(
          productSurfaceTelemetryEvent.returned({
            productKey,
            fromSurfaceKey,
            toSurfaceKey,
            attemptId,
            elapsedBucket: 'LT_1S',
          })
        );
      },
      beginScopeSwitch(productKey, surfaceValue, scopeKind) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        const attemptId = rotate() ?? noopAttempt;
        if (surfaceKey && attemptId !== noopAttempt) {
          client.capture(
            productSurfaceTelemetryEvent.scopeSwitchStarted({
              productKey,
              surfaceKey,
              scopeKind,
              attemptId,
            })
          );
        }
        return { attemptId, startedAtMs: monotonicNow() };
      },
      completeScopeSwitch(productKey, surfaceValue, scopeKind, attemptId, startedAtMs) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        if (!surfaceKey || attemptId === noopAttempt) return;
        client.capture(
          productSurfaceTelemetryEvent.scopeSwitchCompleted({
            productKey,
            surfaceKey,
            scopeKind,
            attemptId,
            elapsedBucket: toProductSurfaceElapsedBucket(Math.max(0, monotonicNow() - startedAtMs)),
          })
        );
      },
      failScopeSwitch(productKey, surfaceValue, scopeKind, attemptId, reasonCode) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        if (!surfaceKey || attemptId === noopAttempt) return;
        client.capture(
          productSurfaceTelemetryEvent.scopeSwitchFailed({
            productKey,
            surfaceKey,
            scopeKind,
            attemptId,
            reasonCode,
          })
        );
      },
    };
  }, [client]);
  return (
    <ProductSurfaceTelemetryContext.Provider value={value}>
      {children}
    </ProductSurfaceTelemetryContext.Provider>
  );
}

/** Product features may use capture/newAttempt to add the typed task events they own. */
export function useProductSurfaceTelemetry(): ProductSurfaceTelemetryContextValue {
  return useContext(ProductSurfaceTelemetryContext);
}

function deviceClass(): 'DESKTOP' | 'TABLET' | 'MOBILE' {
  if (window.matchMedia('(max-width: 599px)').matches) return 'MOBILE';
  if (window.matchMedia('(max-width: 1023px)').matches) return 'TABLET';
  return 'DESKTOP';
}

export function ProductSurfaceTelemetryExposure({
  productKey,
  surfaceKey,
  children,
}: {
  productKey: string;
  surfaceKey: `${string}.${string}`;
  children: ReactNode;
}) {
  const telemetry = useProductSurfaceTelemetry();
  const captured = useRef<string | null>(null);
  useEffect(() => {
    if (!telemetry.enabled) return;
    const identity = `${productKey}:${surfaceKey}`;
    if (captured.current === identity) return;
    captured.current = identity;
    telemetry.completeSurfaceSwitch(productKey, surfaceKey);
    telemetry.capture(
      productSurfaceTelemetryEvent.exposed({
        productKey,
        surfaceKey,
        deviceClass: deviceClass(),
        attemptId: telemetry.newAttempt(),
      })
    );
  }, [productKey, surfaceKey, telemetry]);
  return children;
}
