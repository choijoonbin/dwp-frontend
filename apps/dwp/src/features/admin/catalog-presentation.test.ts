import { describe, expect, it } from 'vitest';

import {
  catalogCriticalityLabelKey,
  catalogCriticalityStroke,
  catalogAssuranceEvidencePresentation,
  catalogAssuranceFindingLabelKey,
  catalogAssuranceStateLabelKey,
  catalogKindLabelKey,
  catalogRelationTypeLabelKey,
  catalogScopeLabelKey,
} from './catalog-presentation';

describe('catalog presentation', () => {
  it('maps known kind and scope values', () => {
    expect(catalogKindLabelKey('APP')).toBe('catalog.kinds.APP');
    expect(catalogScopeLabelKey('TENANT')).toBe('catalog.scopes.TENANT');
  });

  it('never derives an i18n key from an unknown server code', () => {
    expect(catalogKindLabelKey('FUTURE_KIND')).toBe('catalog.kinds.UNKNOWN');
    expect(catalogScopeLabelKey('FUTURE_SCOPE')).toBe('catalog.scopes.UNKNOWN');
    expect(catalogRelationTypeLabelKey('FUTURE_RELATION')).toBe('catalog.relation.types.UNKNOWN');
    expect(catalogCriticalityLabelKey('FUTURE_CRITICALITY')).toBe('catalog.criticality.UNKNOWN');
    expect(catalogCriticalityStroke('FUTURE_CRITICALITY')).toBe('#64748B');
    expect(catalogAssuranceFindingLabelKey('FUTURE_FINDING')).toBe(
      'catalog.assurance.findings.UNKNOWN'
    );
    expect(catalogAssuranceStateLabelKey('FUTURE_STATE')).toBe('catalog.assurance.states.UNKNOWN');
  });

  it('summarizes only safe typed assurance evidence', () => {
    const presentation = catalogAssuranceEvidencePresentation({
      entityRevision: 7,
      directDependentCount: 2,
      internalRuleKey: 'must-not-render',
      nested: { secret: true },
    });
    expect(presentation).toEqual({
      retainedFieldCount: 4,
      items: [
        { labelKey: 'catalog.assurance.inspector.entityRevision', value: '7' },
        { labelKey: 'catalog.assurance.inspector.directDependents', value: '2' },
      ],
    });
    expect(JSON.stringify(presentation)).not.toContain('must-not-render');
  });
});
