import { describe, expect, it } from 'vitest';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { VideoMeetingPreparation } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import {
  editablePreparationAgenda,
  movePreparationAgenda,
  normalizePreparationAgenda,
  preparationAgendaError,
  preparationEntryAllowed,
  preparationInvitationChanged,
  preparationOwners,
  validatePreparationMaterialBoundary,
} from './meeting-preparation-model';

const meeting = {
  organizerUserId: 1,
  organizerName: 'Host',
  participants: [
    { userId: 2, displayName: 'Presenter', attendanceState: 'INVITED' },
    { userId: 3, displayName: 'Denied', attendanceState: 'DENIED' },
  ],
} as VideoMeetingSummary;
const item = { title: 'Review', objective: 'Choose', ownerUserId: 2, plannedMinutes: 15 };
describe('meeting preparation model', () => {
  it('rejects missing material fields instead of fabricating an empty authorized state', () => {
    const legacy = {
      meetingId: 'meeting-1',
      agendaItems: [],
      canManageMaterials: true,
    } as unknown as VideoMeetingPreparation;
    expect(() => validatePreparationMaterialBoundary(legacy)).toThrow(
      'Invalid preparation boundary'
    );
  });
  it('preserves a complete governed material boundary', () => {
    const complete = {
      agendaVersion: 3,
      agendaItems: [{ itemId: 'agenda-1' }],
      materials: [{ materialId: 'material-1' }],
      materialsVersion: 3,
      canManageMaterials: true,
      canPrepare: true,
      myPreparation: {
        agendaVersion: 3,
        version: 1,
        preparedAgendaItemIds: ['agenda-1'],
        updatedAt: null,
      },
    } as unknown as VideoMeetingPreparation;
    expect(validatePreparationMaterialBoundary(complete)).toBe(complete);
  });
  it('rejects preparation state outside the current self agenda without exposing aggregates', () => {
    const invalid = {
      agendaVersion: 3,
      agendaItems: [{ itemId: 'agenda-1' }],
      materials: [],
      materialsVersion: 0,
      canManageMaterials: false,
      canPrepare: true,
      myPreparation: {
        agendaVersion: 3,
        version: 1,
        preparedAgendaItemIds: ['another-user-or-agenda-item'],
        updatedAt: null,
      },
    } as unknown as VideoMeetingPreparation;
    expect(() => validatePreparationMaterialBoundary(invalid)).toThrow(
      'Invalid preparation boundary'
    );
  });
  it('maps actual participant identities and excludes denied owners', () => {
    expect(preparationOwners(meeting)).toEqual([
      { userId: 1, displayName: 'Host' },
      { userId: 2, displayName: 'Presenter' },
    ]);
  });
  it('keeps explicit agenda ordering without copying display metadata', () => {
    const preparation = {
      agendaItems: [
        { ...item, itemId: 'second', position: 2, ownerDisplayName: 'Person' },
        { ...item, itemId: 'first', position: 1, title: 'First' },
      ],
    } as VideoMeetingPreparation;
    const result = editablePreparationAgenda(preparation);
    expect(result.map((value) => value.itemId)).toEqual(['first', 'second']);
    expect(result[0]).not.toHaveProperty('position');
    expect(result[1]).not.toHaveProperty('ownerDisplayName');
  });
  it('normalizes only editable fields and does not carry arbitrary content credentials', () => {
    expect(
      normalizePreparationAgenda([
        { ...item, title: ' Review ', objective: '  ', token: 'never' } as typeof item,
      ])
    ).toEqual([{ title: 'Review', objective: null, ownerUserId: 2, plannedMinutes: 15 }]);
  });
  it.each([
    [{ ...item, title: '' }, 'title'],
    [{ ...item, objective: 'x'.repeat(2001) }, 'objective'],
    [{ ...item, ownerUserId: 99 }, 'owner'],
    [{ ...item, ownerUserId: 3 }, 'owner'],
    [{ ...item, plannedMinutes: 0 }, 'minutes'],
    [{ ...item, plannedMinutes: 1.5 }, 'minutes'],
  ])('rejects invalid agenda field %#', (value, error) =>
    expect(preparationAgendaError([value as typeof item], meeting)).toBe(error)
  );
  it('allows unspecified ownership/time and empty agenda without inventing values', () => {
    expect(
      preparationAgendaError([{ title: 'Check', ownerUserId: null, plannedMinutes: null }], meeting)
    ).toBeNull();
    expect(preparationAgendaError([], meeting)).toBeNull();
    expect(preparationAgendaError(Array(51).fill(item), meeting)).toBe('tooMany');
  });
  it('supports keyboard reordering without mutating the source', () => {
    const items = [item, { ...item, title: 'Next' }];
    expect(movePreparationAgenda(items, 0, 1).map((value) => value.title)).toEqual([
      'Next',
      'Review',
    ]);
    expect(items[0].title).toBe('Review');
    expect(movePreparationAgenda(items, 0, -1)).toBe(items);
  });
  it.each(['DRAFT', 'ENDED', 'CANCELLED'] as const)(
    'does not enter %s meetings',
    (lifecycleState) => expect(preparationEntryAllowed({ ...meeting, lifecycleState })).toBe(false)
  );
  it.each(['SCHEDULED', 'LOBBY', 'LIVE'] as const)(
    'offers device entry for %s without publishing media',
    (lifecycleState) => expect(preparationEntryAllowed({ ...meeting, lifecycleState })).toBe(true)
  );
  it('distinguishes a changed invitation from an unchanged response', () => {
    expect(
      preparationInvitationChanged({
        invitationRevision: 3,
        myResponse: { invitationRevision: 2 },
      } as VideoMeetingPreparation)
    ).toBe(true);
    expect(
      preparationInvitationChanged({
        invitationRevision: 3,
        myResponse: { invitationRevision: 3 },
      } as VideoMeetingPreparation)
    ).toBe(false);
  });
});
