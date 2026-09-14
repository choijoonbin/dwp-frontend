import { describe, expect, it } from 'vitest';

import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import { ApprovalTypedFormError } from './approval-form-typed-model';
import { approvalRequestDraftValues } from './approval-request-model';
import { approvalRequestVerifiedDetailSnapshot } from './approval-request-draft-snapshot';
import {
  approvalRequestLegacyValues,
  approvalRequestPublishedSchemaMatches,
  approvalRequestSchemaKind,
  approvalRequestStoredEditingValues,
  approvalRequestTypedEvaluation,
} from './approval-request-schema-model';
import {
  APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
  APPROVAL_REQUEST_TYPED_TEST_INPUT,
} from '../../../../../e2e/support/approval-request-typed-fixture';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';

function stored(payload: Record<string, unknown>): ApprovalRequestDetail {
  return {
    request: {
      requestId: 'draft-1',
      requestNumber: 'APR-1',
      status: 'DRAFT',
      title: 'Typed draft',
      summary: 'Original summary',
      priority: 'NORMAL',
      version: 3,
      workflowNameKo: '결재',
      workflowNameEn: 'Approval',
      totalSteps: 1,
      dataClassification: 'INTERNAL',
    },
    workflowId: 'workflow-1',
    formId: 'form-1',
    payload,
    formSchema: APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
    timeline: [],
  };
}

