import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportDwaionGovernanceAudit } from './agent-admin-api';
import { axiosInstance } from '../axios-instance';
vi.mock('../axios-instance', () => ({ axiosInstance: { get: vi.fn() } }));
describe('DWAI·ON audit export scope', () => {
  beforeEach(() => vi.resetAllMocks());
  it('preserves server truncation and row limit with the selected filters', async () => {
    const blob = new Blob(['category,target\nSOURCE,CALENDAR']);
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: blob,
      headers: new Headers({ 'X-DWP-Export-Limit': '10000', 'X-DWP-Export-Truncated': 'true' }),
    });
    expect(await exportDwaionGovernanceAudit({ category: 'SOURCE', query: 'CALENDAR' })).toEqual({
      blob,
      limit: 10000,
      truncated: true,
    });
    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/api/agent/v1/admin/audit/export?category=SOURCE&query=CALENDAR',
      { responseType: 'blob' }
    );
  });
  it('does not turn missing or malformed scope evidence into an unlimited complete export', async () => {
    const blob = new Blob(['category,target']);
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: blob,
      headers: new Headers({
        'X-DWP-Export-Limit': 'unknown',
        'X-DWP-Export-Truncated': 'unknown',
      }),
    });
    expect(await exportDwaionGovernanceAudit()).toEqual({ blob, limit: null, truncated: null });
  });
});
