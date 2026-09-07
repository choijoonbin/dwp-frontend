import { describe, expect, it } from 'vitest';

import { workHubPartialCopy } from './work-hub-partial-notice';
import { snapshot } from './work-hub.test-support';

describe('workHubPartialCopy', () => {
  it('distinguishes bounded results, failed sources and a mixed state', () => {
    const bounded = snapshot();
    bounded.completeness = 'PARTIAL';
    bounded.sources[0].hasMore = true;
    expect(workHubPartialCopy(bounded).title).toBe('workHub.partial.boundedTitle');

    const failed = snapshot();
    failed.completeness = 'PARTIAL';
    failed.sources[0].state = 'UNAVAILABLE';
    expect(workHubPartialCopy(failed).title).toBe('workHub.partial.failureTitle');

    failed.sources.push({ ...bounded.sources[0], sourceId: 'services' });
    expect(workHubPartialCopy(failed).title).toBe('workHub.partial.mixedTitle');
  });
});
