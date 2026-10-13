// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getByRole } from '@testing-library/dom';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EmploymentAssignmentsRuntime,
  employmentAssignmentsScopeIsReady,
  type EmploymentAssignmentProposalRenderer,
  type EmploymentAssignmentsReader,
} from '../pages/employment-assignments-workspace';
import {
  EMPLOYMENT_ASSIGNMENTS_PRODUCTION_CONTRACT,
  employmentAssignmentsSnapshotIsStale,
} from '../model/employment-assignments-production';
import {
  EMPLOYMENT_EVENT_PUBLISH_OPERATION,
  employmentEventPublishCommand,
  employmentEventPublishExecutionCommand,
} from '../hooks/use-employment-event-publish';
import { selectEmploymentAssignmentsWorkbench } from '../api/employment-workbench-api';

import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import type { EmploymentAssignmentsWorkbench } from '../api/employment-workbench-api';
import type { ProductSurfaceHighRiskCommandDescriptor } from '../../../../components/product-surface-high-risk-command';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

const scope: ProductSurfaceRequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope:hris/operations',
  cacheKey: [
    'tenant-1',
    'actor-9',
    'BUSINESS_OPERATOR',
    'hcm.operations',
    'scope:hris/operations',
    '38',
  ],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-9',
    accessMode: 'BUSINESS_OPERATOR',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    contextScopeKey: 'scope:hris/operations',
    decisionRevision: '38',
  },
};

const owner = {
  owner: 'HRM',
  schemaId: 'HRM.Organization.v1',
  publicId: '30000000-0000-4000-8000-000000000001',
  revision: 4,
  contentHash: 'a'.repeat(64),
  validFrom: '2025-01-01T00:00:00Z',
  validToExclusive: null,
} as const;

const workbench: EmploymentAssignmentsWorkbench = {
  asOf: '2026-10-13T00:00:00Z',
  assignments: [
    {
      personPublicId: '10000000-0000-4000-8000-000000000001',
      workerPublicId: '10000000-0000-4000-8000-000000000002',
      workerStatus: 'ACTIVE',
      workerVersion: 7,
      relationshipPublicId: '10000000-0000-4000-8000-000000000003',
      relationshipType: 'EMPLOYEE',
      relationshipStart: '2025-01-01',
      relationshipEnd: null,
      relationshipVersion: 6,
      assignmentPublicId: '10000000-0000-4000-8000-000000000004',
      assignmentStatus: 'ACTIVE',
      validFrom: '2025-01-01',
      validToExclusive: null,
      primary: true,
      fte: '1.0',
      assignmentVersion: 5,
      legalEmployerRef: { ...owner, schemaId: 'HRM.LegalEmployer.v1' },
      organizationRef: { ...owner, schemaId: 'HRM.Organization.v1' },
      positionRef: { ...owner, schemaId: 'HRM.Position.v1' },
      jobRef: { ...owner, schemaId: 'HRM.Job.v1' },
      workLocationRef: { ...owner, schemaId: 'HRM.WorkLocation.v1' },
    },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function revisedScope(revision: string): ProductSurfaceRequestScope {
  return {
    ...scope,
    cacheKey: [
      scope.cacheKey[0],
      scope.cacheKey[1],
      scope.cacheKey[2],
      scope.cacheKey[3],
      scope.cacheKey[4],
      revision,
    ],
    queryMeta: { ...scope.queryMeta, decisionRevision: revision },
  };
}

let root: Root;
let host: HTMLDivElement;
let client: QueryClient;

async function renderRuntime(
  reader: EmploymentAssignmentsReader,
  options: Readonly<{
    requestScope?: ProductSurfaceRequestScope;
    canManageEvents?: boolean;
    nowMs?: number;
    renderProposalWorkspace?: EmploymentAssignmentProposalRenderer;
  }> = {}
) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <EmploymentAssignmentsRuntime
          requestScope={options.requestScope ?? scope}
          reader={reader}
          canManageEvents={options.canManageEvents ?? true}
          nowMs={options.nowMs ?? Date.parse('2026-10-13T00:05:00Z')}
          renderProposalWorkspace={options.renderProposalWorkspace}
        />
      </QueryClientProvider>
    );
  });
}

async function shown(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(document.body.textContent).toContain(text));
  });
}

async function clickButton(name: string) {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === name
  );
  if (!button) throw new Error(`Missing button: ${name}`);
  await act(async () => button.click());
}

