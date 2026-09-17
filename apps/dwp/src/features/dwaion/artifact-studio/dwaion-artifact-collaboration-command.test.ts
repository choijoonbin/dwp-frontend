import { describe, expect, it } from 'vitest';

import { collaborationPreflightSources } from './dwaion-artifact-collaboration-command';

describe('DWAI.ON artifact collaboration command boundary', () => {
  it('preserves attachment evidence in the team ACL preflight payload', () => {
    const sources = [
      { sourceType: 'WORK_ITEM', reference: 'WK-1042' },
      { sourceType: 'ATTACHMENT', reference: 'secure-attachment-42' },
      { sourceType: 'MAIL', reference: 'mail-7' },
    ] as const;

    expect(collaborationPreflightSources(sources)).toEqual(sources);
    expect(collaborationPreflightSources(sources)).not.toBe(sources);
    expect(sources).toHaveLength(3);
  });
});
