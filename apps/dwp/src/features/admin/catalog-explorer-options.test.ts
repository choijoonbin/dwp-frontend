import { describe, expect, it } from 'vitest';

import { APPLICATION_LIFECYCLE_OWNER_QUERY_KEYS } from './catalog-explorer-options';

describe('catalog application owner refresh contract', () => {
  it('includes every owner used by the application lifecycle aggregate', () => {
    expect(APPLICATION_LIFECYCLE_OWNER_QUERY_KEYS).toEqual([
      ['admin', 'app-governance'],
      ['admin', 'tenant-app-adoption', 'projection'],
      ['admin', 'tenant-app-adoption', 'assignments'],
    ]);
  });
});
