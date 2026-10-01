import { describe, expect, it } from 'vitest';

import {
  auditActivityLabelKey,
  auditActorLabel,
  auditCaseStateLabelKey,
  auditCategoryLabelKey,
  auditClassificationLabelKey,
  auditDomainLabelKey,
  auditEntityRelationshipLabelKey,
  auditFindingStateLabelKey,
  auditOutcomeLabelKey,
  auditSeverityLabelKey,
  auditSlaLabelKey,
  auditSlaColor,
  auditSourceServiceLabelKey,
  strongestAuditClassification,
} from './audit-runtime-presentation';

describe('audit runtime presentation', () => {
  it('maps known audit values to localized labels', () => {
    expect(auditSeverityLabelKey('CRITICAL')).toBe('auditControl.severity.CRITICAL');
    expect(auditOutcomeLabelKey('SUCCESS')).toBe('auditControl.outcome.SUCCESS');
    expect(auditCategoryLabelKey('DATA_ACCESS')).toBe('auditControl.category.DATA_ACCESS');
    expect(auditDomainLabelKey('AI_AUTOMATION')).toBe(
      'auditControl.correlation.domain.AI_AUTOMATION'
    );
    expect(auditClassificationLabelKey('RESTRICTED')).toBe(
      'auditControl.correlation.classification.RESTRICTED'
    );
    expect(auditFindingStateLabelKey('OPEN')).toBe('auditControl.findingStatus.OPEN');
    expect(auditCaseStateLabelKey('CLOSED')).toBe('auditControl.caseStatus.CLOSED');
    expect(auditSlaLabelKey('AT_RISK')).toBe('auditControl.sla.AT_RISK');
    expect(auditActivityLabelKey('TASK_UPDATED')).toBe('auditControl.activity.TASK_UPDATED');
    expect(auditSourceServiceLabelKey('dwp-auth-server')).toBe('auditControl.sourceServices.AUTH');
    expect(auditEntityRelationshipLabelKey('ACTOR')).toBe('auditControl.entity.relationship.ACTOR');
  });

  it('fails closed for future enum values and missing actor identity', () => {
    expect(auditSeverityLabelKey('FUTURE')).toBe('auditControl.severity.UNKNOWN');
    expect(auditOutcomeLabelKey('FUTURE')).toBe('auditControl.outcome.UNKNOWN');
    expect(auditCategoryLabelKey('FUTURE')).toBe('auditControl.category.UNKNOWN');
    expect(auditDomainLabelKey('FUTURE')).toBe('auditControl.correlation.domain.UNKNOWN');
    expect(auditClassificationLabelKey('FUTURE')).toBe(
      'auditControl.correlation.classification.UNKNOWN'
    );
    expect(strongestAuditClassification(['FUTURE'])).toBe('UNKNOWN');
    expect(auditFindingStateLabelKey('FUTURE')).toBe('auditControl.findingStatus.UNKNOWN');
    expect(auditCaseStateLabelKey('FUTURE')).toBe('auditControl.caseStatus.UNKNOWN');
    expect(auditSlaLabelKey('FUTURE')).toBe('auditControl.sla.UNKNOWN');
    expect(auditActivityLabelKey('FUTURE')).toBe('auditControl.activity.UNKNOWN');
    expect(auditSourceServiceLabelKey('future-service')).toBe(
      'auditControl.sourceServices.UNKNOWN'
    );
    expect(auditEntityRelationshipLabelKey('FUTURE')).toBe(
      'auditControl.entity.relationship.UNKNOWN'
    );
    expect(auditSlaColor('FUTURE')).toBe('default');
    expect(auditActorLabel({ actorId: null }, 'Unavailable actor')).toBe('Unavailable actor');
  });
});
