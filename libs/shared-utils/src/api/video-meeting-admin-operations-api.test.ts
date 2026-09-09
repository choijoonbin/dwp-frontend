import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadVideoMeetingAdminOperations } from './video-meeting-admin-operations-api';

describe('video meeting admin operations export API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests a bounded binary export with the selected IANA time zone', async () => {
    const exportBlob = new Blob(['aggregate-only'], { type: 'text/csv' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => exportBlob,
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadVideoMeetingAdminOperations('Asia/Seoul')).resolves.toBe(exportBlob);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/meetings/v1/admin/operations/export?timeZone=Asia%2FSeoul'
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toEqual(
      expect.objectContaining({ Accept: 'text/csv' })
    );
  });
});
