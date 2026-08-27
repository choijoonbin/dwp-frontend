import { fulfillSuccess } from './shell-session';

import type { Page } from '@playwright/test';
import type {
  CreateWorkforceAccessPolicyRequest,
  WorkforceAccessPolicy,
} from '@dwp-frontend/shared-utils';

type RevokePayload = { version: number; reason: string };

export type WorkforceAccessMockStore = {
  policies: WorkforceAccessPolicy[];
  policyListAttempts: number;
  organizationAttempts: number;
  userQueries: string[];
  createPayloads: CreateWorkforceAccessPolicyRequest[];
  revokePayloads: RevokePayload[];
};

export async function mockWorkforceAccess(
  page: Page,
  options: { failFirstPolicyList?: boolean; failFirstOrganizations?: boolean } = {}
): Promise<WorkforceAccessMockStore> {
  const store: WorkforceAccessMockStore = {
    policies: [
      {
        policyId: 'policy-legacy-admin',
        subjectType: 'ROLE',
        subjectRef: 'ADMIN',
        populationType: 'TENANT',
        organizationId: null,
        organizationName: null,
        fieldGroups: ['DIRECTORY', 'WORKER_IDENTIFIERS', 'EMPLOYMENT', 'JOB_GRADE'],
        actionCodes: ['READ'],
        validFrom: null,
        validTo: null,
        lifecycleState: 'ACTIVE',
        justification: 'Existing governed workforce access for the unified administrator role.',
        version: 3,
      },
    ],
    policyListAttempts: 0,
    organizationAttempts: 0,
    userQueries: [],
    createPayloads: [],
    revokePayloads: [],
  };

  const organizations = [
    {
      organizationId: 'org-people-platform',
      organizationKey: 'PEOPLE-PLATFORM',
      name: 'People Platform',
      parentOrganizationId: null,
    },
    {
      organizationId: 'org-workplace',
      organizationKey: 'WORKPLACE',
      name: 'Digital Workplace',
      parentOrganizationId: 'org-people-platform',
    },
  ];
  const searchedUser = {
    userId: 501,
    displayName: 'Mina Search Result',
    email: 'mina.search@example.com',
    status: 'ACTIVE',
    mfaEnabled: true,
    roles: ['WORKSPACE_MEMBER'],
    effectiveRoles: ['WORKSPACE_MEMBER'],
    roleManagement: { allowed: true, reason: 'ALLOWED' },
    accessRevision: 2,
    version: 4,
  };

  await page.route('**/api/auth/admin/identity/users**', (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('query')?.trim() ?? '';
    store.userQueries.push(query);
    const content = query.toLocaleLowerCase().includes('mina') ? [searchedUser] : [];
    return fulfillSuccess(route, {
      content,
      page: 0,
      size: 100,
      totalElements: query ? content.length : 240,
      totalPages: query ? 1 : 3,
    });
  });

  await page.route('**/api/people/v1/admin/workforce/access-policies**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith('/organizations') && request.method() === 'GET') {
      store.organizationAttempts += 1;
      if (options.failFirstOrganizations && store.organizationAttempts === 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Reference data unavailable' }),
        });
      }
      return fulfillSuccess(route, organizations);
    }

    if (path.endsWith('/access-policies') && request.method() === 'GET') {
      store.policyListAttempts += 1;
      if (options.failFirstPolicyList && store.policyListAttempts === 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            message: 'Workforce policy service unavailable',
          }),
        });
      }
      return fulfillSuccess(route, store.policies);
    }

    if (path.endsWith('/access-policies') && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateWorkforceAccessPolicyRequest;
      store.createPayloads.push(payload);
      const created: WorkforceAccessPolicy = {
        policyId: 'policy-scheduled-user',
        ...payload,
        organizationName: organizations.find(
          (organization) => organization.organizationId === payload.organizationId
        )?.name,
        lifecycleState: 'ACTIVE',
        version: 0,
      };
      store.policies.push(created);
      return fulfillSuccess(route, created);
    }

    const revokeMatch = path.match(/\/access-policies\/([^/]+)\/revoke$/);
    if (revokeMatch && request.method() === 'PATCH') {
      const payload = request.postDataJSON() as RevokePayload;
      store.revokePayloads.push(payload);
      const index = store.policies.findIndex((policy) => policy.policyId === revokeMatch[1]);
      const current = store.policies[index];
      if (!current) return route.fulfill({ status: 404, body: '{}' });
      const revoked: WorkforceAccessPolicy = {
        ...current,
        lifecycleState: 'REVOKED',
        version: current.version + 1,
      };
      store.policies[index] = revoked;
      return fulfillSuccess(route, revoked);
    }

    return route.fallback();
  });

  return store;
}
