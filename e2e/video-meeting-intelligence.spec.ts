import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const meetingId = '81000000-0000-0000-0000-000000000091';
const runId = '87000000-0000-0000-0000-000000000091';
const reportId = '88000000-0000-0000-0000-000000000091';
const transcriptId = '84000000-0000-0000-0000-000000000091';
const summary = {
  meetingId,
  title: 'Governed intelligence review',
  description: null,
  agenda: 'Confirm the launch decision, owner, open risk, and next checkpoint.',
  lifecycleState: 'ENDED',
  accessScope: 'INVITED',
  meetingCode: 'AI-EVIDENCE-01',
  startsAt: '2026-08-27T01:00:00Z',
  endsAt: '2026-08-27T01:50:00Z',
  startedAt: '2026-08-27T01:03:00Z',
  endedAt: '2026-08-27T01:45:00Z',
  durationMinutes: 50,
  timeZone: 'Asia/Seoul',
  organizerUserId: 42,
  organizerName: 'Mina Kim',
  waitingRoomEnabled: true,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  attendeeCount: 2,
  participantRole: 'ORGANIZER',
  canHost: true,
  canModerate: true,
  version: 7,
};

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: success(data) });
}

function createDeferredResponse() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function mockMeetingHost(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 42,
    locale: 'en',
    displayName: 'Mina Kim',
    email: 'mina.kim@sk.com',
    permissions: ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
      resourceType: 'APP',
      resourceKey: 'APP.MEETINGS',
      permissionCode,
      effect: 'ALLOW' as const,
    })),
  });
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfill(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'e2e-meeting-intelligence',
      sourceRevisions: {
        auth: 'auth-meeting-intelligence',
        policy: 'policy-meeting-intelligence',
        productRelationship: 'relationship-meeting-intelligence',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-08-27T00:00:00Z',
      contexts: [],
      rollouts: [
        {
          productKey: 'meetings',
          state: '000',
          flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
          cohort: 'baseline',
          opaqueRevision: 'rollout-meeting-intelligence',
          authorityStatus: 'NOT_EVALUATED',
        },
      ],
    })
  );
}

