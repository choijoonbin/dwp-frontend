import { describe, expect, it } from 'vitest';

import {
  isExclusiveProviderSupportContext,
  parseProductSurfaceAuthoritySnapshot,
  productSurfaceAuthoritySemanticsMatch,
  productSurfaceBackgroundRefreshDelay,
  productSurfaceExpiryDelay,
  productSurfaceLeaseAdvanced,
  productSurfaceRefreshDelay,
  productSurfaceServerNow,
  productSurfaceSnapshotRemainsValid,
  resolveProductRollout,
} from './product-surface-authority-model';
import { PRODUCT_SCOPE_KINDS } from './product-surface-scope-kind';

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
            validUntil: '2026-08-24T01:01:00Z',
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

function providerSupportEnvelope() {
  const candidate = structuredClone(envelope());
  candidate.activeAccessMode = 'PROVIDER_SUPPORT';
  const context = candidate.contexts[0]!;
  context.contextKey = 'ctx-communications-support';
  context.surfaceKey = 'communications.management';
  context.plane = 'management';
  context.accessMode = 'PROVIDER_SUPPORT';
  context.accessSource = 'SUPPORT';
  context.appResourceKey = 'ADMIN.COMMUNICATIONS';
  context.effectiveGrants = [
    {
      grantKind: 'POLICY',
      accessPolicyKey: 'communications.management-entry.v1',
      policyDecisionRef: 'support-decision-1',
      authorityMode: 'SUPPORT_SESSION',
      scopeKeys: ['support-session-1'],
      requiresProductEntitlement: false,
      readOnly: true,
    },
  ];
  context.scopes = [
    {
      key: 'support-session-1',
      kind: 'SUPPORT_SESSION',
      displayName: 'Approved support session',
      isDefault: true,
      readOnly: true,
      validUntil: '2026-08-24T01:01:00Z',
    },
  ];
  return candidate;
}

