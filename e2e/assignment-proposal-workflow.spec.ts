import { expect, test, type Page, type Route } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { mockApprovalHighRiskNetwork } from './support/approval-high-risk';
import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';

import type {
  AssignmentDetail,
  AssignmentProposal,
  AssignmentTimelineEntry,
  PersonDetail,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

const ASSIGNMENT_ID = '9411471a-dfcc-48b7-a2fe-9c3128dac4dd';
const WORKER_ID = 'f249277d-0505-46df-b42b-bd148c5e03bc';
const RELATIONSHIP_ID = '270b817d-5acf-4d89-b344-bbbb85b58de2';
const PROPOSAL_ID = 'a8b0894f-65b8-4b9d-97c8-6d519e97bf4c';
const DESTINATION_ORGANIZATION_ID = '05ffdeef-7325-45be-899b-45cbc3935567';

const PERSON = {
  personId: 'person-mina',
  displayName: 'Mina Kim',
  lifecycleState: 'ACTIVE',
  workerNumber: 'W-1001',
  workerType: 'EMPLOYEE',
  workerStatus: 'ACTIVE',
  assignmentKey: 'ASG-MINA-PRIMARY',
  businessTitle: 'People operations lead',
  organizationId: 'org-people',
  organizationKey: 'PEOPLE',
  organizationName: 'People Operations',
  jobProfileName: 'People operations lead',
  managementLevel: 'MANAGER',
  jobGradeKey: 'G7',
  jobGradeName: 'Grade 7',
  locationKey: 'SEOUL_HQ',
  locationName: 'Seoul HQ',
  workEmail: 'mina.kim@example.invalid',
  profileImageKey: null,
  assignmentEffectiveFrom: '2026-01-01',
  managerPersonId: 'person-manager',
  managerDisplayName: 'Jordan Lee',
  directReportCount: 4,
  dataAccess: {
    classification: 'WORKFORCE',
    workerNumberMasked: false,
    excludedFieldGroups: [],
  },
} satisfies PersonSummary;

const PERSON_DETAIL = {
  person: PERSON,
  originalHireDate: '2020-01-15',
  legalEmployerName: 'SKAX',
  managerAssignmentKey: 'ASG-JORDAN-PRIMARY',
  assignments: [
    {
      assignmentKey: 'ASG-MINA-PRIMARY',
      assignmentStatus: 'ACTIVE',
      primaryAssignment: true,
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: null,
      businessTitle: 'People operations lead',
      organizationName: 'People Operations',
      jobProfileName: 'People operations lead',
      jobGradeName: 'Grade 7',
      locationName: 'Seoul HQ',
      managerAssignmentKey: 'ASG-JORDAN-PRIMARY',
      changeReasonCode: 'PROMOTION',
    },
  ],
  workers: [
    {
      workerId: WORKER_ID,
      workerNumber: 'W-1001',
      workerType: 'EMPLOYEE',
      workerStatus: 'ACTIVE',
      originalHireDate: '2020-01-15',
      workRelationships: [
        {
          workRelationshipId: RELATIONSHIP_ID,
          relationshipKey: 'REL-MINA',
          relationshipType: 'EMPLOYEE',
          primaryRelationship: true,
          startDate: '2020-01-15',
          endDate: null,
          projectedEndDate: null,
          legalEmployerKey: 'SKAX',
          legalEmployerName: 'SKAX',
          legalEmployerCountryCode: 'KR',
          assignments: [
            {
              assignmentId: ASSIGNMENT_ID,
              assignmentKey: 'ASG-MINA-PRIMARY',
              assignmentStatus: 'ACTIVE',
              primaryAssignment: true,
              effectiveStartDate: '2026-01-01',
              effectiveEndDate: null,
              effectiveSequence: 1,
              businessTitle: 'People operations lead',
              organizationId: 'org-people',
              organizationKey: 'PEOPLE',
              organizationName: 'People Operations',
              jobProfileName: 'People operations lead',
              jobGradeName: 'Grade 7',
              locationKey: 'SEOUL_HQ',
              locationName: 'Seoul HQ',
              managerAssignmentKey: 'ASG-JORDAN-PRIMARY',
              changeReasonCode: 'PROMOTION',
            },
          ],
        },
      ],
    },
  ],
} satisfies PersonDetail;

const ASSIGNMENT = {
  assignmentId: ASSIGNMENT_ID,
  workerId: WORKER_ID,
  workRelationshipId: RELATIONSHIP_ID,
  assignmentKey: 'ASG-MINA-PRIMARY',
  workerNumber: 'W-1001',
  personDisplayName: 'Mina Kim',
  assignmentStatus: 'ACTIVE',
  primaryAssignment: true,
  effectiveStartDate: '2026-01-01',
  effectiveEndDate: null,
  organizationId: '976e923a-c1d5-4771-8dc2-e814ce955a18',
  organizationName: 'People Operations',
  jobProfileKey: 'PEOPLE_LEAD',
  jobName: 'People operations lead',
  locationKey: 'SEOUL_HQ',
  locationName: 'Seoul HQ',
  managerAssignmentId: 'e5b97118-8e99-48fb-9442-c08e33409931',
  businessTitle: 'People operations lead',
  workerHours: 40,
  fullTimeEquivalent: 1,
  changeReasonCode: 'PROMOTION',
  workerVersion: 5,
  relationshipVersion: 4,
  assignmentVersion: 3,
} satisfies AssignmentDetail;

const TIMELINE = [
  {
    assignmentId: ASSIGNMENT_ID,
    effectiveStartDate: '2026-01-01',
    effectiveEndDate: null,
    effectiveSequence: 1,
    assignmentStatus: 'ACTIVE',
    businessTitle: 'People operations lead',
    organizationId: ASSIGNMENT.organizationId,
    jobProfileKey: 'PEOPLE_LEAD',
    locationKey: 'SEOUL_HQ',
    managerAssignmentId: ASSIGNMENT.managerAssignmentId,
    changeReasonCode: 'PROMOTION',
    version: 3,
  },
] satisfies AssignmentTimelineEntry[];

function proposal(
  lifecycleState: AssignmentProposal['lifecycleState'],
  version: number
): AssignmentProposal {
  return {
    proposalId: PROPOSAL_ID,
    targetAssignmentId: ASSIGNMENT_ID,
    targetWorkerId: WORKER_ID,
    targetWorkRelationshipId: RELATIONSHIP_ID,
    assignmentKey: 'ASG-MINA-PRIMARY',
    workerNumber: 'W-1001',
    personDisplayName: 'Mina Kim',
    changeType: 'TRANSFER',
    effectiveDate: '2026-11-01',
    reasonCode: 'ORG_REALIGNMENT',
    proposedChanges: { organizationId: DESTINATION_ORGANIZATION_ID },
    lifecycleState,
    validationFindings: [],
    targetWorkerVersion: 5,
    targetRelationshipVersion: 4,
    targetAssignmentVersion: 3,
    version,
    validatedAt: lifecycleState === 'DRAFT' ? null : '2026-10-06T10:01:00Z',
    submittedAt: lifecycleState === 'SUBMITTED' ? '2026-10-06T10:02:00Z' : null,
    cancelledAt: lifecycleState === 'CANCELLED' ? '2026-10-06T10:03:00Z' : null,
    cancellationReason: lifecycleState === 'CANCELLED' ? 'Superseded' : null,
    createdAt: '2026-10-06T10:00:00Z',
    updatedAt: '2026-10-06T10:02:00Z',
  };
}

function error(route: Route, status: number, errorCode: string) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ERROR', message: errorCode, errorCode }),
  });
}

