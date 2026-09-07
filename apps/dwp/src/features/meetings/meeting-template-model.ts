import type {
  VideoMeetingTemplate,
  VideoMeetingTemplateInput,
  VideoMeetingTemplateFilter,
} from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';

export const MEETING_TEMPLATE_CATEGORIES = [
  'TEAM',
  'DECISION',
  'ONE_ON_ONE',
  'RETROSPECTIVE',
  'WORKSHOP',
  'OTHER',
] as const;

export function emptyMeetingTemplate(): VideoMeetingTemplateInput {
  return { name: '', purpose: '', category: 'TEAM', durationMinutes: 30, agendaItems: [] };
}

export function editableMeetingTemplate(template: VideoMeetingTemplate): VideoMeetingTemplateInput {
  return {
    name: template.name,
    purpose: template.purpose,
    category: template.category,
    durationMinutes: template.durationMinutes,
    agendaItems: template.agendaItems.map((item) => ({ ...item })),
  };
}

export function normalizeMeetingTemplateInput(
  input: VideoMeetingTemplateInput
): VideoMeetingTemplateInput {
  return {
    name: input.name.trim(),
    purpose: input.purpose.trim(),
    category: input.category.trim(),
    durationMinutes: input.durationMinutes,
    agendaItems: input.agendaItems.map((item) => ({
      title: item.title.trim(),
      description: item.description.trim(),
      role: item.role.trim(),
      durationMinutes: item.durationMinutes,
    })),
  };
}

export function meetingTemplateInputError(input: VideoMeetingTemplateInput): string | null {
  const value = normalizeMeetingTemplateInput(input);
  if (!value.name || value.name.length > 160) return 'name';
  if (value.purpose.length > 2000) return 'purpose';
  if (!value.category || value.category.length > 40) return 'category';
  if (
    !Number.isInteger(value.durationMinutes) ||
    value.durationMinutes < 5 ||
    value.durationMinutes > 1440
  )
    return 'duration';
  if (value.agendaItems.length > 50) return 'agendaLimit';
  if (
    value.agendaItems.some(
      (item) =>
        !item.title ||
        item.title.length > 240 ||
        item.description.length > 2000 ||
        item.role.length > 80 ||
        !Number.isInteger(item.durationMinutes) ||
        item.durationMinutes < 1 ||
        item.durationMinutes > 1440
    )
  )
    return 'agendaItem';
  if (
    value.agendaItems.reduce((sum, item) => sum + item.durationMinutes, 0) > value.durationMinutes
  )
    return 'agendaDuration';
  return null;
}

export function meetingTemplateScope(value: string | null): VideoMeetingTemplateFilter {
  return value === 'ORGANIZATION' ? 'ORGANIZATION' : 'PERSONAL';
}

export function visibleMeetingTemplates(
  templates: VideoMeetingTemplate[],
  category: string,
  favoritesOnly: boolean
): VideoMeetingTemplate[] {
  return templates.filter(
    (item) => (!category || item.category === category) && (!favoritesOnly || item.favorite)
  );
}

export function moveTemplateAgenda(
  input: VideoMeetingTemplateInput,
  index: number,
  direction: -1 | 1
): VideoMeetingTemplateInput {
  const target = index + direction;
  if (
    index < 0 ||
    index >= input.agendaItems.length ||
    target < 0 ||
    target >= input.agendaItems.length
  )
    return input;
  const agendaItems = [...input.agendaItems];
  [agendaItems[index], agendaItems[target]] = [agendaItems[target], agendaItems[index]];
  return { ...input, agendaItems };
}
