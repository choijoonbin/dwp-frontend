import { beforeEach, expect, it, vi } from 'vitest';
import { getMyServiceRequest, respondToServiceInformationRequest } from './service-center-api';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));
beforeEach(() => {
  vi.resetAllMocks();
  http.get.mockResolvedValue({ data: { data: {} } });
  http.post.mockResolvedValue({ data: { data: {} } });
});
it('binds the source detail read to its selected Services scope', async () => {
  await getMyServiceRequest('request-1', 'services-self');
  expect(http.get).toHaveBeenCalledWith('/api/platform/v1/services/requests/request-1', {
    contextScopeKey: 'services-self',
  });
});
it('preserves response identity and the reviewed object version on replay', async () => {
  const input = {
    values: { systemName: 'Finance' },
    message: 'Required for the monthly reporting task',
    version: 3,
    idempotencyKey: 'c047b790-36b0-4f21-9c46-9100aa1f583e',
  };
  const authority = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
  await respondToServiceInformationRequest('request/1', input, authority);
  await respondToServiceInformationRequest('request/1', input, authority);
  expect(http.post.mock.calls[0][0]).toBe(
    '/api/platform/v1/services/requests/request%2F1/information-response'
  );
  expect(http.post.mock.calls[0][1]).toEqual(input);
  expect(http.post.mock.calls[1]).toEqual(http.post.mock.calls[0]);
});
it('carries the exact source decision and context headers in secure mode', async () => {
  await respondToServiceInformationRequest(
    'request-1',
    { values: {}, message: 'Full response explanation', version: 2, idempotencyKey: 'stable' },
    {
      mode: 'SECURE',
      rolloutState: '110',
      expectedDecisionRevision: 'revision',
      contextKey: 'context',
      contextScopeKey: 'scope',
    }
  );
  expect(http.post.mock.calls[0][2]).toMatchObject({
    contextScopeKey: 'scope',
    headers: {
      'X-DWP-Expected-Decision-Revision': 'revision',
    },
  });
});
