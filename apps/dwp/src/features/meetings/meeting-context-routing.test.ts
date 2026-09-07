import { describe, expect, it } from 'vitest';
import type { VideoMeetingTemplate } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import {
  meetingContextRequest,
  meetingPersonalRoomRequest,
  meetingDraftFromCurrentTemplate,
  meetingPreparationPath,
  meetingTemplateSchedulePath,
} from './meeting-context-routing';

const id = '81000000-0000-0000-0000-000000000001';
const template: VideoMeetingTemplate = {
  templateId: id,
  scope: 'PERSONAL',
  name: 'Decision review',
  purpose: 'Private preparation text',
  category: 'DECISION',
  durationMinutes: 30,
  agendaItems: [
    { title: 'Private topic', description: 'Private objective', role: 'Host', durationMinutes: 30 },
  ],
  favorite: true,
  canEdit: true,
  version: 2,
  updatedAt: '2026-09-04T01:00:00Z',
};

describe('Meeting context screen routing', () => {
  it('keeps room invitations distinct from code entry without resolving or joining automatically', () => {
    expect(meetingPersonalRoomRequest('?code=ABCD-EFGH')).toBeNull();
    expect(meetingPersonalRoomRequest('?room=' + 'a'.repeat(32) + '&revision=2')).toEqual({
      opaqueAlias: 'a'.repeat(32),
      revision: 2,
    });
  });
  it.each([
    '?room=../admin&revision=1',
    '?room=' + 'a'.repeat(32),
    '?revision=1',
    '?room=' + 'a'.repeat(32) + '&revision=0',
    '?room=' + 'a'.repeat(32) + '&revision=9007199254740992',
    '?room=' + 'a'.repeat(32) + '&revision=1&code=ABCD-EFGH',
    '?room=' + 'a'.repeat(32) + '&revision=1&revision=2',
  ])('rejects ambiguous room invitation links: %s', (search) => {
    expect(meetingPersonalRoomRequest(search)).toBe('invalid');
  });
  it('keeps existing list filters under My Meetings', () => {
    expect(meetingContextRequest('?page=3&role=host')).toEqual({ view: 'list' });
    expect(meetingContextRequest('?view=personal-room')).toEqual({ view: 'personal-room' });
    expect(meetingContextRequest('?view=schedule')).toEqual({ view: 'schedule', template: null });
  });
  it('opens a concrete preparation under the authorized list route', () => {
    const path = meetingPreparationPath(id);
    expect(path.startsWith('/meetings/mine?')).toBe(true);
    expect(meetingContextRequest(path.slice(path.indexOf('?')))).toEqual({
      view: 'preparation',
      meetingId: id,
    });
  });
  it('puts only source identity and version into history', () => {
    const draft = meetingDraftFromCurrentTemplate(template, { templateId: id, version: 2 })!;
    const path = meetingTemplateSchedulePath(draft);
    expect(meetingContextRequest(path.slice(path.indexOf('?')))).toEqual({
      view: 'schedule',
      template: { templateId: id, version: 2 },
    });
    expect(path).not.toContain('Private');
    expect(path).not.toContain('Decision');
    expect([...new URLSearchParams(path.slice(path.indexOf('?'))).keys()]).toEqual([
      'view',
      'templateId',
      'templateVersion',
    ]);
  });
  it.each([
    '?view=https://example.com',
    '?view=schedule&view=personal-room',
    '?view=preparation',
    '?view=preparation&meetingId=../../admin',
    `?view=preparation&meetingId=${id}&meetingId=${id}`,
    `?view=schedule&templateId=${id}`,
    '?view=schedule&templateVersion=2',
    `?view=schedule&templateId=${id}&templateVersion=-1`,
    `?view=schedule&templateId=${id}&templateVersion=1.5`,
    `?view=schedule&templateId=${id}&templateVersion=9007199254740992`,
    `?view=schedule&templateId=${id}&templateVersion=1&templateVersion=2`,
  ])('rejects ambiguous or invalid context: %s', (search) => {
    expect(meetingContextRequest(search)).toEqual({ view: 'invalid' });
  });
  it('does not apply a changed or unrelated template revision', () => {
    expect(meetingDraftFromCurrentTemplate(template, { templateId: id, version: 1 })).toBeNull();
    expect(
      meetingDraftFromCurrentTemplate(template, {
        templateId: '82000000-0000-0000-0000-000000000001',
        version: 2,
      })
    ).toBeNull();
  });
  it('starts with safe defaults and copies no consent, participants or device identifiers', () => {
    const draft = meetingDraftFromCurrentTemplate(
      {
        ...template,
        participants: [9],
        microphoneId: 'secret-device',
        consent: true,
      } as VideoMeetingTemplate,
      { templateId: id, version: 2 }
    )!;
    expect(draft).toMatchObject({
      accessScope: 'INVITED',
      waitingRoomEnabled: true,
      defaultMicrophoneEnabled: false,
      defaultCameraEnabled: false,
      requiresPolicyRevalidation: true,
    });
    expect(draft).not.toHaveProperty('participants');
    expect(draft).not.toHaveProperty('microphoneId');
    expect(draft).not.toHaveProperty('consent');
    draft.agendaItems[0]!.title = 'Edited locally';
    expect(template.agendaItems[0]!.title).toBe('Private topic');
  });
  it('rejects invalid generated links before navigation', () => {
    expect(() => meetingPreparationPath('../admin')).toThrow();
    const draft = meetingDraftFromCurrentTemplate(template, { templateId: id, version: 2 })!;
    expect(() => meetingTemplateSchedulePath({ ...draft, sourceTemplateVersion: -1 })).toThrow();
  });
});
