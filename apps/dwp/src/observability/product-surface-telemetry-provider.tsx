import { useMemo, useRef, type PropsWithChildren } from 'react';

import {
  ProductSurfaceTelemetryContextProvider,
  PRODUCT_SURFACE_NOOP_ATTEMPT,
} from './product-surface-telemetry-context';
import {
  createProductSurfaceAttemptRotator,
  createProductSurfaceTelemetryClient,
  productSurfaceTelemetryEvent,
  toProductSurfaceElapsedBucket,
} from './product-surface-telemetry';

import type { ProductSurfaceTelemetryEvent } from '@dwp-frontend/shared-utils/api/observability-api';
import type {
  ProductSurfaceTelemetryContextValue,
  ProductSurfaceTimedAttempt,
} from './product-surface-telemetry-context';
import type { ProductSurfaceAttemptId } from './product-surface-telemetry';

type PendingJourney = {
  attemptId: ProductSurfaceAttemptId;
  startedAtMs: number;
  productKey: string;
  fromSurfaceKey: `${string}.${string}`;
  toSurfaceKey: `${string}.${string}`;
};

type PendingReturn = {
  attemptId: ProductSurfaceAttemptId;
  productKey: string;
  toSurfaceKey: `${string}.${string}`;
};

type PendingScopeJourney = ProductSurfaceTimedAttempt & {
  productKey: string;
  surfaceKey: `${string}.${string}`;
  scopeKind: Parameters<ProductSurfaceTelemetryContextValue['beginScopeSwitch']>[2];
};

type ExposureJourney = {
  attemptId: ProductSurfaceAttemptId;
  startedAtMs: number;
  productKey: string;
  surfaceKey: `${string}.${string}`;
  actionAttempted: boolean;
  meaningfulAction: boolean;
};

function canonicalSurfaceKey(value: string): `${string}.${string}` | null {
  return /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/u.test(value)
    ? (value as `${string}.${string}`)
    : null;
}

function monotonicNow(): number {
  return typeof performance === 'undefined' ? 0 : performance.now();
}

