import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import { createApprovalWorkflowDraft, updateApprovalWorkflowDraft } from './approval-api';
import {
  APPROVAL_TYPED_WORKFLOW_CONTRACT,
  readApprovalTypedWorkflowDetail,
} from './approval-workflow-typed-contract';

const execution = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' } as const;
const metadata = {
  nameKo: '결재선',
  nameEn: 'Workflow',
  descriptionKo: '설명',
  descriptionEn: 'Description',
  category: 'GENERAL',
  dataClassification: 'INTERNAL',
  slaMinutes: 60,
  ownerGroupRef: 'APPROVAL_OPERATOR',
};
const definition = () => ({
  schemaContract: APPROVAL_TYPED_WORKFLOW_CONTRACT as typeof APPROVAL_TYPED_WORKFLOW_CONTRACT,
  schemaVersion: 2 as const,
  slaMinutes: 60,
  stages: [
    {
      key: 'REVIEW',
      name: 'Review',
      candidateRole: 'APPROVAL_OPERATOR',
      quorum: { mode: 'COUNT' as const, value: 2 },
      slaMinutes: 60,
      predecessors: [] as string[],
    },
  ],
});
const response = (data: unknown) =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
describe('typed workflow API transport', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });
  it.each(['CREATE', 'UPDATE'] as const)(
    'sends %s through the existing exact route without legacy steps or invented quorum modes',
    async (action) => {
      const typedDefinition = definition();
      const returned = {
        workflow: { workflowId: 'workflow-1' },
        definition: structuredClone(typedDefinition),
        definitionHash: 'a'.repeat(64),
      };
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
        .mockResolvedValue(response(returned));
      vi.stubGlobal('fetch', fetch);
      const result =
        action === 'CREATE'
          ? await createApprovalWorkflowDraft(
              { ...metadata, workflowKey: 'QUORUM_REVIEW', typedDefinition },
              execution
            )
          : await updateApprovalWorkflowDraft(
              'workflow-1',
              { ...metadata, expectedVersion: 3, typedDefinition },
              execution
            );
      expect(result.definition.stages[0]?.quorum).toEqual({ mode: 'COUNT', value: 2 });
      const [url, init] = fetch.mock.calls.find(
        ([, init]) => init.method === (action === 'CREATE' ? 'POST' : 'PUT')
      )!;
      expect(url).toBe(
        action === 'CREATE'
          ? '/api/approvals/v1/admin/workflows'
          : '/api/approvals/v1/admin/workflows/workflow-1/draft'
      );
      expect(JSON.parse(init.body)).toEqual({
        ...metadata,
        ...(action === 'CREATE' ? { workflowKey: 'QUORUM_REVIEW' } : { expectedVersion: 3 }),
        typedDefinition,
      });
      expect(Object.isFrozen(result.definition.stages)).toBe(true);
    }
  );
  it('captures the original nested proposal before asynchronous CSRF resolution', async () => {
    const typedDefinition = definition();
    const original = structuredClone(typedDefinition);
    const fetch = vi
      .fn()
      .mockImplementationOnce(async () => {
        typedDefinition.stages[0]!.name = 'Changed while waiting';
        typedDefinition.stages[0]!.quorum.value = 3;
        return response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
      })
      .mockResolvedValue(
        response({ workflow: {}, definition: original, definitionHash: 'a'.repeat(64) })
      );
    vi.stubGlobal('fetch', fetch);
    await createApprovalWorkflowDraft(
      { ...metadata, workflowKey: 'QUORUM_REVIEW', typedDefinition },
      execution
    );
    expect(
      JSON.parse(fetch.mock.calls.find(([, init]) => init.method === 'POST')![1].body)
        .typedDefinition
    ).toEqual(original);
  });
  it.each(['BOTH', 'MISSING', 'TAG', 'SLA', 'MODE', 'ARGUMENT', 'EXCESS_PERCENT'] as const)(
    'rejects %s before any network call',
    async (defect) => {
      const body: Record<string, unknown> = {
        ...metadata,
        workflowKey: 'QUORUM_REVIEW',
        typedDefinition: definition(),
      };
      const typed = body.typedDefinition as ReturnType<typeof definition>;
      if (defect === 'BOTH')
        body.steps = [
          {
            key: 'REVIEW',
            name: 'Review',
            mode: 'ANY',
            candidateRole: 'APPROVAL_OPERATOR',
            slaMinutes: 60,
          },
        ];
      if (defect === 'MISSING') delete body.typedDefinition;
      if (defect === 'TAG')
        body.typedDefinition = { ...typed, schemaContract: 'QUORUM_UNRECOGNIZED' };
      if (defect === 'SLA') body.slaMinutes = 75;
      if (defect === 'MODE')
        body.typedDefinition = {
          ...typed,
          stages: [{ ...typed.stages[0], quorum: { mode: 'PARALLEL' } }],
        };
      if (defect === 'ARGUMENT')
        body.typedDefinition = {
          ...typed,
          stages: [{ ...typed.stages[0], quorum: { mode: 'ANY', value: 2 } }],
        };
      if (defect === 'EXCESS_PERCENT')
        body.typedDefinition = {
          ...typed,
          stages: [{ ...typed.stages[0], quorum: { mode: 'PERCENT', value: 101 } }],
        };
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      // Exercise malformed untyped external callers, not a production coercion.
      await expect(createApprovalWorkflowDraft(body as never, execution)).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it('does not reinterpret a marked malformed response as legacy', () => {
    expect(
      readApprovalTypedWorkflowDetail({
        workflow: {},
        definition: { schemaVersion: 2, steps: [] },
        definitionHash: 'legacy',
      })
    ).toBeNull();
    expect(() =>
      readApprovalTypedWorkflowDetail({
        workflow: {},
        definition: { schemaContract: 'UNKNOWN', schemaVersion: 2 },
        definitionHash: 'a'.repeat(64),
      })
    ).toThrow();
  });
});
