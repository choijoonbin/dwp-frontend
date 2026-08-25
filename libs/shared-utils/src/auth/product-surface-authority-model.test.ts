import { describe, expect, it } from 'vitest';

import {
  parseProductSurfaceAuthoritySnapshot,
  productSurfaceRefreshDelay,
  productSurfaceServerNow,
  resolveProductRollout,
} from './product-surface-authority-model';

const RECEIVED_AT = Date.parse('2026-08-24T01:00:10Z');

function envelope() {
  return {
    contractVersion: '1',
    decisionRevision: 'psr-7',
    sourceRevisions: { auth: 'auth-4', policy: 'policy-2' },
    activeAccessMode: 'NORMAL',
    generatedAt: '2026-08-24T01:00:00Z',
    contexts: [
      {
        contextKey: 'ctx-communications-work',
        productKey: 'communications',
        surfaceKey: 'communications.work',
        plane: 'work',
        accessMode: 'NORMAL',
        accessSource: 'ENTITLEMENT',
        appResourceKey: 'APP.COMMUNICATIONS',
        effectiveGrants: [
          {
            grantKind: 'POLICY',
            accessPolicyKey: 'communications.work-access.v1',
            policyDecisionRef: 'policy-decision-1',
            authorityMode: 'ENTITLEMENT',
            scopeKeys: ['self'],
            requiresProductEntitlement: true,
            readOnly: false,
          },
        ],
        scopes: [
          {
            key: 'self',
            kind: 'SELF',
            displayName: 'My work',
            isDefault: true,
            readOnly: false,
          },
        ],
        revalidateAt: '2026-08-24T01:01:00Z',
      },
    ],
    rollouts: [
      {
        productKey: 'communications',
        state: '111',
        flags: {
          contextShadow: true,
          capabilityEnforcement: true,
          surfaceUi: true,
        },
        cohort: 'eligible-10',
        opaqueRevision: 'rollout-communications-7',
        authorityStatus: 'AVAILABLE',
      },
    ],
  };
}

