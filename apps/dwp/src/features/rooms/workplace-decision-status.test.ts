import { describe, expect, it } from 'vitest';

import { transitionWorkplaceDecisionNotice } from './workplace-decision-status';

import type { WorkplaceDecisionAction, WorkplaceDecisionNotice } from './workplace-decision-status';

const action: WorkplaceDecisionAction = {
  id: 'check-in:booking-1',
  kind: 'CHECK_IN',
  endsAt: '2026-08-19T01:30:00Z',
};

function notice(reason: WorkplaceDecisionNotice['reason'] = 'UNVERIFIED'): WorkplaceDecisionNotice {
  return { actionId: action.id, kind: action.kind, endsAt: action.endsAt, reason };
}

describe('transitionWorkplaceDecisionNotice', () => {
  it('replaces an unverified closure when the same action is authoritative again', () => {
    expect(
      transitionWorkplaceDecisionNotice(notice(), [action], Date.parse(action.endsAt) - 1, true)
    ).toEqual({
      ...notice(),
      reason: 'RECOVERED',
    });
  });

  it('does not recover from a different action identity or kind', () => {
    const current = notice();

    expect(
      transitionWorkplaceDecisionNotice(
        current,
        [
          { ...action, id: 'check-in:booking-2' },
          { ...action, kind: 'RELEASE' },
        ],
        Date.parse(action.endsAt) - 1,
        false
      )
    ).toBe(current);
  });

  it('moves a recovered notice back to unverified when authority is lost again', () => {
    expect(
      transitionWorkplaceDecisionNotice(
        notice('RECOVERED'),
        [],
        Date.parse(action.endsAt) - 1,
        false
      )
    ).toEqual(notice('UNVERIFIED'));
  });

  it('moves a recovered notice to ended at its decision boundary', () => {
    expect(
      transitionWorkplaceDecisionNotice(notice('RECOVERED'), [], Date.parse(action.endsAt), false)
    ).toEqual(notice('ENDED'));
  });

  it('keeps an ended notice terminal across clock rollback and action reappearance', () => {
    const current = notice('ENDED');

    expect(
      transitionWorkplaceDecisionNotice(current, [action], Date.parse(action.endsAt) - 60_000, true)
    ).toBe(current);
  });

  it('refreshes the boundary snapshot when the authoritative action recovers', () => {
    const updatedAction = { ...action, endsAt: '2026-08-19T02:00:00Z' };

    expect(
      transitionWorkplaceDecisionNotice(
        notice(),
        [updatedAction],
        Date.parse(action.endsAt) - 1,
        true
      )
    ).toEqual({ ...notice('RECOVERED'), endsAt: updatedAction.endsAt });
  });

  it('clears a notice when an authoritative snapshot confirms the action is gone', () => {
    expect(
      transitionWorkplaceDecisionNotice(
        notice('RECOVERED'),
        [],
        Date.parse(action.endsAt) - 1,
        true
      )
    ).toBeNull();
  });

  it('clears a notice after the matching command completes', () => {
    expect(
      transitionWorkplaceDecisionNotice(
        notice('RECOVERED'),
        [action],
        Date.parse(action.endsAt) - 1,
        true,
        new Set([action.id])
      )
    ).toBeNull();
  });
});
