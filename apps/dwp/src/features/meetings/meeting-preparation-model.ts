import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type {
  VideoMeetingAgendaInput,
  VideoMeetingPreparation,
} from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';

/**
 * Reject an incomplete material contract at the feature boundary instead of rendering an
 * authorized-looking empty collection or allowing commands with a fabricated version.
 */
export function validatePreparationMaterialBoundary(
  preparation: VideoMeetingPreparation
): VideoMeetingPreparation {
  const agendaItemIds = new Set(preparation.agendaItems?.map((item) => item.itemId));
  if (
    !Array.isArray(preparation.materials) ||
    !Number.isSafeInteger(preparation.materialsVersion) ||
    preparation.materialsVersion < 0 ||
    typeof preparation.canManageMaterials !== 'boolean' ||
    typeof preparation.canPrepare !== 'boolean' ||
    !preparation.myPreparation ||
    preparation.myPreparation.agendaVersion !== preparation.agendaVersion ||
    !Number.isSafeInteger(preparation.myPreparation.version) ||
    preparation.myPreparation.version < 0 ||
    !Array.isArray(preparation.myPreparation.preparedAgendaItemIds) ||
    new Set(preparation.myPreparation.preparedAgendaItemIds).size !==
      preparation.myPreparation.preparedAgendaItemIds.length ||
    preparation.myPreparation.preparedAgendaItemIds.some((itemId) => !agendaItemIds.has(itemId))
  )
    throw new Error('Invalid preparation boundary');
  return preparation;
}

export function editablePreparationAgenda(
  preparation: VideoMeetingPreparation
): VideoMeetingAgendaInput[] {
  return [...preparation.agendaItems]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      itemId: item.itemId,
      title: item.title,
      objective: item.objective ?? null,
      ownerUserId: item.ownerUserId ?? null,
      plannedMinutes: item.plannedMinutes ?? null,
    }));
}

export function preparationOwners(meeting: VideoMeetingSummary) {
  const owners = new Map<number, string>();
  if (meeting.organizerUserId && meeting.organizerUserId > 0)
    owners.set(meeting.organizerUserId, meeting.organizerName);
  meeting.participants.forEach((person) => {
    if (person.userId && person.userId > 0 && person.attendanceState !== 'DENIED')
      owners.set(person.userId, person.displayName);
  });
  return [...owners].map(([userId, displayName]) => ({ userId, displayName }));
}

export function preparationAgendaError(
  items: VideoMeetingAgendaInput[],
  meeting: VideoMeetingSummary
) {
  if (items.length > 50) return 'tooMany';
  const owners = new Set(preparationOwners(meeting).map((person) => person.userId));
  if (items.some((item) => !item.title.trim() || item.title.trim().length > 240)) return 'title';
  if (items.some((item) => (item.objective?.length ?? 0) > 2000)) return 'objective';
  if (items.some((item) => item.ownerUserId != null && !owners.has(item.ownerUserId)))
    return 'owner';
  if (
    items.some(
      (item) =>
        item.plannedMinutes != null &&
        (!Number.isInteger(item.plannedMinutes) ||
          item.plannedMinutes < 1 ||
          item.plannedMinutes > 1440)
    )
  )
    return 'minutes';
  return null;
}

export function normalizePreparationAgenda(
  items: VideoMeetingAgendaInput[]
): VideoMeetingAgendaInput[] {
  return items.map((item) => ({
    ...(item.itemId ? { itemId: item.itemId } : {}),
    title: item.title.trim(),
    objective: item.objective?.trim() || null,
    ownerUserId: item.ownerUserId ?? null,
    plannedMinutes: item.plannedMinutes ?? null,
  }));
}

export function movePreparationAgenda(
  items: VideoMeetingAgendaInput[],
  index: number,
  delta: -1 | 1
) {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function preparationEntryAllowed(meeting: VideoMeetingSummary) {
  return ['SCHEDULED', 'LOBBY', 'LIVE'].includes(meeting.lifecycleState);
}

export function preparationInvitationChanged(preparation: VideoMeetingPreparation) {
  return Boolean(
    preparation.myResponse &&
    preparation.myResponse.invitationRevision !== preparation.invitationRevision
  );
}
