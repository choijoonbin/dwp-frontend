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
      mailProposalFiltersFromSearch(
        new URLSearchParams(
          'status=PROPOSED&type=CREATE_TASK&accountId=account-1&dateFrom=2026-09-01&dateTo=2026-09-17&page=2&pageSize=25'
        )
      )
    ).toEqual({
      status: 'PROPOSED',
      type: 'CREATE_TASK',
      accountId: 'account-1',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-17',
      page: 2,
      pageSize: 25,
    });
    expect(mailProposalFiltersFromSearch(new URLSearchParams('status=UNKNOWN&type=OTHER'))).toEqual(
      { page: 0, pageSize: 20 }
    );
    expect(
      updateMailProposalFilterSearch(
        new URLSearchParams('proposalId=old&focus=mail-proposal-old&status=DISMISSED'),
        {
          status: 'ACCEPTED',
          page: 1,
          pageSize: 20,
        }
      ).toString()
    ).toBe('proposalId=old&focus=mail-proposal-old&status=ACCEPTED&page=1');
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
