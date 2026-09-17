import { FULL_PRODUCT_PERMISSIONS, fulfillSuccess, mockShellSession } from './shell-session';
import type { Page } from '@playwright/test';
import type {
  CalendarBooking,
  CalendarPolicy,
  CalendarResource,
  WorkplacePolicyImpact,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';

export const siteId = '10000000-0000-0000-0000-000000000001';
export const floorId = '20000000-0000-0000-0000-000000000001';
export const resourceId = '30000000-0000-0000-0000-000000000001';
const bookingId = '40000000-0000-0000-0000-000000000001';
const requestId = '50000000-0000-0000-0000-000000000001';
export const site = {
  siteId,
  code: 'QA',
  name: 'QA site',
  nameKo: 'QA 사이트',
  nameEn: 'QA site',
  type: 'HEADQUARTERS',
  timeZone: 'Asia/Seoul',
  state: 'ACTIVE',
  configuredFloorCount: 1,
  resourceCount: 1,
  version: 1,
};
export const floor = {
  floorId,
  siteId,
  siteName: site.name,
  floorNumber: 1,
  name: 'QA floor',
  nameKo: 'QA 층',
  nameEn: 'QA floor',
  planWidth: 1200,
  planHeight: 800,
  backgroundAssetPath: null,
  resourceCount: 1,
  state: 'ACTIVE',
  version: 1,
};
export const resource = {
  resourceId,
  siteId,
  floorId,
  code: 'QA-DESK',
  name: 'QA desk',
  nameKo: 'QA 좌석',
  nameEn: 'QA desk',
  type: 'DESK',
  capacity: 1,
  features: [],
  neighborhood: null,
  assignedUserId: null,
  calendarResourceId: null,
  approvalRequired: false,
  accessible: true,
  mode: 'RESERVABLE',
  positionX: 12,
  positionY: 20,
  widthPercent: 8,
  heightPercent: 6,
  rotationDegrees: 0,
  assignedToCurrentUser: false,
  assignedPersonPublicId: null,
  assignedDisplayName: null,
  state: 'AVAILABLE',
  version: 1,
} satisfies WorkplaceResource;
const initialPolicy = {
  bookingWindowDays: 30,
  maximumActiveBookings: 20,
  minimumBookingMinutes: 30,
  maximumBookingMinutes: 480,
  maximumConsecutiveDays: 5,
  workingDayStart: '07:00:00',
  workingDayEnd: '20:00:00',
  allowRecurring: false,
  requireCheckIn: true,
  checkInLeadMinutes: 60,
  autoReleaseMinutes: 30,
  allowAssignedDeskLending: false,
  showColleagueNames: false,
  bookingRetentionDays: 365,
  version: 2,
};
const initialRoom = {
  resourceId: '91000000-0000-0000-0000-000000000001',
  code: 'QA-ROOM',
  name: 'Native approval test room',
  nameKo: '승인 테스트 회의실',
  nameEn: 'Native approval test room',
  type: 'ROOM',
  site: 'Native meeting test site',
  floor: '12',
  capacity: 18,
  features: ['VIDEO'],
  timeZone: 'Asia/Seoul',
  approvalRequired: true,
  state: 'AVAILABLE',
  available: true,
  version: 3,
} satisfies CalendarResource;
const roomPolicy = {
  weekStart: 1,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  defaultEventMinutes: 30,
  minimumEventMinutes: 15,
  maximumEventMinutes: 240,
  maximumAdvanceDays: 30,
  defaultBufferMinutes: 10,
  weeklyFocusTargetMinutes: 300,
  dailyMeetingLimitMinutes: 240,
  enforceMeetingAgenda: true,
  allowExternalAttendees: false,
  version: 2,
} satisfies CalendarPolicy;
const initialRoomBooking = {
  bookingId: '92000000-0000-0000-0000-000000000001',
  eventId: '93000000-0000-0000-0000-000000000001',
  resourceId: initialRoom.resourceId,
  resourceName: initialRoom.name,
  eventTitle: 'Native approval test meeting',
  startsAt: '2026-09-18T05:00:00Z',
  endsAt: '2026-09-18T08:30:00Z',
  organizerName: 'Tenant Admin',
  organizerEmail: 'tenant-admin@example.test',
  status: 'PENDING',
  requestedBy: 900018,
  version: 4,
} satisfies CalendarBooking;
export const booking = {
  bookingId,
  resourceId,
  siteId,
  floorId,
  resourceName: resource.name,
  resourceType: 'DESK',
  floorName: floor.name,
  status: 'NO_SHOW',
  startsAt: '2026-09-14T00:00:00Z',
  endsAt: '2026-09-14T01:00:00Z',
  checkedInAt: null,
  releasedAt: null,
  legalHold: false,
  version: 1,
  updatedAt: '2026-09-14T01:30:00Z',
  detailHref: '/workplace/admin/operations',
  exceptionReasons: ['NO_SHOW'],
};
export const metadata = {
  generatedAt: '2026-09-14T02:00:00Z',
  sourceUpdatedAt: '2026-09-14T01:30:00Z',
  availability: 'AVAILABLE' as const,
  owner: 'WP_BOOKINGS',
  denominatorBasis: 'current roster resource minutes across 24-hour local days',
  historicalRosterAvailable: false,
  recurringOccurrencesIncluded: true,
};
const summary = {
  bookingCount: 2,
  cancelledCount: 0,
  bookedMinutes: 60,
  denominatorResourceMinutes: 7 * 1440,
  utilizationPercent: (60 / (7 * 1440)) * 100,
  noShowEligibleCount: 2,
  noShowCount: 1,
  noShowPercent: 50,
  peakUtilizationPercent: 100,
  unresolvedPastBookings: 0,
};
export const pageData = <T>(content: T[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
  generatedAt: metadata.generatedAt,
});
const report = {
  scope: {
    siteId,
    floorId: null,
    siteName: site.name,
    timeZone: site.timeZone,
    from: '2026-09-08',
    to: '2026-09-15',
    startsAt: '2026-09-07T15:00:00Z',
    endsAt: '2026-09-14T15:00:00Z',
  },
  metadata,
  current: {
    activeSites: 1,
    configuredFloors: 1,
    reservableResources: 1,
    assignedResources: 0,
    bookingsThisWeek: 2,
    checkedInToday: 1,
    utilizationPercent: (60 / 1440) * 100,
    policy: initialPolicy,
  },
  summary,
  floors: [{ floorId, floorName: floor.name, resourceCount: 1, summary }],
  hourlyHeatmap: Array.from({ length: 7 }, (_, dayIndex) =>
    Array.from({ length: 24 }, (_, hour) => {
      const date = `2026-09-${String(8 + dayIndex).padStart(2, '0')}`;
      const nextDate = `2026-09-${String(9 + dayIndex).padStart(2, '0')}`;
      const bookedMinutes = dayIndex === 6 && hour === 8 ? 60 : 0;
      return {
        date,
        dayOfWeek: (2 + dayIndex) % 7,
        hour,
        offset: '+09:00',
        startsAt: `${date}T${String(hour).padStart(2, '0')}:00:00+09:00`,
        endsAt: `${hour === 23 ? nextDate : date}T${String((hour + 1) % 24).padStart(2, '0')}:00:00+09:00`,
        bookedMinutes,
        denominatorResourceMinutes: 60,
        utilizationPercent: (bookedMinutes / 60) * 100,
      };
    })
  ).flat(),
  dailyTrend: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-09-${String(8 + index).padStart(2, '0')}`,
    bookingCount: index === 6 ? 2 : 0,
    bookedMinutes: index === 6 ? 60 : 0,
    denominatorResourceMinutes: 1440,
    utilizationPercent: index === 6 ? (60 / 1440) * 100 : 0,
    noShowCount: index === 6 ? 1 : 0,
    noShowPercent: index === 6 ? 50 : null,
  })),
  comparison: {
    previousFrom: '2026-09-01',
    previousTo: '2026-09-08',
    previous: summary,
    utilizationChangePercentagePoints: 0,
    noShowChangePercentagePoints: 0,
  },
  exceptions: pageData([booking]),
  externalSources: [
    {
      kind: 'SENSOR_OCCUPANCY',
      availability: 'UNAVAILABLE',
      reason: 'No verified sensor producer is installed.',
      owner: 'EXTERNAL_ADAPTER',
      integrationPath: '/workplace/admin/governance?area=experience',
    },
  ],
  definitions: ['This is persisted planned occupancy, not actual live presence.'],
};
export async function setup(
  page: Page,
  options: {
    dark?: boolean;
    reportFailure?: boolean;
    impactFailure?: boolean;
    policyConflict?: boolean;
    elevated?: boolean;
  } = {}
) {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    ...(options.dark
      ? {
          appearance: { mode: 'dark', density: 'standard', highContrast: true, reduceMotion: true },
        }
      : {}),
  });
  if (options.elevated) {
    await page.route('**/api/auth/product-surface-contexts', (route) =>
      fulfillSuccess(route, {
        contractVersion: 'product-surfaces/v3',
        decisionRevision: 'workplace-facility-closure-elevated',
        sourceRevisions: {
          auth: 'auth-facility-closure',
          policy: 'policy-facility-closure',
          productRelationship: 'relationship-facility-closure',
        },
        activeAccessMode: 'ELEVATED',
        generatedAt: metadata.generatedAt,
        contexts: [],
        rollouts: [
          'approvals',
          'calendar',
          'communications',
          'dwaion',
          'hcm',
          'mail',
          'meetings',
          'messaging',
          'notifications',
          'services',
          'spaces',
          'workplace',
        ].map((productKey) => ({
          productKey,
          state: '000',
          flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
          cohort: 'baseline',
          opaqueRevision: `rollout-${productKey}-baseline`,
          authorityStatus: 'NOT_EVALUATED',
        })),
      })
    );
  }
  const state = {
    reportFailure: options.reportFailure ?? false,
    impactFailure: options.impactFailure ?? false,
    policyConflict: options.policyConflict ?? false,
    policy: { ...initialPolicy },
    impacts: [] as { from: string | null; to: string | null }[],
    policyPreviews: [] as Record<string, string>[],
    room: { ...initialRoom } as CalendarResource,
    pendingRooms: [{ ...initialRoomBooking }] as CalendarBooking[],
    createdRooms: [] as CalendarResource[],
    roomFailure: false,
    roomGate: null as Promise<void> | null,
    detailReads: 0,
    floorFailureStatus: null as number | null,
    statusFailure: false,
    statusGate: null as Promise<void> | null,
    writes: [] as { path: string; body: Record<string, unknown>; key: string | undefined }[],
    closurePreviews: [] as {
      path: string;
      body: Record<string, unknown>;
      key: string | undefined;
    }[],
  };
  let closures: Record<string, unknown>[] = [];
  let closureCommand: Record<string, unknown> | null = null;
  await page.route('**/api/platform/v1/admin/rooms/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/overview'))
      return fulfillSuccess(route, {
        activeResources: 1,
        resourcesInMaintenance: 0,
        bookingsThisWeek: 1,
        pendingBookings: state.pendingRooms.length,
        eventsThisWeek: 1,
        conflictedUsers: 0,
        policy: roomPolicy,
        resources: [state.room, ...state.createdRooms],
        generatedAt: metadata.generatedAt,
      });
    if (path.endsWith('/bookings/pending')) return fulfillSuccess(route, state.pendingRooms);
    if (
      (path.includes('/resources/') && request.method() === 'PUT') ||
      (path.endsWith('/resources') && request.method() === 'POST')
    ) {
      const body = request.postDataJSON();
      state.writes.push({ path, body, key: undefined });
      if (state.roomGate) await state.roomGate;
      if (state.roomFailure)
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Fixture: native resource outcome unavailable',
            code: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
          }),
        });
      if (request.method() === 'POST') {
        const created = {
          ...state.room,
          ...body,
          resourceId: '91000000-0000-0000-0000-000000000002',
          name: body.nameEn,
          version: 0,
        };
        state.createdRooms.push(created);
        return fulfillSuccess(route, created);
      }
      state.room = { ...state.room, ...body, version: state.room.version + 1 };
      return fulfillSuccess(route, state.room);
    }
    if (path.endsWith('/decision') && request.method() === 'POST') {
      const body = request.postDataJSON();
      state.writes.push({ path, body, key: undefined });
      const decided = {
        ...initialRoomBooking,
        status: body.decision === 'APPROVE' ? 'CONFIRMED' : 'DECLINED',
        decisionNote: body.note,
        version: 5,
      };
      state.pendingRooms = [];
      return fulfillSuccess(route, decided);
    }
    return route.fallback();
  });
  let facility = {
    requestId,
    resourceId,
    siteId,
    floorId,
    resourceName: resource.name,
    category: 'REPAIR',
    description: 'Fixture: the desk light needs repair.',
    status: 'OPEN',
    statusReason: null as string | null,
    priority: 'NORMAL',
    assignedTo: null as string | null,
    serviceProvider: null as string | null,
    externalWorkOrderReference: null as string | null,
    slaDueAt: null as string | null,
    version: 0,
    createdAt: metadata.generatedAt,
    updatedAt: metadata.generatedAt,
    owner: 'WORKPLACE_NATIVE',
  };
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const failure = () =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Fixture: source unavailable',
          code: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
        }),
      });
    if (path.endsWith('/sites')) return fulfillSuccess(route, [site]);
    if (path.endsWith('/floors')) return fulfillSuccess(route, [floor]);
    if (path.endsWith('/resources')) return fulfillSuccess(route, [resource]);
    if (path.endsWith('/audit-events'))
      return fulfillSuccess(
        route,
        pageData([
          {
            auditEventId: '70000000-0000-4000-8000-000000000001',
            action: 'workplace.facility.closure_created',
            aggregateType: 'FACILITY_CLOSURE',
            aggregateId: '70000000-0000-4000-8000-000000000002',
            actorUserId: 7,
            correlationId: '70000000-0000-4000-8000-000000000003',
            snapshot: { resourceId, siteId, floorId },
            occurredAt: metadata.generatedAt,
          },
        ])
      );
    if (path.endsWith('/governance/delegated-admin-scopes/effective'))
      return fulfillSuccess(route, []);
    if (
      path.endsWith('/experience-report') &&
      new URL(request.url()).searchParams.has('floorId') &&
      state.floorFailureStatus
    ) {
      return route.fulfill({
        status: state.floorFailureStatus,
        contentType: 'application/json',
        body: JSON.stringify({
          code: state.floorFailureStatus === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
          message: 'Fixture floor access revoked or floor deleted',
        }),
      });
    }
    if (path.endsWith('/experience-report'))
      return state.reportFailure
        ? failure()
        : fulfillSuccess(route, {
            ...report,
            current: { ...report.current, policy: state.policy },
          });
    if (path.includes('/experience-report/bookings/')) return fulfillSuccess(route, booking);
    if (path.endsWith('/future-booking-impact')) {
      const params = new URL(request.url()).searchParams;
      state.impacts.push({ from: params.get('from'), to: params.get('to') });
      return state.impactFailure
        ? failure()
        : fulfillSuccess(route, {
            resourceId,
            siteId,
            resourceName: resource.name,
            owner: 'WORKPLACE',
            resourceState: 'AVAILABLE',
            from: params.get('from')!,
            to: params.get('to')!,
            metadata: {
              ...metadata,
              owner: 'WORKPLACE',
              denominatorBasis: 'CURRENT_RESERVABLE_ROSTER_ELAPSED_MINUTES',
              recurringOccurrencesIncluded: false,
            },
            affectedBookings: {
              ...pageData([
                {
                  ...booking,
                  status: 'RESERVED',
                  startsAt: params.get('from')!,
                  endsAt: params.get('to')!,
                  exceptionReasons: [],
                  detailHref: `/workplace/admin/operations?siteId=${siteId}&bookingId=${booking.bookingId}`,
                },
              ]),
              page: Number(params.get('page') ?? 0),
              size: Number(params.get('size') ?? 20),
            },
            mutatesBookings: false,
            notificationScheduled: false,
            replacementScheduled: false,
          });
    }
    if (path.endsWith('/policy-impact-preview')) {
      const params = Object.fromEntries(new URL(request.url()).searchParams);
      state.policyPreviews.push(params);
      return fulfillSuccess(route, {
        siteId,
        floorId: null,
        from: params.from,
        to: params.to,
        metadata,
        proposed: { minimumBookingMinutes: Number(params.minimumBookingMinutes) },
        reviewedBookings: 2,
        affectedBookings: 1,
        content: [
          {
            booking: {
              ...booking,
              startsAt: '2026-09-14T00:00:00Z',
              endsAt: '2026-09-14T00:30:00Z',
              status: 'RESERVED',
              checkedInAt: null,
              releasedAt: null,
              exceptionReasons: [],
            },
            knownEffects: ['BELOW_PROPOSED_MINIMUM_DURATION'],
          },
        ],
        page: 0,
        size: 20,
        totalPages: 1,
        mutatesExistingBookings: false,
        limitations: ['Fixture: existing snapshots are retained.'],
        dailyImpact: [
          { date: '2026-09-14', timeZone: site.timeZone, reviewedBookings: 1, affectedBookings: 1 },
          { date: '2026-09-15', timeZone: site.timeZone, reviewedBookings: 1, affectedBookings: 0 },
        ],
      } satisfies WorkplacePolicyImpact);
    }
    if (path.endsWith('/workplace/policy') && request.method() === 'GET')
      return fulfillSuccess(route, state.policy);
    if (path.endsWith('/booking-policy/review'))
      return fulfillSuccess(route, {
        targetType: 'WP_BOOKING_POLICY',
        targetId: null,
        current: state.policy,
        proposed: request.postDataJSON().proposed,
        currentActorAccess: null,
        knownImpact: ['Existing booking snapshots remain unchanged.'],
        warnings: [],
        evaluatedAt: metadata.generatedAt,
      });
    if (path.endsWith('/booking-policy/changes')) {
      const body = request.postDataJSON();
      state.writes.push({ path, body, key: undefined });
      if (state.policyConflict) {
        state.policyConflict = false;
        state.policy = { ...state.policy, version: state.policy.version + 1 };
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'OBJECT_VERSION_CONFLICT',
            message: 'Fixture version conflict',
          }),
        });
      }
      state.policy = { ...body.proposed, version: state.policy.version + 1 };
      return fulfillSuccess(route, state.policy);
    }
    if (path.endsWith('/experience/facilities/closures'))
      return fulfillSuccess(route, pageData(closures));
    if (path.endsWith('/closure-impact-previews') && request.method() === 'POST') {
      const body = request.postDataJSON();
      state.closurePreviews.push({ path, body, key: request.headers()['idempotency-key'] });
      return fulfillSuccess(route, {
        previewId: '61000000-0000-0000-0000-000000000001',
        resourceId,
        siteId,
        reservationOwner: 'WORKPLACE',
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        resourceVersion: body.resourceVersion,
        previewVersion: 1,
        confirmationToken: 'fixture-closure-snapshot',
        affectedBookingCount: 1,
        affectedRecipientCount: 1,
        expiresAt: '2026-09-17T04:10:00Z',
        generatedAt: metadata.generatedAt,
        items: [
          {
            previewItemId: '62000000-0000-0000-0000-000000000001',
            reservationOwner: 'WORKPLACE',
            bookingId,
            eventId: null,
            sourceWorkplaceResourceId: resourceId,
            sourceOwnerResourceId: resourceId,
            startsAt: body.startsAt,
            endsAt: body.endsAt,
            bookingStatus: 'RESERVED',
            bookingVersion: booking.version,
            recipientUserIds: [7],
            replacementBlockReason: null,
            replacementCandidates: [],
          },
        ],
      });
    }
    if (path.endsWith('/closure-impact-previews/61000000-0000-0000-0000-000000000001/commands')) {
      const body = request.postDataJSON();
      state.writes.push({ path, body, key: request.headers()['idempotency-key'] });
      const previewBody = state.closurePreviews.at(-1)!.body;
      const closure = {
        closureId: '60000000-0000-0000-0000-000000000001',
        resourceId,
        siteId,
        floorId,
        resourceName: resource.name,
        timeZone: site.timeZone,
        startsAt: previewBody.startsAt,
        endsAt: previewBody.endsAt,
        status: 'ACTIVE',
        reason: body.reason,
        cancellationReason: null,
        resourceVersionAtCreate: resource.version,
        version: 0,
        createdAt: metadata.generatedAt,
        updatedAt: metadata.generatedAt,
        affectedBookingsPath: '',
      };
      closures = [closure];
      closureCommand = {
        commandId: '63000000-0000-0000-0000-000000000001',
        previewId: '61000000-0000-0000-0000-000000000001',
        closureId: closure.closureId,
        resourceId,
        siteId,
        state: 'SUCCEEDED',
        expectedPreviewVersion: body.expectedPreviewVersion,
        reason: body.reason,
        keptCount: body.selections.filter((item: { action: string }) => item.action === 'KEEP')
          .length,
        cancelledCount: body.selections.filter(
          (item: { action: string }) => item.action === 'CANCEL'
        ).length,
        replacedCount: body.selections.filter(
          (item: { action: string }) => item.action === 'REPLACE'
        ).length,
        version: 1,
        createdAt: metadata.generatedAt,
        completedAt: metadata.generatedAt,
        notifications: {
          recipientCount: 1,
          eventCount: 1,
          state: 'PUBLISHED',
          pendingCount: 0,
          retryCount: 0,
          sendingCount: 0,
          publishedCount: 1,
          resultUnknownCount: 0,
          deadCount: 0,
          eventTransportConfigured: true,
          reconciliationRequired: false,
          observedAt: metadata.generatedAt,
        },
        items: body.selections.map((selection: Record<string, unknown>, index: number) => ({
          commandItemId: `64000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
          previewItemId: selection.previewItemId,
          reservationOwner: 'WORKPLACE',
          bookingId,
          selectedAction: selection.action,
          expectedBookingVersion: selection.expectedBookingVersion,
          replacementWorkplaceResourceId: selection.replacementResourceId ?? null,
          replacementOwnerResourceId: null,
          replacementResourceVersion: selection.expectedReplacementResourceVersion ?? null,
          resultState: 'SUCCEEDED',
          resultCode: null,
          resultingBookingVersion: booking.version + 1,
        })),
      };
      return fulfillSuccess(route, closureCommand);
    }
    if (path.endsWith('/closure-commands/63000000-0000-0000-0000-000000000001/receipt'))
      return fulfillSuccess(route, {
        command: closureCommand,
        owner: 'PLATFORM',
        bookingsMutated: false,
        notificationScheduled: true,
        notificationDispatchPublished: true,
        externalDeliveryProven: false,
        auditTrail: [
          {
            commandEventId: '65000000-0000-0000-0000-000000000001',
            eventType: 'COMMAND_COMPLETED',
            actorUserId: 7,
            evidence: 'Fixture closure completed.',
            correlationId: 'fixture-closure-command',
            occurredAt: metadata.generatedAt,
          },
        ],
      });
    if (path.endsWith('/closure-commands/63000000-0000-0000-0000-000000000001'))
      return fulfillSuccess(route, closureCommand);
    if (path.includes('/resources/') && path.endsWith('/closures') && request.method() === 'POST') {
      const body = request.postDataJSON();
      state.writes.push({ path, body, key: request.headers()['idempotency-key'] });
      const closure = {
        closureId: '60000000-0000-0000-0000-000000000001',
        resourceId,
        siteId,
        floorId,
        resourceName: resource.name,
        timeZone: site.timeZone,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        status: 'ACTIVE',
        reason: body.reason,
        cancellationReason: null,
        resourceVersionAtCreate: resource.version,
        version: 0,
        createdAt: metadata.generatedAt,
        updatedAt: metadata.generatedAt,
        affectedBookingsPath: '',
      };
      closures = [closure];
      return fulfillSuccess(route, closure);
    }
    if (path.includes('/experience/facilities/closures/') && request.method() === 'GET') {
      state.detailReads += 1;
      return fulfillSuccess(
        route,
        closures.find((item) => item.closureId === path.split('/').at(-1))
      );
    }
    if (path.endsWith('/cancel')) {
      const body = request.postDataJSON();
      state.writes.push({ path, body, key: undefined });
      closures = closures.map((item) => ({
        ...item,
        status: 'CANCELLED',
        cancellationReason: body.reason,
        version: Number(item.version) + 1,
      }));
      return fulfillSuccess(route, closures[0]);
    }
    if (path.endsWith('/experience/facilities/requests')) {
      const status = new URL(request.url()).searchParams.get('status');
      return fulfillSuccess(
        route,
        pageData(!status || facility.status === status ? [facility] : [])
      );
    }
    if (path.endsWith('/status')) {
      const body = request.postDataJSON();
      state.writes.push({ path, body, key: undefined });
      if (state.statusGate) await state.statusGate;
      if (state.statusFailure) return failure();
      facility = {
        ...facility,
        status: body.status,
        statusReason: body.reason,
        priority: body.priority ?? facility.priority,
        assignedTo:
          body.assignedTo === undefined ? facility.assignedTo : body.assignedTo.trim() || null,
        serviceProvider:
          body.serviceProvider === undefined
            ? facility.serviceProvider
            : body.serviceProvider.trim() || null,
        externalWorkOrderReference:
          body.externalWorkOrderReference === undefined
            ? facility.externalWorkOrderReference
            : body.externalWorkOrderReference.trim() || null,
        slaDueAt: body.clearSla ? null : (body.slaDueAt ?? facility.slaDueAt),
        version: facility.version + 1,
      };
      return fulfillSuccess(route, facility);
    }
    if (path.endsWith('/photo') || path.endsWith('/photo/metadata'))
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'NOT_FOUND', message: 'Fixture: no registered photo' }),
      });
    return route.fallback();
  });
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/explore'))
      return fulfillSuccess(route, {
        sites: [site],
        floors: [floor],
        selectedFloor: floor,
        resources: [resource],
        occupancy: [],
        closures: [],
        policy: state.policy,
        generatedAt: metadata.generatedAt,
      });
    if (path.endsWith('/photo') || path.endsWith('/photo/metadata'))
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'NOT_FOUND', message: 'Fixture: no registered photo' }),
      });
    if (path.endsWith('/experience/facilities/requests') && request.method() === 'GET')
      return fulfillSuccess(route, pageData([facility]));
    if (path.includes('/resources/') && path.endsWith('/requests')) {
      const body = request.postDataJSON();
      state.writes.push({ path, body, key: request.headers()['idempotency-key'] });
      facility = { ...facility, category: body.category, description: body.description };
      return fulfillSuccess(route, facility);
    }
    return route.fallback();
  });
  return state;
}
