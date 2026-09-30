import { describe, expect, it } from 'vitest';

import {
  homeStudioAuditActionLabelKey,
  homeStudioAuditOutcomeLabelKey,
  homeStudioAuditTargetLabelKey,
} from './home-studio-audit-presentation';

describe('Home Studio audit presentation', () => {
  it('maps known evidence and fails closed for future values', () => {
    expect(homeStudioAuditActionLabelKey('home-experience.published')).toContain(
      'experiencePublished'
    );
    expect(homeStudioAuditActionLabelKey('internal.secret.action')).toContain('.managed');
    expect(homeStudioAuditTargetLabelKey('INTERNAL_TARGET')).toContain('.managed');
    expect(homeStudioAuditOutcomeLabelKey('FUTURE')).toContain('.unavailable');
  });
});
