import { describe, expect, it } from 'vitest';

import { auditActorTypeLabelKey, auditSourceLabelKey } from './audit-log-presentation';

describe('audit log presentation', () => {
  it('fails closed for unknown source and actor values', () => {
    expect(auditSourceLabelKey('FUTURE_SOURCE')).toBe('audit.sources.UNKNOWN');
    expect(auditActorTypeLabelKey('FUTURE_ACTOR')).toBe('audit.actorTypes.UNKNOWN');
  });
});
