import { describe, expect, it } from 'vitest';

import {
  replaceAssignmentRegisterSearchParams,
  resolveAssignmentRegisterFilters,
} from './assignment-register-model';

describe('assignment register URL state', () => {
  it('restores valid shareable filters and selected detail', () => {
    expect(
      resolveAssignmentRegisterFilters(
        new URLSearchParams('q=People+Operations&status=PENDING&asOf=2027-01-31&person=person-42'),
        '2026-10-06'
      )
    ).toEqual({
      asOf: '2027-01-31',
      query: 'People Operations',
      status: 'PENDING',
      personId: 'person-42',
    });
  });

  it('fails closed to safe defaults for invalid filter values', () => {
    expect(
      resolveAssignmentRegisterFilters(
        new URLSearchParams('status=ROOT&asOf=2026-02-31&person=%20'),
        '2026-10-06'
      )
    ).toEqual({
      asOf: '2026-10-06',
      query: '',
      status: 'ALL',
      personId: null,
    });
  });

  it('preserves unrelated route state while clearing defaults and stale detail', () => {
    const next = replaceAssignmentRegisterSearchParams(
      new URLSearchParams('tab=history&person=person-42&status=ACTIVE'),
      { q: 'Mina', status: 'ALL', person: null }
    );
    expect(next.toString()).toBe('tab=history&q=Mina');
  });

  it('preserves editable whitespace and treats ALL as a valid search term', () => {
    expect(
      resolveAssignmentRegisterFilters(new URLSearchParams('q=Mina+Kim'), '2026-10-06').query
    ).toBe('Mina Kim');
    expect(
      replaceAssignmentRegisterSearchParams(new URLSearchParams(), { q: 'ALL' }).toString()
    ).toBe('q=ALL');
  });
});
