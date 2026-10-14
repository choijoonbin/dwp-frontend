import type { Page, Route } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './shell-session';
import { fulfillSuccess } from './shell-session-contracts';

export const COMPPLAN_CENTRAL_ROUTE = '/hr/operations/performance/compensation-planning' as const;

const BASE_PATH = '/api/people/v1/hris/performance/compensation-planning';
const NOW = '2026-10-14T00:40:00Z';
const HASH = '7'.repeat(64);

export const COMPPLAN_CENTRAL_IDS = Object.freeze({
  cycle: '11111111-1111-4111-8111-111111111111',
  proposal: '22222222-2222-4222-8222-222222222222',
  worker: '33333333-3333-4333-8333-333333333333',
  assignment: '44444444-4444-4444-8444-444444444444',
  organization: '55555555-5555-4555-8555-555555555555',
  budgetEntry: '66666666-6666-4666-8666-666666666666',
  roundingPolicy: '77777777-7777-4777-8777-777777777777',
});

export type CompensationPlanningCentralScenario =
  'PROPOSAL_REVIEW' | 'APPROVED' | 'PROPOSALS_UNAVAILABLE' | 'MASKED_DETAIL';

export type CompensationPlanningCentralRequestLog = {
  cycles: number;
  cycleDetail: number;
  proposals: number;
  proposalDetail: number;
  unexpectedCompensationRequests: string[];
  externalRequests: string[];
};

const capabilities = [
  'hcm.compensation.plan.view',
  'hcm.compensation.plan.propose',
  'hcm.compensation.plan.approve',
] as const;

const actionCapability = Object.freeze({
  'route.hcm.operations.compensation-cycle-create.action': 'hcm.compensation.plan.propose',
  'route.hcm.operations.compensation-cycle-revise.action': 'hcm.compensation.plan.propose',
  'route.hcm.operations.compensation-budget-allocate.action': 'hcm.compensation.plan.propose',
  'route.hcm.operations.compensation-proposal-upsert.action': 'hcm.compensation.plan.propose',
  'route.hcm.operations.compensation-proposal-submit.action': 'hcm.compensation.plan.propose',
  'route.hcm.operations.compensation-plan-approve.action': 'hcm.compensation.plan.approve',
  'route.hcm.operations.compensation-snapshot-publish.action': 'hcm.compensation.plan.approve',
  'route.hcm.operations.compensation-cycle-cancel.action': 'hcm.compensation.plan.propose',
});

function capabilityGrant(capabilityContractKey: string) {
  return {
    grantKind: 'CAPABILITY',
    capabilityContractKey,
    resolvedCapabilityCode: capabilityContractKey,
    authorityMode: 'PERMISSION',
    predicatePolicyKeys: [],
    responsibilityRequirement: 'NOT_REQUIRED',
    scopeKeys: ['scope:hcm:compensation-planning'],
    requiresProductEntitlement: false,
    readOnly: false,
    activationState: 'ACTIVE',
    validUntil: null,
  } as const;
}

function compensationContext() {
  return {
    contextKey: 'ctx:hcm:compensation-planning',
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    plane: 'management',
    accessMode: 'NORMAL',
    accessSource: 'MANAGEMENT',
    appResourceKey: 'APP.HCM',
    effectiveGrants: [
      {
        grantKind: 'POLICY',
        accessPolicyKey: 'hcm.operations-access.v1',
        authorityMode: 'ENTITLEMENT',
        policyDecisionRef: 'policy:hcm.operations-access.v1',
        scopeKeys: ['scope:hcm:compensation-planning'],
        requiresProductEntitlement: true,
        readOnly: false,
        validUntil: null,
      },
      ...capabilities.map(capabilityGrant),
    ],
    scopes: [
      {
        key: 'scope:hcm:compensation-planning',
        kind: 'TARGET_POPULATION',
        displayName: 'Synthetic compensation acceptance scope',
        isDefault: true,
        readOnly: false,
        validUntil: null,
      },
    ],
    revalidateAt: '2026-10-15T00:40:00Z',
  } as const;
}

