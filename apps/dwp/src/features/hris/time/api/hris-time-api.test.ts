import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get },
}));

import { readHrisTimeWorkspace } from './hris-time-api';

describe('HRIS time scoped data source', () => {
  beforeEach(() => runtime.get.mockReset());

  it('passes the selected surface scope and React Query AbortSignal to the real API', async () => {
    const signal = new AbortController().signal;
    const workspace = { employee: { personId: 'p1' }, entries: [], exceptions: [], teamQueue: [] };
    runtime.get.mockResolvedValue({ data: { data: workspace } });

    await expect(readHrisTimeWorkspace('scope:hris/time', signal)).resolves.toBe(workspace);
    expect(runtime.get).toHaveBeenCalledWith('/api/people/v1/hr/time', {
      contextScopeKey: 'scope:hris/time',
      signal,
    });
  });
});
