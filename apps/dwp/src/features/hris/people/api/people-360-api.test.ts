import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get },
}));

import {
  getPeople360,
  listPeople360,
  people360SelfDataSource,
  people360TeamDataSource,
} from './people-360-api';

describe('People 360 owner API', () => {
  beforeEach(() => {
    runtime.get.mockReset();
    runtime.get.mockResolvedValue({ data: { data: { synthetic: true } } });
  });

  it('uses the registered list path with explicit projection, as-of, and governed scope', async () => {
    const signal = new AbortController().signal;
    await listPeople360({
      projection: 'people360',
      asOf: '2026-09-17',
      query: 'Synthetic Worker',
      status: 'ACTIVE',
      cursor: 'cursor/2',
      size: 50,
      contextScopeKey: 'scope:hris/operations',
      signal,
    });

    expect(runtime.get).toHaveBeenCalledWith(
      '/api/people/v1/workforce/people?projection=people360&asOf=2026-09-17&size=50&query=Synthetic+Worker&status=ACTIVE&cursor=cursor%2F2',
      { contextScopeKey: 'scope:hris/operations', signal }
    );
  });

  it('uses the registered detail path and never invents a suffix route', async () => {
    const signal = new AbortController().signal;
    await getPeople360(
      '11111111-1111-4111-8111-111111111111',
      '2026-09-17',
      'people360',
      'scope:hris/operations',
      signal
    );

    expect(runtime.get).toHaveBeenCalledWith(
      '/api/people/v1/workforce/people/11111111-1111-4111-8111-111111111111?projection=people360&asOf=2026-09-17',
      { contextScopeKey: 'scope:hris/operations', signal }
    );
    expect(runtime.get.mock.calls[0]?.[0]).not.toContain('/360');
  });

  it('uses the registered personal owner path for an explicit self projection', async () => {
    const signal = new AbortController().signal;
    await people360SelfDataSource.self('2026-09-17', 'people360', 'scope:hris/self', signal);

    expect(runtime.get).toHaveBeenCalledWith(
      '/api/people/v1/hr/home?projection=people360&asOf=2026-09-17',
      { contextScopeKey: 'scope:hris/self', signal }
    );
  });

  it('uses the registered team owner path for an explicit manager projection', async () => {
    const signal = new AbortController().signal;
    await people360TeamDataSource.detail(
      '11111111-1111-4111-8111-111111111111',
      '2026-09-17',
      'people360',
      'scope:hris/team',
      signal
    );

    expect(runtime.get).toHaveBeenCalledWith(
      '/api/people/v1/hr/team?projection=people360&personId=11111111-1111-4111-8111-111111111111&asOf=2026-09-17',
      { contextScopeKey: 'scope:hris/team', signal }
    );
  });
});
