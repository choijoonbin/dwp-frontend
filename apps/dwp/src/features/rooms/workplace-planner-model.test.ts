import { describe, expect, it } from 'vitest';

import {
  buildWorkplacePlannerHoldRequest,
  buildWorkplacePlannerIntentItems,
  buildWorkplacePlannerTeamConstraints,
  defaultWorkplacePlannerCandidateSelections,
  resolveWorkplacePlannerCollectionState,
  shouldPollWorkplacePlannerBatch,
  summarizeWorkplacePlannerDay,
  workplacePlannerBatchCounts,
  workplacePlannerHoldSecondsRemaining,
  workplacePlannerOfferSecondsRemaining,
  workplacePlannerRange,
} from './workplace-planner-model';

import type {
  WorkplaceBookingBatch,
  WorkplaceBookingIntentPreview,
  WorkplaceExploreResponse,
} from '@dwp-frontend/shared-utils';

const response = {
  sites: [],
  floors: [],
  selectedFloor: null,
  resources: [
    {
      resourceId: 'desk-open',
      siteId: 'site-1',
      floorId: 'floor-1',
      type: 'DESK',
      state: 'AVAILABLE',
      mode: 'RESERVABLE',
    },
    {
      resourceId: 'desk-busy',
      siteId: 'site-1',
      floorId: 'floor-1',
      type: 'DESK',
      state: 'AVAILABLE',
      mode: 'RESERVABLE',
    },
    {
      resourceId: 'locker-closed',
      siteId: 'site-1',
      floorId: 'floor-2',
      type: 'LOCKER',
      state: 'AVAILABLE',
      mode: 'RESERVABLE',
    },
  ],
  occupancy: [{ resourceId: 'desk-busy' }],
  closures: [{ resourceId: 'locker-closed' }],
  policy: {},
  generatedAt: '2026-09-16T00:00:00Z',
} as unknown as WorkplaceExploreResponse;

