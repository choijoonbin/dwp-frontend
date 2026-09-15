import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  approvalDraftMigrationPreviewFingerprint,
  getApprovalDraftMigrationPreview,
  migrateApprovalDraft,
} from './approval-draft-migration-api';

const sourceRequestId = '11111111-1111-4111-8111-111111111111';
const draftRequestId = '22222222-2222-4222-8222-222222222222';
const sourceFormId = '33333333-3333-4333-8333-333333333333';
const sourceFormVersionId = '44444444-4444-4444-8444-444444444444';
const targetFormId = '55555555-5555-4555-8555-555555555555';
const targetFormVersionId = '66666666-6666-4666-8666-666666666666';
const sourceWorkflowId = '77777777-7777-4777-8777-777777777777';
const sourceWorkflowVersionId = '88888888-8888-4888-8888-888888888888';
const targetWorkflowId = '99999999-9999-4999-8999-999999999999';
const targetWorkflowVersionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const revision = `psr-${'b'.repeat(64)}`;

const source = {
  formId: sourceFormId,
  formVersionId: sourceFormVersionId,
  formVersion: 2,
  formSchemaSha256: '1'.repeat(64),
  formNameKo: '기존 양식',
  formNameEn: 'Legacy form',
  workflowId: sourceWorkflowId,
  workflowVersionId: sourceWorkflowVersionId,
  workflowVersion: 3,
  workflowDefinitionSha256: '2'.repeat(64),
  workflowNameKo: '기존 경로',
  workflowNameEn: 'Legacy route',
};
const target = {
  formId: targetFormId,
  formVersionId: targetFormVersionId,
  formVersion: 7,
  formSchemaSha256: '3'.repeat(64),
  formNameKo: '현재 양식',
  formNameEn: 'Current form',
  workflowId: targetWorkflowId,
  workflowVersionId: targetWorkflowVersionId,
  workflowVersion: 9,
  workflowDefinitionSha256: '4'.repeat(64),
  workflowNameKo: '현재 경로',
  workflowNameEn: 'Current route',
};
const preview = {
  sourceRequestId,
  sourceVersion: 5,
  source,
  target,
  migrationRequired: true,
  routeCompatible: true,
  mappedFields: ['summary', 'amount'],
  droppedFields: ['legacyCode'],
  incompatibleFields: [],
  requiredFieldsToComplete: ['costCenter'],
  evaluatedAt: '2026-09-15T00:00:00Z',
};
const draft = {
  requestId: draftRequestId,
  requestNumber: 'APR-DRAFT-2026-2',
  title: '복구된 초안',
  summary: '현재 양식에 매핑됨',
  workflowNameKo: target.workflowNameKo,
  workflowNameEn: target.workflowNameEn,
  currentStepKey: null,
  currentStepName: null,
  currentStepSequence: null,
  totalSteps: 2,
  status: 'DRAFT',
  priority: 'HIGH',
  dataClassification: 'INTERNAL',
  latestInformationRequest: null,
  submittedAt: null,
  dueAt: null,
  completedAt: null,
  version: 0,
};

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function execution() {
  return {
    mode: 'SECURE',
    rolloutState: '110',
    expectedDecisionRevision: revision,
    contextKey: 'approval-work',
    contextScopeKey: 'opaque-approval-scope',
  } as const;
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('approval draft migration API', () => {
  it('reads a target-bound preview without exposing malformed server data', async () => {
    const guard = vi.fn();
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      response(preview)
    );
    vi.stubGlobal('fetch', fetch);

    const result = await getApprovalDraftMigrationPreview(
      sourceRequestId,
      targetFormId,
      targetWorkflowId,
      { contextScopeKey: 'opaque-approval-scope', beforeDispatch: guard }
    );

    const called = new URL(String(fetch.mock.calls[0]![0]), 'http://test.invalid');
    expect(called.pathname).toBe(
      `/api/approvals/v1/requests/${sourceRequestId}/draft/migration-preview`
    );
    expect(called.searchParams.get('targetFormId')).toBe(targetFormId);
    expect(called.searchParams.get('targetWorkflowId')).toBe(targetWorkflowId);
    expect(result.target).toEqual(target);
    expect(approvalDraftMigrationPreviewFingerprint(result)).toContain(targetFormVersionId);
    expect(guard.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('creates a separate draft with the exact preview pins and original command key', async () => {
    const guard = vi.fn();
    const fetch = vi.fn(async (input: string | URL | Request, _init?: RequestInit) =>
      String(input).includes('/csrf')
        ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
        : response({
            draft,
            sourceRequestId,
            sourceVersion: 5,
            target,
            mappedFields: preview.mappedFields,
            droppedFields: preview.droppedFields,
            incompatibleFields: preview.incompatibleFields,
            requiredFieldsToComplete: preview.requiredFieldsToComplete,
          })
    );
    vi.stubGlobal('fetch', fetch);
    const input = {
      expectedVersion: 5,
      targetFormId,
      targetFormVersionId,
      targetFormSchemaSha256: target.formSchemaSha256,
      targetWorkflowId,
      targetWorkflowVersionId,
      targetWorkflowDefinitionSha256: target.workflowDefinitionSha256,
      reason: '  현재 게시 양식으로 안전하게 복구  ',
    };

    await expect(
      migrateApprovalDraft(sourceRequestId, input, execution(), {
        idempotencyKey: 'migration:stable-command',
        beforeDispatch: guard,
      })
    ).resolves.toMatchObject({ draft, sourceRequestId, sourceVersion: 5, target });

    const call = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('Idempotency-Key')).toBe('migration:stable-command');
    expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(revision);
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      ...input,
      reason: '현재 게시 양식으로 안전하게 복구',
    });
    expect(guard.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('fails closed on invalid identifiers, response drift and source reuse', async () => {
    await expect(
      getApprovalDraftMigrationPreview('invalid', targetFormId, targetWorkflowId)
    ).rejects.toThrow('Invalid approval draft migration contract');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ ...preview, sourceVersion: -1 }))
    );
    await expect(
      getApprovalDraftMigrationPreview(sourceRequestId, targetFormId, targetWorkflowId)
    ).rejects.toThrow('Invalid approval draft migration contract');

    resetCsrfToken();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) =>
        String(input).includes('/csrf')
          ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
          : response({
              draft: { ...draft, requestId: sourceRequestId },
              sourceRequestId,
              sourceVersion: 5,
              target,
              mappedFields: [],
              droppedFields: [],
              incompatibleFields: [],
              requiredFieldsToComplete: [],
            })
      )
    );
    await expect(
      migrateApprovalDraft(
        sourceRequestId,
        {
          expectedVersion: 5,
          targetFormId,
          targetFormVersionId,
          targetFormSchemaSha256: target.formSchemaSha256,
          targetWorkflowId,
          targetWorkflowVersionId,
          targetWorkflowDefinitionSha256: target.workflowDefinitionSha256,
          reason: 'recover',
        },
        execution(),
        { idempotencyKey: 'valid-key', beforeDispatch: () => undefined }
      )
    ).rejects.toThrow('Invalid approval draft migration contract');
  });
});
