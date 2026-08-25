import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getApprovalFormReferenceWorkflow,
  getApprovalFormReferenceWorkflows,
  getApprovalStudioWorkflow,
  getApprovalStudioWorkflows,
} from './approval-management-api';
import {
  getHcmServiceCatalog,
  getHcmServiceRequests,
  getServiceDiscoverCatalog,
  getServiceDraftRequest,
  getServiceDraftRequests,
  getServiceHomeCatalog,
  getServiceHomeRequests,
  getServiceManagementCatalog,
  getServiceMyRequest,
  getServiceMyRequests,
} from './service-center-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('Product Surface query discriminator contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('matches every ACTIVE approvals FIXED/ABSENT workflow binding in registry v3', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const scope = 'scope:approvals/design-east';

    await getApprovalStudioWorkflows(scope, controller.signal);
    await getApprovalStudioWorkflow('workflow-studio-1', scope, controller.signal);
    await getApprovalFormReferenceWorkflows(scope, controller.signal);
    await getApprovalFormReferenceWorkflow('workflow-reference-1', scope, controller.signal);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/approvals/v1/admin/workflows?contextScopeKey=scope%3Aapprovals%2Fdesign-east',
      '/api/approvals/v1/admin/workflows/workflow-studio-1?contextScopeKey=scope%3Aapprovals%2Fdesign-east',
      '/api/approvals/v1/admin/workflows?view=reference&contextScopeKey=scope%3Aapprovals%2Fdesign-east',
      '/api/approvals/v1/admin/workflows/workflow-reference-1?view=reference&contextScopeKey=scope%3Aapprovals%2Fdesign-east',
    ]);
    fetchMock.mock.calls.forEach(([, init]) =>
      expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal)
    );
  });

  it('matches every ACTIVE Services FIXED/ABSENT read binding in registry v3', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await getServiceHomeCatalog(controller.signal);
    await getServiceHomeRequests(controller.signal);
    await getServiceDiscoverCatalog(controller.signal);
    await getServiceMyRequests(controller.signal);
    await getServiceDraftRequests(controller.signal);
    await getServiceMyRequest('request-my-1', controller.signal);
    await getServiceDraftRequest('request-draft-1', controller.signal);
    await getServiceManagementCatalog('scope:services/catalog-west', controller.signal);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/platform/v1/services/catalog',
      '/api/platform/v1/services/requests',
      '/api/platform/v1/services/catalog?view=discover',
      '/api/platform/v1/services/requests?view=my',
      '/api/platform/v1/services/requests?view=drafts',
      '/api/platform/v1/services/requests/request-my-1',
      '/api/platform/v1/services/requests/request-draft-1?view=draft',
      '/api/platform/v1/services/catalog?view=management&contextScopeKey=scope%3Aservices%2Fcatalog-west',
    ]);
    fetchMock.mock.calls.forEach(([, init]) =>
      expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal)
    );
  });

  it('keeps the HCM service hub on its fixed surface variant without a view default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await getHcmServiceCatalog(controller.signal);
    await getHcmServiceRequests(controller.signal);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/platform/v1/services/catalog?surface=hcm',
      '/api/platform/v1/services/requests?surface=hcm',
    ]);
  });
});
