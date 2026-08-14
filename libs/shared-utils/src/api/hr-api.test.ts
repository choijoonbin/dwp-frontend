import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { getHrHome, withdrawHrLeaveRequest } from './hr-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('HR API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('withdraws a leave request with evidence and optimistic-lock version', async () => {
    const workspace = { employee: { personId: 'person-1' }, requests: [], teamCalendar: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(workspace));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      withdrawHrLeaveRequest('leave/1', { note: 'Plans changed', version: 4 })
    ).resolves.toEqual(workspace);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/people/v1/hr/absence/requests/leave%2F1/withdraw'
    );
    expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
    expect(JSON.parse(String(request.body))).toEqual({ note: 'Plans changed', version: 4 });
  });

  it('normalizes legacy home fields and internal seed origins at the API boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          asOf: '2026-08-14',
          employee: { personId: 'person-1', displayName: 'Mina', directReportCount: 0 },
          time: null,
          leaveBalances: [],
          pay: {
            payCycleId: 'cycle-1',
            name: 'August payroll',
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            payDate: '2026-08-31',
            status: 'COLLECTING',
            timeValidated: false,
            absenceValidated: false,
            sourceConfirmed: false,
            dataOrigin: 'LOCAL_SEED',
          },
          activeBenefitCount: 0,
          openBenefitWindowCount: 0,
          activeGoalCount: 0,
          requiredLearningCount: 0,
          teamPendingCount: 0,
          referenceDataPresent: true,
        })
      )
    );

    const home = await getHrHome();

    expect(home.generatedAt).toBeNull();
    expect(home.timeZone).toBe('UTC');
    expect(home.enrollmentWindows).toEqual([]);
    expect(home.domainStates.TIME).toEqual({
      availability: 'AVAILABLE',
      dataOrigin: 'UNKNOWN',
      reasonCode: null,
    });
    expect(home.pay?.dataOrigin).toBe('REFERENCE');
  });
});
