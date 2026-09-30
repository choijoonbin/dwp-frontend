import { describe, expect, it } from 'vitest';

import {
  appAssignmentStateLabelKey,
  appDutyLabelKey,
  appPrincipalTypeLabelKey,
  appRequestChannelLabelKey,
  appResponsibilityLabelKey,
  appReviewEvidenceLabelKey,
  appReviewReasonLabelKey,
  appReviewStateLabelKey,
  isKnownAppResponsibility,
} from './app-governance-presentation';

describe('app governance presentation', () => {
  it('maps governed codes and fails closed for unknown values', () => {
    expect(appDutyLabelKey('APPROVAL_DESIGN_DRAFT')).toContain('approvalDesignDraft');
    expect(appDutyLabelKey('FUTURE_INTERNAL_DUTY')).toBe(
      'appGovernance.presentation.duties.managed'
    );
    expect(appReviewReasonLabelKey('FUTURE_REASON')).toBe(
      'appGovernance.presentation.reviewReasons.managed'
    );
  });

  it('never serializes review evidence', () => {
    const evidence = { secret: 'never-render-me' };
    const label = appReviewEvidenceLabelKey(evidence);
    expect(label).toBe('appGovernance.presentation.evidence.retained');
    expect(label).not.toContain('never-render-me');
  });

  it('does not expose unknown actor, channel, or lifecycle codes', () => {
    expect(appPrincipalTypeLabelKey('SERVICE_ACCOUNT')).toContain('.managed');
    expect(appRequestChannelLabelKey('INTERNAL_PIPELINE')).toContain('.managed');
    expect(appAssignmentStateLabelKey('FUTURE_STATE')).toBe('appGovernance.states.UNKNOWN');
    expect(appReviewStateLabelKey('FUTURE_REVIEW')).toBe(
      'appGovernance.presets.reviewStates.UNKNOWN'
    );
    expect(appResponsibilityLabelKey('FUTURE_RESPONSIBILITY')).toBe(
      'appGovernance.responsibilities.UNKNOWN'
    );
    expect(isKnownAppResponsibility('FUTURE_RESPONSIBILITY')).toBe(false);
  });
});
