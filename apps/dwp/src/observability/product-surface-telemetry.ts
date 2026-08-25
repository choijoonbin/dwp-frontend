import {
  reportProductSurfaceEvent,
  type ProductSurfaceElapsedBucket,
  type ProductSurfaceTelemetryEvent,
} from '@dwp-frontend/shared-utils/api/observability-api';

declare const productSurfaceAttemptIdBrand: unique symbol;

export type ProductSurfaceAttemptId = string & {
  readonly [productSurfaceAttemptIdBrand]: true;
};

type EventName = ProductSurfaceTelemetryEvent['eventName'];
type EventOf<Name extends EventName> = Extract<ProductSurfaceTelemetryEvent, { eventName: Name }>;
type EventInput<Name extends EventName> = Omit<EventOf<Name>, 'schemaVersion' | 'eventName'>;
type AttemptIdFactory = () => string;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function productSurfaceAttemptId(value: string): ProductSurfaceAttemptId {
  if (!UUID_PATTERN.test(value)) throw new Error('Product surface attempt ID must be a UUID.');
  return value as ProductSurfaceAttemptId;
}

export function createProductSurfaceAttemptRotator(
  createUuid: AttemptIdFactory = () => crypto.randomUUID()
) {
  let currentAttemptId: ProductSurfaceAttemptId | null = null;

  return {
    current: () => currentAttemptId,
    rotate: () => {
      const nextAttemptId = productSurfaceAttemptId(createUuid());
      if (nextAttemptId === currentAttemptId) {
        throw new Error('Product surface attempt ID must rotate between journeys.');
      }
      currentAttemptId = nextAttemptId;
      return nextAttemptId;
    },
    clear: () => {
      currentAttemptId = null;
    },
  };
}

export function toProductSurfaceElapsedBucket(durationMs: number): ProductSurfaceElapsedBucket {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error('Product surface duration must be a finite non-negative value.');
  }
  if (durationMs < 1_000) return 'LT_1S';
  if (durationMs < 5_000) return 'S1_TO_5';
  if (durationMs < 15_000) return 'S5_TO_15';
  if (durationMs < 30_000) return 'S15_TO_30';
  if (durationMs < 60_000) return 'S30_TO_60';
  if (durationMs < 300_000) return 'M1_TO_5';
  return 'GTE_5M';
}

export const productSurfaceTelemetryEvent = {
  exposed(input: EventInput<'surface.exposed'>): EventOf<'surface.exposed'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.exposed',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      deviceClass: input.deviceClass,
      attemptId: input.attemptId,
    };
  },
  switchStarted(input: EventInput<'surface.switch.started'>): EventOf<'surface.switch.started'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.switch.started',
      productKey: input.productKey,
      fromSurfaceKey: input.fromSurfaceKey,
      toSurfaceKey: input.toSurfaceKey,
      attemptId: input.attemptId,
    };
  },
  switchCompleted(
    input: EventInput<'surface.switch.completed'>
  ): EventOf<'surface.switch.completed'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.switch.completed',
      productKey: input.productKey,
      fromSurfaceKey: input.fromSurfaceKey,
      toSurfaceKey: input.toSurfaceKey,
      attemptId: input.attemptId,
      elapsedBucket: input.elapsedBucket,
    };
  },
  switchFailed(input: EventInput<'surface.switch.failed'>): EventOf<'surface.switch.failed'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.switch.failed',
      productKey: input.productKey,
      targetSurfaceKey: input.targetSurfaceKey,
      attemptId: input.attemptId,
      reasonCode: input.reasonCode,
    };
  },
  returned(input: EventInput<'surface.returned'>): EventOf<'surface.returned'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.returned',
      productKey: input.productKey,
      fromSurfaceKey: input.fromSurfaceKey,
      toSurfaceKey: input.toSurfaceKey,
      attemptId: input.attemptId,
      elapsedBucket: input.elapsedBucket,
    };
  },
  routeDenied(input: EventInput<'surface.route.denied'>): EventOf<'surface.route.denied'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.route.denied',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      routeId: input.routeId,
      reasonCode: input.reasonCode,
    };
  },
  scopeSwitchStarted(
    input: EventInput<'surface.scope.switch.started'>
  ): EventOf<'surface.scope.switch.started'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.scope.switch.started',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      scopeKind: input.scopeKind,
      attemptId: input.attemptId,
    };
  },
  scopeSwitchCompleted(
    input: EventInput<'surface.scope.switch.completed'>
  ): EventOf<'surface.scope.switch.completed'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.scope.switch.completed',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      scopeKind: input.scopeKind,
      attemptId: input.attemptId,
      elapsedBucket: input.elapsedBucket,
    };
  },
  scopeSwitchFailed(
    input: EventInput<'surface.scope.switch.failed'>
  ): EventOf<'surface.scope.switch.failed'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.scope.switch.failed',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      scopeKind: input.scopeKind,
      attemptId: input.attemptId,
      reasonCode: input.reasonCode,
    };
  },
  scopeInvalid(input: EventInput<'surface.scope.invalid'>): EventOf<'surface.scope.invalid'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.scope.invalid',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      scopeKind: input.scopeKind,
      reasonCode: input.reasonCode,
    };
  },
  assignmentExpired(
    input: EventInput<'surface.assignment.expired'>
  ): EventOf<'surface.assignment.expired'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.assignment.expired',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      readOnly: input.readOnly,
    };
  },
  policyLockViewed(
    input: EventInput<'surface.policy.lock.viewed'>
  ): EventOf<'surface.policy.lock.viewed'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.policy.lock.viewed',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      policyKind: input.policyKind,
    };
  },
  taskStarted(input: EventInput<'surface.task.started'>): EventOf<'surface.task.started'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.task.started',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      taskKind: input.taskKind,
      attemptId: input.attemptId,
    };
  },
  taskCompleted(input: EventInput<'surface.task.completed'>): EventOf<'surface.task.completed'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.task.completed',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      taskKind: input.taskKind,
      attemptId: input.attemptId,
      elapsedBucket: input.elapsedBucket,
    };
  },
  taskFailed(input: EventInput<'surface.task.failed'>): EventOf<'surface.task.failed'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.task.failed',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      taskKind: input.taskKind,
      attemptId: input.attemptId,
      reasonCode: input.reasonCode,
    };
  },
  taskAbandoned(input: EventInput<'surface.task.abandoned'>): EventOf<'surface.task.abandoned'> {
    return {
      schemaVersion: 1,
      eventName: 'surface.task.abandoned',
      productKey: input.productKey,
      surfaceKey: input.surfaceKey,
      taskKind: input.taskKind,
      attemptId: input.attemptId,
      elapsedBucket: input.elapsedBucket,
    };
  },
};

export type ProductSurfaceTelemetryClientOptions = {
  privacyConsentGranted?: boolean;
  productionCollectionEnabled?: boolean;
  report?: (event: ProductSurfaceTelemetryEvent) => Promise<void>;
};

export function createProductSurfaceTelemetryClient(
  options: ProductSurfaceTelemetryClientOptions = {}
) {
  const enabled =
    (options.privacyConsentGranted ?? false) && (options.productionCollectionEnabled ?? false);
  const report = options.report ?? reportProductSurfaceEvent;

  return {
    enabled,
    capture(event: ProductSurfaceTelemetryEvent): void {
      if (!enabled) return;
      try {
        void report(event).catch(() => {
          // UX telemetry is non-authoritative and must never block a workflow.
        });
      } catch {
        // A non-conforming reporter must remain isolated from the user action.
      }
    },
  };
}
