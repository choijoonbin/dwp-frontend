import { describe, expect, it } from 'vitest';

import {
  approvalPolicyRuleEditorEntries,
  approvalPolicyRuleInput,
  approvalPolicyValuesEqual,
  buildApprovalPolicyComparisonRows,
  createApprovalPolicyEditDraft,
  isApprovalPolicyMakerBlocked,
  isApprovalPolicyDraftValid,
  isApprovalPolicySourceCurrent,
  parseApprovalPolicyProjection,
  parseApprovalPolicyVersionProjection,
} from './approval-policy-model';

import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';

const policy = (patch: Partial<ApprovalPolicy> = {}): ApprovalPolicy => ({
  policyId: 'policy-1',
  policyKey: 'SOD.DEFAULT',
  nameKo: '직무 분리',
  nameEn: 'Separation of duties',
  policyType: 'SEGREGATION_OF_DUTIES',
  enforcementMode: 'BLOCK',
  severity: 'HIGH',
  lifecycleState: 'ACTIVE',
  rule: { allowSelfApproval: false, minimumApprovers: 1 },
  version: 4,
  pendingReview: false,
  pendingRule: {},
  ...patch,
});

describe('approval policy model', () => {
  it('strictly tags and sanitizes the full policy projection', () => {
    const parsed = parseApprovalPolicyProjection([
      {
        ...policy(),
        pendingEnforcementMode: null,
        pendingSeverity: null,
        pendingLifecycleState: null,
        pendingChangeReason: null,
        pendingBy: null,
        pendingAt: null,
      },
    ]);

    expect(parsed.kind).toBe('full');
    expect(parsed.policies[0]).toEqual({
      ...policy(),
      pendingEnforcementMode: null,
      pendingSeverity: null,
      pendingLifecycleState: null,
      pendingChangeReason: null,
      pendingBy: null,
      pendingAt: null,
    });
  });

  it('keeps oversight policies metadata-only and rejects mixed or secret-bearing rows', () => {
    const oversight = {
      policyId: 'policy-1',
      policyKey: 'SOD.DEFAULT',
      nameKo: '직무 분리',
      nameEn: 'Separation of duties',
      policyType: 'SEGREGATION_OF_DUTIES',
      enforcementMode: 'BLOCK',
      severity: 'HIGH',
      lifecycleState: 'ACTIVE',
      version: 4,
      pendingReview: true,
      pendingEnforcementMode: 'WARN',
      pendingSeverity: 'CRITICAL',
      pendingLifecycleState: 'ACTIVE',
      pendingAt: '2026-09-14T00:00:00Z',
    };
    const parsed = parseApprovalPolicyProjection([oversight]);

    expect(parsed).toEqual({ kind: 'oversight', policies: [oversight] });
    expect(Object.hasOwn(parsed.policies[0]!, 'rule')).toBe(false);
    expect(() => parseApprovalPolicyProjection([{ ...oversight, pendingBy: 7 }])).toThrow(
      /Invalid approval management projection/u
    );
    expect(() => parseApprovalPolicyProjection([oversight, policy()])).toThrow(
      /Invalid approval management projection/u
    );
  });

  it('fails closed on malformed policy projections instead of reaching comparison rendering', () => {
    expect(() => parseApprovalPolicyProjection([{ ...policy(), pendingRule: undefined }])).toThrow(
      /policies\[0\]\.pendingRule/u
    );
    expect(() => parseApprovalPolicyProjection([{ ...policy(), version: Number.NaN }])).toThrow(
      /policies\[0\]\.version/u
    );
    expect(() => parseApprovalPolicyProjection({ data: [policy()] })).toThrow(/policies/u);
  });

  it('parses policy history only against the selected projection contract', () => {
    const oversightVersion = {
      policyVersionId: 'version-1',
      versionNumber: 1,
      enforcementMode: 'BLOCK',
      severity: 'HIGH',
      lifecycleState: 'ACTIVE',
      submittedAt: null,
      publishedAt: '2026-09-14T00:00:00Z',
    };
    expect(parseApprovalPolicyVersionProjection([oversightVersion], 'oversight')).toEqual({
      kind: 'oversight',
      versions: [oversightVersion],
    });
    expect(() =>
      parseApprovalPolicyVersionProjection([{ ...oversightVersion, rule: {} }], 'oversight')
    ).toThrow(/policyVersions\[0\]/u);
    expect(() => parseApprovalPolicyVersionProjection([oversightVersion], 'full')).toThrow(
      /policyVersions\[0\]\.rule/u
    );
  });

  it('binds an editor to its original version and complete proposed source without healing', () => {
    const original = policy({
      pendingReview: true,
      pendingRule: { minimumApprovers: 2 },
      pendingBy: 31,
    });
    expect(isApprovalPolicySourceCurrent(original, structuredClone(original))).toBe(true);
    for (const change of [
      { version: original.version + 1 },
      { pendingRule: { minimumApprovers: 3 } },
      { pendingBy: 32 },
      { pendingReview: false },
      { policyId: 'another-policy' },
      { rule: { allowSelfApproval: true } },
    ]) {
      expect(isApprovalPolicySourceCurrent(original, { ...original, ...change })).toBe(false);
    }
    expect(isApprovalPolicySourceCurrent(original, null)).toBe(false);
    expect(isApprovalPolicySourceCurrent(null, original)).toBe(false);
    expect(isApprovalPolicySourceCurrent(policy({ version: -1 }), policy({ version: -1 }))).toBe(
      false
    );
  });
  it('compares structured policy values semantically regardless of object key order', () => {
    expect(approvalPolicyValuesEqual({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(approvalPolicyValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('builds deterministic current and proposed rows with explicit change flags', () => {
    const rows = buildApprovalPolicyComparisonRows(
      policy({
        pendingReview: true,
        pendingSeverity: 'CRITICAL',
        pendingRule: { minimumApprovers: 2, allowSelfApproval: false },
      })
    );

    expect(rows.map((row) => row.key)).toEqual([
      'enforcement',
      'severity',
      'lifecycle',
      'rule-allowSelfApproval',
      'rule-minimumApprovers',
    ]);
    expect(rows.find((row) => row.key === 'severity')?.changed).toBe(true);
    expect(rows.find((row) => row.key === 'rule-allowSelfApproval')?.changed).toBe(false);
    expect(rows.find((row) => row.key === 'rule-minimumApprovers')?.changed).toBe(true);
  });

  it('preserves boolean, number, string, and structured rule values without coercion', () => {
    const entries = approvalPolicyRuleEditorEntries({
      active: true,
      threshold: 3,
      mode: 'STRICT',
      scope: { tenant: true },
    });

    expect(entries.map((entry) => entry.kind)).toEqual([
      'boolean',
      'string',
      'structured',
      'number',
    ]);
    expect(approvalPolicyRuleInput(entries)).toEqual({
      active: true,
      mode: 'STRICT',
      scope: { tenant: true },
      threshold: 3,
    });
  });

  it('shows removed and added rules rather than silently retaining the published value', () => {
    const rows = buildApprovalPolicyComparisonRows(
      policy({ pendingReview: true, pendingRule: { minimumApprovers: 1, newRule: true } })
    );
    expect(rows.find((row) => row.ruleKey === 'allowSelfApproval')).toMatchObject({
      current: false,
      proposed: undefined,
      changed: true,
    });
    expect(rows.find((row) => row.ruleKey === 'newRule')).toMatchObject({
      current: undefined,
      proposed: true,
      changed: true,
    });
    expect(rows.find((row) => row.ruleKey === 'minimumApprovers')?.changed).toBe(false);
  });

  it('continues editing the pending proposal without reverting to the published policy', () => {
    const proposed = policy({
      pendingReview: true,
      pendingEnforcementMode: 'WARN',
      pendingSeverity: 'CRITICAL',
      pendingLifecycleState: 'RETIRED',
      pendingRule: { minimumApprovers: 3 },
      pendingChangeReason: 'Existing independent proposal',
    });
    expect(createApprovalPolicyEditDraft(proposed)).toEqual({
      enforcementMode: 'WARN',
      severity: 'CRITICAL',
      lifecycleState: 'RETIRED',
      rules: [{ key: 'minimumApprovers', kind: 'number', value: 3 }],
      changeReason: 'Existing independent proposal',
    });
    expect(proposed.rule).toEqual({ allowSelfApproval: false, minimumApprovers: 1 });
  });

  it('ignores inactive proposal remnants when no review is pending', () => {
    const current = policy({ pendingSeverity: 'CRITICAL', pendingRule: { staleRule: true } });
    expect(buildApprovalPolicyComparisonRows(current).every((row) => !row.changed)).toBe(true);
    expect(createApprovalPolicyEditDraft(current).rules).toEqual(
      approvalPolicyRuleEditorEntries(current.rule)
    );
  });

  it('blocks the pending change author from entering the publish command', () => {
    const pending = policy({ pendingReview: true, pendingBy: 42 });

    expect(isApprovalPolicyMakerBlocked(pending, '42')).toBe(true);
    expect(isApprovalPolicyMakerBlocked(pending, '7')).toBe(false);
    expect(isApprovalPolicyMakerBlocked(policy(), '42')).toBe(false);
  });

  it('requires an auditable reason and finite typed rule values', () => {
    const draft = createApprovalPolicyEditDraft(policy());

    expect(isApprovalPolicyDraftValid(draft)).toBe(false);
    expect(
      isApprovalPolicyDraftValid({
        ...draft,
        changeReason: 'Independent policy reason',
      })
    ).toBe(true);
    expect(
      isApprovalPolicyDraftValid({
        ...draft,
        changeReason: 'Independent policy reason',
        rules: draft.rules.map((entry) =>
          entry.kind === 'number' ? { ...entry, value: Number.NaN } : entry
        ),
      })
    ).toBe(false);
  });
});
