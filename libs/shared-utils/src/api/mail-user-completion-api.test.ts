import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import { downloadMailMessageAttachment, updateAdvancedMailDraft } from './mail-user-completion-api';

describe('mail message attachment API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads through the authenticated mail resource path as a blob', async () => {
    const blob = new Blob(['agenda'], { type: 'application/pdf' });
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: blob });

    await expect(
      downloadMailMessageAttachment('thread/1', 'message/1', 'attachment/1')
    ).resolves.toBe(blob);
    expect(get).toHaveBeenCalledWith(
      '/api/platform/v1/mail/threads/thread%2F1/messages/message%2F1/attachments/attachment%2F1',
      { responseType: 'blob' }
    );
  });

  it('binds final draft completion to the accepted Mail owner command', async () => {
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({
      data: { data: { thread: { threadId: 'thread-1', version: 3 } } },
    });
    const input = {
      toEmail: 'owner@example.com',
      subject: 'Owner draft',
      body: 'Reviewed',
      deliveryMode: 'DRAFT' as const,
      idempotencyKey: '70000000-0000-4000-8000-000000000001',
      version: 2,
    };
    await updateAdvancedMailDraft('thread-1', input, {
      proposalId: '50000000-0000-4000-8000-000000000003',
      commandId: '60000000-0000-4000-8000-000000000003',
      version: 4,
    });
    expect(put).toHaveBeenCalledWith('/api/platform/v1/mail/threads/thread-1/draft', input, {
      headers: {
        'X-DWP-Mail-Proposal-ID': '50000000-0000-4000-8000-000000000003',
        'X-DWP-Mail-Command-ID': '60000000-0000-4000-8000-000000000003',
        'X-DWP-Mail-Proposal-Version': '4',
      },
    });
  });
});
