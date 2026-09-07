import { describe, expect, it } from 'vitest';

import {
  approvalHomeRiskColor,
  approvalRequestProgress,
  approvalHomeRowLimit,
} from './approval-home-model';

import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

describe('approval home visual semantics', () => {
  it.each([
    [0, 'text.secondary'],
    [69, 'text.secondary'],
    [70, 'warning.main'],
    [84, 'warning.main'],
    [85, 'error.main'],
    [100, 'error.main'],
  ])('uses a consistent risk tone for %s', (score, color) => {
    expect(approvalHomeRiskColor(Number(score))).toBe(color);
  });

  it('makes editable list heights affect the published content budget', () => {
    expect(
      ['short', 'standard', 'tall', 'expanded'].map((height) =>
        approvalHomeRowLimit(height as 'short' | 'standard' | 'tall' | 'expanded')
      )
    ).toEqual([1, 2, 4, 6]);
  });
});

describe('approvalRequestProgress', () => {
  it.each(['SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO'] as const)(
    'does not mark a pending final stage complete in %s',
    (status) => {
      expect(approvalRequestProgress({ status, currentStepSequence: 3, totalSteps: 3 })).toBe(66);
      expect(approvalRequestProgress({ status, currentStepSequence: 1, totalSteps: 1 })).toBe(0);
    }
  );

  it('shows completed approvals even when no pending stage remains', () => {
    expect(
      approvalRequestProgress({ status: 'APPROVED', currentStepSequence: null, totalSteps: 3 })
    ).toBe(100);
  });

  it.each(['DRAFT', 'REJECTED', 'WITHDRAWN', 'CANCELLED'] as ApprovalRequest['status'][])(
    'does not invent progress for %s',
    (status) => {
      expect(approvalRequestProgress({ status, currentStepSequence: null, totalSteps: 3 })).toBe(
        null
      );
    }
  );

  it.each([
    [null, 3],
    [0, 3],
    [4, 3],
    [1, 0],
    [1.5, 3],
    [1, Number.NaN],
  ])('does not infer progress from invalid stage data %s/%s', (current, total) => {
    expect(
      approvalRequestProgress({
        status: 'IN_REVIEW',
        currentStepSequence: current,
        totalSteps: total!,
      })
    ).toBe(null);
  });
});
