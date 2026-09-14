import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  planningIds,
  planningInputFixture,
  planningResultFixture,
  planningSelectionFixture,
} from '../test-utils/approval-workflow-planning-fixtures';
import {
  APPROVAL_WORKFLOW_PLANNING_ROUTE,
  APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE,
} from './approval-workflow-planning-contract';
import {
  getApprovalWorkflowPlanningSelection,
  simulateApprovalWorkflowPlanning,
} from './approval-workflow-planning-api';
const authority = (
  routeContractKey:
    typeof APPROVAL_WORKFLOW_PLANNING_ROUTE | typeof APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE
) => ({
  mode: 'SECURE' as const,
  rolloutState: '110' as const,
  routeContractKey,
  expectedDecisionRevision: `psr-${'f'.repeat(64)}`,
  contextKey: 'management',
  contextScopeKey: 'opaque-current',
});
const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});
describe('native readonly selection/preview DATA transport', () => {
  it('GET uses sole canonical optional formId and opaque scope, no action key', async () => {
    const fetch = vi.fn().mockResolvedValue(response(planningSelectionFixture()));
    vi.stubGlobal('fetch', fetch);
    await getApprovalWorkflowPlanningSelection(
      planningIds.workflow,
      planningIds.form,
      authority(APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE),
      { beforeDispatch: vi.fn() }
    );
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(
      `/api/approvals/v1/admin/workflows/${planningIds.workflow}/planning-selection?formId=${planningIds.form}&contextScopeKey=opaque-current`
    );
    expect(init.method).toBe('GET');
    expect(init.headers['X-DWP-Expected-Decision-Revision']).toBe(`psr-${'f'.repeat(64)}`);
    expect(init.headers['Idempotency-Key']).toBeUndefined();
  });
  it('POST carries only genuine native8 pins plus canonical sample, no ACTION/stepUp', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValue(response(planningResultFixture()));
    vi.stubGlobal('fetch', fetch);
    await simulateApprovalWorkflowPlanning(
      planningIds.workflow,
      planningIds.version,
      planningInputFixture(),
      authority(APPROVAL_WORKFLOW_PLANNING_ROUTE),
      { beforeDispatch: vi.fn() }
    );
    const [url, init] = fetch.mock.calls[1]!;
    expect(url).toBe(
      `/api/approvals/v1/admin/workflows/${planningIds.workflow}/versions/${planningIds.version}/simulation?contextScopeKey=opaque-current`
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(planningInputFixture());
    for (const key of [
      'Idempotency-Key',
      'X-DWP-Step-Up-Challenge',
      'X-DWP-Expected-Object-Version',
    ])
      expect(init.headers[key]).toBeUndefined();
  });
  it('missing current authority rejects before HTTP/CSRF', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      simulateApprovalWorkflowPlanning(
        planningIds.workflow,
        planningIds.version,
        planningInputFixture(),
        { ...authority(APPROVAL_WORKFLOW_PLANNING_ROUTE), rolloutState: '000' } as never,
        { beforeDispatch: vi.fn() }
      )
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('late authority loss during CSRF blocks POST and does not replay', async () => {
    let current = true;
    const fetch = vi.fn(async () => {
      current = false;
      return response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
    });
    vi.stubGlobal('fetch', fetch);
    await expect(
      simulateApprovalWorkflowPlanning(
        planningIds.workflow,
        planningIds.version,
        planningInputFixture(),
        authority(APPROVAL_WORKFLOW_PLANNING_ROUTE),
        {
          beforeDispatch: () => {
            if (!current) throw new Error('Changed');
          },
        }
      )
    ).rejects.toThrow('Changed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('wrong selected form response is never accepted as the current source', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ ...planningSelectionFixture(), selectedFormId: null }))
    );
    await expect(
      getApprovalWorkflowPlanningSelection(
        planningIds.workflow,
        planningIds.form,
        authority(APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE),
        { beforeDispatch: vi.fn() }
      )
    ).rejects.toThrow('identity');
  });
});
