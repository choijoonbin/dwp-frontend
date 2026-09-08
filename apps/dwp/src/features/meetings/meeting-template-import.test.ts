import { describe, expect, it } from 'vitest';
import { parseMeetingTemplateImport } from './meeting-template-import';

const input = {
  name: ' Release ',
  purpose: 'Review readiness',
  category: 'DECISION',
  durationMinutes: 30,
  agendaItems: [
    { title: ' Scope ', description: 'Review evidence', role: 'Host', durationMinutes: 15 },
  ],
};
describe('template import data boundary', () => {
  it('imports only reviewed editable structure without external authority or consent', () => {
    const result = parseMeetingTemplateImport(
      JSON.stringify({
        ...input,
        templateId: 'external-id',
        scope: 'ORGANIZATION',
        canEdit: true,
        consent: true,
        participants: [1, 2],
      })
    );
    expect(result).toEqual({
      ...input,
      name: 'Release',
      agendaItems: [{ ...input.agendaItems[0], title: 'Scope' }],
    });
  });
  it.each([
    'null',
    '[]',
    '{}',
    '{invalid',
    JSON.stringify({ ...input, agendaItems: ['x'] }),
    JSON.stringify({ ...input, durationMinutes: 10 }),
    ' '.repeat(128001),
  ])('rejects invalid or excessive import (%#)', (value) =>
    expect(parseMeetingTemplateImport(value)).toBeNull()
  );
});
