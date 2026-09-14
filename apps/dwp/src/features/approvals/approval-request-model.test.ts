import { describe, expect, it } from 'vitest';

import {
  approvalRequestCanSubmit,
  approvalRequestDraftValues,
  approvalRequestHasLocalChanges,
  approvalRequestNextCommand,
  approvalRequestPayload,
  approvalRequestProgress,
  approvalRequestRecovery,
  isApprovalRequestSnapshotCurrent,
  mergeApprovalResponseFields,
  missingApprovalRequestFields,
} from './approval-request-model';

import type {
  ApprovalFormField,
  ApprovalRequest,
  ApprovalRequestDetail,
} from '@dwp-frontend/shared-utils';

const request: ApprovalRequest = {
  requestId: 'request-1',
  requestNumber: 'APR-1',
  title: 'Access request',
  summary: 'Minimum required access',
  workflowNameKo: '접근 검토',
  workflowNameEn: 'Access review',
  currentStepName: 'Manager',
  currentStepSequence: 2,
  totalSteps: 4,
  status: 'IN_REVIEW',
  priority: 'HIGH',
  dataClassification: 'CONFIDENTIAL',
  version: 7,
};

const fields: ApprovalFormField[] = [
  { key: 'businessReason', type: 'TEXTAREA', required: true },
  { key: 'riskLevel', type: 'SELECT', required: false, options: ['LOW', 'HIGH'] },
];

describe('approval request lifecycle model', () => {
  it('keeps incomplete drafts savable while making submit readiness schema-complete', () => {
    expect(missingApprovalRequestFields(fields, {})).toEqual([fields[0]]);
    expect(
      approvalRequestCanSubmit({
        contextReady: true,
        title: 'Valid title',
        summary: 'Valid summary',
        fields,
        values: {},
      })
    ).toBe(false);
    expect(
      approvalRequestCanSubmit({
        contextReady: true,
        title: 'Valid title',
        summary: 'Valid summary',
        fields,
        values: { businessReason: 'Required evidence' },
      })
    ).toBe(true);
  });

  it('normalizes persisted payload without empty fields or mutable system metadata', () => {
    expect(
      approvalRequestPayload(' Summary ', {
        businessReason: ' Evidence ',
        optional: '  ',
      })
    ).toEqual({
      summary: 'Summary',
      businessReason: 'Evidence',
      createdFrom: 'DWP_APPROVALS',
    });
  });

  it('hydrates a draft without leaking system payload fields into the form', () => {
    const detail: ApprovalRequestDetail = {
      request: { ...request, status: 'DRAFT' },
      workflowId: 'workflow-1',
      formId: 'form-1',
      payload: { summary: 'System summary', createdFrom: 'DWP', amount: 12 },
      timeline: [],
    };
    const values = approvalRequestDraftValues(detail);
    expect(values).toEqual({
      formId: 'form-1',
      title: request.title,
      summary: request.summary,
      priority: 'HIGH',
      payload: { amount: '12' },
    });
    expect(approvalRequestHasLocalChanges(values)).toBe(true);
  });

  it('maps only server-supported status transitions to requester commands', () => {
    expect(approvalRequestNextCommand('DRAFT')).toBe('EDIT');
    expect(approvalRequestNextCommand('NEEDS_INFO')).toBe('RESPOND');
    expect(approvalRequestNextCommand('SUBMITTED')).toBe('WITHDRAW');
    expect(approvalRequestNextCommand('IN_REVIEW')).toBe('WITHDRAW');
    expect(approvalRequestNextCommand('APPROVED')).toBeNull();
    expect(approvalRequestNextCommand('WITHDRAWN')).toBeNull();
  });

  it('never reports an in-flight stage as fully complete', () => {
    expect(approvalRequestProgress(request)).toBe(25);
    expect(approvalRequestProgress({ ...request, currentStepSequence: 4 })).toBe(75);
    expect(approvalRequestProgress({ ...request, status: 'APPROVED' })).toBe(100);
  });

  it('requires exact request identity, status, and version for a command', () => {
    expect(isApprovalRequestSnapshotCurrent([request], request)).toBe(true);
    expect(isApprovalRequestSnapshotCurrent([{ ...request, version: 8 }], request)).toBe(false);
    expect(isApprovalRequestSnapshotCurrent([{ ...request, status: 'NEEDS_INFO' }], request)).toBe(
      false
    );
  });

  it('classifies first command failures into fail-closed recovery states', () => {
    expect(approvalRequestRecovery(409)).toBe('CONFLICT');
    expect(approvalRequestRecovery(403)).toBe('DENIED');
    expect(approvalRequestRecovery(503)).toBe('UNAVAILABLE');
    expect(approvalRequestRecovery(500)).toBe('ERROR');
  });

  it('keeps frozen schema fields authoritative while preserving legacy payload visibility', () => {
    expect(
      mergeApprovalResponseFields(fields, {
        businessReason: 'Evidence',
        legacyCode: 'X',
        createdFrom: 'DWP',
      })
    ).toEqual([...fields, { key: 'legacyCode', type: 'TEXT', required: false }]);
  });
});
