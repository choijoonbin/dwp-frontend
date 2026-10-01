import { describe, expect, it } from 'vitest';

import {
  referenceActivityActionLabelKey,
  referenceActivityActorLabelKey,
  referenceActivityOutcomeLabelKey,
} from './reference-data-activity-presentation';

describe('reference data activity presentation', () => {
  it('fails closed for unknown audit values', () => {
    expect(referenceActivityActionLabelKey('internal.future')).toContain('.UNKNOWN');
    expect(referenceActivityActorLabelKey('FUTURE')).toContain('unknownActor');
    expect(referenceActivityOutcomeLabelKey('FUTURE')).toContain('.UNKNOWN');
  });
});