function cycleSummary(status: 'PROPOSAL_REVIEW' | 'APPROVED') {
  return {
    cycleId: COMPPLAN_CENTRAL_IDS.cycle,
    aggregateVersion: status === 'APPROVED' ? 8 : 7,
    cycleCode: 'SYNTH-FY27',
    effectiveFrom: '2027-01-01',
    effectiveTo: null,
    status,
    budgetMasked: true,
  } as const;
}

function cycleDetail(status: 'PROPOSAL_REVIEW' | 'APPROVED') {
  return {
    ...cycleSummary(status),
    budgetMasked: false,
    guidelines: {
      components: [
        {
          componentCode: 'BASE',
          currency: 'KRW',
          minimumAmount: '1000000',
          maximumAmount: '9000000',
          exceptionPolicyCode: 'NO_EXCEPTION',
          roundingPolicyVersionPublicId: COMPPLAN_CENTRAL_IDS.roundingPolicy,
        },
      ],
      budgetMode: 'HARD_CAP',
      effectiveFrom: '2027-01-01',
      effectiveTo: null,
    },
    population: {
      asOf: NOW,
      hrmOwnerRevision: 12,
      lines: [
        {
          workerPublicId: COMPPLAN_CENTRAL_IDS.worker,
          assignmentPublicId: COMPPLAN_CENTRAL_IDS.assignment,
          organizationPublicId: COMPPLAN_CENTRAL_IDS.organization,
          gradePublicId: null,
          jobProfilePublicId: null,
          assignmentOwnerRevision: 3,
          eligibleComponentCodes: ['BASE'],
        },
      ],
    },
    budgetEntries: [
      {
        entryId: COMPPLAN_CENTRAL_IDS.budgetEntry,
        entrySequence: 1,
        organizationPublicId: COMPPLAN_CENTRAL_IDS.organization,
        currency: 'KRW',
        amount: '50000000',
        entryType: 'ALLOCATE',
        sourceEntryPublicId: null,
        createdAt: NOW,
      },
    ],
    budgetAggregates: [
      {
        organizationPublicId: COMPPLAN_CENTRAL_IDS.organization,
        currency: 'KRW',
        allocatedAmount: '50000000',
        committedAmount: '42000000',
        remainingAmount: '8000000',
      },
    ],
  } as const;
}

function maskedCycleDetail(status: 'PROPOSAL_REVIEW' | 'APPROVED') {
  return cycleSummary(status);
}

function proposal(status: 'SUBMITTED' | 'FROZEN') {
  return {
    proposalId: COMPPLAN_CENTRAL_IDS.proposal,
    aggregateVersion: status === 'FROZEN' ? 3 : 2,
    cycleId: COMPPLAN_CENTRAL_IDS.cycle,
    workerId: COMPPLAN_CENTRAL_IDS.worker,
    assignmentId: COMPPLAN_CENTRAL_IDS.assignment,
    componentCode: 'BASE',
    currency: 'KRW',
    effectiveFrom: '2027-01-01',
    effectiveTo: null,
    currentRevision: status === 'FROZEN' ? 2 : 1,
    status,
    contentDigest: HASH,
    amountMasked: true,
  } as const;
}

function failure(route: Route) {
  return route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'ERROR',
      message: 'Synthetic proposal projection is temporarily unavailable.',
      correlationId: '88888888-8888-4888-8888-888888888888',
    }),
  });
}

async function mockCompensationAuthority(page: Page) {
  const context = compensationContext();
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfillSuccess(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'e2e-compplan-central-1',
      sourceRevisions: {
        auth: 'auth-compplan-central-1',
        policy: 'policy-compplan-central-1',
        productRelationship: 'relationship-compplan-central-1',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: NOW,
      contexts: [context],
      rollouts: [
        'approvals',
        'calendar',
        'communications',
        'dwaion',
        'hcm',
        'mail',
        'meetings',
        'messaging',
        'notifications',
        'services',
        'spaces',
        'workplace',
      ].map((productKey) => ({
        productKey,
        state: productKey === 'hcm' ? '111' : '000',
        flags: {
          contextShadow: productKey === 'hcm',
          capabilityEnforcement: productKey === 'hcm',
          surfaceUi: productKey === 'hcm',
        },
        cohort: productKey === 'hcm' ? 'e2e-compplan-central' : null,
        opaqueRevision: `rollout-${productKey}-e2e`,
        authorityStatus: 'AVAILABLE',
      })),
    })
  );
  await page.route('**/api/auth/product-surface-access/evaluate', (route) => {
    const body = route.request().postDataJSON() as { routeContractKey?: string };
    const routeContractKey = body.routeContractKey ?? '';
    const capability = actionCapability[routeContractKey as keyof typeof actionCapability];
    const evaluatedContext = capability
      ? {
          ...context,
          effectiveGrants: context.effectiveGrants.filter(
            (grant) =>
              grant.grantKind === 'CAPABILITY' && grant.capabilityContractKey === capability
          ),
        }
      : context;
    return fulfillSuccess(route, {
      decision: 'ALLOWED',
      reasonCode: null,
      decisionRevision: 'e2e-compplan-central-1',
      context: evaluatedContext,
      routeGrantRef: `grant:${routeContractKey}`,
      scope: context.scopes[0],
      effectiveReadOnly: false,
      validUntil: null,
      revalidateAt: context.revalidateAt,
    });
  });
}

