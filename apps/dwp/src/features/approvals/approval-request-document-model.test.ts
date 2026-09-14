import { describe, expect, it } from 'vitest';
import {
  approvalDocumentRequestDetail,
  approvalDocumentTools,
} from '../../../../../e2e/support/approval-request-document-fixtures';
import {
  approvalArchiveDocumentsEligible,
  approvalRequestDocumentMatches,
  sameApprovalRequestDocument,
} from './approval-request-document-model';

describe('Request document immutable source and archive eligibility', () => {
  it('binds request owner and database version zero without confusing task and request versions', () => {
    const tools = { ...approvalDocumentTools(), requestVersion: 0 };
    expect(approvalRequestDocumentMatches(tools, { requestId: tools.requestId, version: 0 })).toBe(
      true
    );
    expect(
      approvalRequestDocumentMatches(
        { ...tools, taskId: tools.requestId },
        { requestId: tools.requestId, version: 0 }
      )
    ).toBe(false);
  });
  it.each([
    { requestVersion: 4 },
    { payloadRevision: 2 },
    { payloadSha256: 'b'.repeat(64) },
    { policyVersion: 3 },
    { policyId: '77777777-7777-4777-8777-777777777777' },
    { resourceSetKey: 'RS_OTHER' },
    { commentsVersion: 1 },
    { holdVersion: 1 },
    { legalHold: true },
    { preservationPending: true },
  ])('rejects a changed pin %j', (changed) => {
    const tools = approvalDocumentTools();
    expect(sameApprovalRequestDocument(tools, { ...tools, ...changed })).toBe(false);
  });
  it('permits only advancing comment sequence for the explicit original unknown comment replay', () => {
    const tools = { ...approvalDocumentTools(), commentsVersion: 3 };
    expect(sameApprovalRequestDocument(tools, { ...tools, commentsVersion: 4 }, true)).toBe(true);
    expect(sameApprovalRequestDocument(tools, { ...tools, commentsVersion: 2 }, true)).toBe(false);
    expect(
      sameApprovalRequestDocument(tools, { ...tools, commentsVersion: 4, policyVersion: 3 }, true)
    ).toBe(false);
  });
  it('requires a common exact published policy and resource set, terminal states, and all export gates', () => {
    const a = approvalDocumentTools();
    const b = approvalDocumentTools('77777777-7777-4777-8777-777777777777');
    const requests = [
      approvalDocumentRequestDetail().request,
      approvalDocumentRequestDetail(b.requestId).request,
    ];
    expect(approvalArchiveDocumentsEligible([a, b], requests)).toBe(true);
    expect(
      approvalArchiveDocumentsEligible([a, { ...b, resourceSetKey: 'RS_OTHER' }], requests)
    ).toBe(false);
    expect(approvalArchiveDocumentsEligible([a, { ...b, policyVersion: 3 }], requests)).toBe(false);
    expect(approvalArchiveDocumentsEligible([a, { ...b, maxBatchItems: 1 }], requests)).toBe(false);
    expect(
      approvalArchiveDocumentsEligible(
        [a, { ...b, archiveExport: { allowed: false, reason: 'PROHIBITED' } }],
        requests
      )
    ).toBe(false);
    expect(
      approvalArchiveDocumentsEligible(
        [a, b],
        [requests[0]!, { ...requests[1]!, status: 'SUBMITTED' }]
      )
    ).toBe(false);
    expect(approvalArchiveDocumentsEligible([], [])).toBe(false);
  });
});
