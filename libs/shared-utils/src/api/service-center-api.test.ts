import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import { createServiceRequest } from './service-center-api';

describe('service center owner completion API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('binds a reviewed DWAI.ON proposal to the created service request', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({
      data: { data: { request: { requestId: 'request-1', version: 0 } } },
    });
    const input = {
      serviceKey: 'IT.ACCESS',
      summary: 'Grant reviewed access',
      values: { system: 'ERP' },
      idempotencyKey: '70000000-0000-4000-8000-000000000021',
      submit: true,
    };

    await createServiceRequest(
      input,
      { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' },
      {
        version: 1,
        handoffId: '70000000-0000-4000-8000-000000000022',
        proposalId: '70000000-0000-4000-8000-000000000023',
        actionKey: 'SERVICE.REQUEST.CREATE',
        handoffVersion: 2,
      }
    );

    expect(post).toHaveBeenCalledWith('/api/platform/v1/services/requests', input, {
      headers: {
        'X-DWP-DWAI-ON-Handoff-ID': '70000000-0000-4000-8000-000000000022',
        'X-DWP-DWAI-ON-Proposal-ID': '70000000-0000-4000-8000-000000000023',
        'X-DWP-DWAI-ON-Action-Key': 'SERVICE.REQUEST.CREATE',
        'X-DWP-DWAI-ON-Handoff-Version': '2',
      },
    });
  });
});