export async function prepareCompensationPlanningCentralAcceptance(
  page: Page,
  scenario: CompensationPlanningCentralScenario,
  locale: 'en' | 'ko' = 'en'
): Promise<CompensationPlanningCentralRequestLog> {
  const log: CompensationPlanningCentralRequestLog = {
    cycles: 0,
    cycleDetail: 0,
    proposals: 0,
    proposalDetail: 0,
    unexpectedCompensationRequests: [],
    externalRequests: [],
  };
  const approved = scenario === 'APPROVED';
  const status = approved ? 'APPROVED' : 'PROPOSAL_REVIEW';
  const proposalItem = proposal(approved ? 'FROZEN' : 'SUBMITTED');

  await page.clock.setFixedTime(new Date(NOW));
  if (locale === 'ko') {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'language', {
        configurable: true,
        get: () => 'ko-KR',
      });
    });
  }
  await mockShellSession(page, ['HR_ADMIN'], {
    locale,
    permissions: [
      ...FULL_PRODUCT_PERMISSIONS,
      {
        resourceType: 'DATA',
        resourceKey: 'DATA.HRIS_COMPENSATION_PLAN',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ],
    appearance: {
      mode: 'system',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockCompensationAuthority(page);

  await page.route(`**${BASE_PATH}/**`, (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      log.unexpectedCompensationRequests.push(`${request.method()} ${path}`);
      return failure(route);
    }
    if (path === `${BASE_PATH}/cycles`) {
      log.cycles += 1;
      return fulfillSuccess(route, {
        items: [cycleSummary(status)],
        nextCursor: null,
        hasMore: false,
        asOf: NOW,
        scopeRevision: 12,
        fieldPolicyRevision: 4,
      });
    }
    if (path === `${BASE_PATH}/cycles/${COMPPLAN_CENTRAL_IDS.cycle}/proposals`) {
      log.proposals += 1;
      if (scenario === 'PROPOSALS_UNAVAILABLE') return failure(route);
      return fulfillSuccess(route, {
        items: [proposalItem],
        nextCursor: null,
        hasMore: false,
        referenceEffectiveAt: NOW,
        freshnessWatermark: NOW,
        fieldPolicyRevision: 4,
      });
    }
    if (path === `${BASE_PATH}/cycles/${COMPPLAN_CENTRAL_IDS.cycle}`) {
      log.cycleDetail += 1;
      return fulfillSuccess(route, {
        item: scenario === 'MASKED_DETAIL' ? maskedCycleDetail(status) : cycleDetail(status),
        referenceEffectiveAt: NOW,
        freshnessWatermark: NOW,
        fieldPolicyRevision: 4,
      });
    }
    if (path === `${BASE_PATH}/proposals/${COMPPLAN_CENTRAL_IDS.proposal}`) {
      log.proposalDetail += 1;
      return fulfillSuccess(route, {
        item: proposalItem,
        referenceEffectiveAt: NOW,
        freshnessWatermark: NOW,
        fieldPolicyRevision: 4,
      });
    }
    log.unexpectedCompensationRequests.push(`${request.method()} ${path}`);
    return failure(route);
  });

  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !loopback) {
      log.externalRequests.push(url.origin);
      return route.abort('blockedbyclient');
    }
    return route.fallback();
  });
  return log;
}
