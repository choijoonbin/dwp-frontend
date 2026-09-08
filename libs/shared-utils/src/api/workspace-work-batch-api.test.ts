import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateWorkspaceWorkStatuses } from './workspace-api';

const http = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));
beforeEach(() => {
  vi.resetAllMocks();
  http.patch.mockResolvedValue({ data: { data: [] } });
});

describe('Workspace batch source contract', () => {
  it('keeps the original versioned request body for existing callers', async () => {
    const items = [{ workItemId: 'work-1', version: 3 }];
    expect(await updateWorkspaceWorkStatuses(items, 'COMPLETED')).toEqual([]);
    expect(http.patch).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-items/batch/status',
      { items, status: 'COMPLETED' },
      { signal: undefined }
    );
  });

  it('passes the owning batch cancellation signal through to the transport', async () => {
    const controller = new AbortController();
    const items = [{ workItemId: 'work-1', version: 3 }];
    await updateWorkspaceWorkStatuses(items, 'IN_PROGRESS', controller.signal);
    expect(http.patch).toHaveBeenCalledWith(
      '/api/platform/v1/workspace/work-items/batch/status',
      { items, status: 'IN_PROGRESS' },
      { signal: controller.signal }
    );
  });
});
