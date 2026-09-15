import { describe, expect, it } from 'vitest';

import {
  emptyApprovalPolicyCreateDraft,
  newApprovalPolicyCreateRule,
  validateApprovalPolicyCreateDraft,
} from './approval-policy-create-model';

import type { ApprovalPolicyCreateDraft } from './approval-policy-create-model';

function validDraft(): ApprovalPolicyCreateDraft {
  return {
    ...emptyApprovalPolicyCreateDraft(),
    policyKey: 'SOD.FINANCE.REQUESTER_MAKER',
    nameKo: '재무 기안자와 게시자 분리',
    nameEn: 'Finance requester and publisher separation',
    rules: [
      { ...newApprovalPolicyCreateRule(), key: 'requesterCannotPublish', value: 'true' },
      { ...newApprovalPolicyCreateRule('INTEGER'), key: 'minimumReviewers', value: '2' },
      {
        ...newApprovalPolicyCreateRule('JSON'),
        key: 'protectedGroups',
        value: '["FINANCE","RISK"]',
      },
    ],
    changeReason: '재무 결재의 기안자와 게시자를 독립된 사용자로 분리합니다.',
  };
}

describe('approval policy creation schema', () => {
  it('normalizes the key and text while preserving typed rule values', () => {
    const draft = { ...validDraft(), policyKey: ' sod.finance.requester_maker ' };
    const result = validateApprovalPolicyCreateDraft(draft, []);
    expect(result.issues).toEqual([]);
    expect(result.input).toEqual({
      policyKey: 'SOD.FINANCE.REQUESTER_MAKER',
      nameKo: draft.nameKo,
      nameEn: draft.nameEn,
      policyType: 'SEGREGATION_OF_DUTIES',
      enforcementMode: 'BLOCK',
      severity: 'HIGH',
      lifecycleState: 'ACTIVE',
      rule: {
        requesterCannotPublish: true,
        minimumReviewers: 2,
        protectedGroups: ['FINANCE', 'RISK'],
      },
      changeReason: draft.changeReason,
    });
  });

  it('rejects a latest-catalog key collision before creating a command', () => {
    const result = validateApprovalPolicyCreateDraft(validDraft(), [
      { policyKey: 'sod.finance.requester_maker' },
    ]);
    expect(result.input).toBeNull();
    expect(result.issues).toContainEqual({ path: 'policyKey', code: 'DUPLICATE' });
  });

  it.each([
    ['policy key', { policyKey: 'INVALID KEY' }, 'policyKey', 'FORMAT'],
    ['Korean name', { nameKo: ' ' }, 'nameKo', 'REQUIRED'],
    ['English name', { nameEn: ' ' }, 'nameEn', 'REQUIRED'],
    ['change reason', { changeReason: 'short' }, 'changeReason', 'REQUIRED'],
  ])('rejects invalid %s input', (_label, patch, path, code) => {
    const result = validateApprovalPolicyCreateDraft({ ...validDraft(), ...patch }, []);
    expect(result.input).toBeNull();
    expect(result.issues).toContainEqual({ path, code });
  });

  it('rejects duplicate and unsafe rule keys without collapsing user rows', () => {
    const first = { ...newApprovalPolicyCreateRule(), key: 'sameRule', value: 'true' };
    const second = { ...newApprovalPolicyCreateRule(), key: 'sameRule', value: 'false' };
    const invalid = { ...newApprovalPolicyCreateRule(), key: 'not allowed', value: 'true' };
    const result = validateApprovalPolicyCreateDraft(
      { ...validDraft(), rules: [first, second, invalid] },
      []
    );
    expect(result.input).toBeNull();
    expect(result.issues).toContainEqual({
      path: `rules.${second.id}.key`,
      code: 'DUPLICATE',
    });
    expect(result.issues).toContainEqual({
      path: `rules.${invalid.id}.key`,
      code: 'FORMAT',
    });
  });

  it.each([
    ['fractional number', 'INTEGER', '1.5'],
    ['unsafe integer', 'INTEGER', '9007199254740993'],
    ['malformed JSON', 'JSON', '{'],
    ['scalar JSON', 'JSON', '12'],
    ['unsafe nested key', 'JSON', '{"not allowed":true}'],
  ] as const)('rejects a %s rule value', (_label, kind, value) => {
    const entry = { ...newApprovalPolicyCreateRule(kind), key: 'ruleValue', value };
    const result = validateApprovalPolicyCreateDraft({ ...validDraft(), rules: [entry] }, []);
    expect(result.input).toBeNull();
    expect(result.issues).toContainEqual({
      path: `rules.${entry.id}.value`,
      code: 'INVALID_VALUE',
    });
  });

  it('rejects an empty or oversized rule object at the same bounds as the owner service', () => {
    const empty = validateApprovalPolicyCreateDraft({ ...validDraft(), rules: [] }, []);
    expect(empty.issues).toContainEqual({ path: 'rules', code: 'REQUIRED' });
    const rules = Array.from({ length: 65 }, (_, index) => ({
      ...newApprovalPolicyCreateRule(),
      key: `rule${index}`,
      value: 'true',
    }));
    const large = validateApprovalPolicyCreateDraft({ ...validDraft(), rules }, []);
    expect(large.issues).toContainEqual({ path: 'rules', code: 'TOO_MANY' });
  });
});
