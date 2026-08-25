import { describe, expect, it, vi } from 'vitest';

import {
  createProductSurfaceAttemptRotator,
  createProductSurfaceTelemetryClient,
  productSurfaceTelemetryEvent,
  toProductSurfaceElapsedBucket,
} from './product-surface-telemetry';
import {
  PRODUCT_SURFACE_TELEMETRY_CONSENT_KEY,
  readProductSurfaceTelemetryConsent,
} from './product-surface-telemetry-context';

const UUID_ONE = 'd2e63316-8564-4d8c-bd02-eaede882f982';
const UUID_TWO = '2df2663c-0e19-4e6c-934c-84d8b0d95ce2';

describe('product surface telemetry', () => {
  it('rotates a non-identifying UUID for each journey and can clear it', () => {
    const ids = [UUID_ONE, UUID_TWO];
    const attempts = createProductSurfaceAttemptRotator(() => ids.shift() ?? UUID_TWO);

    expect(attempts.current()).toBeNull();
    expect(attempts.rotate()).toBe(UUID_ONE);
    expect(attempts.rotate()).toBe(UUID_TWO);
    attempts.clear();
    expect(attempts.current()).toBeNull();
  });

  it('rejects invalid or reused journey identifiers', () => {
    expect(() => createProductSurfaceAttemptRotator(() => 'actor-100').rotate()).toThrow(/UUID/);
    const attempts = createProductSurfaceAttemptRotator(() => UUID_ONE);
    attempts.rotate();
    expect(() => attempts.rotate()).toThrow(/rotate/);
  });

  it('correlates one attempt and rotates before the next attempt', () => {
    const ids = [UUID_ONE, UUID_TWO];
    const attempts = createProductSurfaceAttemptRotator(() => ids.shift() ?? UUID_TWO);
    const firstAttemptId = attempts.rotate();
    const started = productSurfaceTelemetryEvent.taskStarted({
      productKey: 'communications',
      surfaceKey: 'communications.management',
      taskKind: 'CONFIGURATION',
      attemptId: firstAttemptId,
    });
    const completed = productSurfaceTelemetryEvent.taskCompleted({
      productKey: 'communications',
      surfaceKey: 'communications.management',
      taskKind: 'CONFIGURATION',
      attemptId: attempts.current() as typeof firstAttemptId,
      elapsedBucket: 'S5_TO_15',
    });
    const nextAttemptId = attempts.rotate();

    expect(started.attemptId).toBe(completed.attemptId);
    expect(nextAttemptId).not.toBe(firstAttemptId);
  });

  it('builds the exact backend allowlist for every event kind', () => {
    const common = { productKey: 'communications' } as const;
    const surfaceKey = 'communications.management' as const;
    const workKey = 'communications.work' as const;
    const events = [
      productSurfaceTelemetryEvent.exposed({
        ...common,
        surfaceKey,
        deviceClass: 'DESKTOP',
        attemptId: UUID_ONE,
      }),
      productSurfaceTelemetryEvent.switchStarted({
        ...common,
        fromSurfaceKey: workKey,
        toSurfaceKey: surfaceKey,
        attemptId: UUID_ONE,
      }),
      productSurfaceTelemetryEvent.switchCompleted({
        ...common,
        fromSurfaceKey: workKey,
        toSurfaceKey: surfaceKey,
        attemptId: UUID_ONE,
        elapsedBucket: 'S1_TO_5',
      }),
      productSurfaceTelemetryEvent.switchFailed({
        ...common,
        targetSurfaceKey: surfaceKey,
        attemptId: UUID_ONE,
        reasonCode: 'NETWORK_ERROR',
      }),
      productSurfaceTelemetryEvent.returned({
        ...common,
        fromSurfaceKey: surfaceKey,
        toSurfaceKey: workKey,
        attemptId: UUID_ONE,
        elapsedBucket: 'S5_TO_15',
      }),
      productSurfaceTelemetryEvent.routeDenied({
        ...common,
        surfaceKey,
        routeId: 'communications.management.settings',
        reasonCode: 'ROUTE_DENIED',
      }),
      productSurfaceTelemetryEvent.scopeSwitchStarted({
        ...common,
        surfaceKey,
        scopeKind: 'RESOURCE_SET',
        attemptId: UUID_ONE,
      }),
      productSurfaceTelemetryEvent.scopeSwitchCompleted({
        ...common,
        surfaceKey,
        scopeKind: 'RESOURCE_SET',
        attemptId: UUID_ONE,
        elapsedBucket: 'LT_1S',
      }),
      productSurfaceTelemetryEvent.scopeSwitchFailed({
        ...common,
        surfaceKey,
        scopeKind: 'RESOURCE_SET',
        attemptId: UUID_ONE,
        reasonCode: 'SCOPE_INVALID',
      }),
      productSurfaceTelemetryEvent.scopeInvalid({
        ...common,
        surfaceKey,
        scopeKind: 'RESOURCE_SET',
        reasonCode: 'SCOPE_INVALID',
      }),
      productSurfaceTelemetryEvent.assignmentExpired({
        ...common,
        surfaceKey,
        readOnly: true,
      }),
      productSurfaceTelemetryEvent.policyLockViewed({
        ...common,
        surfaceKey,
        policyKind: 'UPSTREAM_LOCK',
      }),
      productSurfaceTelemetryEvent.taskStarted({
        ...common,
        surfaceKey,
        taskKind: 'CONFIGURATION',
        attemptId: UUID_ONE,
      }),
      productSurfaceTelemetryEvent.taskCompleted({
        ...common,
        surfaceKey,
        taskKind: 'CONFIGURATION',
        attemptId: UUID_ONE,
        elapsedBucket: 'M1_TO_5',
      }),
      productSurfaceTelemetryEvent.taskFailed({
        ...common,
        surfaceKey,
        taskKind: 'CONFIGURATION',
        attemptId: UUID_ONE,
        reasonCode: 'VALIDATION_ERROR',
      }),
      productSurfaceTelemetryEvent.taskAbandoned({
        ...common,
        surfaceKey,
        taskKind: 'CONFIGURATION',
        attemptId: UUID_ONE,
        elapsedBucket: 'GTE_5M',
      }),
    ];

    expect(events.map((event) => event.eventName)).toEqual([
      'surface.exposed',
      'surface.switch.started',
      'surface.switch.completed',
      'surface.switch.failed',
      'surface.returned',
      'surface.route.denied',
      'surface.scope.switch.started',
      'surface.scope.switch.completed',
      'surface.scope.switch.failed',
      'surface.scope.invalid',
      'surface.assignment.expired',
      'surface.policy.lock.viewed',
      'surface.task.started',
      'surface.task.completed',
      'surface.task.failed',
      'surface.task.abandoned',
    ]);
    expect(events.map((event) => Object.keys(event))).toEqual([
      ['schemaVersion', 'eventName', 'productKey', 'surfaceKey', 'deviceClass', 'attemptId'],
      ['schemaVersion', 'eventName', 'productKey', 'fromSurfaceKey', 'toSurfaceKey', 'attemptId'],
      [
        'schemaVersion',
        'eventName',
        'productKey',
        'fromSurfaceKey',
        'toSurfaceKey',
        'attemptId',
        'elapsedBucket',
      ],
      ['schemaVersion', 'eventName', 'productKey', 'targetSurfaceKey', 'attemptId', 'reasonCode'],
      [
        'schemaVersion',
        'eventName',
        'productKey',
        'fromSurfaceKey',
        'toSurfaceKey',
        'attemptId',
        'elapsedBucket',
      ],
      ['schemaVersion', 'eventName', 'productKey', 'surfaceKey', 'routeId', 'reasonCode'],
      ['schemaVersion', 'eventName', 'productKey', 'surfaceKey', 'scopeKind', 'attemptId'],
      [
        'schemaVersion',
        'eventName',
        'productKey',
        'surfaceKey',
        'scopeKind',
        'attemptId',
        'elapsedBucket',
      ],
      [
        'schemaVersion',
        'eventName',
        'productKey',
        'surfaceKey',
        'scopeKind',
        'attemptId',
        'reasonCode',
      ],
      ['schemaVersion', 'eventName', 'productKey', 'surfaceKey', 'scopeKind', 'reasonCode'],
      ['schemaVersion', 'eventName', 'productKey', 'surfaceKey', 'readOnly'],
      ['schemaVersion', 'eventName', 'productKey', 'surfaceKey', 'policyKind'],
      ['schemaVersion', 'eventName', 'productKey', 'surfaceKey', 'taskKind', 'attemptId'],
      [
        'schemaVersion',
        'eventName',
        'productKey',
        'surfaceKey',
        'taskKind',
        'attemptId',
        'elapsedBucket',
      ],
      [
        'schemaVersion',
        'eventName',
        'productKey',
        'surfaceKey',
        'taskKind',
        'attemptId',
        'reasonCode',
      ],
      [
        'schemaVersion',
        'eventName',
        'productKey',
        'surfaceKey',
        'taskKind',
        'attemptId',
        'elapsedBucket',
      ],
    ]);
    for (const event of events) {
      expect(event).not.toHaveProperty('actorId');
      expect(event).not.toHaveProperty('personId');
      expect(event).not.toHaveProperty('objectId');
      expect(event).not.toHaveProperty('rawUrl');
      expect(event).not.toHaveProperty('query');
      expect(event).not.toHaveProperty('scopeKey');
      expect(event).not.toHaveProperty('cohort');
      expect(event).not.toHaveProperty('tenantId');
    }
  });

  it('selects safe fields instead of spreading caller or server context', () => {
    const dirtyInput = {
      productKey: 'communications',
      surfaceKey: 'communications.management',
      scopeKind: 'RESOURCE_SET',
      attemptId: UUID_ONE,
      actorId: 'actor-1',
      rawUrl: '/communications/admin?scope=S_COMMUNICATIONS',
      scopeKey: 'S_COMMUNICATIONS',
      tenantId: 'T_A',
      cohort: 'design-partner',
    } as Parameters<typeof productSurfaceTelemetryEvent.scopeSwitchStarted>[0];

    expect(productSurfaceTelemetryEvent.scopeSwitchStarted(dirtyInput)).toEqual({
      schemaVersion: 1,
      eventName: 'surface.scope.switch.started',
      productKey: 'communications',
      surfaceKey: 'communications.management',
      scopeKind: 'RESOURCE_SET',
      attemptId: UUID_ONE,
    });
  });

  it('uses stable duration buckets and rejects invalid duration values', () => {
    expect(
      [0, 999, 1_000, 5_000, 15_000, 30_000, 60_000, 300_000].map(toProductSurfaceElapsedBucket)
    ).toEqual([
      'LT_1S',
      'LT_1S',
      'S1_TO_5',
      'S5_TO_15',
      'S15_TO_30',
      'S30_TO_60',
      'M1_TO_5',
      'GTE_5M',
    ]);
    expect(() => toProductSurfaceElapsedBucket(-1)).toThrow(/non-negative/);
  });

  it('defaults both privacy gates off', () => {
    const report = vi.fn().mockResolvedValue(undefined);
    const event = productSurfaceTelemetryEvent.exposed({
      productKey: 'communications',
      surfaceKey: 'communications.work',
      deviceClass: 'MOBILE',
      attemptId: UUID_ONE,
    });

    createProductSurfaceTelemetryClient({ report }).capture(event);
    createProductSurfaceTelemetryClient({ privacyConsentGranted: true, report }).capture(event);
    createProductSurfaceTelemetryClient({ productionCollectionEnabled: true, report }).capture(
      event
    );

    expect(report).not.toHaveBeenCalled();
  });

  it('accepts only the explicit telemetry consent value and fails closed on storage errors', () => {
    expect(
      readProductSurfaceTelemetryConsent({
        getItem: (key) => (key === PRODUCT_SURFACE_TELEMETRY_CONSENT_KEY ? 'granted' : null),
      })
    ).toBe(true);
    expect(readProductSurfaceTelemetryConsent({ getItem: () => 'true' })).toBe(false);
    expect(readProductSurfaceTelemetryConsent({ getItem: () => null })).toBe(false);
    expect(
      readProductSurfaceTelemetryConsent({
        getItem: () => {
          throw new Error('storage is unavailable');
        },
      })
    ).toBe(false);
  });

  it('is fire-and-forget and isolates asynchronous and synchronous reporter failures', async () => {
    const event = productSurfaceTelemetryEvent.exposed({
      productKey: 'communications',
      surfaceKey: 'communications.work',
      deviceClass: 'TABLET',
      attemptId: UUID_ONE,
    });
    const rejected = createProductSurfaceTelemetryClient({
      privacyConsentGranted: true,
      productionCollectionEnabled: true,
      report: vi.fn().mockRejectedValue(new Error('offline')),
    });
    const throwing = createProductSurfaceTelemetryClient({
      privacyConsentGranted: true,
      productionCollectionEnabled: true,
      report: () => {
        throw new Error('unexpected reporter failure');
      },
    });

    expect(rejected.capture(event)).toBeUndefined();
    expect(() => throwing.capture(event)).not.toThrow();
    await Promise.resolve();
  });
});
