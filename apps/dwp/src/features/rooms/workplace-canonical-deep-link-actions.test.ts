import { describe, expect, it } from 'vitest';

import { buildWorkplaceCanonicalDeepLink } from './workplace-canonical-deep-link-actions';

describe('Workplace canonical deep links', () => {
  it('keeps only allowlisted find context in deterministic order', () => {
    expect(
      buildWorkplaceCanonicalDeepLink(
        '/workplace/find',
        {
          resource: 'resource-1',
          sites: 'site-1',
          bookingId: 'must-not-leak',
          correlationId: 'must-not-leak',
          v: 1,
        },
        'https://dwp.example'
      )
    ).toBe('https://dwp.example/workplace/find?resource=resource-1&sites=site-1&v=1');
  });

  it('never includes credentials when sharing a guided route', () => {
    expect(
      buildWorkplaceCanonicalDeepLink(
        '/workplace/navigation',
        {
          siteId: 'site-1',
          originPoiId: 'origin-1',
          destinationPoiId: 'destination-1',
          accessible: true,
          passId: 'secret',
          code: 'secret',
        },
        'https://dwp.example/base'
      )
    ).toBe(
      'https://dwp.example/workplace/navigation?accessible=true&destinationPoiId=destination-1&originPoiId=origin-1&siteId=site-1'
    );
  });
});