describe('product surface authority model', () => {
  it('uses the server clock offset when scheduling the earliest revalidation', () => {
    const snapshot = parseProductSurfaceAuthoritySnapshot(envelope(), RECEIVED_AT);

    expect(snapshot.clockOffsetMs).toBe(-10_000);
    expect(productSurfaceServerNow(snapshot, RECEIVED_AT + 20_000)).toBe(
      Date.parse('2026-08-24T01:00:20Z')
    );
    expect(productSurfaceExpiryDelay(snapshot, RECEIVED_AT + 20_000)).toBe(40_000);
    expect(productSurfaceBackgroundRefreshDelay(snapshot, RECEIVED_AT + 20_000)).toBe(30_000);
    expect(productSurfaceRefreshDelay(snapshot, RECEIVED_AT + 20_000)).toBe(40_000);
    expect(productSurfaceSnapshotRemainsValid(snapshot, RECEIVED_AT + 59_999)).toBe(true);
    expect(productSurfaceSnapshotRemainsValid(snapshot, RECEIVED_AT + 60_000)).toBe(false);
    expect(productSurfaceRefreshDelay(snapshot, RECEIVED_AT + 61_000)).toBe(0);
  });

  it('refreshes short-lived authority halfway to expiry without creating an immediate loop', () => {
    const snapshot = parseProductSurfaceAuthoritySnapshot(envelope(), RECEIVED_AT);

    expect(productSurfaceBackgroundRefreshDelay(snapshot, RECEIVED_AT + 57_000)).toBe(1_500);
  });

  it('accepts only a semantic no-op with a strictly advanced lease as a background renewal', () => {
    const previous = parseProductSurfaceAuthoritySnapshot(envelope(), RECEIVED_AT);
    const renewedEnvelope = envelope();
    renewedEnvelope.generatedAt = '2026-08-24T01:00:20Z';
    renewedEnvelope.contexts[0]!.revalidateAt = '2026-08-24T01:01:20Z';
    renewedEnvelope.contexts[0]!.scopes[0]!.validUntil = '2026-08-24T01:01:20Z';
    const previousWithScopeLeaseEnvelope = envelope();
    previousWithScopeLeaseEnvelope.contexts[0]!.scopes[0]!.validUntil = '2026-08-24T01:01:00Z';
    const previousWithScopeLease = parseProductSurfaceAuthoritySnapshot(
      previousWithScopeLeaseEnvelope,
      RECEIVED_AT
    );
    const renewed = parseProductSurfaceAuthoritySnapshot(renewedEnvelope, RECEIVED_AT + 20_000);
    const unchangedLease = parseProductSurfaceAuthoritySnapshot(envelope(), RECEIVED_AT + 20_000);
    const changedAuthorityEnvelope = structuredClone(renewedEnvelope);
    changedAuthorityEnvelope.contexts[0]!.scopes[0]!.readOnly = true;
    const changedAuthority = parseProductSurfaceAuthoritySnapshot(
      changedAuthorityEnvelope,
      RECEIVED_AT + 20_000
    );

    expect(productSurfaceAuthoritySemanticsMatch(previousWithScopeLease, renewed)).toBe(true);
    expect(productSurfaceLeaseAdvanced(previous, renewed)).toBe(true);
    expect(productSurfaceLeaseAdvanced(previous, unchangedLease)).toBe(false);
    expect(productSurfaceAuthoritySemanticsMatch(previous, changedAuthority)).toBe(false);
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

  it('requires context-backed AVAILABLE authority before enabling 110 canary enforcement', () => {
    const availableEnvelope = envelope();
    availableEnvelope.rollouts[0]!.state = '110';
    availableEnvelope.rollouts[0]!.flags.surfaceUi = false;
    const available = parseProductSurfaceAuthoritySnapshot(availableEnvelope, RECEIVED_AT);
    expect(resolveProductRollout(available, 'communications')).toMatchObject({
      state: 'ready',
      surfaceUiEvaluation: 'resolved',
      rollout: { state: '110', authorityStatus: 'AVAILABLE' },
    });

    const notEvaluatedEnvelope = envelope();
    notEvaluatedEnvelope.rollouts[0]!.state = '110';
    notEvaluatedEnvelope.rollouts[0]!.flags.surfaceUi = false;
    notEvaluatedEnvelope.rollouts[0]!.authorityStatus = 'NOT_EVALUATED';
    expect(
      resolveProductRollout(
        parseProductSurfaceAuthoritySnapshot(notEvaluatedEnvelope, RECEIVED_AT),
        'communications'
      )
    ).toEqual({ state: 'authority-unavailable' });
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

  it.each(['TENANT', 'TEAM', 'POLICY_NODE'] as const)(
    'accepts the canonical %s scope kind from the authority wire',
    (kind) => {
      const candidate = envelope();
      candidate.contexts[0]!.scopes[0]!.kind = kind;

      expect(() => parseProductSurfaceAuthoritySnapshot(candidate, RECEIVED_AT)).not.toThrow();
      expect(PRODUCT_SCOPE_KINDS).toContain(kind);
    }
  );

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

  it.each(['110', '111'] as const)(
    'accepts the %s server support DTO only as an exclusive read-only support-session union',
    (state) => {
      const candidate = providerSupportEnvelope();
      candidate.rollouts[0]!.state = state;
      candidate.rollouts[0]!.flags.surfaceUi = state === '111';

      expect(isExclusiveProviderSupportContext(candidate.contexts[0])).toBe(true);
      expect(() => parseProductSurfaceAuthoritySnapshot(candidate, RECEIVED_AT)).not.toThrow();
    }
  );

  it('rejects malformed, mixed, or writable provider support contexts at the wire boundary', () => {
    type SupportEnvelope = ReturnType<typeof providerSupportEnvelope>;
    const mutations: readonly ((candidate: SupportEnvelope) => void)[] = [
      (candidate) => {
        candidate.contexts[0]!.accessSource = 'MANAGEMENT';
      },
      (candidate) => {
        candidate.contexts[0]!.effectiveGrants[0]!.grantKind = 'CAPABILITY';
      },
      (candidate) => {
        candidate.contexts[0]!.effectiveGrants[0]!.authorityMode = 'ENTITLEMENT';
      },
      (candidate) => {
        candidate.contexts[0]!.effectiveGrants[0]!.readOnly = false;
      },
      (candidate) => {
        candidate.contexts[0]!.effectiveGrants[0]!.requiresProductEntitlement = true;
      },
      (candidate) => {
        candidate.contexts[0]!.effectiveGrants[0]!.scopeKeys = [];
      },
      (candidate) => {
        candidate.contexts[0]!.effectiveGrants = [];
      },
      (candidate) => {
        candidate.contexts[0]!.scopes[0]!.readOnly = false;
      },
      (candidate) => {
        candidate.contexts[0]!.scopes[0]!.kind = 'RESOURCE_SET';
      },
      (candidate) => {
        candidate.contexts[0]!.scopes.push({
          ...candidate.contexts[0]!.scopes[0]!,
          displayName: 'Duplicate support scope',
        });
      },
      (candidate) => {
        candidate.contexts[0]!.scopes.push({
          ...candidate.contexts[0]!.scopes[0]!,
          key: 'support-session-2',
          displayName: 'Second default support scope',
        });
        candidate.contexts[0]!.effectiveGrants[0]!.scopeKeys.push('support-session-2');
      },
      (candidate) => {
        candidate.contexts.push({
          ...structuredClone(candidate.contexts[0]!),
          contextKey: 'ctx-mixed-normal',
          surfaceKey: 'communications.work',
          plane: 'work',
          accessMode: 'NORMAL',
        });
      },
    ];

    for (const mutate of mutations) {
      const candidate = providerSupportEnvelope();
      mutate(candidate);
      expect(() => parseProductSurfaceAuthoritySnapshot(candidate, RECEIVED_AT)).toThrow(
        /context is invalid/
      );
    }
  });

  it('rejects support-session authority mixed into a normal access-mode context', () => {
    const candidate = providerSupportEnvelope();
    candidate.activeAccessMode = 'NORMAL';
    candidate.contexts[0]!.accessMode = 'NORMAL';

    expect(() => parseProductSurfaceAuthoritySnapshot(candidate, RECEIVED_AT)).toThrow(
      /context is invalid/
    );
  });
});
