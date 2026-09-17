import { describe, expect, it } from 'vitest';

import {
  createDwaionResearchDraft,
  dwaionResearchDefinition,
  dwaionResearchDeliveryCapabilityKey,
  dwaionResearchProgressPercent,
  validateDwaionResearchDraft,
} from './dwaion-deep-research-model';

describe('DWAI.ON deep research model', () => {
  it('builds a canonical plan without silently adding source access', () => {
    const draft = {
      ...createDwaionResearchDraft(),
      goal: 'Compare the verified total cost of governed infrastructure options.',
      question: 'Which option best satisfies the verified three-year cost threshold?',
      successCriteria: 'Verify finance ledger\nCite every final claim\nVerify finance ledger',
      allowedSources: ['WORK_ITEM'],
      requireAllAllowedSources: true,
    };

    const definition = dwaionResearchDefinition(draft);

    expect(definition.successCriteria).toEqual(['Verify finance ledger', 'Cite every final claim']);
    expect(
      definition.sourcePolicies.find((source) => source.sourceKey === 'WORK_ITEM')
    ).toMatchObject({
      allowed: true,
    });
    expect(definition.sourcePolicies.find((source) => source.sourceKey === 'MAIL')).toMatchObject({
      allowed: false,
    });
    expect(definition.requireAllAllowedSources).toBe(true);
  });

  it('fails closed on missing scope, criteria, or invalid limits', () => {
    const base = {
      ...createDwaionResearchDraft(),
      goal: 'A sufficiently detailed research goal',
      question: 'A sufficiently detailed research question',
      successCriteria: 'One verifiable criterion',
    };
    expect(validateDwaionResearchDraft({ ...base, allowedSources: [] })).toBe('SOURCE');
    expect(validateDwaionResearchDraft({ ...base, successCriteria: '  ' })).toBe('CRITERIA');
    expect(validateDwaionResearchDraft({ ...base, maximumMinutes: 241 })).toBe('BUDGET');
  });

  it('clamps progress to a user-safe percentage', () => {
    expect(dwaionResearchProgressPercent(2, 4)).toBe(50);
    expect(dwaionResearchProgressPercent(7, 4)).toBe(100);
    expect(dwaionResearchProgressPercent(0, 0)).toBe(0);
  });

  it('binds every visible delivery action to its server capability', () => {
    expect(dwaionResearchDeliveryCapabilityKey('ARTIFACT')).toBe('artifact');
    expect(dwaionResearchDeliveryCapabilityKey('EXPORT')).toBe('export');
    expect(dwaionResearchDeliveryCapabilityKey('PROPOSAL')).toBe('proposal');
    expect(dwaionResearchDeliveryCapabilityKey('HANDOFF')).toBe('handoff');
    expect(dwaionResearchDeliveryCapabilityKey('SHARE')).toBe('share');
    expect(dwaionResearchDeliveryCapabilityKey('ROUTINE')).toBe('routine');
  });
});