describe('workplace planner model', () => {
  it('builds an exact instant range in the selected site time zone', () => {
    expect(workplacePlannerRange('2026-09-16', '09:30', 90, 'Asia/Seoul')).toEqual({
      from: '2026-09-16T00:30:00Z',
      to: '2026-09-16T02:00:00Z',
    });
    expect(workplacePlannerRange('invalid', '09:30', 90, 'Asia/Seoul')).toBeNull();
  });

  it('counts only the selected scope and excludes occupied or closed resources', () => {
    expect(
      summarizeWorkplacePlannerDay('2026-09-16', response, ['DESK'], 'site-1', 'floor-1')
    ).toMatchObject({ date: '2026-09-16', total: 2, available: 1 });
    expect(
      summarizeWorkplacePlannerDay('2026-09-16', response, ['LOCKER'], 'site-1')
    ).toMatchObject({ total: 1, available: 0 });
  });

  it('fails closed on permission and distinguishes partial failure from empty data', () => {
    expect(
      resolveWorkplacePlannerCollectionState({
        permissionLoaded: false,
        canView: false,
        pendingCount: 0,
        errorCount: 0,
        successfulCount: 0,
        totalResources: 0,
      })
    ).toBe('PERMISSION_LOADING');
    expect(
      resolveWorkplacePlannerCollectionState({
        permissionLoaded: true,
        canView: false,
        pendingCount: 0,
        errorCount: 0,
        successfulCount: 0,
        totalResources: 0,
      })
    ).toBe('DENIED');
    expect(
      resolveWorkplacePlannerCollectionState({
        permissionLoaded: true,
        canView: true,
        pendingCount: 0,
        errorCount: 1,
        successfulCount: 4,
        totalResources: 0,
      })
    ).toBe('DEGRADED');
    expect(
      resolveWorkplacePlannerCollectionState({
        permissionLoaded: true,
        canView: true,
        pendingCount: 0,
        errorCount: 0,
        successfulCount: 5,
        totalResources: 0,
      })
    ).toBe('EMPTY');
  });

  it('builds a bounded five-day team package without dropping requested resources', () => {
    const result = buildWorkplacePlannerIntentItems({
      dates: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'],
      beneficiaries: Array.from({ length: 5 }, (_, index) => ({
        userId: index + 1,
        personPublicId: `person-${index + 1}`,
        displayName: `Member ${index + 1}`,
        delegationGrantId: index === 0 ? null : `grant-${index + 1}`,
      })),
      resourceTypes: ['DESK', 'PARKING', 'LOCKER'],
      start: '09:00',
      durationMinutes: 540,
      timeZone: 'Asia/Seoul',
      siteId: 'site-1',
      floorId: 'floor-1',
      purpose: 'Weekly workplace plan',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(35);
    expect(result.items.filter((item) => item.resourceType === 'DESK')).toHaveLength(25);
    expect(result.items.filter((item) => item.resourceType === 'PARKING')).toHaveLength(5);
    expect(result.items.filter((item) => item.resourceType === 'LOCKER')).toHaveLength(5);
    expect(result.items[0]).toMatchObject({
      startsAt: '2026-09-14T00:00:00Z',
      endsAt: '2026-09-14T09:00:00Z',
    });
  });

  it('fails the entire preview input when it exceeds the server boundary', () => {
    expect(
      buildWorkplacePlannerIntentItems({
        dates: Array.from(
          { length: 14 },
          (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`
        ),
        beneficiaries: Array.from({ length: 5 }, (_, index) => ({
          userId: index + 1,
          personPublicId: null,
          displayName: `Member ${index + 1}`,
          delegationGrantId: null,
        })),
        resourceTypes: ['DESK'],
        start: '09:00',
        durationMinutes: 60,
        timeZone: 'Asia/Seoul',
        siteId: '',
        floorId: '',
        purpose: 'Plan',
      })
    ).toEqual({ ok: false, code: 'TOO_MANY_ITEMS' });
  });

  it('groups team desk items by day and keeps explicit placement constraints', () => {
    const built = buildWorkplacePlannerIntentItems({
      dates: ['2026-09-14', '2026-09-15'],
      beneficiaries: [1, 2].map((userId) => ({
        userId,
        personPublicId: null,
        displayName: `Member ${userId}`,
        delegationGrantId: userId === 1 ? null : 'grant-2',
      })),
      resourceTypes: ['DESK'],
      start: '09:00',
      durationMinutes: 540,
      timeZone: 'Asia/Seoul',
      siteId: 'site-1',
      floorId: 'floor-1',
      purpose: 'Plan',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(
      buildWorkplacePlannerTeamConstraints({
        items: built.items,
        enabled: true,
        adjacentSeats: true,
        sameNeighborhood: true,
        minimumDistanceMeters: 0,
        maximumDistanceMeters: 8,
      })
    ).toEqual([
      expect.objectContaining({
        groupKey: '2026-09-14:TEAM_DESKS',
        clientItemKeys: ['2026-09-14:1:DESK', '2026-09-14:2:DESK'],
        adjacentSeats: true,
        sameNeighborhood: true,
        minimumDistanceMeters: 0,
        maximumDistanceMeters: 8,
      }),
      expect.objectContaining({ groupKey: '2026-09-15:TEAM_DESKS' }),
    ]);
  });

  it('requires an explicit valid candidate for every holdable item', () => {
    const preview = {
      intentId: 'intent-1',
      version: 4,
      items: [
        {
          intentItemId: 'item-1',
          decision: 'AVAILABLE',
          version: 2,
          candidates: [
            { resourceId: 'desk-1', preferred: false, resourceVersion: 6 },
            { resourceId: 'desk-2', preferred: true, resourceVersion: 7 },
          ],
        },
        {
          intentItemId: 'item-2',
          decision: 'POLICY_DENIED',
          version: 1,
          candidates: [],
        },
      ],
    } as unknown as WorkplaceBookingIntentPreview;
    const selections = defaultWorkplacePlannerCandidateSelections(preview);
    expect(selections).toEqual({ 'item-1': 'desk-2' });
    expect(buildWorkplacePlannerHoldRequest(preview, selections, 'Confirm resources')).toEqual({
      expectedIntentVersion: 4,
      selections: [
        {
          intentItemId: 'item-1',
          resourceId: 'desk-2',
          expectedItemVersion: 2,
          expectedResourceVersion: 7,
        },
      ],
      reason: 'Confirm resources',
      explicitConfirmation: true,
    });
    expect(buildWorkplacePlannerHoldRequest(preview, {}, 'Confirm resources')).toBeNull();
  });

  it('uses server time for hold expiry and preserves unknown batch recovery', () => {
    expect(
      workplacePlannerHoldSecondsRemaining(
        [
          {
            state: 'ACTIVE',
            expiresAt: '2026-09-16T00:02:00Z',
          },
          {
            state: 'ACTIVE',
            expiresAt: '2026-09-16T00:01:30Z',
          },
        ] as never,
        '2026-09-16T00:00:00Z',
        31_000
      )
    ).toBe(59);
    const batch = {
      terminal: true,
      requeryRequired: true,
      items: [
        { state: 'SUCCEEDED', requeryRequired: false },
        { state: 'RESULT_UNKNOWN', requeryRequired: true },
      ],
    } as unknown as WorkplaceBookingBatch;
    expect(workplacePlannerBatchCounts(batch)).toMatchObject({ SUCCEEDED: 1, RESULT_UNKNOWN: 1 });
    expect(shouldPollWorkplacePlannerBatch(batch)).toBe(true);
  });

  it('uses the waitlist server snapshot instead of the browser clock for offer expiry', () => {
    expect(
      workplacePlannerOfferSecondsRemaining('2026-09-16T00:05:00Z', '2026-09-16T00:00:00Z', 1_500)
    ).toBe(299);
    expect(
      workplacePlannerOfferSecondsRemaining('2026-09-16T00:05:00Z', '2026-09-16T00:00:00Z', 301_000)
    ).toBe(0);
    expect(workplacePlannerOfferSecondsRemaining('invalid', 'invalid', 0)).toBe(0);
  });
});
