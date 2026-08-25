import { axiosInstance } from '../axios-instance';
import type { components } from '@dwp-frontend/api-contracts';
import type { ProductScopeKind } from '../auth/product-surface-scope-kind';

export type WebVitalMetric = components['schemas']['platform_WebVitalRequest'];

export const PRODUCT_SURFACE_EVENT_ENDPOINT =
  '/api/platform/v1/observability/product-surface-events' as const;

export type ProductSurfaceKey = `${string}.${string}`;
export type ProductSurfaceScopeKind = ProductScopeKind;
export type ProductSurfaceDeviceClass = 'DESKTOP' | 'TABLET' | 'MOBILE';
export type ProductSurfaceElapsedBucket =
  'LT_1S' | 'S1_TO_5' | 'S5_TO_15' | 'S15_TO_30' | 'S30_TO_60' | 'M1_TO_5' | 'GTE_5M';
export type ProductSurfaceReasonCode =
  | 'APP_DENIED'
  | 'SURFACE_DENIED'
  | 'ROUTE_DENIED'
  | 'SCOPE_SELECTION_REQUIRED'
  | 'SCOPE_INVALID'
  | 'EXPIRED'
  | 'ACTIVATION_REQUIRED'
  | 'STEP_UP_REQUIRED'
  | 'SOD_CONFLICT'
  | 'SUPPORT_SCOPE_DENIED'
  | 'AUTHORITY_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'CANCELLED'
  | 'VALIDATION_ERROR';
export type ProductSurfaceTaskKind =
  | 'WORK'
  | 'OPERATIONS'
  | 'CONFIGURATION'
  | 'ADMINISTRATION'
  | 'GOVERNANCE'
  | 'DESIGN'
  | 'INTEGRATION'
  | 'REPORTING'
  | 'REVIEW';
export type ProductSurfacePolicyKind =
  'READ_ONLY' | 'UPSTREAM_LOCK' | 'SEGREGATION_OF_DUTIES' | 'STEP_UP' | 'SUPPORT' | 'EXPIRY';

type ProductSurfaceEventBase<EventName extends string> = {
  schemaVersion: 1;
  eventName: EventName;
  productKey: string;
};

export type ProductSurfaceTelemetryEvent =
  | (ProductSurfaceEventBase<'surface.exposed'> & {
      surfaceKey: ProductSurfaceKey;
      deviceClass: ProductSurfaceDeviceClass;
      attemptId: string;
    })
  | (ProductSurfaceEventBase<'surface.switch.started'> & {
      fromSurfaceKey: ProductSurfaceKey;
      toSurfaceKey: ProductSurfaceKey;
      attemptId: string;
    })
  | (ProductSurfaceEventBase<'surface.switch.completed'> & {
      fromSurfaceKey: ProductSurfaceKey;
      toSurfaceKey: ProductSurfaceKey;
      attemptId: string;
      elapsedBucket: ProductSurfaceElapsedBucket;
    })
  | (ProductSurfaceEventBase<'surface.switch.failed'> & {
      targetSurfaceKey: ProductSurfaceKey;
      attemptId: string;
      reasonCode: ProductSurfaceReasonCode;
    })
  | (ProductSurfaceEventBase<'surface.returned'> & {
      fromSurfaceKey: ProductSurfaceKey;
      toSurfaceKey: ProductSurfaceKey;
      attemptId: string;
      elapsedBucket: ProductSurfaceElapsedBucket;
    })
  | (ProductSurfaceEventBase<'surface.route.denied'> & {
      surfaceKey: ProductSurfaceKey;
      routeId: string;
      reasonCode: ProductSurfaceReasonCode;
    })
  | (ProductSurfaceEventBase<'surface.scope.switch.started'> & {
      surfaceKey: ProductSurfaceKey;
      scopeKind: ProductSurfaceScopeKind;
      attemptId: string;
    })
  | (ProductSurfaceEventBase<'surface.scope.switch.completed'> & {
      surfaceKey: ProductSurfaceKey;
      scopeKind: ProductSurfaceScopeKind;
      attemptId: string;
      elapsedBucket: ProductSurfaceElapsedBucket;
    })
  | (ProductSurfaceEventBase<'surface.scope.switch.failed'> & {
      surfaceKey: ProductSurfaceKey;
      scopeKind: ProductSurfaceScopeKind;
      attemptId: string;
      reasonCode: ProductSurfaceReasonCode;
    })
  | (ProductSurfaceEventBase<'surface.scope.invalid'> & {
      surfaceKey: ProductSurfaceKey;
      scopeKind: ProductSurfaceScopeKind;
      reasonCode: ProductSurfaceReasonCode;
    })
  | (ProductSurfaceEventBase<'surface.assignment.expired'> & {
      surfaceKey: ProductSurfaceKey;
      readOnly: boolean;
    })
  | (ProductSurfaceEventBase<'surface.policy.lock.viewed'> & {
      surfaceKey: ProductSurfaceKey;
      policyKind: ProductSurfacePolicyKind;
    })
  | (ProductSurfaceEventBase<'surface.task.started'> & {
      surfaceKey: ProductSurfaceKey;
      taskKind: ProductSurfaceTaskKind;
      attemptId: string;
    })
  | (ProductSurfaceEventBase<'surface.task.completed'> & {
      surfaceKey: ProductSurfaceKey;
      taskKind: ProductSurfaceTaskKind;
      attemptId: string;
      elapsedBucket: ProductSurfaceElapsedBucket;
    })
  | (ProductSurfaceEventBase<'surface.task.failed'> & {
      surfaceKey: ProductSurfaceKey;
      taskKind: ProductSurfaceTaskKind;
      attemptId: string;
      reasonCode: ProductSurfaceReasonCode;
    })
  | (ProductSurfaceEventBase<'surface.task.abandoned'> & {
      surfaceKey: ProductSurfaceKey;
      taskKind: ProductSurfaceTaskKind;
      attemptId: string;
      elapsedBucket: ProductSurfaceElapsedBucket;
    });

