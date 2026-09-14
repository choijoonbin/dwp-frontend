import { describe, expect, it } from 'vitest';

import {
  approvalDocumentFieldCount,
  approvalDocumentFieldType,
  approvalDocumentHoldValid,
  approvalDocumentMakerBlocked,
  approvalDocumentNewField,
  approvalDocumentPolicyValid,
  approvalDocumentRuleDifferences,
  approvalDocumentRulesValid,
} from './approval-admin-document-model';
import type {
  ApprovalDocumentHold,
  ApprovalDocumentPolicy,
  ApprovalDocumentRules,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';

const rules: ApprovalDocumentRules = {
  allowComments: true,
  allowPrint: false,
  allowJsonExport: false,
  allowArchiveExport: false,
  includeComments: false,
  includeEvidence: false,
  allowedClassifications: [],
  fields: [],
  maxBatchItems: 20,
  maxBytes: 1048576,
  snapshotTtlSeconds: 300,
  evidenceRetentionDays: 365,
};
const policy: ApprovalDocumentPolicy = {
  policyId: '11111111-1111-1111-1111-111111111111',
  resourceSetKey: 'ALL',
  version: 0,
  published: {
    revision: 0,
    rules,
    sha256: 'a'.repeat(64),
    makerUserId: null,
    createdAt: '2026-09-14T00:00:00Z',
  },
  pending: null,
};
const hold: ApprovalDocumentHold = {
  requestId: '22222222-2222-2222-2222-222222222222',
  version: 0,
  active: false,
  pending: null,
  journal: [],
  purgeState: 'PURGE_WORKER_NOT_IMPLEMENTED',
  retainUntil: '2027-09-14T00:00:00Z',
  preservationPending: false,
  purgeEligible: false,
};

describe('approval document admin authoritative model', () => {
  it('accepts the real ALL default without enabling any export', () => {
    expect(approvalDocumentPolicyValid(policy)).toBe(true);
    expect(approvalDocumentRulesValid(rules)).toBe(true);
    expect([rules.allowPrint, rules.allowJsonExport, rules.allowArchiveExport]).toEqual([
      false,
      false,
      false,
    ]);
  });
  it.each(['allowPrint', 'allowJsonExport', 'allowArchiveExport'] as const)(
    'requires explicit classification for %s',
    (key) => {
      expect(approvalDocumentRulesValid({ ...rules, [key]: true })).toBe(false);
      expect(
        approvalDocumentRulesValid({ ...rules, [key]: true, allowedClassifications: ['INTERNAL'] })
      ).toBe(true);
    }
  );
  it.each([
    { maxBatchItems: 51 },
    { maxBatchItems: 1.5 },
    { maxBytes: 1023 },
    { snapshotTtlSeconds: 59 },
    { evidenceRetentionDays: 3651 },
    { allowedClassifications: ['INTERNAL', 'INTERNAL'] },
    { allowedClassifications: ['PUBLIC'] },
  ])('uses actual API validation for bounds and classifications %j', (change) => {
    expect(approvalDocumentRulesValid({ ...rules, ...change })).toBe(false);
  });
  it('validates nested allowlists, unique local keys, total 100 and depth 4', () => {
    const leaf = approvalDocumentNewField([]);
    const group = { ...approvalDocumentFieldType(leaf, 'OBJECT_LIST'), children: [leaf] };
    expect(approvalDocumentRulesValid({ ...rules, fields: [group] })).toBe(true);
    expect(approvalDocumentFieldCount([group])).toBe(2);
    expect(approvalDocumentRulesValid({ ...rules, fields: [leaf, leaf] })).toBe(false);
    expect(approvalDocumentRulesValid({ ...rules, fields: [{ ...leaf, children: [leaf] }] })).toBe(
      false
    );
    const fields = Array.from({ length: 100 }, (_, index) => ({ ...leaf, key: `field_${index}` }));
    expect(approvalDocumentRulesValid({ ...rules, fields })).toBe(true);
    expect(
      approvalDocumentRulesValid({ ...rules, fields: [...fields, { ...leaf, key: 'last' }] })
    ).toBe(false);
    let nested = leaf;
    for (let depth = 0; depth < 4; depth++)
      nested = { ...approvalDocumentFieldType(leaf, 'OBJECT'), children: [nested] };
    expect(approvalDocumentRulesValid({ ...rules, fields: [nested] })).toBe(true);
    expect(
      approvalDocumentRulesValid({ ...rules, fields: [{ ...nested, children: [nested] }] })
    ).toBe(false);
  });
  it('keeps field edits immutable and resets incompatible child and row options', () => {
    const child = approvalDocumentNewField([]);
    const group = {
      ...approvalDocumentFieldType(child, 'OBJECT_LIST'),
      children: [child],
      maxRows: 5,
    };
    expect(approvalDocumentNewField([child]).key).toBe('field_2');
    expect(approvalDocumentFieldType(group, 'STRING')).toEqual({
      ...group,
      type: 'STRING',
      children: [],
      maxRows: null,
    });
    expect(group.children).toEqual([child]);
    expect(
      approvalDocumentRuleDifferences(rules, { ...rules, fields: [group], allowComments: false })
    ).toEqual(['allowComments', 'fields']);
  });
  it.each([
    undefined,
    null,
    {},
    { ...policy, pending: {} },
    { ...policy, published: null },
    { ...policy, version: Number.MAX_SAFE_INTEGER + 1 },
    { ...policy, resourceSetKey: 'tenant-other' },
    { ...policy, published: { ...policy.published, rules: { ...rules, fields: [null] } } },
  ])('rejects malformed policy without a rendering crash %j', (value) => {
    expect(() => approvalDocumentPolicyValid(value)).not.toThrow();
    expect(approvalDocumentPolicyValid(value)).toBe(false);
  });
  it('requires a real independent maker and strictly newer proposal revision', () => {
    const pending = { ...policy.published, revision: 1, makerUserId: 12 };
    expect(approvalDocumentPolicyValid({ ...policy, version: 1, pending })).toBe(true);
    expect(approvalDocumentPolicyValid({ ...policy, pending: { ...pending, revision: 0 } })).toBe(
      false
    );
    expect(
      approvalDocumentPolicyValid({ ...policy, pending: { ...pending, makerUserId: null } })
    ).toBe(false);
    expect(approvalDocumentMakerBlocked(12, '12')).toBe(true);
    expect(approvalDocumentMakerBlocked(12, '13')).toBe(false);
    expect(approvalDocumentMakerBlocked(null, '13')).toBe(true);
    expect(approvalDocumentMakerBlocked(12, 'not-a-server-user')).toBe(true);
  });
  it('distinguishes pending preservation from an active restriction and never claims purge eligibility', () => {
    expect(approvalDocumentHoldValid(hold, hold.requestId)).toBe(true);
    const pending = {
      proposalId: '33333333-3333-3333-3333-333333333333',
      operation: 'PLACE' as const,
      reason: 'Preserve the approval evidence',
      makerUserId: 12,
      createdAt: '2026-09-14T00:00:00Z',
    };
    expect(
      approvalDocumentHoldValid({ ...hold, pending, preservationPending: true }, hold.requestId)
    ).toBe(true);
    expect(
      approvalDocumentHoldValid({ ...hold, pending, preservationPending: false }, hold.requestId)
    ).toBe(false);
    expect(
      approvalDocumentHoldValid(
        { ...hold, active: true, pending, preservationPending: true },
        hold.requestId
      )
    ).toBe(false);
    expect(approvalDocumentHoldValid({ ...hold, purgeEligible: true }, hold.requestId)).toBe(false);
  });
  it.each([
    null,
    {},
    { ...hold, pending: {} },
    { ...hold, journal: [null] },
    { ...hold, journal: Array(501).fill({}) },
    { ...hold, retainUntil: 'invalid' },
  ])('rejects malformed hold and journal without a rendering crash %j', (value) => {
    expect(() => approvalDocumentHoldValid(value, hold.requestId)).not.toThrow();
    expect(approvalDocumentHoldValid(value, hold.requestId)).toBe(false);
  });
  it('rejects a journal where maker and checker are the same actor', () => {
    const entry = {
      entryId: '44444444-4444-4444-4444-444444444444',
      version: 1,
      operation: 'PLACE' as const,
      makerUserId: 12,
      checkerUserId: 13,
      reason: 'Preserve evidence',
      reviewComment: 'Independently reviewed',
      occurredAt: '2026-09-14T00:00:00Z',
    };
    expect(approvalDocumentHoldValid({ ...hold, journal: [entry] }, hold.requestId)).toBe(true);
    expect(
      approvalDocumentHoldValid(
        { ...hold, journal: [{ ...entry, checkerUserId: 12 }] },
        hold.requestId
      )
    ).toBe(false);
    expect(approvalDocumentHoldValid(hold, policy.policyId)).toBe(false);
  });
});