describe('product surface authority model', () => {
  it('uses the server clock offset when scheduling the earliest revalidation', () => {
    const snapshot = parseProductSurfaceAuthoritySnapshot(envelope(), RECEIVED_AT);

    expect(snapshot.clockOffsetMs).toBe(-10_000);
    expect(productSurfaceServerNow(snapshot, RECEIVED_AT + 20_000)).toBe(
      Date.parse('2026-08-24T01:00:20Z')
    );
    expect(productSurfaceRefreshDelay(snapshot, RECEIVED_AT + 20_000)).toBe(40_000);
    expect(productSurfaceRefreshDelay(snapshot, RECEIVED_AT + 61_000)).toBe(0);
  });

  it('fails a governed product closed for missing, duplicate, or inconsistent rollout data', () => {
    const missing = parseProductSurfaceAuthoritySnapshot(
      { ...envelope(), rollouts: [] },
      RECEIVED_AT
    );
    const duplicate = parseProductSurfaceAuthoritySnapshot(
      { ...envelope(), rollouts: [envelope().rollouts[0], envelope().rollouts[0]] },
      RECEIVED_AT
    );
    const inconsistent = parseProductSurfaceAuthoritySnapshot(
      {
        ...envelope(),
        rollouts: [
          {
            ...envelope().rollouts[0],
            state: '000',
          },
        ],
      },
      RECEIVED_AT
    );

    expect(resolveProductRollout(missing, 'communications').state).toBe('authority-unavailable');
    expect(resolveProductRollout(duplicate, 'communications').state).toBe('authority-unavailable');
    expect(resolveProductRollout(inconsistent, 'communications').state).toBe(
      'authority-unavailable'
    );
  });

  it('accepts explicit 110 AVAILABLE and NOT_EVALUATED compatibility meanings', () => {
    const snapshot = parseProductSurfaceAuthoritySnapshot(
      {
        ...envelope(),
        rollouts: [
          {
            ...envelope().rollouts[0],
            state: '110',
            flags: {
              contextShadow: true,
              capabilityEnforcement: true,
              surfaceUi: false,
            },
            authorityStatus: 'NOT_EVALUATED',
          },
        ],
      },
      RECEIVED_AT
    );

    expect(resolveProductRollout(snapshot, 'communications')).toMatchObject({
      state: 'ready',
      surfaceUiEvaluation: 'resolved',
      rollout: { state: '110' },
    });

    const availableEnvelope = envelope();
    availableEnvelope.rollouts[0]!.state = '110';
    availableEnvelope.rollouts[0]!.flags.surfaceUi = false;
    const available = parseProductSurfaceAuthoritySnapshot(availableEnvelope, RECEIVED_AT);
    expect(resolveProductRollout(available, 'communications')).toMatchObject({
      state: 'ready',
      surfaceUiEvaluation: 'resolved',
      rollout: { state: '110', authorityStatus: 'AVAILABLE' },
    });
  });

  it('requires AVAILABLE authority for 111 and fails unavailable 110 closed', () => {
    const uiEnabled = envelope();
    uiEnabled.rollouts[0]!.state = '111';
    uiEnabled.rollouts[0]!.flags.surfaceUi = true;
    expect(
      resolveProductRollout(parseProductSurfaceAuthoritySnapshot(uiEnabled), 'communications')
    ).toMatchObject({ state: 'ready', rollout: { authorityStatus: 'AVAILABLE' } });

    for (const [state, authorityStatus] of [
      ['111', 'UNAVAILABLE'],
      ['111', 'NOT_EVALUATED'],
      ['110', 'UNAVAILABLE'],
    ] as const) {
      const invalid = envelope();
      invalid.rollouts[0]!.state = state;
      invalid.rollouts[0]!.flags.surfaceUi = state === '111';
      invalid.rollouts[0]!.authorityStatus = authorityStatus;
      expect(
        resolveProductRollout(parseProductSurfaceAuthoritySnapshot(invalid), 'communications')
      ).toEqual({ state: 'authority-unavailable' });
    }
  });

  it('rejects missing or unknown rollout authority status at the wire parser', () => {
    for (const authorityStatus of [undefined, 'FUTURE_STATUS']) {
      const invalid = envelope() as unknown as {
        rollouts: Array<Record<string, unknown>>;
      };
      invalid.rollouts[0]!.authorityStatus = authorityStatus;
      expect(() => parseProductSurfaceAuthoritySnapshot(invalid, RECEIVED_AT)).toThrow(
        /duplicate or invalid identities/
      );
    }
  });

  it('rejects invalid timestamps instead of relying on the local clock alone', () => {
    const invalid = envelope();
    invalid.contexts[0]!.revalidateAt = 'not-a-server-time';
    expect(() => parseProductSurfaceAuthoritySnapshot(invalid, RECEIVED_AT)).toThrow(
      /context is invalid/
    );
  });

  it('rejects unknown or production-unsupported activation states and foreign scopes', () => {
    const unknownActivation = envelope();
    (unknownActivation.contexts[0]!.effectiveGrants as unknown[]).splice(0, 1, {
      grantKind: 'CAPABILITY',
      capabilityContractKey: 'communications.content.read',
      resolvedCapabilityCode: 'COMMUNICATION_READ',
      authorityMode: 'PERMISSION',
      predicatePolicyKeys: [],
      responsibilityRequirement: 'NOT_REQUIRED',
      scopeKeys: ['self'],
      requiresProductEntitlement: false,
      readOnly: false,
      activationState: 'FUTURE_STATE',
    });
    expect(() => parseProductSurfaceAuthoritySnapshot(unknownActivation, RECEIVED_AT)).toThrow(
      /context is invalid/
    );

    const unsupportedRequired = envelope();
    (unsupportedRequired.contexts[0]!.effectiveGrants as unknown[]).splice(0, 1, {
      grantKind: 'CAPABILITY',
      capabilityContractKey: 'communications.content.publish',
      resolvedCapabilityCode: 'COMMUNICATION_PUBLISH',
      authorityMode: 'PERMISSION',
      predicatePolicyKeys: [],
      responsibilityRequirement: 'REQUIRED',
      responsibility: { code: 'APP_CONFIG_ADMIN', resourceSetKey: 'RS_COMMUNICATIONS' },
      scopeKeys: ['self'],
      requiresProductEntitlement: false,
      readOnly: false,
      activationState: 'REQUIRED',
    });
    expect(() => parseProductSurfaceAuthoritySnapshot(unsupportedRequired, RECEIVED_AT)).toThrow(
      /context is invalid/
    );

    const foreignScope = envelope();
    foreignScope.contexts[0]!.effectiveGrants[0]!.scopeKeys = ['foreign-scope'];
    expect(() => parseProductSurfaceAuthoritySnapshot(foreignScope, RECEIVED_AT)).toThrow(
      /context is invalid/
    );
  });
});
