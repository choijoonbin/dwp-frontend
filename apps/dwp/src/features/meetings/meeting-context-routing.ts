import type {
  VideoMeetingTemplate,
  VideoMeetingTemplateScheduleDraft,
} from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export type MeetingTemplateReference = { templateId: string; version: number };
export type MeetingPersonalRoomReference = { opaqueAlias: string; revision: number };

/** Public links select a room invitation, never confer participation or start media. */
export function meetingPersonalRoomRequest(
  search: string
): MeetingPersonalRoomReference | 'invalid' | null {
  const params = new URLSearchParams(search);
  const alias = params.get('room');
  const revision = params.get('revision');
  if (alias === null && revision === null) return null;
  if (
    !alias ||
    !/^[a-f0-9]{32}$/u.test(alias) ||
    !revision ||
    !/^[1-9]\d*$/u.test(revision) ||
    !Number.isSafeInteger(Number(revision)) ||
    params.getAll('room').length !== 1 ||
    params.getAll('revision').length !== 1 ||
    params.has('code')
  )
    return 'invalid';
  return { opaqueAlias: alias, revision: Number(revision) };
}
export type MeetingContextRequest =
  | { view: 'list' | 'personal-room' | 'invalid' }
  | { view: 'schedule'; template: MeetingTemplateReference | null }
  | { view: 'preparation'; meetingId: string };

/** Context screens stay under the authorized My Meetings route, not arbitrary return URLs. */
export function meetingContextRequest(search: string): MeetingContextRequest {
  const params = new URLSearchParams(search);
  const view = params.get('view');
  if (!view) return { view: 'list' };
  if (params.getAll('view').length !== 1) return { view: 'invalid' };
  if (view === 'personal-room') return { view };
  if (view === 'preparation') {
    const meetingId = params.get('meetingId');
    return meetingId && uuid.test(meetingId) && params.getAll('meetingId').length === 1
      ? { view, meetingId: meetingId.toLowerCase() }
      : { view: 'invalid' };
  }
  if (view !== 'schedule') return { view: 'invalid' };
  const templateId = params.get('templateId');
  const revision = params.get('templateVersion');
  if (templateId === null && revision === null) return { view, template: null };
  if (
    !templateId ||
    !uuid.test(templateId) ||
    revision === null ||
    !/^\d+$/u.test(revision) ||
    !Number.isSafeInteger(Number(revision)) ||
    Number(revision) < 0 ||
    params.getAll('templateId').length !== 1 ||
    params.getAll('templateVersion').length !== 1
  ) {
    return { view: 'invalid' };
  }
  return { view, template: { templateId: templateId.toLowerCase(), version: Number(revision) } };
}

export function meetingPreparationPath(meetingId: string): string {
  if (!uuid.test(meetingId)) throw new Error('A valid meeting reference is required.');
  return `/meetings/mine?${new URLSearchParams({ view: 'preparation', meetingId: meetingId.toLowerCase() })}`;
}

/** Only opaque identity/version enter browser history. Agenda and purpose never do. */
export function meetingTemplateSchedulePath(draft: VideoMeetingTemplateScheduleDraft): string {
  if (
    !uuid.test(draft.sourceTemplateId) ||
    !Number.isSafeInteger(draft.sourceTemplateVersion) ||
    draft.sourceTemplateVersion < 0
  ) {
    throw new Error('A valid template reference is required.');
  }
  return `/meetings/mine?${new URLSearchParams({
    view: 'schedule',
    templateId: draft.sourceTemplateId.toLowerCase(),
    templateVersion: String(draft.sourceTemplateVersion),
  })}`;
}

/** Re-read current source ACL and exact revision before constructing an editable local form. */
export function meetingDraftFromCurrentTemplate(
  template: VideoMeetingTemplate,
  reference: MeetingTemplateReference
): VideoMeetingTemplateScheduleDraft | null {
  if (
    template.templateId.toLowerCase() !== reference.templateId.toLowerCase() ||
    template.version !== reference.version
  )
    return null;
  return {
    sourceTemplateId: template.templateId,
    sourceTemplateVersion: template.version,
    title: template.name,
    purpose: template.purpose,
    durationMinutes: template.durationMinutes,
    agendaItems: template.agendaItems.map((item) => ({ ...item })),
    accessScope: 'INVITED',
    waitingRoomEnabled: true,
    defaultMicrophoneEnabled: false,
    defaultCameraEnabled: false,
    requiresPolicyRevalidation: true,
  };
}
