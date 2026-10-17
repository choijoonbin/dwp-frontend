import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWorkforceAccessPolicy } from './workforce-access-api';

import type { CreateWorkforceAccessPolicyRequest } from './workforce-access-api';

const http = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => {
  vi.resetAllMocks();
  http.post.mockResolvedValue({ data: { data: { policyId: 'policy-1' } } });
});

describe('workforce access API', () => {
  it('serializes ORGANIZATION as its own workforce field group', async () => {
    const request: CreateWorkforceAccessPolicyRequest = {
      subjectType: 'ROLE',
      subjectRef: 'HR_ADMIN',
      populationType: 'ORG_TREE',
      organizationId: '8ef96017-3ac0-4ef7-b344-662220980afd',
      fieldGroups: ['DIRECTORY', 'ORGANIZATION'],
      actionCodes: ['READ'],
      justification: 'Organization graph administration',
    };

    await createWorkforceAccessPolicy(request);

    expect(http.post).toHaveBeenCalledWith(
      '/api/people/v1/admin/workforce/access-policies',
      request
    );
  });
});