describe('HRM employment assignment operations mount', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('pins IAQ-006 and every employment-event owner route without a legacy endpoint', () => {
    expect(EMPLOYMENT_ASSIGNMENTS_PRODUCTION_CONTRACT).toEqual({
      page: {
        contractId: 'IAQ-006',
        routeContractKey: 'route.hcm.operations.employment-assignments.page',
        method: 'GET',
        path: '/api/people/v1/hris/workbench/operations/employment/assignments',
      },
      eventDetail: {
        routeContractKey: 'route.hcm.operations.assignment-event-detail.data',
        method: 'GET',
        path: '/api/people/v1/hris/assignment-events/{eventPublicId}',
      },
      eventReceipt: {
        routeContractKey: 'route.hcm.operations.assignment-command-receipt.data',
        method: 'GET',
        path: '/api/people/v1/hris/command-receipts/{receiptId}',
      },
      eventActions: [
        {
          bindingId: 'PEP-HRM-006',
          routeContractKey: 'route.hcm.operations.assignment-event-create.action',
          method: 'POST',
          path: '/api/people/v1/hris/assignment-events',
        },
        {
          bindingId: 'PEP-HRM-007',
          routeContractKey: 'route.hcm.operations.assignment-event-validate.action',
          method: 'POST',
          path: '/api/people/v1/hris/assignment-events/{eventPublicId}/validate',
        },
        {
          bindingId: 'PEP-HRM-008',
          routeContractKey: 'route.hcm.operations.assignment-event-submit.action',
          method: 'POST',
          path: '/api/people/v1/hris/assignment-events/{eventPublicId}/submit',
        },
        {
          bindingId: 'PEP-HRM-009',
          routeContractKey: 'route.hcm.operations.assignment-event-publish.action',
          method: 'POST',
          path: '/api/people/v1/hris/assignment-events/{eventPublicId}/publish',
        },
      ],
    });
    expect(JSON.stringify(EMPLOYMENT_ASSIGNMENTS_PRODUCTION_CONTRACT)).not.toContain(
      '/hr/operations/assignments'
    );
  });

  it('rejects malformed or foreign-owner projections before they reach the workspace', () => {
    expect(selectEmploymentAssignmentsWorkbench(workbench)).toEqual(workbench);
    expect(() =>
      selectEmploymentAssignmentsWorkbench({
        ...workbench,
        tenantId: 'foreign-tenant',
      })
    ).toThrow('workbench is invalid');
    expect(() =>
      selectEmploymentAssignmentsWorkbench({
        ...workbench,
        assignments: [
          {
            ...workbench.assignments[0]!,
            organizationRef: {
              ...workbench.assignments[0]!.organizationRef,
              owner: 'FOREIGN',
            },
          },
        ],
      })
    ).toThrow('owner evidence is invalid');
  });

  it('keeps publish identity immutable for an exact retry and only accepts coordinator key rotation', () => {
    const binding = {
      eventPublicId: '20000000-0000-4000-8000-000000000001',
      expectedVersion: 3 as const,
      idempotencyKey: 'employment-publish-command-0001',
      correlationId: '20000000-0000-4000-8000-000000000002',
    };
    const descriptor = employmentEventPublishCommand(binding);

    expect(EMPLOYMENT_EVENT_PUBLISH_OPERATION).toBe('HCM_EMPLOYMENT_EVENT_PUBLISH');
    expect(descriptor).toMatchObject({
      operation: 'HCM_EMPLOYMENT_EVENT_PUBLISH',
      commandMethod: 'POST',
      commandPath:
        '/api/people/v1/hris/assignment-events/20000000-0000-4000-8000-000000000001/publish',
      targetType: 'EMPLOYMENT_EVENT',
      targetId: binding.eventPublicId,
      expectedObjectVersion: 3,
      idempotencyKey: binding.idempotencyKey,
    });
    expect(employmentEventPublishExecutionCommand(binding, descriptor)).toEqual(binding);

    const proofRenewal = {
      ...descriptor,
      idempotencyKey: 'employment-publish-command-0002',
    } as ProductSurfaceHighRiskCommandDescriptor;
    expect(employmentEventPublishExecutionCommand(binding, proofRenewal)).toEqual({
      ...binding,
      idempotencyKey: 'employment-publish-command-0002',
    });
    expect(() =>
      employmentEventPublishExecutionCommand(binding, {
        ...descriptor,
        targetId: '20000000-0000-4000-8000-000000000003',
      })
    ).toThrow('changed before dispatch');
  });

  it('waits for the exact hcm.operations scope and then uses its context key for IAQ-006', async () => {
    const pending = deferred<EmploymentAssignmentsWorkbench>();
    const reader = vi.fn<EmploymentAssignmentsReader>().mockReturnValue(pending.promise);
    const notReady: ProductSurfaceRequestScope = {
      ...scope,
      ready: false,
      contextScopeKey: undefined,
      cacheKey: [
        scope.cacheKey[0],
        scope.cacheKey[1],
        scope.cacheKey[2],
        scope.cacheKey[3],
        '',
        '38',
      ],
      queryMeta: { ...scope.queryMeta, contextScopeKey: undefined },
    };
    await renderRuntime(reader, { requestScope: notReady });

    expect(employmentAssignmentsScopeIsReady(notReady)).toBe(false);
    expect(reader).not.toHaveBeenCalled();
    expect(document.querySelector('[data-query-state="loading"]')).not.toBeNull();

    await renderRuntime(reader);
    expect(reader).toHaveBeenCalledWith(
      'scope:hris/operations',
      undefined,
      expect.any(AbortSignal)
    );
    pending.resolve(workbench);
    await shown('Start concurrent employment event');
  });

  it('shows the operator question, versioned evidence and exact event launch at 320px', async () => {
    const reader = vi.fn<EmploymentAssignmentsReader>().mockResolvedValue(workbench);
    const renderProposalWorkspace = vi.fn<EmploymentAssignmentProposalRenderer>((input) => (
      <div data-testid="proposal-workspace">{input.proposalReference}</div>
    ));
    await renderRuntime(reader, { renderProposalWorkspace });
    await shown('Which current assignment needs an employment lifecycle action now?');
    await shown('Worker version: 7');

    expect(document.querySelector('h1')?.textContent).toBe('Employment assignments');
    expect(
      getByRole(document.body, 'button', {
        name: 'EMPLOYEE · 10000000-0000-4000-8000-000000000004',
      })
    ).toBeTruthy();
    expect(document.querySelector('button[aria-label="Refresh assignments"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Worker version: 7');
    expect(document.body.textContent).toContain('Versioned owner evidence');

    await clickButton('Start concurrent employment event');
    await shown('employment:new:CONCURRENT_EMPLOYMENT:10000000-0000-4000-8000-000000000002:7');
    expect(renderProposalWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalReference:
          'employment:new:CONCURRENT_EMPLOYMENT:10000000-0000-4000-8000-000000000002:7',
        requestScope: scope,
      })
    );
  });

  it('keeps legacy rows readable but blocks event creation when owner evidence is incomplete', async () => {
    const incompleteWorkbench: EmploymentAssignmentsWorkbench = {
      ...workbench,
      assignments: [
        {
          ...workbench.assignments[0]!,
          fte: null,
          organizationRef: null,
          positionRef: null,
          jobRef: null,
          workLocationRef: null,
        },
      ],
    };
    const reader = vi.fn<EmploymentAssignmentsReader>().mockResolvedValue(incompleteWorkbench);

    await renderRuntime(reader);
    await shown('Owner evidence is incomplete');

    expect(document.body.textContent).toContain('Not available');
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === 'Start concurrent employment event'
      )?.disabled
    ).toBe(true);
  });

  it('distinguishes empty, permission and unavailable responses without synthetic records', async () => {
    const emptyReader = vi
      .fn<EmploymentAssignmentsReader>()
      .mockResolvedValue({ asOf: workbench.asOf, assignments: [] });
    await renderRuntime(emptyReader);
    await shown('No effective assignments are available');
    expect(document.querySelectorAll('ul > li')).toHaveLength(0);

    client.clear();
    const deniedReader = vi
      .fn<EmploymentAssignmentsReader>()
      .mockRejectedValue(new HttpError('not disclosed', 403, { traceId: 'trace-403' }));
    await renderRuntime(deniedReader, { requestScope: revisedScope('39') });
    await act(async () => {
      await vi.waitFor(() =>
        expect(document.querySelector('[data-query-state="permission"]')).not.toBeNull()
      );
    });
    expect(document.body.textContent).not.toContain(workbench.assignments[0]!.assignmentPublicId);

    client.clear();
    const unavailableReader = vi
      .fn<EmploymentAssignmentsReader>()
      .mockRejectedValue(new HttpError('owner unavailable', 503));
    await renderRuntime(unavailableReader, { requestScope: revisedScope('40') });
    await act(async () => {
      await vi.waitFor(() =>
        expect(document.querySelector('[data-query-state="unavailable"]')).not.toBeNull()
      );
    });
  });

  it('keeps partial records visible but pauses mutation after a failed refresh', async () => {
    const reader = vi
      .fn<EmploymentAssignmentsReader>()
      .mockResolvedValueOnce(workbench)
      .mockRejectedValueOnce(new HttpError('refresh unavailable', 503));
    await renderRuntime(reader);
    await shown('Start concurrent employment event');

    await clickButton('Refresh assignments');
    await shown('The latest refresh is unavailable');

    expect(document.querySelector('[data-state="partial"]')).not.toBeNull();
    expect(document.body.textContent).toContain(workbench.assignments[0]!.assignmentPublicId);
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === 'Start concurrent employment event'
      )?.disabled
    ).toBe(true);
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it('marks stale owner evidence and missing manage authority as fail-closed', async () => {
    expect(
      employmentAssignmentsSnapshotIsStale(workbench.asOf, Date.parse('2026-10-13T00:15:00Z'))
    ).toBe(false);
    expect(
      employmentAssignmentsSnapshotIsStale(workbench.asOf, Date.parse('2026-10-13T00:15:00.001Z'))
    ).toBe(true);

    const reader = vi.fn<EmploymentAssignmentsReader>().mockResolvedValue(workbench);
    await renderRuntime(reader, {
      canManageEvents: false,
      nowMs: Date.parse('2026-10-13T00:16:00Z'),
    });
    await shown('The assignment snapshot is stale');

    expect(document.body.textContent).toContain('Lifecycle actions are not available');
    expect(document.querySelector('[data-stale="true"]')).not.toBeNull();
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === 'Start concurrent employment event'
      )?.disabled
    ).toBe(true);
  });
});