async function mockAssignmentReads(page: Page, timelineFails = false) {
  await page.route('**/api/people/v1/workforce/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/people/v1/workforce/people') {
      return fulfillSuccess(route, {
        items: [PERSON],
        nextCursor: null,
        size: 50,
        hasMore: false,
        asOf: url.searchParams.get('asOf') ?? '2026-10-06',
      });
    }
    if (url.pathname === '/api/people/v1/workforce/people/person-mina') {
      return fulfillSuccess(route, PERSON_DETAIL);
    }
    if (url.pathname === `/api/people/v1/workforce/assignments/${ASSIGNMENT_ID}`) {
      return fulfillSuccess(route, ASSIGNMENT);
    }
    if (url.pathname === `/api/people/v1/workforce/assignments/${ASSIGNMENT_ID}/timeline`) {
      return timelineFails
        ? error(route, 503, 'ASSIGNMENT_TIMELINE_UNAVAILABLE')
        : fulfillSuccess(route, TIMELINE);
    }
    return route.fallback();
  });
}

async function openCreateWorkspace(page: Page) {
  await page.goto('/hr/operations/assignments?q=Mina&status=ACTIVE&person=person-mina');
  await page.getByRole('button', { name: 'Create change proposal' }).click();
  await expect(page).toHaveURL(new RegExp(`proposal=new%3A${ASSIGNMENT_ID}`, 'u'));
  await expect(
    page.getByRole('dialog', { name: 'Create assignment change proposal' })
  ).toBeVisible();
}

async function completeTransferDraft(page: Page) {
  await page.getByRole('textbox', { name: 'Reason code' }).fill('ORG_REALIGNMENT');
  await page
    .getByRole('textbox', { name: 'Destination organization ID' })
    .fill(DESTINATION_ORGANIZATION_ID);
}

test.beforeEach(async ({ page }) => {
  await mockShellSession(page, ['HR_ADMIN'], { permissions: FULL_PRODUCT_PERMISSIONS });
});

