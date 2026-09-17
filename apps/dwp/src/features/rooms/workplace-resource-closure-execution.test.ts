import { describe, expect, it } from 'vitest';

import { workplaceClosureSelections } from './workplace-resource-closure-execution';

import type { WorkplaceClosureImpactPreview } from '@dwp-frontend/shared-utils';

const item = {
  previewItemId: '40000000-0000-4000-8000-000000000001',
  reservationOwner: 'WORKPLACE' as const,
  bookingId: '50000000-0000-4000-8000-000000000001',
  eventId: null,
  sourceWorkplaceResourceId: '20000000-0000-4000-8000-000000000001',
  sourceOwnerResourceId: '20000000-0000-4000-8000-000000000001',
  startsAt: '2026-09-18T01:00:00Z',
  endsAt: '2026-09-18T02:00:00Z',
  bookingStatus: 'CONFIRMED',
  bookingVersion: 4,
  recipientUserIds: [91],
  replacementBlockReason: null,
  replacementCandidates: [
    {
      workplaceResourceId: '21000000-0000-4000-8000-000000000001',
      ownerResourceId: '22000000-0000-4000-8000-000000000001',
      resourceName: 'D-1210',
      floorId: '23000000-0000-4000-8000-000000000001',
      resourceVersion: 8,
      rank: 0,
    },
  ],
};

const preview: WorkplaceClosureImpactPreview = {
  previewId: '30000000-0000-4000-8000-000000000001',
  resourceId: '20000000-0000-4000-8000-000000000001',
  siteId: '10000000-0000-4000-8000-000000000001',
  reservationOwner: 'WORKPLACE',
  startsAt: '2026-09-18T01:00:00Z',
  endsAt: '2026-09-18T03:00:00Z',
  resourceVersion: 7,
  previewVersion: 1,
  confirmationToken: 'snapshot-token',
  affectedBookingCount: 1,
  affectedRecipientCount: 1,
  expiresAt: '2026-09-17T04:10:00Z',
  generatedAt: '2026-09-17T04:00:00Z',
  items: [item],
};

describe('workplace closure booking decisions', () => {
  it('requires one explicit valid decision for every preview item', () => {
    expect(workplaceClosureSelections(preview, {})).toBeNull();
    expect(
      workplaceClosureSelections(preview, {
        [item.previewItemId]: { action: 'REPLACE', replacementResourceId: 'foreign-resource' },
      })
    ).toBeNull();
  });

  it('pins replacement and booking versions from the authoritative preview', () => {
    expect(
      workplaceClosureSelections(preview, {
        [item.previewItemId]: {
          action: 'REPLACE',
          replacementResourceId: item.replacementCandidates[0].workplaceResourceId,
        },
      })
    ).toEqual([
      {
        previewItemId: item.previewItemId,
        action: 'REPLACE',
        expectedBookingVersion: 4,
        replacementResourceId: item.replacementCandidates[0].workplaceResourceId,
        expectedReplacementResourceVersion: 8,
      },
    ]);
  });

  it('allows an empty decision set only for an authoritative zero-impact preview', () => {
    expect(
      workplaceClosureSelections(
        { ...preview, affectedBookingCount: 0, affectedRecipientCount: 0, items: [] },
        {}
      )
    ).toEqual([]);
  });
});
