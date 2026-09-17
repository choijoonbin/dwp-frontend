import { describe, expect, it } from 'vitest';

import {
  applyProposalPayloadEditorValues,
  editableProposalPayload,
  mailProposalFiltersFromSearch,
  updateMailProposalFilterSearch,
} from './mail-proposal-workspace-controls';

describe('mail proposal workspace controls', () => {
  it('keeps valid filters and drops invalid values', () => {
    expect(
      mailProposalFiltersFromSearch(new URLSearchParams('status=PROPOSED&type=CREATE_TASK'))
    ).toEqual({ status: 'PROPOSED', type: 'CREATE_TASK' });
    expect(mailProposalFiltersFromSearch(new URLSearchParams('status=UNKNOWN&type=OTHER'))).toEqual(
      {}
    );
    expect(
      updateMailProposalFilterSearch(new URLSearchParams('proposalId=old&status=DISMISSED'), {
        status: 'ACCEPTED',
      }).toString()
    ).toBe('status=ACCEPTED');
  });

  it('edits primitives while preserving governed confirmation', () => {
    const source = {
      requiresConfirmation: false,
      priority: 'MEDIUM',
      durationMinutes: 30,
      attendees: ['alex@example.com'],
      nested: { private: true },
    };
    const fields = editableProposalPayload(source);
    expect(fields.map(([key]) => key)).toEqual(['priority', 'durationMinutes', 'attendees']);
    expect(
      applyProposalPayloadEditorValues(source, fields, {
        priority: 'HIGH',
        durationMinutes: '45',
        attendees: 'alex@example.com, jin@example.com',
      })
    ).toEqual({
      requiresConfirmation: true,
      priority: 'HIGH',
      durationMinutes: 45,
      attendees: ['alex@example.com', 'jin@example.com'],
      nested: { private: true },
    });
  });
});