test('assignment proposal happy path creates, validates, and submits with lifecycle evidence', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-08-24T00:10:00Z'));
  await mockHcmProductSurfaceAuthority(page);
  await mockAssignmentReads(page);
  const commandHeaders: string[] = [];
  let validateRequests = 0;
  let currentProposal = proposal('DRAFT', 1);
  await page.route('**/api/people/v1/workforce/assignment-proposals**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === 'POST') {
      commandHeaders.push(route.request().headers()['idempotency-key'] ?? '');
    }
    if (path === '/api/people/v1/workforce/assignment-proposals') {
      currentProposal = proposal('DRAFT', 1);
      return fulfillSuccess(route, {
        receiptId: 'receipt-create',
        replayed: false,
        proposal: currentProposal,
      });
    }
    if (path.endsWith('/validate')) {
      validateRequests += 1;
      currentProposal = proposal('VALIDATED', 2);
      return fulfillSuccess(route, {
        receiptId: 'receipt-validate',
        replayed: false,
        proposal: currentProposal,
      });
    }
    if (path === `/api/people/v1/workforce/assignment-proposals/${PROPOSAL_ID}`) {
      return fulfillSuccess(route, currentProposal);
    }
    return route.fallback();
  });
  const highRisk = await mockApprovalHighRiskNetwork(page, {
    commandPath: `/api/people/v1/workforce/assignment-proposals/${PROPOSAL_ID}/submit`,
    commandResult: {
      receiptId: 'receipt-submit',
      replayed: false,
      proposal: proposal('SUBMITTED', 3),
    },
    issuerContinuation: false,
    issuedExpiresAt: ['2026-08-24T00:20:00Z'],
    decisionRevision: 'e2e-hcm-authority-1',
  });

  await openCreateWorkspace(page);
  await completeTransferDraft(page);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page).toHaveURL(new RegExp(`proposal=${PROPOSAL_ID}`, 'u'));
  await page.getByRole('button', { name: 'Validate proposal' }).click();
  await expect.poll(() => validateRequests).toBe(1);
  await expect(page.getByText('Validation passed with no blocking findings.')).toBeVisible();
  await page.getByRole('button', { name: 'Submit proposal' }).click();
  const verification = page.getByRole('dialog', { name: 'Verify this high-risk action' });
  await verification.getByRole('button', { name: 'Verify identity' }).click();
  await expect(verification.getByRole('button', { name: 'Confirm action' })).toBeVisible();
  currentProposal = proposal('SUBMITTED', 3);
  await verification.getByRole('button', { name: 'Confirm action' }).click();

  await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
  await expect(page.getByText('Proposal submitted', { exact: true })).toBeVisible();
  expect(commandHeaders).toHaveLength(2);
  expect(commandHeaders.every(Boolean)).toBe(true);
  expect(highRisk.commandRequests).toHaveLength(1);
  expect(highRisk.commandRequests[0]?.headers).toMatchObject({
    'idempotency-key': expect.any(String),
    'x-dwp-expected-object-version': '2',
    'x-dwp-step-up-challenge': 'e2e-signed-step-up-challenge-1',
  });
});

test('assignment proposal denial stays contained while the assignment register remains usable', async ({
  page,
}) => {
  await mockAssignmentReads(page);
  await page.route(`**/api/people/v1/workforce/assignment-proposals/${PROPOSAL_ID}`, (route) =>
    error(route, 403, 'FORBIDDEN')
  );

  await page.goto(`/hr/operations/assignments?person=person-mina&proposal=${PROPOSAL_ID}`);

  await expect(page.getByText('Mina Kim', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText('This assignment or action is outside your current workforce authority.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit proposal' })).toHaveCount(0);
});

test('assignment proposal conflict refreshes the target version without losing the operator draft', async ({
  page,
}) => {
  let detailReads = 0;
  await mockAssignmentReads(page);
  await page.route(`**/api/people/v1/workforce/assignments/${ASSIGNMENT_ID}`, (route) => {
    detailReads += 1;
    return fulfillSuccess(route, { ...ASSIGNMENT, assignmentVersion: detailReads > 1 ? 4 : 3 });
  });
  await page.route('**/api/people/v1/workforce/assignment-proposals', (route) =>
    error(route, 409, 'OBJECT_VERSION_CONFLICT')
  );

  await openCreateWorkspace(page);
  await completeTransferDraft(page);
  await page.getByRole('button', { name: 'Save draft' }).click();

  await expect(
    page.getByText(
      'The assignment or proposal changed. Current data was refreshed; review it before trying again.'
    )
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Reason code' })).toHaveValue('ORG_REALIGNMENT');
  await expect(page.getByText('Assignment version 4')).toBeVisible();
});

test('assignment timeline partial failure preserves the create action and current assignment', async ({
  page,
}) => {
  await mockAssignmentReads(page, true);
  await openCreateWorkspace(page);
  await completeTransferDraft(page);

  await expect(
    page.getByText('The assignment is available, but its timeline could not be loaded.')
  ).toBeVisible();
  await expect(page.getByText('People Operations', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
});
