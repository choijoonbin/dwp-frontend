import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

import type {
  ProductSurfaceDeviceClass,
  ProductSurfacePolicyKind,
  ProductSurfaceReasonCode,
  ProductSurfaceScopeKind,
  ProductSurfaceTaskKind,
  ProductSurfaceTelemetryEvent,
} from '@dwp-frontend/shared-utils/api/observability-api';
import type { ProductSurfaceAttemptId } from './product-surface-telemetry';

export const PRODUCT_SURFACE_TELEMETRY_CONSENT_KEY =
  'dwp:privacy:product-surface-telemetry-consent:v1';

export type ProductSurfaceTimedAttempt = Readonly<{
  attemptId: ProductSurfaceAttemptId;
  startedAtMs: number;
}>;

export type ProductSurfaceTelemetryContextValue = {
  enabled: boolean;
  capture: (event: ProductSurfaceTelemetryEvent) => void;
  beginSurfaceSwitch: (productKey: string, fromSurfaceKey: string, toSurfaceKey: string) => void;
  captureExposure: (
    productKey: string,
    surfaceKey: string,
    deviceClass: ProductSurfaceDeviceClass
  ) => void;
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
  ) => ProductSurfaceTimedAttempt;
  completeScopeSwitch: (
    productKey: string,
    surfaceKey: string,
    scopeKind: ProductSurfaceScopeKind,
    attemptId: ProductSurfaceAttemptId,
    startedAtMs: number
  ) => void;
  completePendingScopeSwitch: (
    productKey: string,
    surfaceKey: string,
    scopeKind: ProductSurfaceScopeKind
  ) => void;
  failScopeSwitch: (
    productKey: string,
    surfaceKey: string,
    scopeKind: ProductSurfaceScopeKind,
    attemptId: ProductSurfaceAttemptId,
    reasonCode: ProductSurfaceReasonCode
  ) => void;
  failPendingScopeSwitch: (
    productKey: string,
    surfaceKey: string,
    reasonCode: ProductSurfaceReasonCode
  ) => void;
  captureScopeInvalid: (
    productKey: string,
    surfaceKey: string,
    scopeKind: ProductSurfaceScopeKind,
    reasonCode: ProductSurfaceReasonCode
  ) => void;
  capturePolicyLockViewed: (
    productKey: string,
    surfaceKey: string,
    policyKind: ProductSurfacePolicyKind
  ) => void;
  beginTask: (
    productKey: string,
    surfaceKey: string,
    taskKind: ProductSurfaceTaskKind
  ) => ProductSurfaceTimedAttempt;
  completeTask: (
    productKey: string,
    surfaceKey: string,
    taskKind: ProductSurfaceTaskKind,
    attemptId: ProductSurfaceAttemptId,
    startedAtMs: number
  ) => void;
  failTask: (
    productKey: string,
    surfaceKey: string,
    taskKind: ProductSurfaceTaskKind,
    attemptId: ProductSurfaceAttemptId,
    reasonCode: ProductSurfaceReasonCode
  ) => void;
  abandonTask: (
    productKey: string,
    surfaceKey: string,
    taskKind: ProductSurfaceTaskKind,
    attemptId: ProductSurfaceAttemptId,
    startedAtMs: number
  ) => void;
};

export const PRODUCT_SURFACE_NOOP_ATTEMPT =
  '00000000-0000-4000-8000-000000000000' as ProductSurfaceAttemptId;
const noop = () => undefined;
const noopTimedAttempt = () => ({
  attemptId: PRODUCT_SURFACE_NOOP_ATTEMPT,
  startedAtMs: 0,
});
const disabledTelemetry = new Proxy({ enabled: false } as ProductSurfaceTelemetryContextValue, {
  get: (target, property) =>
    property === 'enabled'
      ? target.enabled
      : property === 'beginScopeSwitch' || property === 'beginTask'
        ? noopTimedAttempt
        : noop,
});
const ProductSurfaceTelemetryContext =
  createContext<ProductSurfaceTelemetryContextValue>(disabledTelemetry);

export const ProductSurfaceTelemetryContextProvider = ProductSurfaceTelemetryContext.Provider;

export function readProductSurfaceTelemetryConsent(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    return storage.getItem(PRODUCT_SURFACE_TELEMETRY_CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

/** Product features use the typed journey methods; raw capture remains for non-journey events. */
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
    telemetry.captureExposure(productKey, surfaceKey, deviceClass());
  }, [productKey, surfaceKey, telemetry]);
  return children;
}
