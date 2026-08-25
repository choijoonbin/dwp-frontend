import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  decideHrTeamRequest,
  getHrHome,
  getHrTeam,
  getHrTeamAbsence,
  getHrTeamTime,
  getHrWorkforceOperationsOverview,
  withdrawHrLeaveRequest,
} from './hr-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

const legacyAuthority = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' } as const;

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
      withdrawHrLeaveRequest('leave/1', { note: 'Plans changed', version: 4 }, legacyAuthority)
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

  it('uses dedicated team and workforce operations read boundaries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ members: [], dataBoundary: 'TEAM' }))
      .mockResolvedValueOnce(jsonResponse({ teamQueue: [], dataBoundary: 'TEAM' }))
      .mockResolvedValueOnce(
        jsonResponse({ teamQueue: [], teamCalendar: [], dataBoundary: 'ORGANIZATION_SET' })
      )
      .mockResolvedValueOnce(
        jsonResponse({ domains: [], fieldGroups: [], dataBoundary: 'TENANT' })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getHrTeam();
    await getHrTeamTime();
    await getHrTeamAbsence();
    await getHrWorkforceOperationsOverview();

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/people/v1/hr/team',
      '/api/people/v1/hr/team/time',
      '/api/people/v1/hr/team/absence',
      '/api/people/v1/workforce/operations/overview',
    ]);
  });

  it('sends team decisions only to the team-scoped endpoint with expected version evidence', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ itemId: 'card-1', version: 8 }));
    vi.stubGlobal('fetch', fetchMock);

    await decideHrTeamRequest(
      'time',
      'card/1',
      {
        decision: 'APPROVE',
        note: 'Reviewed team exception evidence',
        version: 7,
      },
      legacyAuthority
    );

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/people/v1/hr/team/time/card%2F1/decision');
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      decision: 'APPROVE',
      note: 'Reviewed team exception evidence',
      version: 7,
    });
  });
});
