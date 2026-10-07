import { describe, expect, it } from 'vitest';

import {
  HR_OPERATIONS_DESTINATIONS,
  hrOperationsDestination,
} from './hr-operations-overview-model';

describe('HR operations overview destinations', () => {
  it('routes the backend workforce aggregate to the governed People 360 workspace', () => {
    expect(hrOperationsDestination('WORKFORCE')).toEqual({
      path: '/hr/operations/people',
      view: 'people',
    });
  });

  it('keeps every backend summary domain actionable', () => {
    expect(Object.keys(HR_OPERATIONS_DESTINATIONS).sort()).toEqual([
      'ABSENCE',
      'BENEFITS',
      'PAY',
      'TALENT',
      'TIME',
      'WORKFORCE',
    ]);
    expect(
      Object.values(HR_OPERATIONS_DESTINATIONS).every(({ path }) => path.startsWith('/hr/'))
    ).toBe(true);
  });
});
