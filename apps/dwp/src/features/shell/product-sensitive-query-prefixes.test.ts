import { describe, expect, it } from 'vitest';

import { GOVERNED_PRODUCT_MANIFESTS } from '../../components/product-manifest-registry';
import {
  GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES,
  GOVERNED_PRODUCT_LEGACY_SENSITIVE_QUERY_PREFIXES,
} from './product-sensitive-query-prefixes';

describe('governed product legacy sensitive-query prefixes', () => {
  it('covers every governed product and the HCM legacy data roots', () => {
    expect(Object.keys(GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES).sort()).toEqual(
      GOVERNED_PRODUCT_MANIFESTS.map((manifest) => manifest.id).sort()
    );
    expect(GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES.hcm).toEqual(
      expect.arrayContaining(['hcm', 'hr', 'workforce', 'system-code-set'])
    );
  });

  it('keeps the flattened response-boundary adapter unique', () => {
    expect(new Set(GOVERNED_PRODUCT_LEGACY_SENSITIVE_QUERY_PREFIXES).size).toBe(
      GOVERNED_PRODUCT_LEGACY_SENSITIVE_QUERY_PREFIXES.length
    );
  });
});