const PRODUCT_SURFACE_EVENT_FIELDS = {
  'surface.exposed': ['surfaceKey', 'deviceClass', 'attemptId'],
  'surface.switch.started': ['fromSurfaceKey', 'toSurfaceKey', 'attemptId'],
  'surface.switch.completed': ['fromSurfaceKey', 'toSurfaceKey', 'attemptId', 'elapsedBucket'],
  'surface.switch.failed': ['targetSurfaceKey', 'attemptId', 'reasonCode'],
  'surface.returned': ['fromSurfaceKey', 'toSurfaceKey', 'attemptId', 'elapsedBucket'],
  'surface.route.denied': ['surfaceKey', 'routeId', 'reasonCode'],
  'surface.scope.switch.started': ['surfaceKey', 'scopeKind', 'attemptId'],
  'surface.scope.switch.completed': ['surfaceKey', 'scopeKind', 'attemptId', 'elapsedBucket'],
  'surface.scope.switch.failed': ['surfaceKey', 'scopeKind', 'attemptId', 'reasonCode'],
  'surface.scope.invalid': ['surfaceKey', 'scopeKind', 'reasonCode'],
  'surface.assignment.expired': ['surfaceKey', 'readOnly'],
  'surface.policy.lock.viewed': ['surfaceKey', 'policyKind'],
  'surface.task.started': ['surfaceKey', 'taskKind', 'attemptId'],
  'surface.task.completed': ['surfaceKey', 'taskKind', 'attemptId', 'elapsedBucket'],
  'surface.task.failed': ['surfaceKey', 'taskKind', 'attemptId', 'reasonCode'],
  'surface.task.abandoned': ['surfaceKey', 'taskKind', 'attemptId', 'elapsedBucket'],
} as const satisfies Record<ProductSurfaceTelemetryEvent['eventName'], readonly string[]>;

function assertExactProductSurfaceEvent(event: ProductSurfaceTelemetryEvent): void {
  const eventFields = PRODUCT_SURFACE_EVENT_FIELDS[event.eventName];
  const allowed = new Set(['schemaVersion', 'eventName', 'productKey', ...eventFields]);
  const actual = Object.keys(event);
  if (
    event.schemaVersion !== 1 ||
    actual.some((field) => !allowed.has(field)) ||
    [...allowed].some((field) => !(field in event))
  ) {
    throw new Error('Product surface telemetry payload does not match the client allowlist.');
  }
}

export async function reportWebVital(metric: WebVitalMetric): Promise<void> {
  await axiosInstance.post<void, WebVitalMetric>(
    '/api/platform/v1/observability/web-vitals',
    metric,
    { keepalive: true, timeoutMs: 2_000 }
  );
}

export async function reportProductSurfaceEvent(
  event: ProductSurfaceTelemetryEvent
): Promise<void> {
  assertExactProductSurfaceEvent(event);
  await axiosInstance.post<void, ProductSurfaceTelemetryEvent>(
    PRODUCT_SURFACE_EVENT_ENDPOINT,
    event,
    {
      keepalive: true,
      timeoutMs: 2_000,
    }
  );
}