test('host retries one intelligence intent and stale review or publish cannot reopen revoked access', async ({
  page,
}) => {
  await mockMeetingHost(page);
  const transcript = {
    artifactId: transcriptId,
    artifactType: 'TRANSCRIPT',
    artifactState: 'AVAILABLE',
    contentType: 'application/json',
    sizeBytes: 12_480,
    retentionUntil: '2026-09-27T01:50:00Z',
    metadata: {},
    version: 3,
  };
  const analysis = {
    executiveSummary: {
      text: 'The group aligned on a staged launch, with one dependency still open.',
      citations: [{ segmentId: 'seg-12', startMillis: 92_000, endMillis: 118_000 }],
    },
    topics: [
      {
        text: 'Staged launch',
        citations: [{ segmentId: 'seg-12', startMillis: 92_000, endMillis: 118_000 }],
      },
    ],
    decisions: [
      {
        text: 'Launch the pilot on Monday.',
        citations: [{ segmentId: 'seg-18', startMillis: 221_000, endMillis: 238_000 }],
      },
    ],
    actionItems: [
      {
        text: 'Mina will verify capacity.',
        citations: [{ segmentId: 'seg-21', startMillis: 281_000, endMillis: 302_000 }],
      },
    ],
    openQuestions: [
      {
        text: 'Is the regional quota approved?',
        citations: [{ segmentId: 'seg-24', startMillis: 340_000, endMillis: 354_000 }],
      },
    ],
    risks: [
      {
        text: 'Regional quota may delay expansion.',
        citations: [{ segmentId: 'seg-24', startMillis: 340_000, endMillis: 354_000 }],
      },
    ],
    conversationClimate: {
      label: 'MIXED',
      signals: ['CONSTRUCTIVE_DISAGREEMENT'],
      citations: [{ segmentId: 'seg-17', startMillis: 198_000, endMillis: 218_000 }],
    },
  };
  const running = {
    runId,
    meetingId,
    sourceArtifactId: transcriptId,
    state: 'RUNNING',
    analysisProfile: 'meeting-intelligence-v1',
    outputLanguage: 'en',
    processingRegion: 'KR',
    providerCode: 'MANAGED',
    providerModel: 'gpt-enterprise',
    schemaVersion: 'meeting-intelligence-v1',
    requestedAt: '2026-08-27T02:00:00Z',
    completedAt: null,
    failureCode: null,
    version: 0,
    reportId: null,
  };
  const draft = {
    reportId,
    meetingId,
    runId,
    state: 'DRAFT',
    audience: 'PRIVATE_REVIEWERS',
    schemaVersion: 'meeting-intelligence-v1',
    retentionUntil: '2026-09-27T01:50:00Z',
    legalHold: false,
    approvedAt: null,
    publishedAt: null,
    version: 0,
    canCurrentViewerReview: true,
    analysis,
    reviews: [],
  };
  let latest: Record<string, unknown> | null = null;
  let latestAccessRevoked = false;
  let createAttempts = 0;
  let reviewRequested = false;
  let publishRequested = false;
  const reviewResponseGate = createDeferredResponse();
  const publishResponseGate = createDeferredResponse();
  const idempotencyKeys: string[] = [];

  await page.route('**/api/meetings/v1/meetings?*', (route) =>
    fulfill(route, { items: [summary], page: 0, pageSize: 30, total: 1 })
  );
  await page.route(`**/api/meetings/v1/meetings/${meetingId}`, (route) =>
    fulfill(route, {
      ...summary,
      guestAccessEnabled: false,
      provider: 'LIVEKIT',
      participants: [],
      artifacts: [transcript],
      decisions: [],
      followUpActions: [],
      recordingAvailable: false,
      transcriptAvailable: true,
      aiNotesAvailable: false,
    })
  );
  await page.route(`**/api/meetings/v1/meetings/${meetingId}/content-plan`, (route) =>
    fulfill(route, {
      meetingId,
      planId: '85000000-0000-0000-0000-000000000091',
      recordingRequested: false,
      transcriptionRequested: true,
      aiSummaryRequested: true,
      e2eeEnabled: false,
      state: 'READY',
      blockers: [],
      dependencies: {
        egressAvailable: false,
        storageAvailable: true,
        kmsAvailable: true,
        auditAvailable: true,
        speechToTextAvailable: true,
        languageModelAvailable: true,
      },
      notice: null,
      consent: { requiredAcknowledgements: 2, receivedAcknowledgements: 2, complete: true },
      recordingSession: null,
      version: 8,
      updatedAt: '2026-08-27T01:55:00Z',
    })
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingId}/intelligence/reports/latest`,
    (route) =>
      latestAccessRevoked
        ? fulfill(route, { code: 'FORBIDDEN' }, 403)
        : latest
          ? fulfill(route, latest)
          : fulfill(route, { code: 'NOT_FOUND' }, 404)
  );
  await page.route(`**/api/meetings/v1/meetings/${meetingId}/intelligence/runs`, (route) => {
    createAttempts += 1;
    idempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '');
    return createAttempts === 1
      ? fulfill(route, { code: 'UPSTREAM_RESPONSE_LOST' }, 503)
      : fulfill(route, running, 201);
  });
  await page.route(
    `**/api/meetings/v1/meetings/${meetingId}/intelligence/runs/${runId}`,
    (route) => {
      latest = draft;
      return fulfill(route, {
        ...running,
        state: 'SUCCEEDED',
        completedAt: '2026-08-27T02:00:08Z',
        version: 1,
        reportId,
      });
    }
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingId}/intelligence/reports/${reportId}/review`,
    async (route) => {
      reviewRequested = true;
      expect(route.request().postDataJSON()).toMatchObject({
        expectedVersion: 0,
        decision: 'APPROVE',
        reasonCode: 'EVIDENCE_VERIFIED',
      });
      await reviewResponseGate.promise;
      latest = {
        ...draft,
        state: 'APPROVED',
        audience: 'PRIVATE_REVIEWERS',
        approvedAt: '2026-08-27T02:02:00Z',
        version: 1,
      };
      return fulfill(route, latest);
    }
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingId}/intelligence/reports/${reportId}/publish`,
    async (route) => {
      publishRequested = true;
      expect(route.request().postDataJSON()).toEqual({ expectedVersion: 1 });
      await publishResponseGate.promise;
      latest = {
        ...latest,
        state: 'PUBLISHED',
        audience: 'MEETING_PARTICIPANTS',
        publishedAt: '2026-08-27T02:03:00Z',
        version: 2,
      };
      return fulfill(route, latest);
    }
  );

  await page.goto('/meetings/mine');
  await page.getByRole('button', { name: 'Open meeting recap' }).click();
  await page.getByRole('tab', { name: 'Recording, transcript, and AI' }).click();
  await expect(page.getByRole('heading', { name: 'AI meeting intelligence' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate draft' }).click();
  await expect(page.getByText('The action was not completed.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Governed intelligence review' })).toBeVisible();
  await page.getByRole('tab', { name: 'Recording, transcript, and AI' }).click();
  await page.getByRole('button', { name: 'Generate draft' }).click();
  await expect(page.getByText('The group aligned on a staged launch')).toBeVisible();
  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[0]).toBe(idempotencyKeys[1]);
  await expect(page.getByText('Mixed discussion')).toBeVisible();

  const reviewResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/reports/${reportId}/review`)
  );
  await page.getByRole('button', { name: 'Approve draft' }).click();
  await expect.poll(() => reviewRequested).toBe(true);
  latestAccessRevoked = true;
  await page
    .getByRole('region', { name: 'AI meeting intelligence' })
    .getByRole('button', { name: 'Refresh' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'AI meeting intelligence is unavailable' })
  ).toBeVisible();
  reviewResponseGate.release();
  await reviewResponse;
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(
    page.getByRole('heading', { name: 'AI meeting intelligence is unavailable' })
  ).toBeVisible();
  await expect(page.getByText('The group aligned on a staged launch')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Approve draft' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Publish to participants' })).toHaveCount(0);

  latestAccessRevoked = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Publish to participants' })).toBeVisible();

  const publishResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/reports/${reportId}/publish`)
  );
  await page.getByRole('button', { name: 'Publish to participants' }).click();
  await expect.poll(() => publishRequested).toBe(true);
  latestAccessRevoked = true;
  await page
    .getByRole('region', { name: 'AI meeting intelligence' })
    .getByRole('button', { name: 'Refresh' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'AI meeting intelligence is unavailable' })
  ).toBeVisible();
  publishResponseGate.release();
  await publishResponse;
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(
    page.getByRole('heading', { name: 'AI meeting intelligence is unavailable' })
  ).toBeVisible();
  await expect(page.getByText('The group aligned on a staged launch')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Publish to participants' })).toHaveCount(0);

  const revokedAccessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    revokedAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  latestAccessRevoked = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Published', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});
