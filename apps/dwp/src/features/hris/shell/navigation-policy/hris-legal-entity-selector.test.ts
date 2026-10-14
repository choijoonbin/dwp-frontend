import { describe, expect, it } from 'vitest';

import {
  HRIS_LEGAL_ENTITY_SELECTOR_PARAM,
  replaceHrisLegalEntitySelector,
  selectHrisLegalEntitySelector,
} from './hris-legal-entity-selector';

const LEGAL_ENTITY_ID = '6d07e952-2f5f-4dc1-8be7-6d7e210d23af';

describe('HRIS legal-entity route selector', () => {
  it('defaults to the tenant baseline when the selector is absent', () => {
    expect(selectHrisLegalEntitySelector(new URLSearchParams('contextScopeKey=scope-1'))).toEqual({
      state: 'TENANT',
      legalEntityPublicId: null,
    });
  });

  it('routes one normalized UUID without discarding the governed context selector', () => {
    const source = new URLSearchParams('contextScopeKey=scope-1&tab=published');
    const routed = replaceHrisLegalEntitySelector(
      source,
      'LEGAL_ENTITY',
      LEGAL_ENTITY_ID.toUpperCase()
    );

    expect(routed.get('contextScopeKey')).toBe('scope-1');
    expect(routed.get('tab')).toBe('published');
    expect(routed.get(HRIS_LEGAL_ENTITY_SELECTOR_PARAM)).toBe(LEGAL_ENTITY_ID);
    expect(selectHrisLegalEntitySelector(routed)).toEqual({
      state: 'LEGAL_ENTITY',
      legalEntityPublicId: LEGAL_ENTITY_ID,
    });

    expect(
      selectHrisLegalEntitySelector(
        new URLSearchParams('legalEntityPublicId=0199e7d4-7a31-7c20-9a31-211395534f9b')
      ).state
    ).toBe('LEGAL_ENTITY');
  });

  it('removes the legal overlay when returning to tenant scope', () => {
    const routed = replaceHrisLegalEntitySelector(
      new URLSearchParams(
        `contextScopeKey=scope-1&${HRIS_LEGAL_ENTITY_SELECTOR_PARAM}=${LEGAL_ENTITY_ID}`
      ),
      'TENANT'
    );
    expect(routed.get(HRIS_LEGAL_ENTITY_SELECTOR_PARAM)).toBeNull();
    expect(routed.get('contextScopeKey')).toBe('scope-1');
  });

  it('rejects malformed or ambiguous browser selectors', () => {
    expect(
      selectHrisLegalEntitySelector(
        new URLSearchParams(`${HRIS_LEGAL_ENTITY_SELECTOR_PARAM}=not-a-uuid`)
      ).state
    ).toBe('INVALID');
    expect(
      selectHrisLegalEntitySelector(
        new URLSearchParams(
          `${HRIS_LEGAL_ENTITY_SELECTOR_PARAM}=${LEGAL_ENTITY_ID}&${HRIS_LEGAL_ENTITY_SELECTOR_PARAM}=${LEGAL_ENTITY_ID}`
        )
      ).state
    ).toBe('INVALID');
    expect(() =>
      replaceHrisLegalEntitySelector(new URLSearchParams(), 'LEGAL_ENTITY', 'not-a-uuid')
    ).toThrow('valid legal-entity public ID');
  });
});