describe('request typed schema and lossless editing boundaries', () => {
  it('narrows only exact typed marker/version and never accepts an unknown marker as legacy', () => {
    expect(approvalRequestSchemaKind(APPROVAL_REQUEST_TYPED_TEST_SCHEMA)).toBe('TYPED');
    expect(approvalRequestSchemaKind({ schemaVersion: 1, fields: [] })).toBe('LEGACY');
    expect(approvalRequestSchemaKind({ schemaVersion: 2, fields: [] })).toBe('LEGACY');
    expect(
      approvalRequestSchemaKind({
        ...APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
        schemaVersion: 1,
      } as never)
    ).toBe('UNSUPPORTED');
    expect(
      approvalRequestSchemaKind({
        ...APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
        schemaContract: 'UNKNOWN',
      } as never)
    ).toBe('UNSUPPORTED');
  });
  it('does not flatten structured rows or reinterpret typed drafts through the legacy path', () => {
    expect(() => approvalRequestLegacyValues({ items: [{ quantity: '2' }] })).toThrow(
      ApprovalTypedFormError
    );
    expect(() => approvalRequestDraftValues(stored({}))).toThrow(ApprovalTypedFormError);
    expect(approvalRequestLegacyValues({ quantity: 2, memo: ' exact ' })).toEqual({
      quantity: '2',
      memo: ' exact ',
    });
  });
  it('keeps exact decimal strings, computed rows and standard summary identical in DRAFT and SUBMIT payloads', async () => {
    const compiled = await compileApprovalTypedForm(APPROVAL_REQUEST_TYPED_TEST_SCHEMA);
    const draft = approvalRequestTypedEvaluation(
      compiled,
      APPROVAL_REQUEST_TYPED_TEST_INPUT,
      ' Original summary ',
      'DRAFT'
    );
    const submit = approvalRequestTypedEvaluation(
      compiled,
      APPROVAL_REQUEST_TYPED_TEST_INPUT,
      ' Original summary ',
      'SUBMIT'
    );
    expect(draft.payload).toEqual(submit.payload);
    expect(draft.payload).toEqual({
      category: 'STANDARD',
      items: [{ quantity: '2', price: '10.25', lineTotal: '20.5' }],
      total: '20.5',
      summary: 'Original summary',
      createdFrom: 'DWP_APPROVALS',
    });
    expect(APPROVAL_REQUEST_TYPED_TEST_INPUT.items[0]).toEqual({
      quantity: '2.00',
      price: '10.25',
    });
  });
  it('strips computed fields only from an exact authoritative stored base, not fresh UI mutations', async () => {
    const compiled = await compileApprovalTypedForm(APPROVAL_REQUEST_TYPED_TEST_SCHEMA);
    const evaluation = approvalRequestTypedEvaluation(
      compiled,
      APPROVAL_REQUEST_TYPED_TEST_INPUT,
      'Original summary',
      'DRAFT'
    );
    const detail = stored({ ...evaluation.payload });
    expect(approvalRequestStoredEditingValues(detail, compiled)).toEqual({
      category: 'STANDARD',
      items: [{ quantity: '2', price: '10.25' }],
    });
    expect(detail.payload).toEqual(evaluation.payload);
    expect(() =>
      approvalRequestTypedEvaluation(
        compiled,
        { ...APPROVAL_REQUEST_TYPED_TEST_INPUT, total: '999' },
        'Original summary',
        'DRAFT'
      )
    ).toThrow(ApprovalTypedFormError);
    const different = await compileApprovalTypedForm({
      ...APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
      fields: [...APPROVAL_REQUEST_TYPED_TEST_SCHEMA.fields].reverse(),
    });
    expect(() => approvalRequestStoredEditingValues(detail, different)).toThrow(
      ApprovalTypedFormError
    );
  });
  it('permits partial drafts but blocks actual submit until conditional required fields and rows are complete', async () => {
    const compiled = await compileApprovalTypedForm(APPROVAL_REQUEST_TYPED_TEST_SCHEMA);
    expect(
      approvalRequestTypedEvaluation(
        compiled,
        { category: 'OTHER', items: [{ quantity: '2' }] },
        '',
        'DRAFT'
      ).payload
    ).toEqual({ category: 'OTHER', items: [{ quantity: '2' }], createdFrom: 'DWP_APPROVALS' });
    expect(() =>
      approvalRequestTypedEvaluation(
        compiled,
        { category: 'OTHER', items: [{ quantity: '2' }] },
        'Summary',
        'SUBMIT'
      )
    ).toThrow(ApprovalTypedFormError);
    expect(() =>
      approvalRequestTypedEvaluation(
        compiled,
        { category: 'STANDARD', items: [{ quantity: '2', price: '50' }] },
        'Summary',
        'SUBMIT'
      )
    ).toThrow(ApprovalTypedFormError);
  });
  it.each(['1e3', '1.234567891', 1.5, 9007199254740992])(
    'rejects lossy/noncanonical numeric input %s before a save',
    async (quantity) => {
      const compiled = await compileApprovalTypedForm(APPROVAL_REQUEST_TYPED_TEST_SCHEMA);
      expect(() =>
        approvalRequestTypedEvaluation(
          compiled,
          { category: 'STANDARD', items: [{ quantity, price: '1' }] },
          'Summary',
          'DRAFT'
        )
      ).toThrow(ApprovalTypedFormError);
    }
  );
  it('binds only the same advertised schema hash and keeps structured receipt reconciliation exact', async () => {
    const compiled = await compileApprovalTypedForm(APPROVAL_REQUEST_TYPED_TEST_SCHEMA);
    expect(approvalRequestPublishedSchemaMatches(compiled, compiled.schemaSha256)).toBe(true);
    expect(approvalRequestPublishedSchemaMatches(compiled, '0'.repeat(64))).toBe(false);
    expect(approvalRequestPublishedSchemaMatches(compiled, undefined)).toBe(false);
    const payload = approvalRequestTypedEvaluation(
      compiled,
      APPROVAL_REQUEST_TYPED_TEST_INPUT,
      'Original summary',
      'DRAFT'
    ).payload;
    const snapshot = await approvalRequestVerifiedDetailSnapshot(stored({ ...payload }));
    expect(snapshot.payload).toEqual(payload);
    await expect(
      approvalRequestVerifiedDetailSnapshot(stored({ ...payload, total: '999' }))
    ).rejects.toThrow(ApprovalTypedFormError);
  });
});
