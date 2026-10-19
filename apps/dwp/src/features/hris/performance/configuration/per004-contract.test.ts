import { describe, expect, it } from 'vitest';

import { parsePer004Projection, PER004_ACTION_KEYS } from './per004-contract';

const ID = '12345678-1234-4234-8234-123456789abc';
const CORRELATION = '12345678-1234-4234-8234-123456789abd';
const NOW = '2026-10-19T08:00:00Z';

export function projection(action = true) {
  return {
    projectionVersion: '2', asOf: NOW, variantKey: 'PERFORMANCE',
    queryState: {
      state: 'COMPLETE', scopeDecisionRevision: 'scope-1', freshness: 'CURRENT', nextCursor: null,
      fieldDecisionSummary: { viewCount: 3, maskedCount: 0, omittedCount: 0 },
      partialFailures: [], correlationId: CORRELATION,
      cachePolicy: { authorizationDecisionRevision: 'auth-1',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1', maxAgeSeconds: 0 },
    },
    items: [{
      itemPublicId: ID, title: 'Performance policy', statusCode: 'SIMULATED',
      fieldGroups: {
        POLICY_VERSION: { decision: 'VIEW', value: { policyKey: 'review.policy', revision: 7,
          effectiveFrom: '2026-10-19', effectiveTo: null, status: 'SIMULATED' } },
        PERFORMANCE_POLICY: { decision: 'VIEW', value: { policyKey: 'review.policy', revision: 7,
          effectiveFrom: '2026-10-19', effectiveTo: null, status: 'SIMULATED' } },
        EFFECTIVE_STATUS: { decision: 'VIEW', value: { code: 'SIMULATED', revision: 7 } },
      },
      deepLink: { route: '/hr/settings/performance', resourcePublicId: ID },
      availableActions: action ? [{ actionKey: PER004_ACTION_KEYS[3], method: 'POST',
        targetResourceType: 'REFERENCE_CONFIGURATION_VERSION', targetConfigurationId: ID,
        targetVersion: 7, expectedObjectVersion: 11,
        resolvedHref: `/api/platform/v1/admin/hris/configurations/${ID}/versions/7/submit`,
        idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
        stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED' }] : [],
    }],
  };
}

describe('PER-004 closed projection', () => {
  it('accepts one exact Platform target with submit between simulation and approval', () => {
    const parsed = parsePer004Projection(projection(), 'PERFORMANCE');
    expect(parsed.items[0]?.availableActions[0]?.targetVersion).toBe(7);
    expect(parsed.items[0]?.availableActions[0]?.expectedObjectVersion).toBe(11);
    expect(parsed.items[0]?.availableActions[0]?.actionKey).toBe(PER004_ACTION_KEYS[3]);
  });

  it('rejects browser-derived target substitution, masking with action, extra fields, and bad cardinality', () => {
    const wrongTarget = projection();
    wrongTarget.items[0]!.availableActions[0]!.targetConfigurationId = CORRELATION;
    expect(() => parsePer004Projection(wrongTarget, 'PERFORMANCE')).toThrow();
    const masked = projection();
    masked.items[0]!.fieldGroups.EFFECTIVE_STATUS = { decision: 'MASK', value: null } as never;
    expect(() => parsePer004Projection(masked, 'PERFORMANCE')).toThrow();
    const extra = { ...projection(), tenantId: 42 };
    expect(() => parsePer004Projection(extra, 'PERFORMANCE')).toThrow();
    const empty = projection();
    empty.queryState.state = 'EMPTY';
    expect(() => parsePer004Projection(empty, 'PERFORMANCE')).toThrow();
    const partial = projection(false);
    partial.queryState.state = 'PARTIAL';
    expect(() => parsePer004Projection(partial, 'PERFORMANCE')).toThrow();
  });

  it('keeps IAQ-020 read-only and enforces its distinct route', () => {
    const forms = projection(false);
    forms.variantKey = 'FORMS_SCALES';
    forms.items[0]!.deepLink.route = '/hr/operations/performance/forms-scales';
    forms.items[0]!.fieldGroups = {
      FORM_VERSION: { decision: 'VIEW', value: { key: 'performance.review.form',
        version: 'template-1', digest: 'a'.repeat(64) } },
      RATING_SCALE: { decision: 'VIEW', value: { publicId: ID, code: 'RATING_SCALE',
        label: 'Five-level rating', revision: 1 } },
      POLICY_STATUS: { decision: 'VIEW', value: { code: 'READY', revision: 1 } },
    } as never;
    expect(parsePer004Projection(forms, 'FORMS_SCALES').items[0]?.availableActions).toEqual([]);
    forms.items[0]!.availableActions = projection().items[0]!.availableActions;
    expect(() => parsePer004Projection(forms, 'FORMS_SCALES')).toThrow();
  });

  it('rejects nested field smuggling and raw terminal create actions', () => {
    const smuggled = projection(false);
    smuggled.items[0]!.fieldGroups.PERFORMANCE_POLICY.value = {
      policyKey: 'review.policy', revision: 7, effectiveFrom: '2026-10-19',
      effectiveTo: null, status: 'SIMULATED', ownerPayload: { secret: true },
    } as never;
    expect(() => parsePer004Projection(smuggled, 'PERFORMANCE')).toThrow();
    const terminal = projection();
    terminal.items[0]!.statusCode = 'PUBLISHED';
    terminal.items[0]!.availableActions[0]!.actionKey = PER004_ACTION_KEYS[0] as never;
    terminal.items[0]!.availableActions[0]!.targetResourceType = 'REFERENCE_CONFIGURATION';
    terminal.items[0]!.availableActions[0]!.resolvedHref =
      `/api/platform/v1/admin/hris/configurations/${ID}/versions`;
    delete (terminal.items[0]!.availableActions[0]! as { targetVersion?: number }).targetVersion;
    delete (terminal.items[0]!.availableActions[0]! as { expectedObjectVersion?: number }).expectedObjectVersion;
    expect(() => parsePer004Projection(terminal, 'PERFORMANCE')).toThrow();
  });

  it('never renders stale or unavailable evidence as complete', () => {
    const stale = projection(false);
    stale.queryState.freshness = 'STALE';
    expect(() => parsePer004Projection(stale, 'PERFORMANCE')).toThrow('PER004_CONTRACT_INVALID');
    const unavailable = projection(false);
    unavailable.queryState.freshness = 'UNAVAILABLE';
    expect(() => parsePer004Projection(unavailable, 'PERFORMANCE')).toThrow('PER004_CONTRACT_INVALID');
    const partialCurrent = projection(false);
    partialCurrent.queryState.state = 'PARTIAL';
    partialCurrent.queryState.partialFailures = [{ componentKey: 'platform', errorCode: 'UNAVAILABLE',
      correlationId: CORRELATION, retryable: true }] as never;
    expect(() => parsePer004Projection(partialCurrent, 'PERFORMANCE')).toThrow('PER004_CONTRACT_INVALID');
  });

  it('accepts only a Platform-bound synthetic create without invented owner fields', () => {
    const candidate = projection(false);
    candidate.items[0]!.statusCode = 'NO_MUTABLE_VERSION_AND_CREATE_ELIGIBLE';
    candidate.items[0]!.fieldGroups = {} as never;
    candidate.queryState.fieldDecisionSummary = { viewCount: 0, maskedCount: 0, omittedCount: 3 };
    candidate.items[0]!.availableActions = [{ actionKey: PER004_ACTION_KEYS[0], method: 'POST',
      targetResourceType: 'REFERENCE_CONFIGURATION', targetConfigurationId: ID,
      resolvedHref: `/api/platform/v1/admin/hris/configurations/${ID}/versions`,
      idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
      stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED' }] as never;
    expect(parsePer004Projection(candidate, 'PERFORMANCE').items[0]?.availableActions).toHaveLength(1);
    candidate.items[0]!.availableActions[0]!.actionKey = PER004_ACTION_KEYS[3] as never;
    expect(() => parsePer004Projection(candidate, 'PERFORMANCE')).toThrow();
  });
});