export default function ProductSurfaceTelemetryProvider({
  children,
  privacyConsentGranted = false,
  productionCollectionEnabled = false,
  report,
}: PropsWithChildren<{
  privacyConsentGranted?: boolean;
  productionCollectionEnabled?: boolean;
  report?: (event: ProductSurfaceTelemetryEvent) => Promise<void>;
}>) {
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
  const pendingReturn = useRef<PendingReturn | null>(null);
  const pendingScope = useRef<PendingScopeJourney | null>(null);
  const exposureJourney = useRef<ExposureJourney | null>(null);
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
      beginSurfaceSwitch(productKey, fromValue, toValue) {
        const fromSurfaceKey = canonicalSurfaceKey(fromValue);
        const toSurfaceKey = canonicalSurfaceKey(toValue);
        if (!fromSurfaceKey || !toSurfaceKey) return;
        const attemptId = rotate();
        if (!attemptId) return;
        const replaced = pendingSwitch.current;
        if (replaced) {
          client.capture(
            productSurfaceTelemetryEvent.switchFailed({
              productKey: replaced.productKey,
              targetSurfaceKey: replaced.toSurfaceKey,
              attemptId: replaced.attemptId,
              reasonCode: 'CANCELLED',
            })
          );
        }
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
      captureExposure(productKey, surfaceValue, currentDeviceClass) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        if (!surfaceKey) return;
        const pending = pendingSwitch.current;
        const returned = pendingReturn.current;
        const nowMs = monotonicNow();
        let attemptId: ProductSurfaceAttemptId | null = null;
        if (pending && pending.productKey === productKey && pending.toSurfaceKey === surfaceKey) {
          attemptId = pending.attemptId;
          client.capture(
            productSurfaceTelemetryEvent.switchCompleted({
              productKey,
              fromSurfaceKey: pending.fromSurfaceKey,
              toSurfaceKey: pending.toSurfaceKey,
              attemptId,
              elapsedBucket: toProductSurfaceElapsedBucket(
                Math.max(0, nowMs - pending.startedAtMs)
              ),
            })
          );
        } else if (
          returned &&
          returned.productKey === productKey &&
          returned.toSurfaceKey === surfaceKey
        ) {
          attemptId = returned.attemptId;
        }
        pendingSwitch.current = null;
        pendingReturn.current = null;
        attemptId ??= rotate();
        if (!attemptId) return;
        exposureJourney.current = {
          attemptId,
          startedAtMs: nowMs,
          productKey,
          surfaceKey,
          actionAttempted: false,
          meaningfulAction: false,
        };
        client.capture(
          productSurfaceTelemetryEvent.exposed({
            productKey,
            surfaceKey,
            deviceClass: currentDeviceClass,
            attemptId,
          })
        );
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
        const exposure = exposureJourney.current;
        const nowMs = monotonicNow();
        const attemptId =
          exposure?.productKey === productKey && exposure.surfaceKey === fromSurfaceKey
            ? exposure.attemptId
            : rotate();
        if (!attemptId) return;
        client.capture(
          productSurfaceTelemetryEvent.returned({
            productKey,
            fromSurfaceKey,
            toSurfaceKey,
            attemptId,
            elapsedBucket: toProductSurfaceElapsedBucket(
              Math.max(
                0,
                nowMs -
                  (exposure?.productKey === productKey && exposure.surfaceKey === fromSurfaceKey
                    ? exposure.startedAtMs
                    : nowMs)
              )
            ),
          })
        );
        pendingSwitch.current = null;
        pendingReturn.current = { attemptId, productKey, toSurfaceKey };
        exposureJourney.current = null;
      },
      beginScopeSwitch(productKey, surfaceValue, scopeKind): ProductSurfaceTimedAttempt {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        const exposure = exposureJourney.current;
        const correlated =
          surfaceKey &&
          exposure?.productKey === productKey &&
          exposure.surfaceKey === surfaceKey &&
          !exposure.actionAttempted
            ? exposure
            : null;
        const attemptId = correlated?.attemptId ?? rotate() ?? PRODUCT_SURFACE_NOOP_ATTEMPT;
        if (correlated) correlated.actionAttempted = true;
        if (surfaceKey && attemptId !== PRODUCT_SURFACE_NOOP_ATTEMPT) {
          const replaced = pendingScope.current;
          if (replaced) {
            client.capture(
              productSurfaceTelemetryEvent.scopeSwitchFailed({
                productKey: replaced.productKey,
                surfaceKey: replaced.surfaceKey,
                scopeKind: replaced.scopeKind,
                attemptId: replaced.attemptId,
                reasonCode: 'CANCELLED',
              })
            );
          }
          pendingScope.current = {
            productKey,
            surfaceKey,
            scopeKind,
            attemptId,
            startedAtMs: monotonicNow(),
          };
          client.capture(
            productSurfaceTelemetryEvent.scopeSwitchStarted({
              productKey,
              surfaceKey,
              scopeKind,
              attemptId,
            })
          );
        }
        return {
          attemptId,
          startedAtMs:
            pendingScope.current?.attemptId === attemptId
              ? pendingScope.current.startedAtMs
              : monotonicNow(),
        };
      },
      completeScopeSwitch(productKey, surfaceValue, scopeKind, attemptId, startedAtMs) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        if (!surfaceKey || attemptId === PRODUCT_SURFACE_NOOP_ATTEMPT) return;
        const exposure = exposureJourney.current;
        if (
          exposure?.productKey === productKey &&
          exposure.surfaceKey === surfaceKey &&
          exposure.attemptId === attemptId
        ) {
          exposure.meaningfulAction = true;
        }
        client.capture(
          productSurfaceTelemetryEvent.scopeSwitchCompleted({
            productKey,
            surfaceKey,
            scopeKind,
            attemptId,
            elapsedBucket: toProductSurfaceElapsedBucket(Math.max(0, monotonicNow() - startedAtMs)),
          })
        );
        if (pendingScope.current?.attemptId === attemptId) pendingScope.current = null;
      },
      completePendingScopeSwitch(productKey, surfaceValue, scopeKind) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        const pending = pendingScope.current;
        if (
          !surfaceKey ||
          !pending ||
          pending.productKey !== productKey ||
          pending.surfaceKey !== surfaceKey ||
          pending.scopeKind !== scopeKind
        ) {
          return;
        }
        client.capture(
          productSurfaceTelemetryEvent.scopeSwitchCompleted({
            productKey,
            surfaceKey,
            scopeKind,
            attemptId: pending.attemptId,
            elapsedBucket: toProductSurfaceElapsedBucket(
              Math.max(0, monotonicNow() - pending.startedAtMs)
            ),
          })
        );
        pendingScope.current = null;
      },
      failScopeSwitch(productKey, surfaceValue, scopeKind, attemptId, reasonCode) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        if (!surfaceKey || attemptId === PRODUCT_SURFACE_NOOP_ATTEMPT) return;
        client.capture(
          productSurfaceTelemetryEvent.scopeSwitchFailed({
            productKey,
            surfaceKey,
            scopeKind,
            attemptId,
            reasonCode,
          })
        );
        if (pendingScope.current?.attemptId === attemptId) pendingScope.current = null;
      },
      failPendingScopeSwitch(productKey, surfaceValue, reasonCode) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        const pending = pendingScope.current;
        if (
          !surfaceKey ||
          !pending ||
          pending.productKey !== productKey ||
          pending.surfaceKey !== surfaceKey
        ) {
          return;
        }
        client.capture(
          productSurfaceTelemetryEvent.scopeSwitchFailed({
            productKey,
            surfaceKey,
            scopeKind: pending.scopeKind,
            attemptId: pending.attemptId,
            reasonCode,
          })
        );
        pendingScope.current = null;
      },
      captureScopeInvalid(productKey, surfaceValue, scopeKind, reasonCode) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        if (!surfaceKey) return;
        client.capture(
          productSurfaceTelemetryEvent.scopeInvalid({
            productKey,
            surfaceKey,
            scopeKind,
            reasonCode,
          })
        );
      },
      capturePolicyLockViewed(productKey, surfaceValue, policyKind) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        if (!surfaceKey) return;
        client.capture(
          productSurfaceTelemetryEvent.policyLockViewed({
            productKey,
            surfaceKey,
            policyKind,
          })
        );
      },
      beginTask(productKey, surfaceValue, taskKind) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        const exposure = exposureJourney.current;
        const correlated =
          surfaceKey &&
          exposure?.productKey === productKey &&
          exposure.surfaceKey === surfaceKey &&
          !exposure.actionAttempted
            ? exposure
            : null;
        const attemptId = correlated?.attemptId ?? rotate() ?? PRODUCT_SURFACE_NOOP_ATTEMPT;
        if (correlated) {
          correlated.actionAttempted = true;
          correlated.meaningfulAction = true;
        }
        if (surfaceKey && attemptId !== PRODUCT_SURFACE_NOOP_ATTEMPT) {
          client.capture(
            productSurfaceTelemetryEvent.taskStarted({
              productKey,
              surfaceKey,
              taskKind,
              attemptId,
            })
          );
        }
        return { attemptId, startedAtMs: monotonicNow() };
      },
      completeTask(productKey, surfaceValue, taskKind, attemptId, startedAtMs) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        if (!surfaceKey || attemptId === PRODUCT_SURFACE_NOOP_ATTEMPT) return;
        client.capture(
          productSurfaceTelemetryEvent.taskCompleted({
            productKey,
            surfaceKey,
            taskKind,
            attemptId,
            elapsedBucket: toProductSurfaceElapsedBucket(Math.max(0, monotonicNow() - startedAtMs)),
          })
        );
      },
      failTask(productKey, surfaceValue, taskKind, attemptId, reasonCode) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        if (!surfaceKey || attemptId === PRODUCT_SURFACE_NOOP_ATTEMPT) return;
        client.capture(
          productSurfaceTelemetryEvent.taskFailed({
            productKey,
            surfaceKey,
            taskKind,
            attemptId,
            reasonCode,
          })
        );
      },
      abandonTask(productKey, surfaceValue, taskKind, attemptId, startedAtMs) {
        const surfaceKey = canonicalSurfaceKey(surfaceValue);
        if (!surfaceKey || attemptId === PRODUCT_SURFACE_NOOP_ATTEMPT) return;
        client.capture(
          productSurfaceTelemetryEvent.taskAbandoned({
            productKey,
            surfaceKey,
            taskKind,
            attemptId,
            elapsedBucket: toProductSurfaceElapsedBucket(Math.max(0, monotonicNow() - startedAtMs)),
          })
        );
      },
    };
  }, [client]);

  return (
    <ProductSurfaceTelemetryContextProvider value={value}>
      {children}
    </ProductSurfaceTelemetryContextProvider>
  );
}
