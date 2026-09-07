import { describe, expect, it } from 'vitest';
import type { VideoMeetingTemplate } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import {
  editableMeetingTemplate,
  emptyMeetingTemplate,
  meetingTemplateInputError,
  meetingTemplateScope,
  moveTemplateAgenda,
  normalizeMeetingTemplateInput,
  visibleMeetingTemplates,
} from './meeting-template-model';

const template: VideoMeetingTemplate = {
  templateId: 'template',
  scope: 'ORGANIZATION',
  name: ' Decision ',
  purpose: ' Review options ',
  category: 'DECISION',
  durationMinutes: 30,
  agendaItems: [
    { title: ' Context ', description: ' Outline ', role: ' Lead ', durationMinutes: 10 },
    { title: 'Decision', description: '', role: '', durationMinutes: 20 },
  ],
  favorite: true,
  canEdit: false,
  version: 5,
  updatedAt: '2026-09-04T00:00:00Z',
};
describe('meeting template editor model', () => {
  it('starts with a blank personal structure, not fake organization presets', () => {
    expect(emptyMeetingTemplate()).toEqual({
      name: '',
      purpose: '',
      category: 'TEAM',
      durationMinutes: 30,
      agendaItems: [],
    });
  });
  it('copies only editable fields and detaches the agenda from the server snapshot', () => {
    const copy = editableMeetingTemplate(template);
    copy.agendaItems[0].title = 'Changed';
    expect(template.agendaItems[0].title).toBe(' Context ');
    expect(copy).not.toHaveProperty('scope');
    expect(copy).not.toHaveProperty('canEdit');
    expect(copy).not.toHaveProperty('templateId');
  });
  it('normalizes user input without assigning role labels to users', () => {
    expect(normalizeMeetingTemplateInput(template).agendaItems[0]).toEqual({
      title: 'Context',
      description: 'Outline',
      role: 'Lead',
      durationMinutes: 10,
    });
  });
  it('accepts an agenda that exactly fills the meeting duration', () =>
    expect(meetingTemplateInputError(template)).toBeNull());
  it.each([
    [{ name: ' ' }, 'name'],
    [{ name: 'x'.repeat(161) }, 'name'],
    [{ purpose: 'x'.repeat(2001) }, 'purpose'],
    [{ category: '' }, 'category'],
    [{ durationMinutes: 4 }, 'duration'],
    [{ durationMinutes: 1441 }, 'duration'],
    [{ durationMinutes: 30.5 }, 'duration'],
    [{ durationMinutes: 25 }, 'agendaDuration'],
    [{ agendaItems: [{ title: '', description: '', role: '', durationMinutes: 5 }] }, 'agendaItem'],
    [
      { agendaItems: [{ title: 'Valid', description: '', role: '', durationMinutes: 0 }] },
      'agendaItem',
    ],
    [
      {
        agendaItems: Array.from({ length: 51 }, () => ({
          title: 'Valid',
          description: '',
          role: '',
          durationMinutes: 1,
        })),
      },
      'agendaLimit',
    ],
  ])('rejects invalid form %s', (patch, error) =>
    expect(meetingTemplateInputError({ ...template, ...patch })).toBe(error)
  );
  it('moves agenda rows using keyboard commands without changing their content', () => {
    const moved = moveTemplateAgenda(template, 1, -1);
    expect(moved.agendaItems.map((item) => item.title)).toEqual(['Decision', ' Context ']);
    expect(template.agendaItems[0].title).toBe(' Context ');
  });
  it.each([
    [-1, 1],
    [0, -1],
    [2, -1],
    [1, 1],
  ])('does not move outside bounds (%s, %s)', (index, direction) => {
    expect(moveTemplateAgenda(template, index, direction as -1 | 1)).toBe(template);
  });
  it('defaults the two-tab workspace to personal without expanding to all or admin scope', () => {
    expect(meetingTemplateScope('ADMIN')).toBe('PERSONAL');
    expect(meetingTemplateScope('ALL')).toBe('PERSONAL');
    expect(meetingTemplateScope(null)).toBe('PERSONAL');
    expect(meetingTemplateScope('PERSONAL')).toBe('PERSONAL');
    expect(meetingTemplateScope('ORGANIZATION')).toBe('ORGANIZATION');
  });
  it('defensively checks the selected purpose and actor favorite', () => {
    expect(
      visibleMeetingTemplates(
        [template, { ...template, templateId: 'other', favorite: false }],
        'DECISION',
        true
      )
    ).toEqual([template]);
    expect(visibleMeetingTemplates([template], 'TEAM', false)).toEqual([]);
  });
});
